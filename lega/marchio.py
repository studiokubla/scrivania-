"""
Il marchio: una corona di picchi dentro una coppa, in sagoma piena.

L'impianto è quello dei marchi delle leghe esport — una macchia sola,
spigoli netti, niente contorni e niente sfumature dentro la forma. Il
bordo di sopra è una linea spezzata di picchi di altezze diverse; quello
di sotto è la curva della coppa. Fra i due, una fessura verticale che
stacca il picco più alto dal resto: è il taglio che fa leggere la forma
come costruita e non come disegnata a mano.

Tutti i vertici stanno in due liste. Cambiare il profilo è cambiare
numeri, non ridisegnare.
"""

LARGO, ALTO = 264, 320

SPALLA = 238        # dove i fianchi smettono di essere dritti
FONDO = 304         # il punto più basso della coppa
SINISTRA, DESTRA = 14, 248

# I vertici del bordo di sopra, da sinistra a destra: (x, y). Le y piccole
# sono i picchi, quelle grandi le valli. Sono pochi di proposito: con
# cinque punte strette la sagoma diventa un ciuffo d'erba, e la prima
# prova lo era.
CRESTA = [
    (SINISTRA, 112),
    (56, 78),           # la spalla di sinistra, tagliata di sbieco
    (80, 218),          # valle, fin quasi a metà corpo
    (114, 26),          # il picco alto
    (146, 212),         # valle
    (174, 124),         # il picco medio
    # La fenditura che stacca il picco sottile: due punti ravvicinati in
    # fondo invece di una valle a V. Provata prima come un cuneo a parte,
    # tagliava la sagoma nel punto sbagliato — qui è la cresta stessa che
    # scende, gira di dieci pixel e risale, ed è tutto un pezzo solo.
    (197, 274), (208, 268),
    (228, 8),           # il picco sottile, il più alto di tutti
    (DESTRA, 150),
]


def marchio():
    cresta = " ".join(f"L{x},{y}" for x, y in CRESTA[1:])
    return (
        f"M{SINISTRA},{CRESTA[0][1]} {cresta} "
        f"L{DESTRA},{SPALLA} "
        # il fondo non è un semicerchio: scende prima e risale a destra,
        # come il fondo di una coppa vista un po' di lato.
        f"C{DESTRA},{FONDO - 4} {DESTRA - 30},{FONDO} {LARGO * 0.46:.0f},{FONDO} "
        f"C{SINISTRA + 30},{FONDO} {SINISTRA},{FONDO - 12} {SINISTRA},{SPALLA} Z"
    )


if __name__ == "__main__":
    print("const SEGNO = `" + f'<path d="{marchio()}"/>' + "`;")
