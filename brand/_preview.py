import re, sys, io
s = io.open(sys.argv[1], encoding='utf-8').read()
m = re.search(r'<helmet>(.*?)</helmet>', s, re.S)
head = m.group(1) if m else ''
body = re.search(r'<x-dc>(.*?)</x-dc>', re.sub(r'<helmet>.*?</helmet>', '', s, flags=re.S), re.S).group(1)
io.open(sys.argv[2], 'w', encoding='utf-8').write(
    '<!doctype html><html><head><meta charset="utf-8">%s</head><body style="margin:0">%s</body></html>' % (head, body))
