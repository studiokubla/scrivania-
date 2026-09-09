#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Assembla la demo Tirabasso in un unico file HTML autoportante.

  src/shell.html  markup + placeholder
  src/style.css   design system
  src/app.js      SPA (router, catalogo, borsa, checkout)
  src/products.json  catalogo arricchito (build-data.py)
  assets/*.webp   immagini, incorporate come data URI

Output:
  dist/index.html     standalone (doppio clic / hosting statico)
  dist/artifact.html  solo contenuto, per la pubblicazione come Artifact
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
ASSETS = os.path.join(ROOT, 'assets')
DIST = os.path.join(ROOT, 'dist')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def data_uri(path):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    ext = os.path.splitext(path)[1].lower()
    mime = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.svg': 'image/svg+xml'}.get(ext, 'application/octet-stream')
    return 'data:%s;base64,%s' % (mime, b64)


def collect_assets():
    """Tutti i .webp in assets/ (top level) -> {nome senza estensione: data URI}."""
    out = {}
    for fn in sorted(os.listdir(ASSETS)):
        p = os.path.join(ASSETS, fn)
        if os.path.isfile(p) and fn.lower().endswith(('.webp', '.png', '.jpg', '.svg')):
            out[os.path.splitext(fn)[0]] = data_uri(p)
    return out


def main():
    shell = read(os.path.join(SRC, 'shell.html'))
    style = read(os.path.join(SRC, 'style.css'))
    app = read(os.path.join(SRC, 'app.js'))
    products = json.load(open(os.path.join(SRC, 'products.json'), encoding='utf-8'))

    assets = collect_assets()

    # packshot -> data URI inline nel catalogo
    missing = []
    for p in products:
        rel = p['img']
        path = os.path.join(ASSETS, rel)
        if not os.path.exists(path):
            missing.append(rel)
            continue
        p['img'] = data_uri(path)
    if missing:
        sys.exit('Packshot mancanti: %s' % missing[:5])

    data = ('const ASSETS=%s;\nconst PRODUCTS=%s;\n'
            % (json.dumps(assets, ensure_ascii=False),
               json.dumps(products, ensure_ascii=False)))

    html = shell.replace('{{STYLE}}', style)
    html = html.replace('{{DATA}}', data)
    html = html.replace('{{APP}}', app)

    # {{A:nome}} nel markup statico
    def sub_asset(m):
        k = m.group(1)
        if k not in assets:
            sys.exit('Asset mancante nello shell: %s' % k)
        return assets[k]
    html = re.sub(r'\{\{A:([a-z0-9\-]+)\}\}', sub_asset, html)

    left = re.findall(r'\{\{[^}]+\}\}', html)
    if left:
        sys.exit('Placeholder non risolti: %s' % set(left))

    os.makedirs(DIST, exist_ok=True)

    with open(os.path.join(DIST, 'artifact.html'), 'w', encoding='utf-8') as f:
        f.write(html)

    standalone = ('<!doctype html>\n<html lang="it">\n<head>\n'
                  '<meta charset="utf-8">\n'
                  '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
                  '<meta name="description" content="Tirabasso — maison italiana del cappello dal 1967. '
                  'Collezioni, savoir-faire e area B2B Jackson.">\n'
                  '</head>\n<body style="margin:0">\n' + html + '\n</body>\n</html>\n')
    with open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(standalone)

    mb = len(standalone.encode('utf-8')) / 1048576
    print('assets incorporati : %d' % len(assets))
    print('prodotti           : %d' % len(products))
    print('dist/index.html    : %.2f MB' % mb)
    print('dist/artifact.html : %.2f MB' % (len(html.encode('utf-8')) / 1048576))
    if mb > 15:
        print('ATTENZIONE: oltre il limite di 16 MB dell\'Artifact.')


if __name__ == '__main__':
    main()
