# Sellora Cyber Print Agent (Windows)

Reports real print-spooler activity from a Cyber PC to Sellora → Cyber → Print Monitor.

```
Sellora Cyber ⇄ Supabase ⇄ THIS AGENT → Windows Print Spooler → Printer
```

## Install (each PC that prints / the PC the printer is plugged into)
1. Install Python 3.9+ (tick "Add to PATH"), then run: `pip install pywin32`
2. Copy `sellora_print_agent.py` to a folder, e.g. `C:\SelloraAgent`.
3. In Sellora (Cyber owner): **Print Monitor → Cyber Computers → Register**, then **Download config.json**
   (the key is shown once) and save it next to the script.
4. Run `python sellora_print_agent.py`. Put a shortcut in `shell:startup` to start it with Windows.
5. Print a test page. It should appear in Print Monitor within a few seconds, and the printer card shows live status.

`config.json` options: `printer_filter` (only printers whose name contains one of these), `printer_exclude`,
`poll_seconds`, `heartbeat_seconds`, `trust_queue_exit` (see below).

## What it reports (and what it cannot know)
* Queued / Printing / Failed / Cancelled come from the spooler's job flags.
* **Completed** requires proof: the spooler showed PagesPrinted ≥ TotalPages. Many inkjet drivers never update
  PagesPrinted; if a job just leaves the queue the agent does NOT claim success — it leaves the job "Left queue – confirm"
  and staff press **Paper came out** or **Failed** in Print Monitor. Set `"trust_queue_exit": true` to treat a clean queue exit
  as Completed (faster, but a jam after hand-off would be recorded as success).
* Printer status uses the spooler's printer flags (offline, paper out, error, jam, printing, ready). A USB printer that is
  unplugged can still show "ready" in some drivers; Sellora shows *Status unavailable* whenever the agent has not reported in the
  last 2 minutes or reports no usable status.
* Colour/paper/copies come from the job's DEVMODE when the app provides it; otherwise they stay *unknown* (and unknown-colour jobs are not auto-priced).
* No internet: reports are written to `outbox.jsonl` and replayed in order on reconnect. The server ignores replays (idempotent by job hash; a job never moves backwards).
* Cancel from Sellora: the agent receives the request on its next heartbeat and deletes the spooler job.

## Security
The agent only calls two database functions with the public anon key plus its own per-PC secret. It has no table access.
Only a SHA-256 hash of the secret is stored. Regenerate it any time (old key stops working immediately).

## Tests
`python test_agent_e2e.py` runs the real agent logic against a real Postgres loaded with the migration
(spooler faked, since it needs Windows). Not a substitute for a live Windows test — see the root README.
