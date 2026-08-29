# -*- coding: utf-8 -*-
"""Costruisce gli artboard .dc.html della board DEZ 11."""
import io, json, os

# ---------------------------------------------------------------- fondamenta
CAMPO   = '#0B0C10'
NOTTE   = '#191B22'
FANGO   = '#2E313A'
CEMENTO = '#6E7280'
NEBBIA  = '#C9CCD3'
CALCE   = '#F1F2F4'
SMALTO  = '#FFFFFF'
LAMPO   = '#C6FF3D'

SPETTRO = [
    ('Rosso',   ['#FF9B8A', '#FF6B4A', '#E8341A', '#96150B']),
    ('Arancio', ['#FFC08F', '#FF8C3D', '#F26505', '#9C3B00']),
    ('Ambra',   ['#FFD880', '#FFB01F', '#DE8A00', '#8F5300']),
    ('Giallo',  ['#FAEC85', '#F2D726', '#B89C00', '#7E6B00']),
    ('Lime',    ['#CDF08E', '#9BDD3A', '#5FA00A', '#3F6E06']),
    ('Verde',   ['#8CEBAE', '#35CB6E', '#0AA44C', '#05622D']),
    ('Menta',   ['#85EFD4', '#21D2AE', '#00AA8B', '#006152']),
    ('Ciano',   ['#8AE9F5', '#22C9E3', '#00A0BC', '#005C6E']),
    ('Azzurro', ['#9BCFFF', '#3E9BFA', '#0B6FDB', '#06407F']),
    ('Blu',     ['#AFBAFF', '#7080FF', '#3B47E8', '#1E2489']),
    ('Viola',   ['#D0AEFF', '#A26BFF', '#7A34E0', '#451682']),
    ('Rosa',    ['#FFAAD2', '#FF5FA3', '#E01E72', '#870A41']),
]

DISPLAY = "'M PLUS Rounded 1c', 'Trebuchet MS', system-ui, sans-serif"
TESTO   = "'Archivo', 'Helvetica Neue', Arial, sans-serif"

# ------------------------------------------------------------------ marchio
DEZ_PATHS = (
    '<path d="M0 120 L0 0 L44 0 C92 0 110 27 110 60 C110 93 92 120 44 120 Z"/>'
    '<path d="M281 0 L185 0 L185 120 L281 120"/>'
    '<path d="M185 60 L267 60"/>'
    '<path d="M356 0 L458 0 L356 120 L458 120"/>'
)
NUM_D = 'M30 84 L120 6 L120 306 M270 84 L360 6 L360 306'
RINGS = [120, 96, 72, 48, 24]


def dez(color, tx=91, ty=90):
    return ('<g transform="translate(%d,%d)" stroke="%s" stroke-width="60">%s</g>'
            % (tx, ty, color, DEZ_PATHS))


def num(colors, tx=118, ty=354):
    inner = ''.join('<path d="%s" stroke="%s" stroke-width="%d"/>' % (NUM_D, c, w)
                    for c, w in zip(colors, RINGS))
    return '<g transform="translate(%d,%d)">%s</g>' % (tx, ty, inner)


def alt(a, b):
    return [a, b, a, b, a]


GRAD = ('<defs><linearGradient id="%s" x1="0" y1="0.1" x2="1" y2="0.9">'
        '<stop offset="0" stop-color="#FF6B4A"/><stop offset="0.18" stop-color="#FFB01F"/>'
        '<stop offset="0.36" stop-color="#9BDD3A"/><stop offset="0.54" stop-color="#21D2AE"/>'
        '<stop offset="0.72" stop-color="#3E9BFA"/><stop offset="0.86" stop-color="#7A34E0"/>'
        '<stop offset="1" stop-color="#FF5FA3"/></linearGradient></defs>')


def marchio(width, nome=CAMPO, anelli=None, defs='', extra=''):
    """Marchio verticale completo, viewBox 640x780."""
    anelli = anelli or alt(CAMPO, SMALTO)
    h = round(width * 780 / 640)
    return ('<svg viewBox="0 0 640 780" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '%s<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s%s</g>%s</svg>'
            % (width, h, defs, dez(nome), num(anelli), extra))


def orizzontale(width, nome=CAMPO, anelli=None):
    anelli = anelli or alt(CAMPO, SMALTO)
    h = round(width * 420 / 1028)
    return ('<svg viewBox="0 0 1028 420" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s%s</g></svg>'
            % (width, h, dez(nome, 30, 270), num(anelli, 608, 54)))


def icona(size, fondo=CAMPO, anelli=None, radius=None):
    anelli = anelli or alt(SMALTO, CAMPO)
    r = radius if radius is not None else 116
    return ('<svg viewBox="0 0 512 512" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '<rect width="512" height="512" rx="%d" fill="%s"/>'
            '<g transform="translate(84,96) scale(0.764)" fill="none" '
            'stroke-linecap="round" stroke-linejoin="round">%s</g></svg>'
            % (size, size, r, fondo, num(anelli, 30, 54)))


def solo_numero(width, anelli=None, defs=''):
    """Solo il numero, viewBox 450x420."""
    anelli = anelli or alt(CAMPO, SMALTO)
    h = round(width * 420 / 450)
    return ('<svg viewBox="0 0 450 420" width="%d" height="%d" role="img" aria-label="11">'
            '%s<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>'
            % (width, h, defs, num(anelli, 30, 54)))


# ------------------------------------------------------------------- maglia
MAGLIA_D = ('M 206 66 C 252 116 368 116 414 66 L 560 150 L 520 272 L 452 236 '
            'L 482 682 Q 310 716 138 682 L 168 236 L 100 272 L 60 150 Z')


def maglia(width, uid, primario, secondario, bordo=CAMPO):
    """Sagoma di maglia a righe verticali nei due colori squadra."""
    h = round(width * 724 / 620)
    strisce = ''.join('<rect x="%d" y="40" width="76" height="700" fill="%s"/>' % (x, secondario)
                      for x in (140, 290, 440))
    return ('<svg viewBox="0 0 620 724" width="%d" height="%d" role="img" aria-hidden="true">'
            '<defs><clipPath id="m%s"><path d="%s"/></clipPath></defs>'
            '<g clip-path="url(#m%s)"><rect width="620" height="724" fill="%s"/>%s</g>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="18" stroke-linejoin="round"/>'
            '</svg>' % (width, h, uid, MAGLIA_D, uid, primario, strisce, MAGLIA_D, bordo))


# ----------------------------------------------------------------- involucro
HELMET = """<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=M+PLUS+Rounded+1c:wght@800&display=swap">
  <style>
    body { margin: 0; font-family: %s; }
    a { color: #0B6FDB; } a:hover { color: #06407F; }
  </style>
</helmet>""" % TESTO


def artboard(nome, corpo):
    doc = ('<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n'
           '  <script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n'
           + HELMET + '\n' + corpo + '\n</x-dc>\n</body>\n</html>\n')
    with io.open(nome, 'w', encoding='utf-8') as f:
        f.write(doc)
    print('  ' + nome)


def occhiello(testo, colore=CEMENTO):
    return ('<span style="font-size: 11px; font-weight: 600; letter-spacing: 0.2em; '
            'text-transform: uppercase; color: %s;">%s</span>' % (colore, testo))


def intestazione(sinistra, destra, colore=CEMENTO, accento=LAMPO):
    return ('<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px;">'
            '%s%s</div>' % (occhiello(sinistra, accento), occhiello(destra, colore)))


def titoletto(testo, colore=CAMPO):
    return ('<h2 style="margin: 0; font-family: %s; font-weight: 800; font-size: 19px; '
            'letter-spacing: -0.01em; color: %s;">%s</h2>' % (DISPLAY, colore, testo))


def nota(testo, colore=CEMENTO, larghezza=None):
    w = ('width: %dpx; flex-shrink: 0; ' % larghezza) if larghezza else ''
    return ('<p style="margin: 0; %sfont-size: 13px; line-height: 1.6; color: %s; '
            'text-wrap: pretty;">%s</p>' % (w, colore, testo))


# =============================================================== 01 · marchio
def build_main():
    barra = ''.join('<div style="flex-grow: 1; background: %s;"></div>' % SPETTRO[i][1][2]
                    for i in range(12))
    corpo = """<div style="width: 900px; height: 1080px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 36px;">
  %(head)s
  <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">%(logo)s</div>
  <div style="display: flex; height: 12px;">%(barra)s</div>
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <p style="margin: 0; flex-grow: 1; font-family: %(display)s; font-weight: 800; font-size: 26px; line-height: 1.28; color: %(calce)s; text-wrap: pretty;">Un nome e un numero: il retro della maglia è la firma di chi scende in campo.</p>
    %(nota)s
  </div>
</div>""" % dict(
        campo=CAMPO, calce=CALCE, display=DISPLAY, barra=barra,
        head=intestazione('Marchio principale', 'DEZ 11 — Identità 01'),
        logo=marchio(470, SMALTO, alt('url(#spettro)', CAMPO), GRAD % 'spettro'),
        nota=nota("Il marchio vive in bianco e nero: il colore appartiene alle squadre. "
                  "Lo spettro entra negli anelli del numero solo quando parla la lega intera.",
                  CEMENTO, 236))
    artboard('Main.dc.html', corpo)


# ========================================================== 02 · costruzione
def build_costruzione():
    griglia = ''.join('<path d="M%d 0 V780"/>' % x for x in range(0, 641, 30)) + \
              ''.join('<path d="M0 %d H640"/>' % y for y in range(0, 781, 30))
    tavola = (
        '<svg viewBox="-10 -10 660 800" width="470" height="570" role="img" aria-label="Griglia di costruzione">'
        '<g fill="none" stroke="%s" stroke-width="1">%s</g>'
        '<rect x="0" y="0" width="640" height="780" fill="none" stroke="%s" stroke-width="3" stroke-dasharray="14 10"/>'
        '<rect x="61" y="60" width="518" height="660" fill="none" stroke="%s" stroke-width="3"/>'
        '<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s%s</g>'
        '</svg>' % (NEBBIA, griglia, '#E8341A', '#3E9BFA', dez(CAMPO), num(alt(CAMPO, CALCE))))

    def riga(k, v):
        return ('<div style="display: flex; justify-content: space-between; gap: 16px; '
                'padding: 9px 0; border-bottom: 1px solid %s;">'
                '<span style="font-size: 13px; color: %s;">%s</span>'
                '<span style="font-size: 13px; font-weight: 700; color: %s; font-variant-numeric: tabular-nums;">%s</span>'
                '</div>' % (NEBBIA, FANGO, k, CAMPO, v))

    misure = ''.join(riga(k, v) for k, v in [
        ('Asta del nome', '2u'), ('Altezza del nome', '6u'),
        ('Asta del numero', '4u'), ('Altezza del numero', '14u'),
        ('Distanza nome / numero', '2u'), ('Area di rispetto', '2u'),
        ('Anelli concentrici', '4 × 0,4u'), ('Anima del numero', '0,8u')])

    def sbagliato(etichetta, stile, contenuto):
        return ('<div style="display: flex; flex-direction: column; gap: 10px;">'
                '<div style="height: 116px; background: %s; border-radius: 10px; display: flex; '
                'align-items: center; justify-content: center; overflow: hidden; position: relative;">'
                '<div style="%s">%s</div>'
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8341A" '
                'stroke-width="3" stroke-linecap="round" style="position: absolute; top: 8px; right: 8px;">'
                '<path d="M5 5 L19 19 M19 5 L5 19"/></svg></div>'
                '<span style="font-size: 11.5px; line-height: 1.45; color: %s;">%s</span></div>'
                % (CALCE, stile, contenuto, CEMENTO, etichetta))

    don_ts = ''.join([
        sbagliato('Non inclinare né ruotare il marchio.', 'transform: rotate(-9deg);', marchio(74)),
        sbagliato('Non colorare gli anelli uno per uno.', '',
                  marchio(74, '#E01E72', ['#F26505', '#FFFFFF', '#3B47E8', '#FFFFFF', '#0AA44C'])),
        sbagliato('Niente ombre, sfumature o contorni aggiunti.',
                  'filter: drop-shadow(4px 6px 0 %s);' % NEBBIA, marchio(74)),
        sbagliato('Non alterare il rapporto fra nome e numero.',
                  'transform: scaleX(1.45);', marchio(74)),
    ])

    corpo = """<div style="width: 1240px; height: 930px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 34px;">
  %(head)s
  <div style="display: flex; gap: 52px; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 16px; flex-shrink: 0;">
      %(tavola)s
      <div style="display: flex; gap: 22px; align-items: center;">
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: #3E9BFA;"></span>ingombro</span>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: repeating-linear-gradient(90deg, #E8341A 0 7px, transparent 7px 12px);"></span>area di rispetto</span>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: %(nebbia)s;"></span>1u = 30</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 30px; flex-grow: 1;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        %(t1)s
        %(n1)s
        <div style="margin-top: 6px;">%(misure)s</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        %(t2)s
        %(n2)s
        <div style="display: flex; gap: 18px; margin-top: 4px;">
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;"><span style="font-family: %(display)s; font-weight: 800; font-size: 22px; color: %(campo)s;">96 px</span><span style="font-size: 11.5px; color: %(cemento)s;">marchio verticale<br>20 mm in stampa</span></div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;"><span style="font-family: %(display)s; font-weight: 800; font-size: 22px; color: %(campo)s;">160 px</span><span style="font-size: 11.5px; color: %(cemento)s;">lockup orizzontale<br>32 mm in stampa</span></div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px;"><span style="font-family: %(display)s; font-weight: 800; font-size: 22px; color: %(campo)s;">32 px</span><span style="font-size: 11.5px; color: %(cemento)s;">simbolo<br>sotto: anima piena</span></div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        %(t3)s
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px;">%(donts)s</div>
      </div>
    </div>
  </div>
</div>""" % dict(
        smalto=SMALTO, campo=CAMPO, cemento=CEMENTO, nebbia=NEBBIA, display=DISPLAY,
        head=intestazione('Costruzione e uso', 'DEZ 11 — Identità 02', CEMENTO, '#0B6FDB'),
        tavola=tavola, misure=misure, donts=don_ts,
        t1=titoletto('Il modulo'), t2=titoletto('Dimensioni minime'), t3=titoletto('Usi da evitare'),
        n1=nota("Tutto nasce da <b>1u</b>, un quarto dell'asta del numero. Nome e numero non si "
                "spostano né si ridimensionano l'uno rispetto all'altro. Gli anelli chiari sono "
                "bianco pieno, non trasparenti: il marchio regge su qualsiasi fondo."),
        n2=nota("Sotto queste misure l'anima del numero si chiude: usare il simbolo, non il marchio intero."))
    artboard('Costruzione.dc.html', corpo)


# ============================================================= 03 · varianti
def build_varianti():
    def tile(etichetta, descrizione, fondo, contenuto, bordo=False):
        b = ('border: 1px solid %s; ' % NEBBIA) if bordo else ''
        return ('<div style="display: flex; flex-direction: column; gap: 12px;">'
                '<div style="%sheight: 268px; background: %s; border-radius: 12px; display: flex; '
                'align-items: center; justify-content: center; overflow: hidden;">%s</div>'
                '<div style="display: flex; flex-direction: column; gap: 3px;">'
                '<span style="font-family: %s; font-weight: 800; font-size: 15px; color: %s;">%s</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: %s;">%s</span>'
                '</div></div>'
                % (b, fondo, contenuto, DISPLAY, CAMPO, etichetta, CEMENTO, descrizione))

    tiles = ''.join([
        tile('Positivo', 'Su fondi chiari. È la versione predefinita.', CALCE, marchio(140), True),
        tile('Negativo', 'Su Nero Campo e su fondi scuri pieni.', CAMPO,
             marchio(140, SMALTO, alt(SMALTO, CAMPO))),
        tile('Spettro', 'Solo per la lega: copertine, splash, chiusure.', CAMPO,
             marchio(140, SMALTO, alt('url(#sp3)', CAMPO), GRAD % 'sp3')),
        tile('Squadra', 'Anelli nei due colori assegnati alla squadra.', CALCE,
             marchio(140, CAMPO, [CAMPO, '#FFB01F', CAMPO, '#E8341A', CAMPO]), True),
        tile('Orizzontale', 'Testate, barre superiori, spazi bassi e larghi.', CALCE,
             orizzontale(280), True),
        tile('Simbolo', 'Icona app, avatar, favicon, bottoni.', CALCE, icona(150), True),
    ])
    corpo = """<div style="width: 1240px; height: 840px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 32px;">
  %(head)s
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 32px;">%(tiles)s</div>
</div>""" % dict(smalto=SMALTO, tiles=tiles,
                 head=intestazione('Varianti del marchio', 'DEZ 11 — Identità 03', CEMENTO, '#0B6FDB'))
    artboard('Varianti.dc.html', corpo)


# =========================================================== 04 · tipografia
GLIFI = {
    'D': ('-30 -30 170 180', '<path d="M0 120 L0 0 L44 0 C92 0 110 27 110 60 C110 93 92 120 44 120 Z"/>'),
    'E': ('-30 -30 156 180', '<path d="M96 0 L0 0 L0 120 L96 120"/><path d="M0 60 L82 60"/>'),
    'Z': ('-30 -30 162 180', '<path d="M0 0 L102 0 L0 120 L102 120"/>'),
}


def glifo(lettera, altezza):
    vb, d = GLIFI[lettera]
    w = round(altezza * float(vb.split()[2]) / float(vb.split()[3]))
    return ('<svg viewBox="%s" width="%d" height="%d" role="img" aria-label="%s" fill="none" '
            'stroke="%s" stroke-width="60" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
            % (vb, w, altezza, lettera, CAMPO, d))


def glifo_uno(altezza):
    inner = ''.join('<path d="M30 84 L120 6 L120 306" stroke="%s" stroke-width="%d"/>' % (c, w)
                    for c, w in zip(alt(CAMPO, SMALTO), RINGS))
    return ('<svg viewBox="-30 -54 210 420" width="%d" height="%d" role="img" aria-label="1" '
            'fill="none" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
            % (round(altezza * 210 / 420), altezza, inner))


def build_tipografia():
    lettering = ('<div style="display: flex; align-items: flex-end; gap: 26px; line-height: 0;">'
                 + glifo('D', 96) + glifo('E', 96) + glifo('Z', 96)
                 + '<div style="width: 18px;"></div>'
                 + '<div style="margin-bottom: -16px;">' + glifo_uno(224) + '</div></div>')

    def specimen(fam, peso, campione, dim, tracking='-0.02em', colore=CAMPO):
        return ('<div style="font-family: %s; font-weight: %s; font-size: %dpx; line-height: 1.08; '
                'letter-spacing: %s; color: %s;">%s</div>' % (fam, peso, dim, tracking, colore, campione))

    def scala(nome, spec, campione, stile):
        return ('<div style="display: flex; align-items: baseline; gap: 22px; padding: 11px 0; '
                'border-bottom: 1px solid %s;">'
                '<span style="width: 108px; flex-shrink: 0; font-size: 11px; font-weight: 600; '
                'letter-spacing: 0.14em; text-transform: uppercase; color: %s;">%s</span>'
                '<span style="width: 150px; flex-shrink: 0; font-size: 12px; color: %s; '
                'font-variant-numeric: tabular-nums;">%s</span>'
                '<span style="%s">%s</span></div>'
                % (NEBBIA, CEMENTO, nome, CEMENTO, spec, stile, campione))

    tabella = ''.join([
        scala('Display XL', 'Rounded 800 · 56/58', 'Undici titolari',
              'font-family: %s; font-weight: 800; font-size: 32px; color: %s;' % (DISPLAY, CAMPO)),
        scala('Display L', 'Rounded 800 · 34/38', 'La mia rosa',
              'font-family: %s; font-weight: 800; font-size: 24px; color: %s;' % (DISPLAY, CAMPO)),
        scala('Titolo', 'Archivo 700 · 22/28', 'Classifica di lega',
              'font-family: %s; font-weight: 700; font-size: 19px; color: %s;' % (TESTO, CAMPO)),
        scala('Corpo', 'Archivo 400 · 16/25', 'Le formazioni chiudono un quarto d\'ora prima.',
              'font-family: %s; font-weight: 400; font-size: 15px; color: %s;' % (TESTO, FANGO)),
        scala('Dato', 'Archivo 600 · tabellare', '78,5  ·  1.204  ·  11',
              'font-family: %s; font-weight: 600; font-size: 15px; color: %s; font-variant-numeric: tabular-nums;' % (TESTO, CAMPO)),
        scala('Micro', 'Archivo 600 · 11 · +0,2em', 'GIORNATA 12',
              'font-family: %s; font-weight: 600; font-size: 11px; letter-spacing: 0.2em; color: %s;' % (TESTO, CEMENTO)),
    ])

    corpo = """<div style="width: 1000px; height: 1340px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 34px;">
  %(head)s
  <div style="display: flex; flex-direction: column; gap: 16px;">
    %(t1)s
    %(n1)s
    <div style="background: %(calce)s; border-radius: 12px; padding: 34px 40px; margin-top: 4px;">%(lettering)s</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px;">
    %(t2)s
    %(n2)s
    %(sp1)s
    <div style="font-family: %(display)s; font-weight: 800; font-size: 21px; line-height: 1.4; color: %(cemento)s; letter-spacing: 0.01em;">ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789 · àèéìòù</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px;">
    %(t3)s
    %(n3)s
    <div style="display: flex; gap: 34px; align-items: flex-start;">
      <p style="margin: 0; flex-grow: 1; font-size: 15px; line-height: 1.62; color: %(fango)s; text-wrap: pretty;">Archivo tiene insieme le tabelle e i testi lunghi: ha cifre tabellari, pesi ravvicinati e una larghezza che non si sfalda a 12 px. È la voce normale dell'app — il Rounded resta per i momenti in cui DEZ 11 alza il tono.</p>
      <div style="width: 210px; flex-shrink: 0; display: flex; flex-direction: column; gap: 7px;">
        <span style="font-size: 15px; font-weight: 400; color: %(fango)s;">Regular 400 — corpo</span>
        <span style="font-size: 15px; font-weight: 500; color: %(fango)s;">Medium 500 — etichette</span>
        <span style="font-size: 15px; font-weight: 600; color: %(campo)s;">Semibold 600 — dati</span>
        <span style="font-size: 15px; font-weight: 700; color: %(campo)s;">Bold 700 — titoli</span>
      </div>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    %(t4)s
    <div>%(tabella)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, calce=CALCE, campo=CAMPO, fango=FANGO, cemento=CEMENTO, display=DISPLAY,
        head=intestazione('Tipografia', 'DEZ 11 — Identità 04', CEMENTO, '#0B6FDB'),
        lettering=lettering, tabella=tabella,
        t1=titoletto('Lettering del marchio'), t2=titoletto('Display — M PLUS Rounded 1c ExtraBold'),
        t3=titoletto('Testo — Archivo'), t4=titoletto('Scala'),
        n1=nota("Le quattro forme del marchio sono disegnate, non composte: aste monolineari, "
                "terminali circolari, nessun raccordo angolare. Restano un file vettoriale — non "
                "si riscrivono con un font."),
        n2=nota("Per titoli e numeri grandi nell'app: stessa famiglia geometrica arrotondata del "
                "lettering, disponibile in tutta l'interfaccia."),
        n3=nota("Per tutto il resto: liste, tabelle, regolamenti, notifiche."),
        sp1=specimen(DISPLAY, 800, 'Undici scelte a settimana', 43))
    artboard('Tipografia.dc.html', corpo)


# =============================================================== 05 · colore
def build_colore():
    def grande(nome, hex_, uso, testo):
        return ('<div style="flex-grow: 1; background: %s; border-radius: 12px; padding: 22px; '
                'height: 138px; box-sizing: border-box; display: flex; flex-direction: column; '
                'justify-content: space-between; border: 1px solid %s;">'
                '<span style="font-family: %s; font-weight: 800; font-size: 19px; color: %s;">%s</span>'
                '<div style="display: flex; flex-direction: column; gap: 3px;">'
                '<span style="font-size: 12px; font-weight: 600; color: %s; font-variant-numeric: tabular-nums;">%s</span>'
                '<span style="font-size: 11.5px; line-height: 1.45; color: %s; opacity: 0.75;">%s</span>'
                '</div></div>' % (hex_, NEBBIA, DISPLAY, testo, nome, testo, hex_, testo, uso))

    core = ''.join([
        grande('Nero Campo', CAMPO, 'Fondo dell\'app, marchio, testo forte.', SMALTO),
        grande('Smalto', SMALTO, 'Superfici chiare, anelli, controtipo.', CAMPO),
        grande('Lampo', LAMPO, 'Una sola azione per schermata. Mai testo.', CAMPO),
    ])

    testate = ''.join(
        '<div style="width: 96px; text-align: center; font-size: 10.5px; font-weight: 600; '
        'color: %s;">%s</div>' % (CEMENTO, n) for n, _ in SPETTRO)
    righe = ''
    for g in range(4):
        celle = ''
        for nome, passi in SPETTRO:
            col = SMALTO if g >= 2 else CAMPO
            celle += ('<div style="width: 96px; height: 92px; background: %s; border-radius: 7px; '
                      'display: flex; align-items: flex-end; padding: 8px; box-sizing: border-box;">'
                      '<span style="font-size: 9.5px; font-weight: 600; letter-spacing: 0.02em; '
                      'color: %s; opacity: 0.82; font-variant-numeric: tabular-nums;">%s</span></div>'
                      % (passi[g], col, passi[g].replace('#', '')))
        righe += ('<div style="display: flex; gap: 6px; align-items: center;">'
                  '<span style="width: 28px; flex-shrink: 0; font-size: 10.5px; font-weight: 700; '
                  'color: %s; font-variant-numeric: tabular-nums;">0%d</span>%s</div>'
                  % (CEMENTO, g + 1, celle))

    neutri = ''.join(
        '<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 7px;">'
        '<div style="height: 56px; background: %s; border-radius: 7px; border: 1px solid %s;"></div>'
        '<span style="font-size: 11.5px; font-weight: 600; color: %s;">%s</span>'
        '<span style="font-size: 10.5px; color: %s; font-variant-numeric: tabular-nums;">%s</span></div>'
        % (h, NEBBIA, CAMPO, n, CEMENTO, h)
        for n, h in [('Campo', CAMPO), ('Notte', NOTTE), ('Fango', FANGO), ('Cemento', CEMENTO),
                     ('Nebbia', NEBBIA), ('Calce', CALCE), ('Smalto', SMALTO)])

    gradienti = ''.join(
        '<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 7px;">'
        '<div style="height: 62px; border-radius: 7px; background: linear-gradient(112deg, %s, %s);"></div>'
        '<span style="font-size: 11.5px; font-weight: 600; color: %s;">%s</span></div>'
        % (a, b, CAMPO, n)
        for n, a, b in [('Tramonto', '#FF6B4A', '#FFB01F'), ('Prato', '#9BDD3A', '#00AA8B'),
                        ('Notturna', '#3B47E8', '#A26BFF'), ('Neon', '#22C9E3', LAMPO),
                        ('Finale', '#E01E72', '#F26505')])

    corpo = """<div style="width: 1400px; height: 1200px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; flex-direction: column; gap: 14px;">
    %(t1)s
    <div style="display: flex; gap: 20px;">%(core)s</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px;">
      <div style="display: flex; gap: 6px;"><span style="width: 28px; flex-shrink: 0;"></span>%(testate)s</div>
      %(righe)s
    </div>
  </div>
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
      %(t3)s
      <div style="display: flex; gap: 12px;">%(neutri)s</div>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t4)s%(n4)s</div>
    <div style="display: flex; gap: 12px;">%(gradienti)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, core=core, testate=testate, righe=righe, neutri=neutri, gradienti=gradienti,
        head=intestazione('Sistema colore', 'DEZ 11 — Identità 05', CEMENTO, '#0B6FDB'),
        t1=titoletto('Nucleo'), t2=titoletto('Spettro — 12 famiglie, 4 gradi'),
        t3=titoletto('Neutri'), t4=titoletto('Gradienti'),
        n2=nota("Quarantotto tinte a disposizione delle squadre: abbastanza perché una lega da "
                "dieci non ripeta mai una coppia."),
        n4=nota("Due tinte adiacenti dello spettro. Mai più di due, mai attraverso tutto il cerchio."))
    artboard('Colore.dc.html', corpo)


# ============================================================== 06 · squadre
SQUADRE = [
    ('Zona Cesarini',    'Rosso 03 · Ambra 02',   '#E8341A', '#FFB01F'),
    ('Panchina Lunga',   'Blu 03 · Ciano 02',     '#3B47E8', '#22C9E3'),
    ('Tridente Atomico', 'Verde 03 · Lime 01',    '#0AA44C', '#CDF08E'),
    ('Muro Giallo',      'Giallo 02 · Campo',     '#F2D726', '#0B0C10'),
    ('Ultimo Minuto',    'Viola 03 · Rosa 02',    '#7A34E0', '#FF5FA3'),
    ('Contropiede',      'Menta 03 · Azzurro 01', '#00AA8B', '#9BCFFF'),
]


def build_squadre():
    def scheda(i, nome, coppia, a, b):
        chip = ('<span style="font-size: 10px; font-weight: 600; letter-spacing: 0.04em; '
                'color: %s; font-variant-numeric: tabular-nums;">%s</span>')
        return ('<div style="display: flex; flex-direction: column; gap: 13px;">'
                '<div style="background: %s; border-radius: 12px; height: 210px; display: flex; '
                'align-items: center; justify-content: center;">%s</div>'
                '<div style="display: flex; flex-direction: column; gap: 5px;">'
                '<span style="font-family: %s; font-weight: 800; font-size: 16px; color: %s;">%s</span>'
                '<span style="font-size: 11.5px; color: %s;">%s</span>'
                '<div style="display: flex; gap: 6px; margin-top: 4px;">'
                '<span style="display: flex; align-items: center; gap: 5px;">'
                '<span style="width: 11px; height: 11px; border-radius: 3px; background: %s; border: 1px solid %s;"></span>%s</span>'
                '<span style="display: flex; align-items: center; gap: 5px;">'
                '<span style="width: 11px; height: 11px; border-radius: 3px; background: %s; border: 1px solid %s;"></span>%s</span>'
                '</div></div></div>'
                % (CALCE, maglia(132, 's%d' % i, a, b), DISPLAY, CAMPO, nome, CEMENTO, coppia,
                   a, NEBBIA, chip % (CEMENTO, a.replace('#', '')),
                   b, NEBBIA, chip % (CEMENTO, b.replace('#', ''))))

    schede = ''.join(scheda(i, *s) for i, s in enumerate(SQUADRE))

    numeri = ''.join(
        '<div style="flex-grow: 1; background: %s; border-radius: 12px; height: 186px; display: flex; '
        'align-items: center; justify-content: center;">%s</div>'
        % (CAMPO, solo_numero(120, [SMALTO, a, SMALTO, b, SMALTO]))
        for _, _, a, b in SQUADRE[:5])

    corpo = """<div style="width: 1400px; height: 850px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 10px;">
      %(t1)s
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: %(fango)s; text-wrap: pretty;">Chi crea una squadra sceglie un <b>primario</b> fra i gradi 02 e 03 dello spettro. Il <b>secondario</b> arriva da una famiglia distante almeno tre posizioni — o è il Nero Campo. Da quella coppia l'app deriva da sola maglia, stemma, grafici e il numero della squadra.</p>
    </div>
    %(n1)s
  </div>
  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px;">%(schede)s</div>
  <div style="display: flex; flex-direction: column; gap: 13px; margin-top: 2px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: flex; gap: 22px;">%(numeri)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, fango=FANGO, schede=schede, numeri=numeri,
        head=intestazione('Le squadre', 'DEZ 11 — Identità 06', CEMENTO, '#0B6FDB'),
        t1=titoletto('Una coppia per squadra'), t2=titoletto('Il numero prende i colori di casa'),
        n1=nota("La regola delle tre posizioni tiene lontane due squadre della stessa lega: nessuno "
                "si ritrova con la maglia del vicino.", CEMENTO, 300),
        n2=nota("Gli anelli interni si colorano; l'armatura resta bianca o nera."))
    artboard('Squadre.dc.html', corpo)


# ========================================================= 07 · applicazioni
def build_applicazioni():
    def telefono(contenuto, fondo=CAMPO):
        return ('<div style="width: 280px; height: 620px; background: %s; border-radius: 30px; '
                'overflow: hidden; display: flex; flex-direction: column;">%s</div>' % (fondo, contenuto))

    splash = telefono(
        '<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">%s</div>'
        '<div style="padding: 0 24px 40px; display: flex; flex-direction: column; gap: 16px;">'
        '<div style="height: 52px; border-radius: 26px; background: %s; display: flex; '
        'align-items: center; justify-content: center; font-family: %s; font-weight: 800; '
        'font-size: 17px; color: %s;">Entra in lega</div>'
        '<div style="height: 52px; border-radius: 26px; border: 1.5px solid %s; display: flex; '
        'align-items: center; justify-content: center; font-size: 15px; font-weight: 600; '
        'color: %s;">Crea la tua squadra</div></div>'
        % (marchio(168, SMALTO, alt('url(#sp7)', CAMPO), GRAD % 'sp7'), LAMPO, DISPLAY, CAMPO, FANGO, CALCE))

    righe = ''
    punti = ['78,5', '76,0', '74,5', '71,5', '70,0', '66,5']
    for i, (nome, _, a, b) in enumerate(SQUADRE):
        righe += ('<div style="display: flex; align-items: center; gap: 13px; height: 56px; '
                  'border-bottom: 1px solid %s;">'
                  '<span style="width: 15px; font-size: 12px; font-weight: 700; color: %s; '
                  'font-variant-numeric: tabular-nums;">%d</span>%s'
                  '<span style="flex-grow: 1; font-size: 14.5px; font-weight: 600; color: %s;">%s</span>'
                  '<span style="font-family: %s; font-weight: 800; font-size: 17px; color: %s; '
                  'font-variant-numeric: tabular-nums;">%s</span></div>'
                  % (NOTTE, CEMENTO, i + 1, maglia(28, 'c%d' % i, a, b, NOTTE), CALCE, nome,
                     DISPLAY, SMALTO, punti[i]))

    lega = telefono(
        '<div style="padding: 34px 22px 18px; display: flex; flex-direction: column; gap: 16px;">'
        '<div style="display: flex; justify-content: space-between; align-items: center;">%s'
        '<span style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.2em; color: %s;">GIORNATA 12</span></div>'
        '<div style="display: flex; flex-direction: column; gap: 3px;">'
        '<span style="font-family: %s; font-weight: 800; font-size: 26px; color: %s; letter-spacing: -0.01em;">Bar dello Sport</span>'
        '<span style="font-size: 12.5px; color: %s;">Le formazioni chiudono fra due ore</span></div></div>'
        '<div style="padding: 0 22px; display: flex; flex-direction: column;">%s</div>'
        % (icona(28, CAMPO, alt(SMALTO, CAMPO), 8), CEMENTO, DISPLAY, SMALTO, CEMENTO, righe))

    icone = ('<div style="display: flex; flex-direction: column; gap: 22px;">'
             '<div style="display: flex; align-items: flex-end; gap: 18px;">%s%s%s</div>'
             '<div style="display: flex; gap: 18px;">%s%s</div></div>'
             % (icona(104), icona(64), icona(40),
                icona(104, CAMPO, alt('url(#sp8)', CAMPO)).replace('<rect', GRAD % 'sp8' + '<rect'),
                icona(104, '#E8341A', alt(SMALTO, '#E8341A'))))

    social = ('<div style="width: 300px; height: 300px; background: %s; border-radius: 14px; '
              'padding: 26px; box-sizing: border-box; display: flex; flex-direction: column; '
              'justify-content: space-between;">'
              '<span style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.2em; color: %s;">DEZ 11 · GIORNATA 12</span>'
              '<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 14px;">'
              '<span style="font-family: %s; font-weight: 800; font-size: 27px; line-height: 1.12; '
              'color: %s; letter-spacing: -0.02em;">Undici scelte.<br>Zero alibi.</span>%s</div></div>'
              % (CAMPO, LAMPO, DISPLAY, SMALTO,
                 solo_numero(96, alt('url(#sp9)', CAMPO), GRAD % 'sp9')))

    striscia = ('<div style="width: 300px; height: 122px; border-radius: 14px; overflow: hidden; '
                'display: flex;">%s</div>'
                % ''.join('<div style="flex-grow: 1; background: %s;"></div>' % SPETTRO[i][1][2]
                          for i in range(12)))

    def didascalia(t):
        return ('<span style="font-size: 11.5px; color: %s;">%s</span>' % (CEMENTO, t))

    corpo = """<div style="width: 1400px; height: 840px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; gap: 40px; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 13px; width: 268px; flex-shrink: 0;">%(icone)s%(d1)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; flex-shrink: 0;">%(splash)s%(d2)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; flex-shrink: 0;">%(lega)s%(d3)s</div>
    <div style="display: flex; flex-direction: column; gap: 22px; flex-shrink: 0;">
      <div style="display: flex; flex-direction: column; gap: 13px;">%(social)s%(d4)s</div>
      <div style="display: flex; flex-direction: column; gap: 13px;">%(striscia)s%(d5)s</div>
    </div>
  </div>
</div>""" % dict(
        smalto=SMALTO, icone=icone, splash=splash, lega=lega, social=social, striscia=striscia,
        head=intestazione('Applicazioni', 'DEZ 11 — Identità 07', CEMENTO, '#0B6FDB'),
        d1=didascalia('Icona: solo il simbolo, mai il marchio intero. Il fondo può passare '
                      'allo spettro o al colore di una squadra.'),
        d2=didascalia('Avvio — l\'unico punto in cui compare lo spettro.'),
        d3=didascalia('Lega: le maglie fanno da stemma, i numeri sono tabellari.'),
        d4=didascalia('Post 1:1.'),
        d5=didascalia('Fascia dello spettro: divisorio, piè di pagina, caricamento.'))
    artboard('Applicazioni.dc.html', corpo)
