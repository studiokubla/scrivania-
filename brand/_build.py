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


def maglia(width, uid, stops, bordo=CAMPO):
    """Sagoma di maglia a undici righe che campionano il gradiente sociale."""
    h = round(width * 724 / 620)
    return ('<svg viewBox="0 0 620 724" width="%d" height="%d" role="img" aria-hidden="true">'
            '<defs><clipPath id="m%s"><path d="%s"/></clipPath>%s</defs>'
            '<g clip-path="url(#m%s)">%s</g>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="18" stroke-linejoin="round"/>'
            '</svg>' % (width, h, uid, MAGLIA_D, _scanalatura_def(uid), uid,
                        _righe(stops, 0, 620, 0, 724, 11, uid), MAGLIA_D, bordo))


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
        tile('Squadra', 'Anelli sul gradiente assegnato alla squadra.', CALCE,
             marchio(140, CAMPO, [CAMPO, gradiente_sociale(0)[2], CAMPO, gradiente_sociale(0)[0], CAMPO]), True),
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
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(splash)s%(d2)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(lega)s%(d3)s</div>
    <div style="display: flex; flex-direction: column; gap: 22px; width: 300px; flex-shrink: 0;">
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


# ============================================================ sistema gradienti
def hex2rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb2hex(t):
    return '#%02X%02X%02X' % tuple(max(0, min(255, int(round(c)))) for c in t)


def campiona(stops, t):
    """Colore del gradiente `stops` alla posizione t (0..1)."""
    n = len(stops) - 1
    if t >= 1:
        return stops[-1]
    if t <= 0:
        return stops[0]
    p = t * n
    i = int(p)
    f = p - i
    a, b = hex2rgb(stops[i]), hex2rgb(stops[i + 1])
    return rgb2hex([a[k] + (b[k] - a[k]) * f for k in range(3)])


# Un gradiente sociale è un arco dello spettro: famiglia X grado 03,
# famiglia X+1 grado 02, famiglia X+2 grado 01.
def gradiente_sociale(i):
    n = len(SPETTRO)
    return [SPETTRO[i % n][1][2], SPETTRO[(i + 1) % n][1][1], SPETTRO[(i + 2) % n][1][0]]


GRADIENTI = [(SPETTRO[i][0], gradiente_sociale(i)) for i in range(12)]
G_ROSSO = gradiente_sociale(0)


def css_grad(stops, angolo='180deg'):
    return 'linear-gradient(' + angolo + ', ' + ', '.join(stops) + ')'


def grana(uid, opacita='0.34', freq='0.82'):
    """Velo di grana: il gradiente non è mai liscio."""
    return ('<svg aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; '
            'opacity: ' + opacita + '; mix-blend-mode: overlay; pointer-events: none;">'
            '<filter id="gr' + uid + '"><feTurbulence type="fractalNoise" baseFrequency="' + freq +
            '" numOctaves="3" stitchTiles="stitch"/></filter>'
            '<rect width="100%" height="100%" filter="url(#gr' + uid + ')"/></svg>')


def campo_piatto(stops, uid, angolo='180deg', stile=''):
    return ('<div style="position: relative; overflow: hidden; background: ' + css_grad(stops, angolo) +
            '; ' + stile + '">' + grana(uid) + '</div>')


SCANALATURA = ('linear-gradient(90deg, rgba(0,0,0,0.24), rgba(255,255,255,0.17) 32%, '
               'rgba(0,0,0,0.05) 64%, rgba(0,0,0,0.28))')


def campo_colonne(stops, uid, n=11, angolo='180deg', stile=''):
    """Il gradiente tagliato in n colonne verticali, ciascuna con il suo rilievo."""
    celle = ''.join('<div style="flex-grow: 1; background: %s, %s;"></div>'
                    % (SCANALATURA, campiona(stops, (i + 0.5) / n)) for i in range(n))
    return ('<div style="position: relative; overflow: hidden; display: flex; ' + stile + '">'
            + celle + grana(uid) + '</div>')


CANNE = [0.52, 0.71, 0.86, 0.96, 1.0, 0.93, 0.80, 0.66, 0.55, 0.44, 0.34]


def campo_canne_spettro(uid, altezza, stile='', altezze=None, salto=1):
    """Undici colonne, ognuna con il gradiente di una famiglia diversa."""
    altezze = altezze or CANNE
    celle = ''.join('<div style="flex-grow: 1; height: %dpx; background: %s;"></div>'
                    % (round(altezza * a), css_grad([CAMPO] + gradiente_sociale(i * salto), '180deg'))
                    for i, a in enumerate(altezze))
    return ('<div style="position: relative; overflow: hidden; display: flex; align-items: flex-end; '
            + stile + '">' + celle + grana(uid) + '</div>')


def campo_canne(stops, uid, altezza, stile='', altezze=None):
    """Colonne di altezza diversa, ciascuna col proprio gradiente verticale."""
    altezze = altezze or CANNE
    scala = [CAMPO] + list(stops)
    celle = ''.join('<div style="flex-grow: 1; height: %dpx; background: %s;"></div>'
                    % (round(altezza * a), css_grad(scala, '180deg')) for a in altezze)
    return ('<div style="position: relative; overflow: hidden; display: flex; align-items: flex-end; '
            + stile + '">' + celle + grana(uid) + '</div>')


# ============================================================== pittogrammi
def _stops_svg(uid, stops, vert=True):
    xy = 'x1="0" y1="0" x2="0" y2="1"' if vert else 'x1="0" y1="0" x2="1" y2="0"'
    fermate = ''.join('<stop offset="%s" stop-color="%s"/>' % (o, c)
                      for o, c in zip(('0', '0.5', '1'), stops))
    return '<linearGradient id="%s" %s>%s</linearGradient>' % (uid, xy, fermate)


def _scanalatura_def(uid):
    return ('<linearGradient id="fl%s" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#000000" stop-opacity="0.24"/>'
            '<stop offset="0.32" stop-color="#FFFFFF" stop-opacity="0.17"/>'
            '<stop offset="0.64" stop-color="#000000" stop-opacity="0.05"/>'
            '<stop offset="1" stop-color="#000000" stop-opacity="0.28"/></linearGradient>' % uid)


def _righe(stops, x0, x1, y0, y1, n=11, uid=''):
    passo = (x1 - x0) / float(n)
    tinte = ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="%s"/>'
                    % (x0 + i * passo, y0, passo + 0.6, y1 - y0, campiona(stops, (i + 0.5) / n))
                    for i in range(n))
    if not uid:
        return tinte
    rilievo = ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="url(#fl%s)"/>'
                      % (x0 + i * passo, y0, passo + 0.6, y1 - y0, uid) for i in range(n))
    return tinte + rilievo


def _maschera_numero(uid, trasforma, esterno=120, interno=48):
    return ('<mask id="%s"><rect width="512" height="512" fill="#FFFFFF"/>'
            '<g transform="%s" fill="none" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="%s" stroke="#000000" stroke-width="%d"/>'
            '<path d="%s" stroke="#FFFFFF" stroke-width="%d"/></g></mask>'
            % (uid, trasforma, NUM_D, esterno, NUM_D, interno))


def _svg(size, defs, corpo):
    return ('<svg viewBox="0 0 512 512" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '<defs>%s</defs>%s</svg>' % (size, size, defs, corpo))


def p_anelli(size, stops=None):
    """A · Anelli — il numero della maglia, con gli anelli concentrici del lettering."""
    return icona(size)


def p_righe(size, stops):
    """B · Righe — campo di undici righe sfumate, il numero ritagliato dentro."""
    u = 'B%d' % size
    tr = 'translate(84,96) scale(0.764)'
    defs = ('<clipPath id="c%s"><rect width="512" height="512" rx="116"/></clipPath>' % u
            + _scanalatura_def(u) + _maschera_numero('m' + u, tr))
    corpo = ('<g clip-path="url(#c%s)"><rect width="512" height="512" fill="%s"/>'
             '<g mask="url(#m%s)">%s</g></g>'
             % (u, CAMPO, u, _righe(stops, 0, 512, 0, 512, 11, u)))
    return _svg(size, defs, corpo)


def p_canne(size, stops):
    """C · Canne — undici colonne di altezza diversa: la forma della squadra."""
    u = 'C%d' % size
    larg, base, alta, x0 = 512 / 11.0, 442.0, 330.0, 0.0
    barre = ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="url(#g%s)"/>'
                    % (x0 + i * larg, base - alta * a, larg + 0.6, alta * a, u)
                    for i, a in enumerate(CANNE))
    defs = ('<clipPath id="c%s"><rect width="512" height="512" rx="116"/></clipPath>' % u
            + _stops_svg('g' + u, [CAMPO] + list(stops)))
    return _svg(size, defs,
                '<g clip-path="url(#c%s)"><rect width="512" height="512" fill="%s"/>%s</g>'
                % (u, CAMPO, barre))


FORMAZIONE = [(256, 430), (114, 338), (208, 338), (304, 338), (398, 338),
              (146, 246), (256, 246), (366, 246), (146, 142), (256, 142), (366, 142)]


def p_formazione(size, stops):
    """D · Formazione — undici punti schierati: ogni punto un passo del gradiente."""
    punti = ''.join('<circle cx="%d" cy="%d" r="27" fill="%s"/>'
                    % (x, y, campiona(stops, i / 10.0)) for i, (x, y) in enumerate(FORMAZIONE))
    return _svg(size, '', '<rect width="512" height="512" rx="116" fill="%s"/>%s' % (CAMPO, punti))


SCUDO_D = 'M 104 84 H 408 V 250 C 408 342 344 396 256 434 C 168 396 104 342 104 250 Z'


def p_scudo(size, stops):
    """E · Scudo — il distintivo classico, riempito con le undici righe."""
    u = 'E%d' % size
    defs = ('<clipPath id="c%s"><path d="%s"/></clipPath>' % (u, SCUDO_D)) + _scanalatura_def(u)
    corpo = ('<rect width="512" height="512" rx="116" fill="%s"/>'
             '<g clip-path="url(#c%s)">%s</g>'
             % (CAMPO, u, _righe(stops, 104, 408, 84, 434, 11, u)))
    return _svg(size, defs, corpo)


def p_maglia(size, stops):
    """F · Maglia — la sagoma sfumata, con il numero in negativo."""
    u = 'F%d' % size
    tr_num = 'translate(156,163) scale(0.444)'
    defs = _stops_svg('g' + u, stops) + _maschera_numero('m' + u, tr_num, 120, 46)
    corpo = ('<rect width="512" height="512" rx="116" fill="%s"/>'
             '<g mask="url(#m%s)"><g transform="translate(49,0) scale(0.6688)">'
             '<path d="%s" fill="url(#g%s)"/></g></g>'
             % (CAMPO, u, MAGLIA_D, u))
    return _svg(size, defs, corpo)


PITTOGRAMMI = [
    ('A', 'Anelli', p_anelli,
     'Il numero della maglia con gli anelli concentrici del lettering. È il marchio ridotto al suo pezzo più riconoscibile.',
     'Molto tipografico: si legge come numero prima che come segno, e sotto i 24 px l\'anima si chiude.'),
    ('B', 'Righe', p_righe,
     'Il campo di undici righe sfumate con il numero ritagliato dentro. Il sistema colore diventa lui stesso il pittogramma.',
     'Cambia faccia a ogni squadra: forte come identità di lega, meno come segno singolo da ricordare.'),
    ('C', 'Canne', p_canne,
     'Undici colonne di altezza diversa — la forma della squadra, giornata per giornata. È l\'unico che può animarsi con i dati veri.',
     'Non dice "undici" a chi non conta le colonne, e assomiglia alle icone di statistiche.'),
    ('D', 'Formazione', p_formazione,
     'Undici punti schierati in campo, ognuno un passo del gradiente. Dice subito di cosa parla l\'app.',
     'Ha bisogno di aria: sotto i 32 px i punti si impastano e resta una griglia qualsiasi.'),
    ('E', 'Scudo', p_scudo,
     'Il distintivo di sempre, riempito con le undici righe. Entra nel registro del calcio senza discutere.',
     'È il più convenzionale dei sei: riconoscibile ovunque, ma non è ancora nessuno.'),
    ('F', 'Maglia', p_maglia,
     'La sagoma della maglia con il numero in negativo. Racconta per intero l\'idea del marchio: nome, numero, schiena.',
     'La sagoma perde definizione sotto i 40 px e il numero sparisce prima.'),
]


# ============================================================= 08 · gradienti
def build_gradienti():
    def pastiglia(nome, hexv, testo):
        return ('<div style="width: 92px; height: 92px; border-radius: 10px; background: ' + hexv +
                '; padding: 10px; box-sizing: border-box; display: flex; align-items: flex-end;">'
                '<span style="font-size: 10px; font-weight: 600; line-height: 1.3; color: ' + testo +
                ';">' + nome + '</span></div>')

    freccia = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + NEBBIA +
               '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
               '<path d="M5 12 H19 M13 6 L19 12 L13 18"/></svg>')

    regola = ('<div style="display: flex; align-items: center; gap: 16px;">'
              + pastiglia('Rosso 03', '#E8341A', SMALTO) + freccia
              + pastiglia('Arancio 02', '#FF8C3D', CAMPO) + freccia
              + pastiglia('Ambra 01', '#FFD880', CAMPO) + freccia
              + '<div style="flex-grow: 1; position: relative; overflow: hidden; height: 92px; '
                'border-radius: 10px; background: ' + css_grad(G_ROSSO, '96deg') + ';">'
              + grana('reg') + '</div></div>')

    def carta(i, nome, stops):
        return ('<div style="display: flex; flex-direction: column; gap: 9px;">'
                '<div style="position: relative; overflow: hidden; height: 78px; border-radius: 10px; '
                'background: ' + css_grad(stops, '96deg') + ';">' + grana('c%d' % i) + '</div>'
                '<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 14px; color: '
                + CAMPO + ';">' + nome + '</span>'
                '<span style="font-size: 9.5px; color: ' + CEMENTO + '; font-variant-numeric: tabular-nums;">'
                + ' '.join(s.replace('#', '') for s in stops) + '</span></div></div>')

    carte = ''.join(carta(i, n, g) for i, (n, g) in enumerate(GRADIENTI))

    def modo(nome, descrizione, campo):
        return ('<div style="display: flex; flex-direction: column; gap: 12px;">' + campo
                + '<div style="display: flex; flex-direction: column; gap: 3px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 15px; color: '
                + CAMPO + ';">' + nome + '</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: ' + CEMENTO + ';">'
                + descrizione + '</span></div></div>')

    modi = ''.join([
        modo('Piatto', 'Sfondi ampi, copertine, schede lunghe.',
             campo_piatto(G_ROSSO, 'm1', '168deg', 'height: 250px; border-radius: 12px;')),
        modo('A colonne', 'Righe della maglia, intestazioni, barre di caricamento.',
             campo_colonne(G_ROSSO, 'm2', 11, '96deg', 'height: 250px; border-radius: 12px;')),
        modo('A canne', 'La forma di una squadra: grafici, avvio, animazioni.',
             '<div style="height: 250px; border-radius: 12px; overflow: hidden; background: ' + CAMPO
             + '; display: flex; align-items: flex-end; padding: 0 18px 0;">'
             + campo_canne(G_ROSSO, 'm3', 232, 'width: 100%;') + '</div>'),
    ])

    corpo = """<div style="width: 1400px; height: 1120px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: baseline; gap: 26px;">%(t1)s%(n1)s</div>
    %(regola)s
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: baseline; gap: 26px;">%(t2)s%(n2)s</div>
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px 26px;">%(carte)s</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: baseline; gap: 26px;">%(t3)s%(n3)s</div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 26px;">%(modi)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, regola=regola, carte=carte, modi=modi,
        head=intestazione('Sistema gradiente', 'DEZ 11 — Identità 08', CEMENTO, '#0B6FDB'),
        t1=titoletto('La regola'), t2=titoletto('I dodici gradienti sociali'), t3=titoletto('Tre modi'),
        n1=nota("Un gradiente sociale è un arco dello spettro: si parte da una famiglia al grado 03 "
                "e si percorrono due famiglie salendo di luce. Percorrendole in senso opposto i "
                "gradienti diventano ventiquattro."),
        n2=nota("Una squadra sceglie un gradiente, non due colori."),
        n3=nota("Sempre con la grana: il gradiente non è mai liscio."))
    artboard('Gradienti.dc.html', corpo)


# =========================================================== 09 · pittogrammi
def build_pittogrammi():
    def scheda(lettera, nome, fn, perche, ma):
        return ('<div style="display: flex; flex-direction: column; gap: 15px;">'
                '<div style="background: ' + CALCE + '; border-radius: 12px; height: 268px; '
                'display: flex; align-items: center; justify-content: center;">'
                + fn(200, G_ROSSO) + '</div>'
                '<div style="display: flex; flex-direction: column; gap: 7px;">'
                '<div style="display: flex; align-items: baseline; gap: 10px;">'
                '<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.16em; color: '
                + '#0B6FDB' + ';">' + lettera + '</span>'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 17px; color: '
                + CAMPO + ';">' + nome + '</span></div>'
                '<span style="font-size: 12.5px; line-height: 1.55; color: ' + FANGO + '; text-wrap: pretty;">'
                + perche + '</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: ' + CEMENTO + '; text-wrap: pretty;">'
                'Ma — ' + ma + '</span></div></div>')

    schede = ''.join(scheda(*p) for p in PITTOGRAMMI)
    corpo = """<div style="width: 1400px; height: 1060px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 28px;">
  %(head)s
  <div style="display: flex; align-items: baseline; gap: 26px;">%(t1)s%(n1)s</div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 34px 30px;">%(schede)s</div>
</div>""" % dict(
        smalto=SMALTO, schede=schede,
        head=intestazione('Pittogramma — sei opzioni', 'DEZ 11 — Opzioni A/F', CEMENTO, '#0B6FDB'),
        t1=titoletto('Sei modi di dire undici'),
        n1=nota("Tutti col gradiente Rosso, per confrontarli ad armi pari. Il marchio esteso "
                "(nome sopra, numero sotto) non cambia: qui si decide solo il segno breve."))
    artboard('Pittogrammi.dc.html', corpo)


def build_pittogrammi_prova():
    def colonna(lettera, nome, fn):
        return ('<div style="display: flex; flex-direction: column; align-items: center; gap: 18px;">'
                '<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; '
                'background: ' + CALCE + '; border-radius: 12px; padding: 22px 18px; width: 100%; '
                'box-sizing: border-box;">'
                + fn(88, G_ROSSO) + fn(44, G_ROSSO) + fn(26, G_ROSSO) + fn(18, G_ROSSO) + '</div>'
                '<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; '
                'background: ' + NOTTE + '; border-radius: 12px; padding: 18px; width: 100%; '
                'box-sizing: border-box;">' + fn(44, G_ROSSO) + fn(26, G_ROSSO) + '</div>'
                '<div style="display: flex; align-items: baseline; gap: 8px;">'
                '<span style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; color: #0B6FDB;">'
                + lettera + '</span>'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 14px; color: '
                + CAMPO + ';">' + nome + '</span></div></div>')

    colonne = ''.join(colonna(p[0], p[1], p[2]) for p in PITTOGRAMMI)
    corpo = """<div style="width: 1400px; height: 640px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 26px;">
  %(head)s
  <div style="display: flex; align-items: baseline; gap: 26px;">%(t1)s%(n1)s</div>
  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 24px;">%(colonne)s</div>
</div>""" % dict(
        smalto=SMALTO, colonne=colonne,
        head=intestazione('Pittogramma — prova di scala', 'DEZ 11 — Opzioni A/F', CEMENTO, '#0B6FDB'),
        t1=titoletto('88, 44, 26, 18 px'),
        n1=nota("Le misure che contano davvero: icona sul telefono, avatar in classifica, "
                "segnaposto in lista, favicon."))
    artboard('PittogrammiProva.dc.html', corpo)


# ======================================================= riscritture al gradiente
def build_main():
    corpo = """<div style="width: 900px; height: 1080px; background: %(campo)s; display: flex; flex-direction: column;">
  <div style="flex-grow: 1; box-sizing: border-box; padding: 56px 56px 0; display: flex; flex-direction: column; gap: 36px;">
    %(head)s
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">%(logo)s</div>
    <div style="display: flex; gap: 44px; align-items: flex-start; padding-bottom: 34px;">
      <p style="margin: 0; flex-grow: 1; font-family: %(display)s; font-weight: 800; font-size: 26px; line-height: 1.28; color: %(calce)s; text-wrap: pretty;">Un nome e un numero: il retro della maglia è la firma di chi scende in campo.</p>
      %(nota)s
    </div>
  </div>
  %(canne)s
</div>""" % dict(
        campo=CAMPO, calce=CALCE, display=DISPLAY,
        head=intestazione('Marchio principale', 'DEZ 11 — Identità 01'),
        logo=marchio(440, SMALTO, alt('url(#spettro)', CAMPO), GRAD % 'spettro'),
        canne=campo_canne_spettro('main', 172, 'height: 172px; flex-shrink: 0;'),
        nota=nota("Il marchio resta bianco e nero: il colore appartiene alle squadre. Undici colonne, "
                  "undici gradienti — la lega al completo.", CEMENTO, 236))
    artboard('Main.dc.html', corpo)


SQUADRE = [
    ('Zona Cesarini', 0), ('Panchina Lunga', 8), ('Tridente Atomico', 5),
    ('Muro Giallo', 2), ('Ultimo Minuto', 10), ('Contropiede', 6),
]


def build_squadre():
    def scheda(i, nome, fam):
        g = gradiente_sociale(fam)
        return ('<div style="display: flex; flex-direction: column; gap: 13px;">'
                '<div style="background: ' + CALCE + '; border-radius: 12px; height: 206px; display: flex; '
                'align-items: center; justify-content: center;">' + maglia(130, 's%d' % i, g) + '</div>'
                '<div style="display: flex; flex-direction: column; gap: 6px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 16px; color: '
                + CAMPO + ';">' + nome + '</span>'
                '<span style="font-size: 11.5px; color: ' + CEMENTO + ';">Gradiente ' + SPETTRO[fam][0] + '</span>'
                '<div style="position: relative; overflow: hidden; height: 16px; border-radius: 4px; '
                'margin-top: 2px; background: ' + css_grad(g, '96deg') + ';">' + grana('b%d' % i, '0.3') + '</div>'
                '<span style="font-size: 9.5px; color: ' + CEMENTO + '; font-variant-numeric: tabular-nums;">'
                + ' '.join(x.replace('#', '') for x in g) + '</span></div></div>')

    schede = ''.join(scheda(i, n, f) for i, (n, f) in enumerate(SQUADRE))

    def banda(i, nome, fam):
        g = gradiente_sociale(fam)
        return ('<div style="position: relative; height: 104px; border-radius: 10px; overflow: hidden;">'
                + campo_colonne(g, 'bn%d' % i, 11, '96deg',
                                'position: absolute; inset: 0;')
                + '<span style="position: absolute; left: 14px; bottom: 12px; font-family: ' + DISPLAY
                + '; font-weight: 800; font-size: 15px; color: ' + contrasto(g[1]) + ';">'
                + nome + '</span></div>')

    bande = ''.join(banda(i, n, f) for i, (n, f) in enumerate(SQUADRE))

    corpo = """<div style="width: 1400px; height: 780px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 28px;">
  %(head)s
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 10px;">
      %(t1)s
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: %(fango)s; text-wrap: pretty;">Chi crea una squadra sceglie <b>un gradiente</b>, non due colori: un arco dello spettro, dodici disponibili (ventiquattro con l'arco inverso). Da lì l'app deriva da sola maglia, stemma, intestazioni e grafici — sempre tagliati in undici righe.</p>
    </div>
    %(n1)s
  </div>
  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px;">%(schede)s</div>
  <div style="display: flex; flex-direction: column; gap: 13px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px;">%(bande)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, fango=FANGO, schede=schede, bande=bande,
        head=intestazione('Le squadre', 'DEZ 11 — Identità 06', CEMENTO, '#0B6FDB'),
        t1=titoletto('Un gradiente per squadra'), t2=titoletto('La banda della squadra'),
        n1=nota("Due squadre della stessa lega non possono prendere archi confinanti: il sistema "
                "tiene sempre tre famiglie di distanza.", CEMENTO, 300),
        n2=nota("Intestazioni, copertine di lega, schede giocatore."))
    artboard('Squadre.dc.html', corpo)


def build_colore():
    def grande(nome, hex_, uso, testo):
        return ('<div style="flex-grow: 1; background: ' + hex_ + '; border-radius: 12px; padding: 22px; '
                'height: 138px; box-sizing: border-box; display: flex; flex-direction: column; '
                'justify-content: space-between; border: 1px solid ' + NEBBIA + ';">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 19px; color: '
                + testo + ';">' + nome + '</span>'
                '<div style="display: flex; flex-direction: column; gap: 3px;">'
                '<span style="font-size: 12px; font-weight: 600; color: ' + testo
                + '; font-variant-numeric: tabular-nums;">' + hex_ + '</span>'
                '<span style="font-size: 11.5px; line-height: 1.45; color: ' + testo
                + '; opacity: 0.75;">' + uso + '</span></div></div>')

    core = ''.join([
        grande('Nero Campo', CAMPO, "Fondo dell'app, marchio, testo forte.", SMALTO),
        grande('Smalto', SMALTO, 'Superfici chiare, anelli, controtipo.', CAMPO),
        grande('Lampo', LAMPO, 'Una sola azione per schermata. Mai testo.', CAMPO),
    ])

    testate = ''.join('<div style="width: 96px; text-align: center; font-size: 10.5px; font-weight: 600; '
                      'color: ' + CEMENTO + ';">' + n + '</div>' for n, _ in SPETTRO)
    righe = ''
    for g in range(4):
        celle = ''
        for nome, passi in SPETTRO:
            col = SMALTO if g >= 2 else CAMPO
            celle += ('<div style="width: 96px; height: 92px; background: ' + passi[g] + '; border-radius: 7px; '
                      'display: flex; align-items: flex-end; padding: 8px; box-sizing: border-box;">'
                      '<span style="font-size: 9.5px; font-weight: 600; color: ' + col
                      + '; opacity: 0.82; font-variant-numeric: tabular-nums;">'
                      + passi[g].replace('#', '') + '</span></div>')
        righe += ('<div style="display: flex; gap: 6px; align-items: center;">'
                  '<span style="width: 28px; flex-shrink: 0; font-size: 10.5px; font-weight: 700; color: '
                  + CEMENTO + '; font-variant-numeric: tabular-nums;">0' + str(g + 1) + '</span>' + celle + '</div>')

    neutri = ''.join('<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 7px;">'
                     '<div style="height: 56px; background: ' + h + '; border-radius: 7px; border: 1px solid '
                     + NEBBIA + ';"></div>'
                     '<span style="font-size: 11.5px; font-weight: 600; color: ' + CAMPO + ';">' + n + '</span>'
                     '<span style="font-size: 10.5px; color: ' + CEMENTO
                     + '; font-variant-numeric: tabular-nums;">' + h + '</span></div>'
                     for n, h in [('Campo', CAMPO), ('Notte', NOTTE), ('Fango', FANGO), ('Cemento', CEMENTO),
                                  ('Nebbia', NEBBIA), ('Calce', CALCE), ('Smalto', SMALTO)])

    corpo = """<div style="width: 1400px; height: 980px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
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
  <div style="display: flex; flex-direction: column; gap: 12px;">
    %(t3)s
    <div style="display: flex; gap: 12px;">%(neutri)s</div>
  </div>
</div>""" % dict(
        smalto=SMALTO, core=core, testate=testate, righe=righe, neutri=neutri,
        head=intestazione('Sistema colore', 'DEZ 11 — Identità 05', CEMENTO, '#0B6FDB'),
        t1=titoletto('Nucleo'), t2=titoletto('Spettro — 12 famiglie, 4 gradi'), t3=titoletto('Neutri'),
        n2=nota("Non è una tavolozza da cui pescare: è la sorgente da cui si ricavano i gradienti "
                "sociali (tavola 08)."))
    artboard('Colore.dc.html', corpo)


def contrasto(hex_):
    """Nero o bianco, secondo la luminanza del fondo."""
    r, g, b = hex2rgb(hex_)
    return CAMPO if (0.299 * r + 0.587 * g + 0.114 * b) > 150 else SMALTO


def banda_spettro(uid, stile='', grado=2):
    celle = ''.join('<div style="flex-grow: 1; background: %s, %s;"></div>'
                    % (SCANALATURA, SPETTRO[i][1][grado]) for i in range(12))
    return ('<div style="position: relative; overflow: hidden; display: flex; ' + stile + '">'
            + celle + grana(uid) + '</div>')


def build_applicazioni():
    def telefono(contenuto, fondo=CAMPO):
        return ('<div style="width: 280px; height: 620px; background: ' + fondo + '; border-radius: 30px; '
                'overflow: hidden; display: flex; flex-direction: column;">' + contenuto + '</div>')

    splash = telefono(
        '<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding-top: 30px;">'
        + marchio(150, SMALTO, alt('url(#sp7)', CAMPO), GRAD % 'sp7') + '</div>'
        '<div style="padding: 0 24px 26px; display: flex; flex-direction: column; gap: 14px;">'
        '<div style="height: 52px; border-radius: 26px; background: ' + LAMPO + '; display: flex; '
        'align-items: center; justify-content: center; font-family: ' + DISPLAY + '; font-weight: 800; '
        'font-size: 17px; color: ' + CAMPO + ';">Entra in lega</div>'
        '<div style="height: 52px; border-radius: 26px; border: 1.5px solid ' + FANGO + '; display: flex; '
        'align-items: center; justify-content: center; font-size: 15px; font-weight: 600; color: '
        + CALCE + ';">Crea la tua squadra</div></div>'
        + campo_canne_spettro('sp', 96, 'height: 96px; flex-shrink: 0;'))

    righe = ''
    punti = ['78,5', '76,0', '74,5', '71,5', '70,0', '66,5']
    for i, (nome, fam) in enumerate(SQUADRE):
        righe += ('<div style="display: flex; align-items: center; gap: 13px; height: 56px; '
                  'border-bottom: 1px solid ' + NOTTE + ';">'
                  '<span style="width: 15px; font-size: 12px; font-weight: 700; color: ' + CEMENTO
                  + '; font-variant-numeric: tabular-nums;">' + str(i + 1) + '</span>'
                  + maglia(28, 'c%d' % i, gradiente_sociale(fam), NOTTE)
                  + '<span style="flex-grow: 1; font-size: 14.5px; font-weight: 600; color: ' + CALCE
                  + ';">' + nome + '</span>'
                  '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 17px; color: '
                  + SMALTO + '; font-variant-numeric: tabular-nums;">' + punti[i] + '</span></div>')

    lega = telefono(
        '<div style="padding: 34px 22px 16px; display: flex; flex-direction: column; gap: 15px;">'
        '<div style="display: flex; justify-content: space-between; align-items: center;">'
        + icona(28, CAMPO, alt(SMALTO, CAMPO), 8)
        + '<span style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.2em; color: ' + CEMENTO
        + ';">GIORNATA 12</span></div>'
        '<div style="display: flex; flex-direction: column; gap: 3px;">'
        '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 26px; color: ' + SMALTO
        + '; letter-spacing: -0.01em;">Bar dello Sport</span>'
        '<span style="font-size: 12.5px; color: ' + CEMENTO + ';">Le formazioni chiudono fra due ore</span></div>'
        + campo_colonne(gradiente_sociale(0), 'pb', 11, '96deg',
                        'height: 8px; border-radius: 4px; width: 62%;')
        + '</div><div style="padding: 0 22px; display: flex; flex-direction: column;">' + righe + '</div>')

    icone = ('<div style="display: flex; flex-direction: column; gap: 20px;">'
             '<div style="display: flex; align-items: flex-end; gap: 18px;">'
             + icona(104) + icona(64) + icona(40) + '</div>'
             '<div style="display: flex; gap: 18px;">'
             + icona(104, CAMPO, alt('url(#sp8)', CAMPO)).replace('<rect', GRAD % 'sp8' + '<rect')
             + p_righe(104, gradiente_sociale(0)) + '</div></div>')

    social = ('<div style="position: relative; width: 300px; height: 300px; border-radius: 14px; '
              'overflow: hidden;">'
              + campo_colonne(gradiente_sociale(0), 'so', 11, '96deg', 'position: absolute; inset: 0;')
              + '<div style="position: absolute; inset: 0; padding: 26px; box-sizing: border-box; '
              'display: flex; flex-direction: column; justify-content: space-between;">'
              '<span style="font-size: 10.5px; font-weight: 600; letter-spacing: 0.2em; color: '
              + CAMPO + ';">DEZ 11 · GIORNATA 12</span>'
              '<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 14px;">'
              '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 27px; line-height: 1.12; '
              'color: ' + CAMPO + '; letter-spacing: -0.02em;">Undici scelte.<br>Zero alibi.</span>'
              + '<div style="flex-shrink: 0;">' + solo_numero(74, alt(CAMPO, SMALTO)) + '</div>'
              + '</div></div></div>')

    striscia = banda_spettro('st', 'width: 300px; height: 122px; border-radius: 14px;')

    def didascalia(t):
        return '<span style="font-size: 11.5px; color: ' + CEMENTO + ';">' + t + '</span>'

    corpo = """<div style="width: 1400px; height: 840px; background: %(smalto)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; gap: 40px; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 13px; width: 268px; flex-shrink: 0;">%(icone)s%(d1)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(splash)s%(d2)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(lega)s%(d3)s</div>
    <div style="display: flex; flex-direction: column; gap: 22px; width: 300px; flex-shrink: 0;">
      <div style="display: flex; flex-direction: column; gap: 13px;">%(social)s%(d4)s</div>
      <div style="display: flex; flex-direction: column; gap: 13px;">%(striscia)s%(d5)s</div>
    </div>
  </div>
</div>""" % dict(
        smalto=SMALTO, icone=icone, splash=splash, lega=lega, social=social, striscia=striscia,
        head=intestazione('Applicazioni', 'DEZ 11 — Identità 07', CEMENTO, '#0B6FDB'),
        d1=didascalia("Icona in attesa della scelta del pittogramma: qui l'opzione A in tre misure, "
                      "poi con gli anelli nello spettro e l'opzione B a colonne."),
        d2=didascalia("Avvio: undici colonne, undici gradienti."),
        d3=didascalia("Lega: le maglie fanno da stemma, la barra di chiusura prende il gradiente di casa."),
        d4=didascalia('Post 1:1 sul campo a colonne.'),
        d5=didascalia('Fascia dello spettro: divisorio, piè di pagina, caricamento.'))
    artboard('Applicazioni.dc.html', corpo)
