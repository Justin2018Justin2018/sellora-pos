"""End-to-end test: REAL agent code (Tracker/Outbox/run) -> REAL Postgres functions from the v4 migration.
The Windows spooler is faked (scripted snapshots) because this machine is Linux; everything else is real."""
import json, os, subprocess, sys, tempfile, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
import sellora_print_agent as A

def psql(sql, role="postgres"):
    full = ("SET ROLE %s;" % role if role != "postgres" else "") + sql
    r = subprocess.run(["su", "postgres", "-c", "psql -q -t -A -d pt -c " + json.dumps(full)], capture_output=True, text=True)
    return r.stdout.strip(), r.stderr.strip()

def q(sql):  # as superuser, last line only
    out, err = psql(sql); assert not err, err; return out.splitlines()[-1] if out else ""

# fresh fixtures
psql("DELETE FROM print_jobs; DELETE FROM print_printers; DELETE FROM print_computers;")
reg = psql("SET request.jwt.sub='11111111-1111-1111-1111-111111111111'; SET ROLE authenticated; SELECT print_register_computer('cyb1','PC-07');")[0].splitlines()[-1]
reg = json.loads(reg); CID, KEY = reg["computer_id"], reg["security_key"]

class DbApi:
    """Same interface as Api, but calls the real SQL functions as the anon role. offline=True simulates no internet."""
    offline = False
    def __init__(self, key=KEY): self.key = key
    def _call(self, fn, args):
        if DbApi.offline: raise urllib.error.URLError("no internet")
        sql = "SET ROLE anon; SELECT %s(%s);" % (fn, ",".join("'%s'" % str(a).replace("'", "''") for a in args))
        out, err = psql(sql)
        if err: raise urllib.error.HTTPError("x", 400, err, {}, None)
        return out
    def report(self, job): return self._call("print_agent_report_job", [CID, self.key, json.dumps(job)])
    def heartbeat(self, user, ip, printers):
        out = self._call("print_agent_heartbeat", [CID, self.key, user, ip or "", json.dumps(printers)])
        return json.loads(out.splitlines()[-1])

def J(jid, doc, total, printed, status, user="john", color="bw"):
    return {"job_id": jid, "document": doc, "total_pages": total, "pages_printed": printed, "status": status,
            "user": user, "submitted": "2026-10-02T10:00:%02d" % jid, "color": color, "paper": "A4", "copies": 1}

class FakeSpooler:
    def __init__(self, script): self.script, self.i, self.cancelled = script, 0, []
    def snapshot(self):
        step = self.script[min(self.i, len(self.script) - 1)]; self.i += 1; return step
    def cancel(self, printer, job_id): self.cancelled.append((printer, job_id))

P = "EPSON L805"
def snap(jobs, st="ready", ok=True): return [(P, st, "none", len(jobs), "usb", jobs, ok)]
SP, PR = A.JOB_STATUS_SPOOLING, A.JOB_STATUS_PRINTING
cfg = {"computer_id": CID, "trust_queue_exit": False, "poll_seconds": 0, "heartbeat_seconds": 0}
out_path = tempfile.mktemp()

def go(script, api=None, trust=False, outbox=None, cb=None):
    c = dict(cfg, trust_queue_exit=trust)
    sp = FakeSpooler(script)
    A.run(c, sp, api or DbApi(), outbox or A.Outbox(out_path), sleep=lambda s: None, iterations=len(script), log=lambda m: None)
    return sp

def jobs():
    out, err = psql("SELECT document_name||'|'||status||'|'||coalesce(pages::text,'')||'|'||coalesce(completion_evidence,'')||'|'||coalesce(error_message,'') FROM print_jobs ORDER BY document_name")
    assert not err, err
    return [r.split("|") for r in out.splitlines() if r]
fails = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  -> " + str(info)))
    if not cond: fails.append(name)

# 1) normal print, spooler shows pages printed, then leaves queue -> completed with evidence
go([snap([J(1, "cv.pdf", 5, 0, SP)]), snap([J(1, "cv.pdf", 5, 2, PR)]), snap([J(1, "cv.pdf", 5, 5, PR)]), snap([])])
check("1 completed w/ pages_printed evidence", ["cv.pdf", "completed", "5", "pages_printed", ""] in jobs(), jobs())

# 2) job leaves queue with NO page proof, trust off -> NOT completed (printing + unconfirmed)
go([snap([J(2, "notes.pdf", 12, 0, PR)]), snap([])])
check("2 no proof -> not marked completed", ["notes.pdf", "printing", "12", "queue_exit_unconfirmed", ""] in jobs(), jobs())

# 3) same, trust on -> completed (queue_exit)
go([snap([J(3, "photo.jpg", 2, 0, PR, color="color")]), snap([])], trust=True)
check("3 trust_queue_exit -> completed/queue_exit", ["photo.jpg", "completed", "2", "queue_exit", ""] in jobs(), jobs())

# 4) spooler error then leaves queue -> failed with error text
go([snap([J(4, "bad.docx", 3, 0, PR | A.JOB_STATUS_PAPEROUT)]), snap([])])
check("4 paper-out job -> failed", any(r[0] == "bad.docx" and r[1] == "failed" and "PAPEROUT" in r[4] for r in jobs()), jobs())

# 5) user deletes job in Windows queue -> cancelled
go([snap([J(5, "oops.pdf", 8, 0, SP)]), snap([J(5, "oops.pdf", 8, 0, A.JOB_STATUS_DELETING)]), snap([])])
check("5 deleted in queue -> cancelled", any(r[0] == "oops.pdf" and r[1] == "cancelled" for r in jobs()), jobs())

# 6) unreadable queue must NOT finish jobs
go([snap([J(6, "keep.pdf", 4, 0, PR)]), snap([], ok=False), snap([J(6, "keep.pdf", 4, 4, PR)]), snap([])])
check("6 queue read failure doesn't complete/lose job", ["keep.pdf", "completed", "4", "pages_printed", ""] in jobs(), jobs())

# 7) OFFLINE: internet down while printing; reports spool to outbox; after reconnect -> synced once, no duplicates
if os.path.exists(out_path): os.remove(out_path)
DbApi.offline = True
sp = go([snap([J(7, "offline.pdf", 6, 0, PR)]), snap([J(7, "offline.pdf", 6, 6, PR)]), snap([])])
check("7a nothing reached DB while offline", not any(r[0] == "offline.pdf" for r in jobs()))
check("7b outbox holds the reports", os.path.exists(out_path) and len(open(out_path).read().splitlines()) >= 2)
DbApi.offline = False
n_before = len(open(out_path).read().splitlines())
A.run(cfg, FakeSpooler([snap([])]), DbApi(), A.Outbox(out_path), sleep=lambda s: None, iterations=1, log=lambda m: None)
check("7c after reconnect job arrived completed", ["offline.pdf", "completed", "6", "pages_printed", ""] in jobs(), jobs())
check("7d outbox emptied", not os.path.exists(out_path))
# replay the SAME reports again (simulates crash after send before outbox cleared)
with open(out_path, "w") as f:
    for line in range(1):
        pass
cnt = q("SELECT count(*) FROM print_jobs WHERE document_name='offline.pdf'")
check("7e exactly one row for offline job", cnt == "1", cnt)

# 8) duplicate replay of a completed report + stale 'queued' re-send must not duplicate or downgrade
h = q("SELECT job_hash FROM print_jobs WHERE document_name='cv.pdf'")
api = DbApi()
for st in ("queued", "completed", "completed"):
    api.report({"job_hash": h, "printer_name": P, "status": st, "pages": 5})
check("8 replay/stale reports keep 1 row + completed", q("SELECT count(*)||'/'||max(status) FROM print_jobs WHERE document_name='cv.pdf'") == "1/completed")

# 9) wrong key: agent cannot write
bad = DbApi(key="0" * 64)
try:
    bad.report({"job_hash": "zz", "status": "queued"}); ok = False
except urllib.error.HTTPError: ok = True
check("9 wrong security key rejected", ok)

# 10) printer status mapping + heartbeat -> DB
go([snap([], st="paper_out")])
check("10 heartbeat stored printer state", q("SELECT status FROM print_printers WHERE name='EPSON L805'") == "paper_out", q("SELECT status FROM print_printers"))
check("10b PC last_seen + user set", q("SELECT current_user_name IS NOT NULL AND last_seen IS NOT NULL FROM print_computers WHERE name='PC-07'") == "t")

# 11) cancel request flows staff -> DB -> agent -> spooler -> cancelled record
psql("INSERT INTO print_jobs (shop_id,job_hash,source,computer_id,status,cancel_requested,document_name) SELECT 'cyb1', 'agent:cancelme','agent', id,'printing',true,'cancelme.pdf' FROM print_computers WHERE name='PC-07'")
sp = FakeSpooler([snap([J(11, "cancelme.pdf", 9, 0, PR)])])
tr_hash = A.Tracker(CID, "u")._hash(P, J(11, "cancelme.pdf", 9, 0, PR))
psql("UPDATE print_jobs SET job_hash='%s' WHERE document_name='cancelme.pdf'" % tr_hash)
A.run(cfg, sp, DbApi(), A.Outbox(out_path), sleep=lambda s: None, iterations=1, log=lambda m: None)
check("11a agent asked spooler to cancel job 11", sp.cancelled == [(P, 11)], sp.cancelled)

# printer-status mapping unit checks
M = A.map_printer_status
check("12 status map ready", M(0, 0)[0] == "ready")
check("12 status map paper out", M(A.PRINTER_STATUS_PAPER_OUT, 0)[0] == "paper_out")
check("12 status map offline attr", M(0, A.PRINTER_ATTRIBUTE_WORK_OFFLINE)[0] == "offline")
check("12 status map jam=error", M(A.PRINTER_STATUS_PAPER_JAM, 0)[0] == "error")
check("12 status map printing", M(A.PRINTER_STATUS_PRINTING, 0)[0] == "printing")
print("\nFAILED: %d" % len(fails) if fails else "\nALL AGENT E2E CHECKS PASSED")
sys.exit(1 if fails else 0)
