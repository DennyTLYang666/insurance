#!/usr/bin/env python3
"""把 products/*.json 打包成 products/index.json 與 products/bundle.js。

為什麼需要：直接雙擊 index.html（file://）時，瀏覽器不允許網頁讀取本機的 JSON 檔，
只能用 <script> 載入 .js，所以把所有商品 JSON 包成 bundle.js。
新增或修改商品 JSON 後執行一次： python build_bundle.py
（若改用 python serve.py 開啟，則不需要這一步。）
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.join(HERE, 'products')


def collect():
    """回傳 [(檔名, 內容)]；無法解析的檔案會略過並印出警告。"""
    items = []
    for fn in sorted(os.listdir(PROD)):
        if not fn.lower().endswith('.json') or fn.lower() == 'index.json':
            continue
        try:
            with open(os.path.join(PROD, fn), encoding='utf-8') as f:
                items.append((fn, json.load(f)))
        except (OSError, ValueError) as e:
            print('略過 %s：%s' % (fn, e), file=sys.stderr)
    return items


def main():
    items = collect()
    with open(os.path.join(PROD, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump([fn for fn, _ in items], f, ensure_ascii=False, indent=1)
    bundle = [{'file': fn, 'data': data} for fn, data in items]
    with open(os.path.join(PROD, 'bundle.js'), 'w', encoding='utf-8') as f:
        f.write('/* 由 build_bundle.py 產生，請勿手動修改 */\n')
        f.write('window.IC_PRODUCT_BUNDLE=' + json.dumps(bundle, ensure_ascii=False) + ';\n')
    print('已打包 %d 個商品：%s' % (len(items), ', '.join(fn for fn, _ in items)))


if __name__ == '__main__':
    main()
