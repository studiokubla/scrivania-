"""
Il marchio: una corona di picchi dentro una coppa.

La stesura precedente aveva i picchi con angoli tutti diversi, scelti a
occhio uno per uno: da lontano il profilo sembrava tremare. Qui c'è una
regola, e si vede.

  · i picchi sono triangoli isosceli, tutti con la stessa base — cambia
    solo l'altezza, e quindi il ritmo si legge come voluto;
  · le valli stanno tutte sulla stessa quota;
  · l'unica eccezione è la punta sottile a destra, base più stretta: è
    l'accento, e per essere un accento deve essere l'unica cosa diversa;
  · ogni vertice è un numero intero, su una griglia di due pixel.

Nessuna curva a mano libera: l'unica curva è il fondo della coppa.
"""

LARGO, ALTO = 264, 316

VALLE = 204         # la quota comune di tutte le valli
BASE = 56           # la base dei picchi normali
SINISTRA, DESTRA = 16, 248
SPALLA = 248        # dove i fianchi smettono di essere dritti
FONDO = 300         # il punto più basso della coppa

# (centro, altezza della punta): la base è sempre la stessa, quindi
# bastano due numeri per picco.
PICCHI = [(98, 20), (154, 92)]

# L'accento: base più stretta, punta più alta di tutte, e prima di lui la
# fenditura che lo stacca dal resto.
ACCENTO = (222, 10)
FENDITURA = ((186, 266), (196, 262))   # fondo sinistro, fondo destro


def cresta():
    """I vertici del bordo di sopra, da sinistra a destra."""
    punti = [(SINISTRA, 100), (60, 80)]         # la spalla, tagliata di sbieco
    for centro, cima in PICCHI:
        punti += [(centro - BASE // 2, VALLE), (centro, cima)]
    punti.append((PICCHI[-1][0] + BASE // 2, VALLE))
    punti += list(FENDITURA)                     # scende, gira, risale
    punti += [ACCENTO, (DESTRA, 150)]
    return punti


def marchio():
    p = cresta()
    spezzata = " ".join(f"L{x},{y}" for x, y in p[1:])
    return (
        f"M{p[0][0]},{p[0][1]} {spezzata} "
        f"L{DESTRA},{SPALLA} "
        # l'unica curva del disegno: il fondo della coppa
        f"C{DESTRA},{FONDO - 4} {DESTRA - 30},{FONDO} {LARGO // 2},{FONDO} "
        f"C{SINISTRA + 30},{FONDO} {SINISTRA},{FONDO - 12} {SINISTRA},{SPALLA} Z"
    )


def documento(colore="#CBEE63"):
    """Il marchio come file a sé, per chi lo vuole aprire o stampare."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LARGO} {ALTO}" '
        f'width="{LARGO}" height="{ALTO}" role="img" aria-label="Dynasty League">\n'
        f'  <title>Dynasty League</title>\n'
        f'  <path fill="{colore}" d="{marchio()}"/>\n</svg>\n'
    )


if __name__ == "__main__":
    print('const SEGNO = `<path d="' + marchio() + '"/>`;')
