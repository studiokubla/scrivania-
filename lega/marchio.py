"""
Il marchio della lega, secondo tentativo — su un'idea diversa.

Le lame curve e affilate del primo tentativo si leggevano come foglie, e
nessuna quantità di ritocchi le avrebbe fatte leggere come metallo: il
problema era l'idea, non i numeri.

Qui il disegno nasce da una lettera. Una D coricata — l'asta in alto, la
pancia sotto — è già la sagoma di un calice; con un fusto e un piede
sotto diventa una coppa, e continua a essere la D di Dynasty. Dentro, una
stella a quattro punte: il titolo vinto.

Tutto sta su cerchi e rette, niente curve a mano: è quello che lo fa
sembrare un oggetto e non una pianta, e quello che lo tiene leggibile a
sedici pixel.
"""

LARGO, ALTO = 320, 348
ASSE = LARGO / 2

# ── La coppa: due profili concentrici, il secondo buca il primo ───────
SPALLA = 38        # quanto in alto comincia la bocca della coppa
SPESSORE = 26      # lo spessore del metallo
MEZZA_BOCCA = 116  # metà larghezza della bocca
FONDO = 122        # da dove parte la curva del fondo
PROFONDITA = 134   # quanto scende il fondo sotto quella quota


def coppa():
    x1, x2 = ASSE - MEZZA_BOCCA, ASSE + MEZZA_BOCCA
    i1, i2 = x1 + SPESSORE, x2 - SPESSORE
    rx, ry = MEZZA_BOCCA, PROFONDITA
    irx, iry = rx - SPESSORE, ry - SPESSORE
    return (
        f"M{x1},{SPALLA} L{x2},{SPALLA} L{x2},{FONDO} "
        f"A{rx},{ry} 0 0 1 {x1},{FONDO} Z "
        f"M{i1},{SPALLA + SPESSORE} L{i2},{SPALLA + SPESSORE} L{i2},{FONDO} "
        f"A{irx},{iry} 0 0 1 {i1},{FONDO} Z"
    )


def stella():
    """La stella dentro la coppa: quattro punte, i lati incavati.

    I bracci sono lunghi diversi — più alto e più basso che larghi — così
    non è la stellina generica: sta dentro una coppa e ne segue la forma."""
    cx, cy = ASSE, (SPALLA + SPESSORE + FONDO + PROFONDITA) / 2
    alto, largo, gola = 56, 43, 13
    return (
        f"M{cx},{cy - alto} "
        f"C{cx + gola},{cy - gola * 2} {cx + largo - gola * 2},{cy - gola} {cx + largo},{cy} "
        f"C{cx + largo - gola * 2},{cy + gola} {cx + gola},{cy + gola * 2} {cx},{cy + alto} "
        f"C{cx - gola},{cy + gola * 2} {cx - largo + gola * 2},{cy + gola} {cx - largo},{cy} "
        f"C{cx - largo + gola * 2},{cy - gola} {cx - gola},{cy - gola * 2} {cx},{cy - alto} Z"
    )


def piede():
    """Fusto, collarino e piede. Il piede è pieno: sotto una coppa a
    contorno serve qualcosa di solido, o il marchio galleggia."""
    gambo = FONDO + PROFONDITA - 6
    return [
        f"M{ASSE - 19},{gambo} L{ASSE + 19},{gambo} L{ASSE + 19},294 L{ASSE - 19},294 Z",
        f"M{ASSE - 37},294 L{ASSE + 37},294 L{ASSE + 45},311 L{ASSE - 45},311 Z",
        f"M{ASSE - 72},318 L{ASSE + 72},318 L{ASSE + 90},346 L{ASSE - 90},346 Z",
    ]


def pezzi():
    return [coppa(), stella()] + piede()


if __name__ == "__main__":
    # La riga da incollare in `app.html` al posto di quella che c'è.
    print("const COPPA = `" + "".join(f'<path d="{d}"/>' for d in pezzi()) + "`;")
