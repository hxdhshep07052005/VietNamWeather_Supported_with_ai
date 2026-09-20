import zlib
import urllib.request

def plantuml_encode(text):
    def encode6bit(b):
        if b < 10:
            return chr(48 + b)
        b -= 10
        if b < 26:
            return chr(65 + b)
        b -= 26
        if b < 26:
            return chr(97 + b)
        b -= 26
        if b == 0:
            return '-'
        if b == 1:
            return '_'
        return '?'

    def append3bytes(b1, b2, b3):
        c1 = b1 >> 2
        c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
        c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
        c4 = b3 & 0x3F
        return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F)

    data = text.encode('utf-8')
    compressed = zlib.compress(data)[2:-4]
    res = ''
    i = 0
    while i < len(compressed):
        b1 = compressed[i]
        b2 = compressed[i+1] if i+1 < len(compressed) else 0
        b3 = compressed[i+2] if i+2 < len(compressed) else 0
        res += append3bytes(b1, b2, b3)
        i += 3
    return res

with open('report/diagrams/usecase.puml', 'r', encoding='utf-8') as f:
    code = f.read()

encoded = plantuml_encode(code)
url = f'http://www.plantuml.com/plantuml/png/{encoded}'
print('URL:', url)

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp, open('report/diagrams/usecase_rendered.png', 'wb') as f:
    f.write(resp.read())
print('Rendered and saved to report/diagrams/usecase_rendered.png')
