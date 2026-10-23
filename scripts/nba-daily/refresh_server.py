#!/usr/bin/env python3
"""Rebuild the crabsketball plan on demand (the page's "Recheck now" button).

nginx (nfl-router) forwards POST /nfl/nba/refresh here after the blaine-auth
check. The reply only says whether the run worked; the page then reads the new
plan from the gated /nfl/csv/nba_plan.json, so nothing private leaves through
this port. Runs as the user service nba-plan-refresh on port 8590.
"""

import ipaddress
import json
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PLAN = Path(__file__).with_name("plan.py")
PORT = 8590
MIN_GAP = 20          # seconds; a second click inside that reuses the last run
# nfl-router reaches the host from a Docker network; nobody else needs this port.
ALLOWED = [ipaddress.ip_network(n) for n in ("127.0.0.0/8", "172.16.0.0/12")]

lock = threading.Lock()
last = {"at": 0.0, "ok": None, "summary": ""}


def run():
    with lock:
        if last["ok"] and time.time() - last["at"] < MIN_GAP:
            return last
        p = subprocess.run([sys.executable, str(PLAN)], capture_output=True, text=True, timeout=120)
        ok = p.returncode == 0
        last.update(at=time.time(), ok=ok,
                    summary=(p.stdout.strip().splitlines() or [""])[-1] if ok else "plan.py failed")
        if not ok:
            print(p.stderr[-2000:], flush=True)
        return last


class Handler(BaseHTTPRequestHandler):
    def _reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if not any(ipaddress.ip_address(self.client_address[0]) in n for n in ALLOWED):
            return self._reply(403, {"ok": False})
        if self.path.rstrip("/") != "/refresh":
            return self._reply(404, {"ok": False})
        try:
            r = run()
        except subprocess.TimeoutExpired:
            return self._reply(504, {"ok": False, "error": "timed out"})
        self._reply(200 if r["ok"] else 500, {"ok": r["ok"], "summary": r["summary"]})

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} {fmt % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
