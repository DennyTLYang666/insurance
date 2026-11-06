# -*- coding: utf-8 -*-
"""本機即時更新伺服器（只用標準函式庫；只綁定 127.0.0.1，不對外）。

用法：python scripts/serve.py [--port 8000]，再開 http://127.0.0.1:8000/
提供網站檔案，另外多兩個端點給頁面上的「立即更新」按鈕：
  GET  /__wm/ping     → {"live": true}（頁面據此顯示按鈕）
  POST /__wm/refresh  → 重抓報價與價格後重建 weekly.json（等同 update_data.py --fetch quotes,prices）
GitHub Pages 或雙擊 index.html 沒有這個端點，頁面不會顯示按鈕，仍是原本的手動更新。
"""
import argparse
import functools
import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIN_GAP = 30  # 兩次更新至少間隔幾秒，避免連點打爆資料來源
lock = threading.Lock()
last = {"t": 0.0, "body": None}


def refresh():
    if not lock.acquire(blocking=False):
        return {"ok": False, "message": "上一次更新還在進行中"}
    try:
        if last["body"] and time.time() - last["t"] < MIN_GAP:
            return dict(last["body"], message="剛更新過（%d 秒內不重複抓取）" % MIN_GAP)
        env = dict(os.environ, PYTHONUTF8="1")
        try:
            p = subprocess.run([sys.executable, str(ROOT / "scripts" / "update_data.py"), "--fetch", "quotes,prices"],
                               cwd=str(ROOT), env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
        except subprocess.TimeoutExpired:
            return {"ok": False, "message": "更新逾時（180 秒）"}
        lines = [x for x in (p.stdout + "\n" + p.stderr).splitlines() if x.strip()]
        fail = [x for x in lines if x.startswith("[抓取失敗]") or x.startswith("[錯誤]") or x.startswith("  [錯誤]")]
        body = {"ok": p.returncode in (0, 2), "message": "；".join(fail)[:300] if fail else "已更新", "code": p.returncode}
        last.update(t=time.time(), body=body)
        return body
    finally:
        lock.release()


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path.split("?")[0] == "/__wm/ping":
            return self._json({"live": True})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/__wm/refresh":
            return self._json(refresh())
        self.send_error(404)


def main():
    ap = argparse.ArgumentParser(description="本機伺服器＋頁面上的「立即更新」")
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), functools.partial(Handler, directory=str(ROOT)))
    print("已啟動：http://127.0.0.1:%d/ （Ctrl+C 結束）" % a.port)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
