# -*- coding: utf-8 -*-
"""Costruisce gli artboard .dc.html della board DEZ 11.

Regola di sistema: il sistema è in bianco e nero. L'unico colore è quello di
una squadra, e una squadra è sempre e solo DUE tinte mischiate.
"""
import io

# ---------------------------------------------------------------- neutri
CAMPO   = '#0B0C10'
NOTTE   = '#14161C'
FANGO   = '#23262E'
GRAFITE = '#3A3E48'
CEMENTO = '#5C616B'
ARDESIA = '#8A9099'
NEBBIA  = '#C9CCD3'
CALCE   = '#F1F2F4'
SMALTO  = '#FFFFFF'
LINEA   = 'rgba(255,255,255,0.10)'

# ------------------------------------------------- le dieci coppie sociali
# Ogni squadra prende una coppia: una tinta profonda e una viva, mai più di due.
COPPIE = [
    ('Rosso',   '#C81E12', '#FF6B3D'),
    ('Ambra',   '#C97400', '#FFB627'),
    ('Lime',    '#4F9400', '#ADE035'),
    ('Verde',   '#00874F', '#2FD183'),
    ('Menta',   '#00857E', '#23D2BE'),
    ('Ciano',   '#00719F', '#2BB8E8'),
    ('Azzurro', '#0B52B8', '#3E93F5'),
    ('Blu',     '#2B22C4', '#6E63FF'),
    ('Viola',   '#5F1EBE', '#A45CFF'),
    ('Rosa',    '#B31358', '#FF4F92'),
]
INDICE = {n: i for i, (n, _, _) in enumerate(COPPIE)}


def coppia(nome_o_indice):
    i = INDICE[nome_o_indice] if isinstance(nome_o_indice, str) else nome_o_indice
    return [COPPIE[i][1], COPPIE[i][2]]


ROSSO = coppia('Rosso')

DISPLAY = "'M PLUS Rounded 1c', 'Trebuchet MS', system-ui, sans-serif"
TESTO   = "'Archivo', 'Helvetica Neue', Arial, sans-serif"
MONO    = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"

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


def marchio(width, nome=CAMPO, anelli=None, defs='', extra=''):
    anelli = anelli or alt(CAMPO, SMALTO)
    return ('<svg viewBox="0 0 640 780" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '%s<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s%s</g>%s</svg>'
            % (width, round(width * 780 / 640), defs, dez(nome), num(anelli), extra))


def orizzontale(width, nome=CAMPO, anelli=None):
    anelli = anelli or alt(CAMPO, SMALTO)
    return ('<svg viewBox="0 0 1028 420" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s%s</g></svg>'
            % (width, round(width * 420 / 1028), dez(nome, 30, 270), num(anelli, 608, 54)))


def icona(size, fondo=CAMPO, anelli=None, radius=116):
    anelli = anelli or alt(SMALTO, CAMPO)
    return ('<svg viewBox="0 0 512 512" width="%d" height="%d" role="img" aria-label="DEZ 11">'
            '<rect width="512" height="512" rx="%d" fill="%s"/>'
            '<g transform="translate(84,96) scale(0.764)" fill="none" '
            'stroke-linecap="round" stroke-linejoin="round">%s</g></svg>'
            % (size, size, radius, fondo, num(anelli, 30, 54)))


def solo_numero(width, anelli=None):
    anelli = anelli or alt(CAMPO, SMALTO)
    return ('<svg viewBox="0 0 450 420" width="%d" height="%d" role="img" aria-label="11">'
            '<g fill="none" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>'
            % (width, round(width * 420 / 450), num(anelli, 30, 54)))


# ------------------------------------------------------------------ materia
def hex2rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb2hex(t):
    return '#%02X%02X%02X' % tuple(max(0, min(255, int(round(c)))) for c in t)


def campiona(stops, t):
    n = len(stops) - 1
    t = min(max(t, 0.0), 1.0)
    if t >= 1:
        return stops[-1]
    p = t * n
    i = int(p)
    f = p - i
    a, b = hex2rgb(stops[i]), hex2rgb(stops[i + 1])
    return rgb2hex([a[k] + (b[k] - a[k]) * f for k in range(3)])


def contrasto(hex_):
    r, g, b = hex2rgb(hex_)
    return CAMPO if (0.299 * r + 0.587 * g + 0.114 * b) > 150 else SMALTO


def css_grad(stops, angolo='180deg'):
    return 'linear-gradient(' + angolo + ', ' + ', '.join(stops) + ')'


SCANALATURA = ('linear-gradient(90deg, rgba(0,0,0,0.34), rgba(255,255,255,0.09) 34%, '
               'rgba(0,0,0,0.03) 66%, rgba(0,0,0,0.36))')
UNDICI = 11


def grana(uid, opacita='0.26', freq='0.86'):
    return ('<svg aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; '
            'opacity: ' + opacita + '; mix-blend-mode: overlay; pointer-events: none;">'
            '<filter id="gr' + uid + '"><feTurbulence type="fractalNoise" baseFrequency="' + freq
            + '" numOctaves="3" stitchTiles="stitch"/></filter>'
            '<rect width="100%" height="100%" filter="url(#gr' + uid + ')"/></svg>')


def campo_pieno(stops, uid, angolo='168deg', stile=''):
    return ('<div style="position: relative; overflow: hidden; background: ' + css_grad(stops, angolo)
            + '; ' + stile + '">' + grana(uid) + '</div>')


def campo_colonne(stops, uid, angolo='96deg', stile='', n=UNDICI):
    celle = ''.join('<div style="flex-grow: 1; background: %s, %s;"></div>'
                    % (SCANALATURA, campiona(stops, (i + 0.5) / n)) for i in range(n))
    return ('<div style="position: relative; overflow: hidden; display: flex; ' + stile + '">'
            + celle + grana(uid) + '</div>')


CANNE = [0.46, 0.66, 0.83, 0.95, 1.0, 0.91, 0.77, 0.63, 0.51, 0.40, 0.30]


def campo_canne(stops, uid, altezza, stile='', altezze=None):
    altezze = altezze or CANNE
    scala = [CAMPO] + list(stops)
    celle = ''.join('<div style="flex-grow: 1; height: %dpx; background: %s;"></div>'
                    % (round(altezza * a), css_grad(scala, '180deg')) for a in altezze)
    return ('<div style="position: relative; overflow: hidden; display: flex; align-items: flex-end; '
            + stile + '">' + celle + grana(uid) + '</div>')


# ------------------------------------------------------------------- maglia
MAGLIA_D = ('M 206 66 C 252 116 368 116 414 66 L 560 150 L 520 272 L 452 236 '
            'L 482 682 Q 310 716 138 682 L 168 236 L 100 272 L 60 150 Z')


def _scanalatura_def(uid):
    return ('<linearGradient id="fl%s" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#000000" stop-opacity="0.34"/>'
            '<stop offset="0.34" stop-color="#FFFFFF" stop-opacity="0.09"/>'
            '<stop offset="0.66" stop-color="#000000" stop-opacity="0.03"/>'
            '<stop offset="1" stop-color="#000000" stop-opacity="0.36"/></linearGradient>' % uid)


def _righe(stops, x0, x1, y0, y1, uid='', n=UNDICI):
    passo = (x1 - x0) / float(n)
    tinte = ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="%s"/>'
                    % (x0 + i * passo, y0, passo + 0.6, y1 - y0, campiona(stops, (i + 0.5) / n))
                    for i in range(n))
    if not uid:
        return tinte
    return tinte + ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="url(#fl%s)"/>'
                           % (x0 + i * passo, y0, passo + 0.6, y1 - y0, uid) for i in range(n))


def maglia(width, uid, stops, bordo=CAMPO):
    return ('<svg viewBox="0 0 620 724" width="%d" height="%d" role="img" aria-hidden="true">'
            '<defs><clipPath id="m%s"><path d="%s"/></clipPath>%s</defs>'
            '<g clip-path="url(#m%s)">%s</g>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="18" stroke-linejoin="round"/></svg>'
            % (width, round(width * 724 / 620), uid, MAGLIA_D, _scanalatura_def(uid), uid,
               _righe(stops, 0, 620, 0, 724, uid), MAGLIA_D, bordo))


# --------------------------------------------------------------- involucro
HELMET = """<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=M+PLUS+Rounded+1c:wght@800&display=swap">
  <style>
    body { margin: 0; font-family: %s; }
    a { color: #FFFFFF; } a:hover { color: #C9CCD3; }
  </style>
</helmet>""" % TESTO


def artboard(nome, corpo):
    with io.open(nome, 'w', encoding='utf-8') as f:
        f.write('<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n'
                '  <script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n'
                + HELMET + '\n' + corpo + '\n</x-dc>\n</body>\n</html>\n')
    print('  ' + nome)


def micro(testo, colore=CEMENTO):
    return ('<span style="font-family: ' + MONO + '; font-size: 10.5px; font-weight: 500; '
            'letter-spacing: 0.16em; text-transform: uppercase; color: ' + colore + ';">'
            + testo + '</span>')


def intestazione(sinistra, destra):
    return ('<div style="display: flex; justify-content: space-between; align-items: baseline; '
            'gap: 24px; padding-bottom: 18px; border-bottom: 1px solid ' + LINEA + ';">'
            + micro(sinistra, SMALTO) + micro(destra, CEMENTO) + '</div>')


def titoletto(testo, colore=SMALTO):
    return ('<h2 style="margin: 0; font-family: ' + DISPLAY + '; font-weight: 800; font-size: 19px; '
            'letter-spacing: -0.01em; color: ' + colore + ';">' + testo + '</h2>')


def nota(testo, colore=ARDESIA, larghezza=None):
    w = ('width: %dpx; flex-shrink: 0; ' % larghezza) if larghezza else ''
    return ('<p style="margin: 0; ' + w + 'font-size: 13px; line-height: 1.62; color: ' + colore
            + '; text-wrap: pretty;">' + testo + '</p>')


def dato(testo, colore=SMALTO, dim='11px'):
    return ('<span style="font-family: ' + MONO + '; font-size: ' + dim + '; font-weight: 400; '
            'letter-spacing: 0.02em; color: ' + colore + ';">' + testo + '</span>')


def foglio(w, h, corpo, gap=30, fondo=CAMPO):
    return ('<div style="width: %dpx; height: %dpx; background: %s; box-sizing: border-box; '
            'padding: 56px; display: flex; flex-direction: column; gap: %dpx;">%s</div>'
            % (w, h, fondo, gap, corpo))


# ------------------------------------------------------------- pittogrammi
def _stops_svg(uid, stops, vert=True):
    xy = 'x1="0" y1="0" x2="0" y2="1"' if vert else 'x1="0" y1="0" x2="1" y2="0"'
    fermate = ''.join('<stop offset="%s" stop-color="%s"/>' % (o, c)
                      for o, c in zip(('0', '1'), stops))
    return '<linearGradient id="%s" %s>%s</linearGradient>' % (uid, xy, fermate)


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
    return icona(size)


def p_righe(size, stops):
    u = 'B%d' % size
    defs = ('<clipPath id="c%s"><rect width="512" height="512" rx="116"/></clipPath>' % u
            + _scanalatura_def(u) + _maschera_numero('m' + u, 'translate(84,96) scale(0.764)'))
    return _svg(size, defs,
                '<g clip-path="url(#c%s)"><rect width="512" height="512" fill="%s"/>'
                '<g mask="url(#m%s)">%s</g></g>'
                % (u, CAMPO, u, _righe(stops, 0, 512, 0, 512, u)))


def p_canne(size, stops):
    u = 'C%d' % size
    larg, base, alta = 512 / 11.0, 442.0, 330.0
    barre = ''.join('<rect x="%.2f" y="%.1f" width="%.2f" height="%.1f" fill="url(#g%s)"/>'
                    % (i * larg, base - alta * a, larg + 0.6, alta * a, u)
                    for i, a in enumerate(CANNE))
    defs = ('<clipPath id="c%s"><rect width="512" height="512" rx="116"/></clipPath>' % u
            + '<linearGradient id="g%s" x1="0" y1="0" x2="0" y2="1">'
              '<stop offset="0" stop-color="%s"/><stop offset="0.18" stop-color="%s"/>'
              '<stop offset="1" stop-color="%s"/></linearGradient>' % (u, CAMPO, stops[0], stops[1]))
    return _svg(size, defs, '<g clip-path="url(#c%s)"><rect width="512" height="512" fill="%s"/>%s</g>'
                % (u, CAMPO, barre))


FORMAZIONE = [(256, 430), (114, 338), (208, 338), (304, 338), (398, 338),
              (146, 246), (256, 246), (366, 246), (146, 142), (256, 142), (366, 142)]


def p_formazione(size, stops):
    punti = ''.join('<circle cx="%d" cy="%d" r="27" fill="%s"/>'
                    % (x, y, campiona(stops, 1 - i / 10.0)) for i, (x, y) in enumerate(FORMAZIONE))
    return _svg(size, '', '<rect width="512" height="512" rx="116" fill="%s"/>%s' % (CAMPO, punti))


SCUDO_D = 'M 104 84 H 408 V 250 C 408 342 344 396 256 434 C 168 396 104 342 104 250 Z'


def p_scudo(size, stops):
    u = 'E%d' % size
    defs = ('<clipPath id="c%s"><path d="%s"/></clipPath>' % (u, SCUDO_D)) + _scanalatura_def(u)
    return _svg(size, defs,
                '<rect width="512" height="512" rx="116" fill="%s"/><g clip-path="url(#c%s)">%s</g>'
                % (CAMPO, u, _righe(stops, 104, 408, 84, 434, u)))


def p_maglia(size, stops):
    u = 'F%d' % size
    defs = _stops_svg('g' + u, stops) + _maschera_numero('m' + u, 'translate(156,163) scale(0.444)', 120, 46)
    return _svg(size, defs,
                '<rect width="512" height="512" rx="116" fill="%s"/>'
                '<g mask="url(#m%s)"><g transform="translate(49,0) scale(0.6688)">'
                '<path d="%s" fill="url(#g%s)"/></g></g>' % (CAMPO, u, MAGLIA_D, u))


PITTOGRAMMI = [
    ('A', 'Anelli', p_anelli,
     'Il numero della maglia con gli anelli concentrici del lettering. Il marchio ridotto al suo pezzo più riconoscibile, e l\'unico che non porta colore.',
     'Molto tipografico: si legge come numero prima che come segno, e sotto i 24 px l\'anima si chiude.'),
    ('B', 'Righe', p_righe,
     'Undici righe scanalate nelle due tinte della squadra, con il numero ritagliato dentro. Il sistema colore diventa lui stesso il pittogramma.',
     'Cambia faccia a ogni squadra: forte come identità di lega, meno come segno singolo da ricordare.'),
    ('C', 'Canne', p_canne,
     'Undici colonne che emergono dal nero — la forma della squadra, giornata per giornata. È l\'unico che può animarsi con i dati veri.',
     'Non dice "undici" a chi non conta le colonne, e assomiglia alle icone di statistiche.'),
    ('D', 'Formazione', p_formazione,
     'Undici punti schierati in campo, dalla tinta viva alla profonda. Il più asciutto dei sei e il più immediato da capire.',
     'Ha bisogno di aria: sotto i 32 px i punti si impastano e resta una griglia qualsiasi.'),
    ('E', 'Scudo', p_scudo,
     'Il distintivo di sempre, riempito con le undici righe. Entra nel registro del calcio senza discutere.',
     'È il meno tech dei sei: dice "società sportiva" prima che "prodotto", e non è ancora nessuno.'),
    ('F', 'Maglia', p_maglia,
     'La sagoma della maglia con il numero in negativo. Racconta per intero l\'idea del marchio: nome, numero, schiena.',
     'La sagoma perde definizione sotto i 40 px e il numero sparisce prima.'),
]


# ============================================================== 01 · marchio
def build_main():
    corpo = ("""<div style="width: 900px; height: 1080px; background: %(campo)s; display: flex; flex-direction: column;">
  <div style="flex-grow: 1; box-sizing: border-box; padding: 56px 56px 0; display: flex; flex-direction: column; gap: 40px;">
    %(head)s
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">%(logo)s</div>
    <div style="display: flex; gap: 44px; align-items: flex-start; padding-bottom: 40px;">
      <p style="margin: 0; flex-grow: 1; font-family: %(display)s; font-weight: 800; font-size: 26px; line-height: 1.28; color: %(calce)s; text-wrap: pretty;">Un nome e un numero: il retro della maglia è la firma di chi scende in campo.</p>
      %(nota)s
    </div>
  </div>
  %(banda)s
</div>""") % dict(
        campo=CAMPO, calce=CALCE, display=DISPLAY,
        head=intestazione('Marchio', 'DEZ 11 / 01'),
        logo=marchio(430, SMALTO, alt(SMALTO, CAMPO)),
        banda=campo_colonne(ROSSO, 'main', '96deg', 'height: 120px; flex-shrink: 0;'),
        nota=nota("Il marchio non porta colore: è bianco su nero o nero su bianco, sempre. "
                  "L'unico colore in campo è quello di una squadra — due tinte, mai una di più.",
                  ARDESIA, 246))
    artboard('Main.dc.html', corpo)


# ========================================================== 02 · costruzione
def build_costruzione():
    griglia = (''.join('<path d="M%d 0 V780"/>' % x for x in range(0, 641, 30))
               + ''.join('<path d="M0 %d H640"/>' % y for y in range(0, 781, 30)))
    tavola = ('<svg viewBox="-10 -10 660 800" width="470" height="570" role="img" aria-label="Griglia">'
              '<g fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1">' + griglia + '</g>'
              '<rect x="0" y="0" width="640" height="780" fill="none" stroke="' + ROSSO[1]
              + '" stroke-width="3" stroke-dasharray="14 10"/>'
              '<rect x="61" y="60" width="518" height="660" fill="none" stroke="' + GRAFITE + '" stroke-width="3"/>'
              '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'
              + dez(SMALTO) + num(alt(SMALTO, CAMPO)) + '</g></svg>')

    def riga(k, v):
        return ('<div style="display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; '
                'border-bottom: 1px solid ' + LINEA + ';">'
                '<span style="font-size: 13px; color: ' + ARDESIA + ';">' + k + '</span>'
                + dato(v, SMALTO, '12px') + '</div>')

    misure = ''.join(riga(k, v) for k, v in [
        ('Asta del nome', '2u'), ('Altezza del nome', '6u'),
        ('Asta del numero', '4u'), ('Altezza del numero', '14u'),
        ('Distanza nome / numero', '2u'), ('Area di rispetto', '2u'),
        ('Anelli concentrici', '4 x 0,4u'), ('Anima del numero', '0,8u')])

    def sbagliato(etichetta, stile, contenuto):
        return ('<div style="display: flex; flex-direction: column; gap: 10px;">'
                '<div style="height: 116px; background: ' + NOTTE + '; border-radius: 8px; display: flex; '
                'align-items: center; justify-content: center; overflow: hidden; position: relative;">'
                '<div style="' + stile + '">' + contenuto + '</div>'
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + ROSSO[1]
                + '" stroke-width="3" stroke-linecap="round" style="position: absolute; top: 9px; right: 9px;">'
                '<path d="M5 5 L19 19 M19 5 L5 19"/></svg></div>'
                '<span style="font-size: 11.5px; line-height: 1.45; color: ' + CEMENTO + ';">'
                + etichetta + '</span></div>')

    m = lambda: marchio(74, SMALTO, alt(SMALTO, CAMPO))
    don_ts = ''.join([
        sbagliato('Non inclinare né ruotare il marchio.', 'transform: rotate(-9deg);', m()),
        sbagliato('Mai più di due tinte, e mai una per anello.', '',
                  marchio(74, '#A45CFF', ['#FF6B3D', CAMPO, '#2FD183', CAMPO, '#3E93F5'])),
        sbagliato('Niente ombre, sfumature o contorni aggiunti.',
                  'filter: drop-shadow(4px 6px 0 ' + GRAFITE + ');', m()),
        sbagliato('Non alterare il rapporto fra nome e numero.', 'transform: scaleX(1.45);', m()),
    ])

    corpo = ("""<div style="width: 1240px; height: 930px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 34px;">
  %(head)s
  <div style="display: flex; gap: 52px; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 16px; flex-shrink: 0;">
      %(tavola)s
      <div style="display: flex; gap: 22px; align-items: center;">
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: %(grafite)s;"></span>ingombro</span>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: repeating-linear-gradient(90deg, %(rosso)s 0 7px, transparent 7px 12px);"></span>area di rispetto</span>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: %(cemento)s;"><span style="width: 22px; height: 3px; background: %(fango)s;"></span>1u = 30</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 30px; flex-grow: 1;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        %(t1)s%(n1)s
        <div style="margin-top: 6px;">%(misure)s</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        %(t2)s%(n2)s
        <div style="display: flex; gap: 18px; margin-top: 4px;">%(minime)s</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px;">
        %(t3)s
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px;">%(donts)s</div>
      </div>
    </div>
  </div>
</div>""") % dict(
        campo=CAMPO, cemento=CEMENTO, grafite=GRAFITE, fango=FANGO, rosso=ROSSO[1],
        head=intestazione('Costruzione e uso', 'DEZ 11 / 02'),
        tavola=tavola, misure=misure, donts=don_ts,
        t1=titoletto('Il modulo'), t2=titoletto('Dimensioni minime'), t3=titoletto('Usi da evitare'),
        n1=nota("Tutto nasce da <b>1u</b>, un quarto dell'asta del numero. Gli anelli chiari sono "
                "bianco pieno, non trasparenti: il marchio regge su qualsiasi fondo."),
        n2=nota("Sotto queste misure l'anima del numero si chiude: usare il simbolo."),
        minime=''.join('<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 7px;">'
                       '<span style="font-family: ' + MONO + '; font-weight: 500; font-size: 21px; color: '
                       + SMALTO + ';">' + a + '</span>'
                       '<span style="font-size: 11.5px; line-height: 1.45; color: ' + CEMENTO + ';">'
                       + b + '</span></div>'
                       for a, b in [('96 px', 'marchio verticale<br>20 mm in stampa'),
                                    ('160 px', 'lockup orizzontale<br>32 mm in stampa'),
                                    ('32 px', 'simbolo<br>sotto: anima piena')]))
    artboard('Costruzione.dc.html', corpo)


# ============================================================= 03 · varianti
def build_varianti():
    def tile(etichetta, descrizione, fondo, contenuto, bordo=False):
        b = ('border: 1px solid ' + LINEA + '; ') if bordo else ''
        return ('<div style="display: flex; flex-direction: column; gap: 12px;">'
                '<div style="' + b + 'height: 262px; background: ' + fondo + '; border-radius: 10px; '
                'display: flex; align-items: center; justify-content: center; overflow: hidden;">'
                + contenuto + '</div>'
                '<div style="display: flex; flex-direction: column; gap: 4px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 15px; color: '
                + SMALTO + ';">' + etichetta + '</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: ' + CEMENTO + ';">'
                + descrizione + '</span></div></div>')

    tiles = ''.join([
        tile('Positivo', 'Su fondi chiari. Nero pieno, anelli bianchi.', CALCE, marchio(140)),
        tile('Negativo', 'Su Nero Campo e su fondi scuri. È la versione predefinita.', NOTTE,
             marchio(140, SMALTO, alt(SMALTO, CAMPO)), True),
        tile('Squadra', 'Anelli nelle due tinte della squadra. Mai una terza.', NOTTE,
             marchio(140, SMALTO, [SMALTO, ROSSO[0], SMALTO, ROSSO[1], SMALTO]), True),
        tile('Orizzontale', 'Testate, barre superiori, spazi bassi e larghi.', CALCE, orizzontale(280)),
        tile('Simbolo', 'Icona app, avatar, favicon, bottoni.', NOTTE,
             icona(150, CAMPO, alt(SMALTO, CAMPO)), True),
        tile('Micro', 'Sotto i 40 px resta solo il simbolo, mai il marchio intero.', NOTTE,
             '<div style="display: flex; align-items: flex-end; gap: 20px;">'
             + icona(64, CAMPO, alt(SMALTO, CAMPO), 15) + icona(40, CAMPO, alt(SMALTO, CAMPO), 9)
             + icona(26, CAMPO, alt(SMALTO, CAMPO), 6) + icona(18, CAMPO, alt(SMALTO, CAMPO), 4)
             + '</div>', True),
    ])
    corpo = foglio(1240, 840,
                   intestazione('Varianti del marchio', 'DEZ 11 / 03')
                   + '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); '
                     'gap: 30px;">' + tiles + '</div>', 32)
    artboard('Varianti.dc.html', corpo)


# =========================================================== 04 · tipografia
GLIFI = {
    'D': ('-30 -30 170 180', '<path d="M0 120 L0 0 L44 0 C92 0 110 27 110 60 C110 93 92 120 44 120 Z"/>'),
    'E': ('-30 -30 156 180', '<path d="M96 0 L0 0 L0 120 L96 120"/><path d="M0 60 L82 60"/>'),
    'Z': ('-30 -30 162 180', '<path d="M0 0 L102 0 L0 120 L102 120"/>'),
}


def glifo(lettera, altezza, colore=SMALTO):
    vb, d = GLIFI[lettera]
    w = round(altezza * float(vb.split()[2]) / float(vb.split()[3]))
    return ('<svg viewBox="%s" width="%d" height="%d" role="img" aria-label="%s" fill="none" '
            'stroke="%s" stroke-width="60" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
            % (vb, w, altezza, lettera, colore, d))


def glifo_uno(altezza):
    inner = ''.join('<path d="M30 84 L120 6 L120 306" stroke="%s" stroke-width="%d"/>' % (c, w)
                    for c, w in zip(alt(SMALTO, CAMPO), RINGS))
    return ('<svg viewBox="-30 -54 210 420" width="%d" height="%d" role="img" aria-label="1" '
            'fill="none" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
            % (round(altezza * 210 / 420), altezza, inner))


def build_tipografia():
    lettering = ('<div style="display: flex; align-items: flex-end; gap: 26px; line-height: 0;">'
                 + glifo('D', 92) + glifo('E', 92) + glifo('Z', 92)
                 + '<div style="width: 16px;"></div>'
                 + '<div style="margin-bottom: -15px;">' + glifo_uno(215) + '</div></div>')

    def scala(nome, spec, campione, stile):
        return ('<div style="display: flex; align-items: baseline; gap: 22px; padding: 11px 0; '
                'border-bottom: 1px solid ' + LINEA + ';">'
                '<span style="width: 96px; flex-shrink: 0;">' + micro(nome) + '</span>'
                '<span style="width: 168px; flex-shrink: 0;">' + dato(spec, CEMENTO, '11px') + '</span>'
                '<span style="' + stile + '">' + campione + '</span></div>')

    tabella = ''.join([
        scala('Display XL', 'Rounded 800 / 56 / 58', 'Undici titolari',
              'font-family: %s; font-weight: 800; font-size: 30px; color: %s;' % (DISPLAY, SMALTO)),
        scala('Display L', 'Rounded 800 / 34 / 38', 'La mia rosa',
              'font-family: %s; font-weight: 800; font-size: 23px; color: %s;' % (DISPLAY, SMALTO)),
        scala('Titolo', 'Archivo 700 / 22 / 28', 'Classifica di lega',
              'font-family: %s; font-weight: 700; font-size: 19px; color: %s;' % (TESTO, CALCE)),
        scala('Corpo', 'Archivo 400 / 16 / 25', "Le formazioni chiudono un quarto d'ora prima.",
              'font-family: %s; font-weight: 400; font-size: 15px; color: %s;' % (TESTO, ARDESIA)),
        scala('Dato', 'Plex Mono 500 / 16', '78,5   1.204   11',
              'font-family: %s; font-weight: 500; font-size: 15px; color: %s;' % (MONO, SMALTO)),
        scala('Micro', 'Plex Mono 500 / 11', 'GIORNATA 12',
              'font-family: %s; font-weight: 500; font-size: 11px; letter-spacing: 0.16em; color: %s;'
              % (MONO, CEMENTO)),
    ])

    corpo = ("""<div style="width: 1000px; height: 1200px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 32px;">
  %(head)s
  <div style="display: flex; flex-direction: column; gap: 14px;">
    %(t1)s%(n1)s
    <div style="background: %(notte)s; border-radius: 10px; padding: 32px 38px; margin-top: 4px;">%(lettering)s</div>
  </div>
  <div style="display: flex; gap: 40px;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
      %(t2)s%(n2)s
      <div style="font-family: %(display)s; font-weight: 800; font-size: 36px; line-height: 1.1; letter-spacing: -0.02em; color: %(smalto)s; margin-top: 4px;">Undici scelte<br>a settimana</div>
    </div>
    <div style="width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">
      %(t3)s%(n3)s
      <div style="font-family: %(mono)s; font-weight: 500; font-size: 26px; letter-spacing: -0.01em; color: %(smalto)s; margin-top: 4px;">0123456789</div>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    %(t4)s
    <p style="margin: 0; font-size: 15px; line-height: 1.62; color: %(ardesia)s; text-wrap: pretty;">Archivo tiene insieme liste, regolamenti e testi lunghi: pesi ravvicinati e una larghezza che non si sfalda a 12 px. Il Rounded resta per i momenti in cui DEZ 11 alza il tono, il Mono per tutto ciò che è misura.</p>
  </div>
  <div style="display: flex; flex-direction: column; gap: 10px;">
    %(t5)s
    <div>%(tabella)s</div>
  </div>
</div>""") % dict(
        campo=CAMPO, notte=NOTTE, smalto=SMALTO, ardesia=ARDESIA, display=DISPLAY, mono=MONO,
        head=intestazione('Tipografia', 'DEZ 11 / 04'), lettering=lettering, tabella=tabella,
        t1=titoletto('Lettering del marchio'), t2=titoletto('Display — M PLUS Rounded 1c'),
        t3=titoletto('Dati — IBM Plex Mono'), t4=titoletto('Testo — Archivo'), t5=titoletto('Scala'),
        n1=nota("Quattro forme disegnate, non composte: aste monolineari, terminali circolari, "
                "nessun raccordo angolare. Restano un file vettoriale — non si riscrivono con un font."),
        n2=nota("Titoli e numeri grandi."),
        n3=nota("Punteggi, quote, orari, etichette."))
    artboard('Tipografia.dc.html', corpo)


# =============================================================== 05 · colore
def build_colore():
    neutri = ''.join(
        '<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px;">'
        '<div style="height: 62px; background: ' + h + '; border-radius: 6px; border: 1px solid '
        + LINEA + ';"></div>'
        '<span style="font-size: 11.5px; font-weight: 600; color: ' + CALCE + ';">' + n + '</span>'
        + dato(h, CEMENTO, '10px') + '</div>'
        for n, h in [('Campo', CAMPO), ('Notte', NOTTE), ('Fango', FANGO), ('Grafite', GRAFITE),
                     ('Cemento', CEMENTO), ('Ardesia', ARDESIA), ('Nebbia', NEBBIA),
                     ('Calce', CALCE), ('Smalto', SMALTO)])

    def carta(i, nome, scuro, chiaro):
        return ('<div style="display: flex; flex-direction: column; gap: 10px;">'
                '<div style="position: relative; overflow: hidden; height: 84px; border-radius: 8px; '
                'background: ' + css_grad([scuro, chiaro], '96deg') + ';">' + grana('k%d' % i) + '</div>'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 14px; color: '
                + SMALTO + ';">' + nome + '</span>'
                '<div style="display: flex; justify-content: space-between; gap: 8px;">'
                + dato(scuro.replace('#', ''), CEMENTO, '10px')
                + dato(chiaro.replace('#', ''), CEMENTO, '10px') + '</div></div>')

    carte = ''.join(carta(i, *c) for i, c in enumerate(COPPIE))

    corpo = ("""<div style="width: 1400px; height: 790px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 10px;">
      %(t0)s
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: %(ardesia)s; text-wrap: pretty;">Il sistema è in bianco e nero. L'unico colore è quello di una squadra, e una squadra è <b style="color: %(smalto)s;">due tinte</b>: una profonda e una viva, della stessa famiglia. Mai una terza, mai due coppie nello stesso elemento.</p>
    </div>
    %(n0)s
  </div>
  <div style="display: flex; flex-direction: column; gap: 13px;">
    %(t1)s
    <div style="display: flex; gap: 12px;">%(neutri)s</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 13px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 22px;">%(carte)s</div>
  </div>
</div>""") % dict(
        campo=CAMPO, ardesia=ARDESIA, smalto=SMALTO, neutri=neutri, carte=carte,
        head=intestazione('Colore', 'DEZ 11 / 05'),
        t0=titoletto('Due tinte, mai tre'), t1=titoletto('Neutri'),
        t2=titoletto('Le dieci coppie'),
        n0=nota("Nessun colore d'accento di sistema: anche il bottone principale prende la tinta "
                "viva della squadra di chi guarda.", ARDESIA, 300),
        n2=nota("Dieci coppie, una lega piena. Due squadre non possono prendere famiglie confinanti."))
    artboard('Colore.dc.html', corpo)


# ============================================================ 08 · gradiente
def build_gradiente():
    freccia = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + GRAFITE
               + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">'
               '<path d="M5 12 H19 M13 6 L19 12 L13 18"/></svg>')

    taglio = ('<div style="display: flex; align-items: center; gap: 20px;">'
              + campo_pieno(ROSSO, 'tg1', '96deg', 'height: 112px; border-radius: 8px; width: 380px; '
                                                   'flex-shrink: 0;')
              + freccia
              + campo_colonne(ROSSO, 'tg2', '96deg', 'height: 112px; border-radius: 8px; flex-grow: 1;')
              + '</div>')

    def modo(nome, descrizione, campo):
        return ('<div style="display: flex; flex-direction: column; gap: 12px;">' + campo
                + '<div style="display: flex; flex-direction: column; gap: 4px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 15px; color: '
                + SMALTO + ';">' + nome + '</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: ' + CEMENTO + ';">'
                + descrizione + '</span></div></div>')

    modi = ''.join([
        modo('Pieno', 'Sfondi ampi, copertine, schede lunghe.',
             campo_pieno(ROSSO, 'md1', '168deg', 'height: 236px; border-radius: 10px;')),
        modo('A colonne', 'Maglie, intestazioni, barre di caricamento.',
             campo_colonne(ROSSO, 'md2', '96deg', 'height: 236px; border-radius: 10px;')),
        modo('A canne', 'La forma di una squadra: grafici, avvio, animazioni.',
             '<div style="height: 236px; border-radius: 10px; overflow: hidden; background: ' + CAMPO
             + '; display: flex; align-items: flex-end;">'
             + campo_canne(ROSSO, 'md3', 224, 'width: 100%;') + '</div>'),
    ])

    corpo = ("""<div style="width: 1400px; height: 760px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 28px;">
  %(head)s
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 10px;">
      %(t1)s
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: %(ardesia)s; text-wrap: pretty;">Le due tinte di una squadra non si accostano: si mischiano, e la mescolanza viene tagliata in <b style="color: %(smalto)s;">undici colonne</b>. È l'unica geometria del sistema — la riga della maglia e il numero dei titolari sono la stessa cosa.</p>
    </div>
    %(n1)s
  </div>
  %(taglio)s
  <div style="display: flex; flex-direction: column; gap: 13px; margin-top: 2px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 26px;">%(modi)s</div>
  </div>
</div>""") % dict(
        campo=CAMPO, ardesia=ARDESIA, smalto=SMALTO, taglio=taglio, modi=modi,
        head=intestazione('Gradiente', 'DEZ 11 / 08'),
        t1=titoletto('Il taglio in undici'), t2=titoletto('Tre modi'),
        n1=nota("Sempre con la grana, sempre a 11 colonne, sempre due tinte. Tre regole e niente "
                "altro da ricordare.", ARDESIA, 300),
        n2=nota("La scanalatura è la stessa in tutti e tre: il rilievo non cambia con il colore."))
    artboard('Gradiente.dc.html', corpo)


# ============================================================== 06 · squadre
SQUADRE = [('Zona Cesarini', 'Rosso'), ('Panchina Lunga', 'Azzurro'), ('Tridente Atomico', 'Verde'),
           ('Muro Giallo', 'Ambra'), ('Ultimo Minuto', 'Viola'), ('Contropiede', 'Menta')]


def build_squadre():
    def scheda(i, nome, fam):
        c = coppia(fam)
        return ('<div style="display: flex; flex-direction: column; gap: 12px;">'
                '<div style="background: ' + NOTTE + '; border-radius: 10px; height: 194px; display: flex; '
                'align-items: center; justify-content: center;">' + maglia(124, 's%d' % i, c, NOTTE) + '</div>'
                '<div style="display: flex; flex-direction: column; gap: 5px;">'
                '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 15px; color: '
                + SMALTO + ';">' + nome + '</span>'
                '<span style="font-size: 11.5px; color: ' + CEMENTO + ';">Coppia ' + fam + '</span>'
                '<div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 2px;">'
                + dato(c[0].replace('#', ''), CEMENTO, '10px')
                + dato(c[1].replace('#', ''), CEMENTO, '10px') + '</div></div></div>')

    schede = ''.join(scheda(i, n, f) for i, (n, f) in enumerate(SQUADRE))

    def banda(i, nome, fam):
        c = coppia(fam)
        return ('<div style="position: relative; height: 92px; border-radius: 8px; overflow: hidden;">'
                + campo_colonne(c, 'bn%d' % i, '96deg', 'position: absolute; inset: 0;')
                + '<span style="position: absolute; left: 13px; bottom: 11px; font-family: ' + DISPLAY
                + '; font-weight: 800; font-size: 14px; color: ' + contrasto(campiona(c, 0.75)) + ';">'
                + nome + '</span></div>')

    bande = ''.join(banda(i, n, f) for i, (n, f) in enumerate(SQUADRE))

    corpo = ("""<div style="width: 1400px; height: 720px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 28px;">
  %(head)s
  <div style="display: flex; gap: 44px; align-items: flex-start;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 10px;">
      %(t1)s
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: %(ardesia)s; text-wrap: pretty;">Chi crea una squadra sceglie <b style="color: %(smalto)s;">una coppia</b> fra le dieci. Da lì l'app deriva da sola maglia, stemma, intestazioni e grafici — sempre tagliati in undici righe, sempre due tinte.</p>
    </div>
    %(n1)s
  </div>
  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px;">%(schede)s</div>
  <div style="display: flex; flex-direction: column; gap: 13px;">
    <div style="display: flex; align-items: baseline; gap: 24px;">%(t2)s%(n2)s</div>
    <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 22px;">%(bande)s</div>
  </div>
</div>""") % dict(
        campo=CAMPO, ardesia=ARDESIA, smalto=SMALTO, schede=schede, bande=bande,
        head=intestazione('Le squadre', 'DEZ 11 / 06'),
        t1=titoletto('Una coppia per squadra'), t2=titoletto('La banda della squadra'),
        n1=nota("Il sistema tiene sempre due famiglie di distanza fra due squadre della stessa lega.",
                ARDESIA, 300),
        n2=nota("Intestazioni, copertine di lega, schede giocatore."))
    artboard('Squadre.dc.html', corpo)


# ========================================================= 07 · applicazioni
def build_applicazioni():
    def telefono(contenuto, fondo=CAMPO):
        return ('<div style="width: 280px; height: 604px; background: ' + fondo + '; border-radius: 28px; '
                'border: 1px solid rgba(255,255,255,0.13); box-sizing: border-box; '
                'overflow: hidden; display: flex; flex-direction: column;">' + contenuto + '</div>')

    splash = telefono(
        '<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; '
        'padding-top: 26px;">' + marchio(146, SMALTO, alt(SMALTO, CAMPO)) + '</div>'
        '<div style="padding: 0 24px 26px; display: flex; flex-direction: column; gap: 13px;">'
        '<div style="height: 50px; border-radius: 8px; background: ' + ROSSO[1] + '; display: flex; '
        'align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: '
        + CAMPO + ';">Entra in lega</div>'
        '<div style="height: 50px; border-radius: 8px; border: 1px solid ' + GRAFITE + '; display: flex; '
        'align-items: center; justify-content: center; font-size: 15px; font-weight: 600; color: '
        + CALCE + ';">Crea la tua squadra</div></div>'
        + campo_canne(ROSSO, 'sp', 88, 'height: 88px; flex-shrink: 0;'))

    righe = ''
    punti = ['78,5', '76,0', '74,5', '71,5', '70,0', '66,5']
    for i, (nome, fam) in enumerate(SQUADRE):
        righe += ('<div style="display: flex; align-items: center; gap: 13px; height: 54px; '
                  'border-bottom: 1px solid ' + LINEA + ';">'
                  + dato(str(i + 1), CEMENTO, '11px')
                  + maglia(26, 'c%d' % i, coppia(fam), CAMPO)
                  + '<span style="flex-grow: 1; font-size: 14.5px; font-weight: 600; color: ' + CALCE
                  + ';">' + nome + '</span>'
                  '<span style="font-family: ' + MONO + '; font-weight: 500; font-size: 15px; color: '
                  + SMALTO + ';">' + punti[i] + '</span></div>')

    lega = telefono(
        '<div style="padding: 32px 22px 14px; display: flex; flex-direction: column; gap: 14px;">'
        '<div style="display: flex; justify-content: space-between; align-items: center;">'
        + icona(26, CAMPO, alt(SMALTO, CAMPO), 7) + micro('Giornata 12') + '</div>'
        '<div style="display: flex; flex-direction: column; gap: 4px;">'
        '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 25px; color: ' + SMALTO
        + '; letter-spacing: -0.01em;">Bar dello Sport</span>'
        '<span style="font-size: 12.5px; color: ' + CEMENTO + ';">Le formazioni chiudono fra due ore</span></div>'
        + campo_colonne(ROSSO, 'pb', '96deg', 'height: 6px; border-radius: 3px; width: 62%;')
        + '</div><div style="padding: 0 22px; display: flex; flex-direction: column;">' + righe + '</div>')

    icone = ('<div style="background: ' + NOTTE + '; border-radius: 12px; padding: 22px; '
             'display: flex; flex-direction: column; gap: 20px;">'
             '<div style="display: flex; align-items: flex-end; gap: 18px;">'
             + icona(100, CAMPO, alt(SMALTO, CAMPO)) + icona(60, CAMPO, alt(SMALTO, CAMPO), 14)
             + icona(38, CAMPO, alt(SMALTO, CAMPO), 9) + '</div>'
             '<div style="display: flex; gap: 18px;">'
             + icona(100, CAMPO, [SMALTO, ROSSO[0], SMALTO, ROSSO[1], SMALTO])
             + p_righe(100, ROSSO) + '</div></div>')

    scheda = ('<div style="width: 300px; background: ' + NOTTE + '; border-radius: 12px; overflow: hidden; '
              'box-sizing: border-box;">'
              + campo_colonne(ROSSO, 'sc', '96deg', 'height: 74px;')
              + '<div style="padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px;">'
              '<div style="display: flex; align-items: center; gap: 12px;">'
              + maglia(34, 'scm', ROSSO, NOTTE)
              + '<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
              '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 16px; color: '
              + SMALTO + ';">Zona Cesarini</span>' + micro('1º su 6') + '</div>'
              '<span style="font-family: ' + MONO + '; font-weight: 500; font-size: 20px; color: '
              + SMALTO + ';">78,5</span></div>'
              '<div style="display: flex; align-items: flex-end; height: 70px;">'
              + campo_canne(ROSSO, 'scc', 70, 'width: 100%;') + '</div></div></div>')

    barra = ('<div style="width: 300px; display: flex; flex-direction: column; gap: 12px;">'
             + campo_colonne(ROSSO, 'br', '96deg', 'height: 10px; border-radius: 5px;')
             + campo_pieno(ROSSO, 'br2', '96deg', 'height: 10px; border-radius: 5px;')
             + campo_colonne(ROSSO, 'br3', '96deg', 'height: 46px; border-radius: 8px;') + '</div>')

    def didascalia(t):
        return '<span style="font-size: 11.5px; line-height: 1.5; color: ' + CEMENTO + ';">' + t + '</span>'

    corpo = ("""<div style="width: 1400px; height: 840px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 30px;">
  %(head)s
  <div style="display: flex; gap: 40px; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 13px; width: 260px; flex-shrink: 0;">%(icone)s%(d1)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(splash)s%(d2)s</div>
    <div style="display: flex; flex-direction: column; gap: 13px; width: 280px; flex-shrink: 0;">%(lega)s%(d3)s</div>
    <div style="display: flex; flex-direction: column; gap: 24px; width: 300px; flex-shrink: 0;">
      <div style="display: flex; flex-direction: column; gap: 13px;">%(scheda)s%(d4)s</div>
      <div style="display: flex; flex-direction: column; gap: 13px;">%(barra)s%(d5)s</div>
    </div>
  </div>
</div>""") % dict(
        campo=CAMPO, icone=icone, splash=splash, lega=lega, scheda=scheda, barra=barra,
        head=intestazione('Applicazioni', 'DEZ 11 / 07'),
        d1=didascalia("Icona in attesa della scelta del pittogramma: qui l'opzione A in tre misure, "
                      "poi con gli anelli nelle due tinte e l'opzione B a colonne."),
        d2=didascalia("Avvio: il marchio non prende colore, l'azione sì."),
        d3=didascalia("Lega: le maglie fanno da stemma, i dati sono in Mono."),
        d4=didascalia('Scheda squadra: banda, maglia, forma.'),
        d5=didascalia('Barre e bottoni: le stesse due tinte, tagliate o piene.'))
    artboard('Applicazioni.dc.html', corpo)


# =========================================================== 09 · pittogrammi
def build_pittogrammi():
    def scheda(lettera, nome, fn, perche, ma):
        return ('<div style="display: flex; flex-direction: column; gap: 15px;">'
                '<div style="background: ' + NOTTE + '; border-radius: 10px; height: 262px; '
                'display: flex; align-items: center; justify-content: center;">' + fn(196, ROSSO) + '</div>'
                '<div style="display: flex; flex-direction: column; gap: 7px;">'
                '<div style="display: flex; align-items: baseline; gap: 10px;">' + micro(lettera, ROSSO[1])
                + '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 17px; color: '
                + SMALTO + ';">' + nome + '</span></div>'
                '<span style="font-size: 12.5px; line-height: 1.55; color: ' + ARDESIA
                + '; text-wrap: pretty;">' + perche + '</span>'
                '<span style="font-size: 12px; line-height: 1.5; color: ' + CEMENTO
                + '; text-wrap: pretty;">Ma — ' + ma + '</span></div></div>')

    schede = ''.join(scheda(*p) for p in PITTOGRAMMI)
    corpo = ("""<div style="width: 1400px; height: 1040px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 28px;">
  %(head)s
  <div style="display: flex; align-items: baseline; gap: 26px;">%(t1)s%(n1)s</div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 30px;">%(schede)s</div>
</div>""") % dict(
        campo=CAMPO, schede=schede,
        head=intestazione('Pittogramma — sei opzioni', 'DEZ 11 / A—F'),
        t1=titoletto('Sei modi di dire undici'),
        n1=nota("Tutti sulla coppia Rosso, per confrontarli ad armi pari, e tutti a due tinte. "
                "Il marchio esteso non cambia: qui si decide solo il segno breve."))
    artboard('Pittogrammi.dc.html', corpo)


def build_pittogrammi_prova():
    def colonna(lettera, nome, fn):
        return ('<div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">'
                '<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; '
                'background: ' + NOTTE + '; border-radius: 10px; padding: 22px 18px; width: 100%; '
                'box-sizing: border-box;">'
                + fn(84, ROSSO) + fn(42, ROSSO) + fn(26, ROSSO) + fn(18, ROSSO) + '</div>'
                '<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; '
                'background: ' + CALCE + '; border-radius: 10px; padding: 18px; width: 100%; '
                'box-sizing: border-box;">' + fn(42, ROSSO) + fn(26, ROSSO) + '</div>'
                '<div style="display: flex; align-items: baseline; gap: 8px;">' + micro(lettera, ROSSO[1])
                + '<span style="font-family: ' + DISPLAY + '; font-weight: 800; font-size: 14px; color: '
                + SMALTO + ';">' + nome + '</span></div></div>')

    colonne = ''.join(colonna(p[0], p[1], p[2]) for p in PITTOGRAMMI)
    corpo = ("""<div style="width: 1400px; height: 640px; background: %(campo)s; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 26px;">
  %(head)s
  <div style="display: flex; align-items: baseline; gap: 26px;">%(t1)s%(n1)s</div>
  <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 24px;">%(colonne)s</div>
</div>""") % dict(
        campo=CAMPO, colonne=colonne,
        head=intestazione('Pittogramma — prova di scala', 'DEZ 11 / A—F'),
        t1=titoletto('84, 42, 26, 18 px'),
        n1=nota("Le misure che contano: icona sul telefono, avatar in classifica, segnaposto in "
                "lista, favicon. Sotto, su fondo chiaro."))
    artboard('PittogrammiProva.dc.html', corpo)
