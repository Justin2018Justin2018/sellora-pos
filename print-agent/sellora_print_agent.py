#!/usr/bin/env python3
"""
Sellora Cyber Print Agent (Windows)

Runs on each Cyber PC (or on the PC the printer is attached to). It watches the Windows Print Spooler and
reports REAL job activity to Sellora's Supabase through two restricted functions:
    print_agent_heartbeat  - PC + printer status, returns cancel requests
    print_agent_report_job - one job's state (idempotent by job_hash; never goes backwards)
It has no table access. It authenticates with the per-PC security key from config.json.

Architecture:  Sellora Cyber -> Supabase <- THIS AGENT -> Windows Print Spooler -> Printer

Requirements (Windows):  Python 3.9+   and   pip install pywin32
Run:                     python sellora_print_agent.py            (or put a shortcut in shell:startup)

Honest limits (see README.md): Windows reports a job as "gone from the queue", not "paper came out".
Completion is recorded as completed only when the spooler showed all pages printed; otherwise the job is
left as 'printing' with completion_evidence='queue_exit_unconfirmed' and staff confirm it in Print Monitor,
unless config "trust_queue_exit" is true.
"""
import json, os, sys, time, socket, getpass, hashlib, urllib.request, urllib.error
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
OUTBOX_PATH = os.path.join(HERE, "outbox.jsonl")   # reports that could not be sent (offline) - replayed later

# ---- Windows spooler constants (winspool.h) ----
JOB_STATUS_PAUSED, JOB_STATUS_ERROR, JOB_STATUS_DELETING, JOB_STATUS_SPOOLING = 0x1, 0x2, 0x4, 0x8
JOB_STATUS_PRINTING, JOB_STATUS_OFFLINE, JOB_STATUS_PAPEROUT, JOB_STATUS_PRINTED = 0x10, 0x20, 0x40, 0x80
JOB_STATUS_DELETED, JOB_STATUS_BLOCKED_DEVQ, JOB_STATUS_USER_INTERVENTION, JOB_STATUS_RESTART = 0x100, 0x200, 0x400, 0x800
PRINTER_STATUS_PAUSED, PRINTER_STATUS_ERROR, PRINTER_STATUS_PENDING_DELETION = 0x1, 0x2, 0x4
PRINTER_STATUS_PAPER_JAM, PRINTER_STATUS_PAPER_OUT, PRINTER_STATUS_MANUAL_FEED = 0x8, 0x10, 0x20
PRINTER_STATUS_PAPER_PROBLEM, PRINTER_STATUS_OFFLINE, PRINTER_STATUS_IO_ACTIVE = 0x40, 0x80, 0x100
PRINTER_STATUS_BUSY, PRINTER_STATUS_PRINTING = 0x200, 0x400
PRINTER_STATUS_OUTPUT_BIN_FULL, PRINTER_STATUS_NOT_AVAILABLE = 0x800, 0x1000
PRINTER_STATUS_DOOR_OPEN, PRINTER_STATUS_NO_TONER, PRINTER_STATUS_USER_INTERVENTION = 0x400000, 0x40000, 0x100000
PRINTER_ATTRIBUTE_WORK_OFFLINE = 0x400
DM_COLOR, DMCOLOR_COLOR, DMCOLOR_MONOCHROME = 0x800, 2, 1

PAPER_NAMES = {9: "A4", 8: "A3", 11: "A5", 1: "Letter", 5: "Legal", 7: "Executive"}


def utcnow_iso():
    return datetime.now(timezone.utc).isoformat()


def map_printer_status(status, attributes):
    """-> (state, detail). state is one of ready|printing|offline|error|paper_out. Never invents: flags in, label out."""
    flags = []
    names = [("PAUSED", PRINTER_STATUS_PAUSED), ("ERROR", PRINTER_STATUS_ERROR), ("PAPER_JAM", PRINTER_STATUS_PAPER_JAM),
             ("PAPER_OUT", PRINTER_STATUS_PAPER_OUT), ("PAPER_PROBLEM", PRINTER_STATUS_PAPER_PROBLEM),
             ("OFFLINE", PRINTER_STATUS_OFFLINE), ("NOT_AVAILABLE", PRINTER_STATUS_NOT_AVAILABLE),
             ("DOOR_OPEN", PRINTER_STATUS_DOOR_OPEN), ("NO_TONER", PRINTER_STATUS_NO_TONER),
             ("USER_INTERVENTION", PRINTER_STATUS_USER_INTERVENTION), ("OUTPUT_BIN_FULL", PRINTER_STATUS_OUTPUT_BIN_FULL),
             ("BUSY", PRINTER_STATUS_BUSY), ("PRINTING", PRINTER_STATUS_PRINTING)]
    for n, bit in names:
        if status & bit:
            flags.append(n)
    if attributes & PRINTER_ATTRIBUTE_WORK_OFFLINE:
        flags.append("WORK_OFFLINE")
    detail = ",".join(flags) or "none"
    if "WORK_OFFLINE" in flags or status & (PRINTER_STATUS_OFFLINE | PRINTER_STATUS_NOT_AVAILABLE):
        return "offline", detail
    if status & (PRINTER_STATUS_PAPER_OUT):
        return "paper_out", detail
    if status & (PRINTER_STATUS_ERROR | PRINTER_STATUS_PAPER_JAM | PRINTER_STATUS_PAPER_PROBLEM | PRINTER_STATUS_DOOR_OPEN |
                 PRINTER_STATUS_NO_TONER | PRINTER_STATUS_USER_INTERVENTION | PRINTER_STATUS_PAUSED | PRINTER_STATUS_OUTPUT_BIN_FULL):
        return "error", detail
    if status & (PRINTER_STATUS_PRINTING | PRINTER_STATUS_BUSY | PRINTER_STATUS_IO_ACTIVE):
        return "printing", detail
    return "ready", detail


def map_job_state(job_status):
    """Spooler job flags -> (state, error_text|None) for a job STILL in the queue."""
    if job_status & JOB_STATUS_DELETING or job_status & JOB_STATUS_DELETED:
        return "deleting", None
    problems = []
    for n, bit in (("ERROR", JOB_STATUS_ERROR), ("PAPEROUT", JOB_STATUS_PAPEROUT), ("OFFLINE", JOB_STATUS_OFFLINE),
                   ("USER_INTERVENTION", JOB_STATUS_USER_INTERVENTION), ("BLOCKED_DEVQ", JOB_STATUS_BLOCKED_DEVQ)):
        if job_status & bit:
            problems.append(n)
    if job_status & JOB_STATUS_PRINTING:
        return "printing", ("spooler: " + ",".join(problems)) if problems else None
    return "queued", ("spooler: " + ",".join(problems)) if problems else None


def file_type_of(doc_name):
    base = (doc_name or "").rsplit("\\", 1)[-1].rsplit("/", 1)[-1]
    if "." in base:
        ext = base.rsplit(".", 1)[-1].lower()
        if 1 <= len(ext) <= 5 and ext.isalnum():
            return ext
    return None


class Tracker:
    """Pure state machine (no Windows or network): turns successive spooler snapshots into job reports."""

    def __init__(self, computer_id, windows_user, trust_queue_exit=False):
        self.computer_id = computer_id
        self.windows_user = windows_user
        self.trust = trust_queue_exit
        self.known = {}  # key -> dict(last state info)
        self.cancelled = set()  # job hashes this agent cancelled on staff request

    def _hash(self, printer, job):
        raw = "%s|%s|%s|%s" % (self.computer_id, printer, job["job_id"], job.get("submitted", ""))
        return "agent:" + hashlib.sha1(raw.encode("utf-8")).hexdigest()

    def observe(self, printer, jobs, printer_ok=True):
        """jobs: list of dicts {job_id, document, total_pages, pages_printed, status, user, submitted, color, paper, copies}.
        Returns a list of report dicts to send."""
        out, seen = [], set()
        for j in jobs:
            h = self._hash(printer, j)
            seen.add(h)
            state, err = map_job_state(j["status"])
            rec = self.known.get(h)
            base = {
                "job_hash": h, "printer_name": printer, "document_name": j.get("document"),
                "file_type": file_type_of(j.get("document")), "windows_user": j.get("user") or self.windows_user,
                "pages": j.get("total_pages") or None, "copies": j.get("copies"),
                "color_mode": j.get("color") or "unknown", "paper_size": j.get("paper"),
            }
            if state == "deleting":
                if not rec or not rec.get("deleting"):
                    self.known[h] = dict(rec or {}, printer=printer, deleting=True, last=j, base=base)
                continue  # final outcome is decided when the job leaves the queue
            snapshot = (state, err, j.get("pages_printed"), j.get("total_pages"))
            if not rec or rec.get("snapshot") != snapshot:
                rep = dict(base, status=state, error_message=err, detected_at=rec.get("detected_at") if rec else utcnow_iso())
                if state == "printing":
                    rep["started_at"] = (rec or {}).get("started_at") or utcnow_iso()
                out.append(rep)
                self.known[h] = {"printer": printer, "snapshot": snapshot, "last": j, "base": base, "err": err,
                                 "detected_at": rep["detected_at"], "started_at": rep.get("started_at"),
                                 "max_printed": max(j.get("pages_printed") or 0, (rec or {}).get("max_printed", 0)), "deleting": False}
            else:
                rec["last"] = j
                rec["max_printed"] = max(rec.get("max_printed", 0), j.get("pages_printed") or 0)
        # jobs that left the queue
        if printer_ok:
            for h in [k for k, v in self.known.items() if v["printer"] == printer and k not in seen]:
                rec = self.known.pop(h)
                out.append(self._finish(h, rec))
        return out

    def _finish(self, h, rec):
        last, base = rec["last"], rec["base"]
        total = last.get("total_pages") or 0
        printed = rec.get("max_printed", 0)
        done = dict(base, job_hash=h, completed_at=utcnow_iso())
        if h in self.cancelled or rec.get("deleting"):
            self.cancelled.discard(h)
            return dict(done, status="cancelled", error_message="Deleted from the Windows print queue")
        if rec.get("err"):
            return dict(done, status="failed", error_message=rec["err"] + " (job left the queue after a spooler problem)")
        if total and printed >= total:
            return dict(done, status="completed", completion_evidence="pages_printed")
        if self.trust:
            return dict(done, status="completed", completion_evidence="queue_exit")
        # Left the queue with no proof pages printed: do NOT claim completed.
        return dict(done, status="printing", completion_evidence="queue_exit_unconfirmed")


class Api:
    def __init__(self, cfg):
        self.base = cfg["supabase_url"].rstrip("/")
        self.key = cfg["anon_key"]
        self.cid = cfg["computer_id"]
        self.secret = cfg["security_key"]

    def rpc(self, fn, body, timeout=15):
        req = urllib.request.Request(
            "%s/rest/v1/rpc/%s" % (self.base, fn), data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"apikey": self.key, "Authorization": "Bearer " + self.key, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt else None

    def heartbeat(self, windows_user, ip, printers):
        return self.rpc("print_agent_heartbeat", {"p_computer_id": self.cid, "p_key": self.secret,
                                                  "p_windows_user": windows_user, "p_ip": ip, "p_printers": printers})

    def report(self, job):
        return self.rpc("print_agent_report_job", {"p_computer_id": self.cid, "p_key": self.secret, "p_job": job})


class Outbox:
    """Offline spool: reports that failed to send are kept on disk and replayed in order. Idempotent server-side."""

    def __init__(self, path):
        self.path = path

    def add(self, rep):
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rep) + "\n")

    def drain(self, send):
        if not os.path.exists(self.path):
            return 0
        with open(self.path, "r", encoding="utf-8") as f:
            lines = [l for l in f.read().splitlines() if l.strip()]
        sent, keep = 0, []
        for i, l in enumerate(lines):
            try:
                send(json.loads(l))
                sent += 1
            except urllib.error.HTTPError as e:
                if 400 <= e.code < 500:  # permanent (bad payload / auth) - drop only definite client errors except auth
                    if e.code in (401, 403):
                        keep = lines[i:]; break
                    continue
                keep = lines[i:]; break
            except Exception:
                keep = lines[i:]; break
        if keep:
            with open(self.path, "w", encoding="utf-8") as f:
                f.write("\n".join(keep) + "\n")
        else:
            try: os.remove(self.path)
            except OSError: pass
        return sent


# ---------------- Windows backend (needs pywin32) ----------------
class WindowsSpooler:
    def __init__(self, include, exclude):
        import win32print  # noqa
        self.w = win32print
        self.include = [x.lower() for x in include]
        self.exclude = [x.lower() for x in exclude]

    def _wanted(self, name):
        n = name.lower()
        if self.include and not any(i in n for i in self.include):
            return False
        return not any(e in n for e in self.exclude)

    def printers(self):
        w = self.w
        flags = w.PRINTER_ENUM_LOCAL | w.PRINTER_ENUM_CONNECTIONS
        return [p for p in w.EnumPrinters(flags, None, 2) if self._wanted(p["pPrinterName"])]

    def snapshot(self):
        """-> list of (name, status_state, detail, queue_len, connection, jobs[] , ok)"""
        w, res = self.w, []
        for p in self.printers():
            name = p["pPrinterName"]
            state, detail = map_printer_status(p.get("Status", 0), p.get("Attributes", 0))
            port = (p.get("pPortName") or "").upper()
            conn = "usb" if port.startswith("USB") else ("network" if port.startswith(("IP_", "WSD", "\\\\")) or "." in port else "unknown")
            jobs, ok = [], True
            try:
                h = w.OpenPrinter(name)
                try:
                    for j in w.EnumJobs(h, 0, -1, 2):
                        dm = j.get("pDevMode")
                        color = paper = copies = None
                        if dm is not None:
                            try:
                                if dm.Fields & DM_COLOR:
                                    color = "color" if dm.Color == DMCOLOR_COLOR else "bw" if dm.Color == DMCOLOR_MONOCHROME else None
                                paper = PAPER_NAMES.get(dm.PaperSize)
                                copies = dm.Copies or None
                            except Exception:
                                pass
                        sub = j.get("Submitted")
                        jobs.append({"job_id": j["JobId"], "document": j.get("pDocument"), "total_pages": j.get("TotalPages"),
                                     "pages_printed": j.get("PagesPrinted"), "status": j.get("Status", 0), "user": j.get("pUserName"),
                                     "submitted": sub.isoformat() if hasattr(sub, "isoformat") else str(sub),
                                     "color": color, "paper": paper, "copies": copies})
                finally:
                    w.ClosePrinter(h)
            except Exception:
                ok = False  # could not read the queue: don't treat missing jobs as finished
            res.append((name, state if ok else "unknown", detail if ok else "queue unreadable", len(jobs), conn, jobs, ok))
        return res

    def cancel(self, printer, job_id):
        w = self.w
        h = w.OpenPrinter(printer)
        try:
            w.SetJob(h, job_id, 0, None, w.JOB_CONTROL_DELETE)
        finally:
            w.ClosePrinter(h)


def load_config():
    if not os.path.exists(CONFIG_PATH):
        sys.exit("config.json not found next to the agent. Download it from Sellora > Print Monitor > Cyber Computers.")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    for k in ("supabase_url", "anon_key", "computer_id", "security_key"):
        if not cfg.get(k):
            sys.exit("config.json is missing '%s'" % k)
    return cfg


def my_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return None


def run(cfg, spooler, api, outbox, sleep=time.sleep, iterations=None, log=print):
    user = getpass.getuser()
    tracker = Tracker(cfg["computer_id"], user, cfg.get("trust_queue_exit", False))
    poll, hb = float(cfg.get("poll_seconds", 1.0)), float(cfg.get("heartbeat_seconds", 30))
    last_hb, n = 0.0, 0
    job_index = {}  # job_hash -> (printer, job_id) for cancel requests
    while iterations is None or n < iterations:
        n += 1
        snap = spooler.snapshot()
        reports = []
        for (name, st, detail, qlen, conn, jobs, ok) in snap:
            reports += tracker.observe(name, jobs, printer_ok=ok)
            for j in jobs:
                job_index[tracker._hash(name, j)] = (name, j["job_id"])
        # send in order; on failure keep everything (and the rest) for later - never lose a report
        for rep in reports:
            outbox.add(rep)
        try:
            outbox.drain(api.report)
        except Exception as e:
            log("report error: %s" % e)
        if time.time() - last_hb >= hb or iterations is not None:
            printers = [{"name": s[0], "status": s[1], "status_detail": s[2], "queue_length": s[3], "connection": s[4]} for s in snap]
            try:
                resp = api.heartbeat(user, my_ip(), printers) or {}
                last_hb = time.time()
                for h in resp.get("cancel_job_hashes", []):
                    if h in job_index:
                        try:
                            spooler.cancel(*job_index[h]); tracker.cancelled.add(h); log("cancelled spooler job for %s" % h)
                        except Exception as e:
                            log("cancel failed: %s" % e)
            except Exception as e:
                log("heartbeat error (offline? reports are queued): %s" % e)
        sleep(poll)


def main():
    cfg = load_config()
    if sys.platform != "win32":
        sys.exit("This agent reads the Windows Print Spooler and must run on Windows.")
    spooler = WindowsSpooler(cfg.get("printer_filter", []), cfg.get("printer_exclude", []))
    run(cfg, spooler, Api(cfg), Outbox(OUTBOX_PATH))


if __name__ == "__main__":
    main()
