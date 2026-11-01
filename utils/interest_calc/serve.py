#!/usr/bin/env python3
"""本機伺服器（只用 Python 內建模組）： python serve.py [埠號，預設 8765]

好處：products/ 資料夾內的 *.json 會即時掃描，放進新的商品 JSON、重新整理頁面就會出現，
不需要執行 build_bundle.py。只綁定 127.0.0.1（本機），不對外開放。
"""
import http.server
import json
import os
import sys
import threading
import urllib.parse
import webbrowser

from build_bundle import collect, HERE


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def _send(self, text, ctype):
        body = text.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', ctype + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/products/index.json':
            return self._send(json.dumps([fn for fn, _ in collect()], ensure_ascii=False), 'application/json')
        if path == '/products/bundle.js':
            bundle = [{'file': fn, 'data': d} for fn, d in collect()]
            return self._send('window.IC_PRODUCT_BUNDLE=' + json.dumps(bundle, ensure_ascii=False) + ';', 'application/javascript')
        return super().do_GET()

    def log_message(self, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    url = 'http://127.0.0.1:%d/index.html' % port
    print('已啟動：%s（按 Ctrl+C 結束）' % url)
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已結束')


if __name__ == '__main__':
    main()
