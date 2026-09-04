"""
Il marchio: un pallone di stelle.

L'effetto sfera non viene dal disegnare stelle più piccole verso il bordo:
viene dalla prospettiva. Le stelle stanno tutte sulla stessa sfera, della
stessa misura, e quello che cambia è come le vediamo — una stella che sta
sul fianco della palla la guardiamo di sbieco, e si schiaccia lungo la
direzione che va verso il centro. Basta quello.

Una in mezzo e otto su un anello. L'anello dei vertici di un icosaedro —
la struttura vera di un pallone — sta a 63°, e a quell'inclinazione le
stelle si schiacciano fino a sembrare frecce: la geometria era giusta e
il disegno illeggibile. Sta a 45°, che è una scelta di disegno e non una
misura, e a quell'angolo la stella si accorcia di un terzo restando una
stella.
"""
import math

LATO = 320
CENTRO = LATO / 2
RAGGIO = 132              # il raggio della sfera, in pixel

INCLINAZIONE = 42         # quanto sta di lato l'anello, sulla sfera
QUANTE = 8                # stelle sull'anello
PUNTA = 63                # da centro a punta della stella in mezzo
PUNTA_ANELLO = 49
# Le stelle dell'anello guardano tutte in fuori. Girarle di mezza punta —
# provato, sembrava l'idea giusta — le fa sovrapporre fra loro e l'anello
# diventa una macchia: qui i vuoti scuri fra una stella e l'altra sono
# metà del disegno, e vanno protetti.
SFASA = 0
GOLA = 0.40               # quanto rientra fra una punta e l'altra


def stella(punta, gola=GOLA, punte=5):
    """Una stella a cinque punte centrata nell'origine, con una punta
    verso destra: destra è la direzione che poi diventerà 'in fuori'."""
    fuori = []
    for i in range(punte * 2):
        r = punta if i % 2 == 0 else punta * gola
        a = math.pi * i / punte
        fuori.append((r * math.cos(a), r * math.sin(a)))
    return fuori


def posa(punti, schiaccia, gira, dove):
    """Schiaccia lungo l'asse orizzontale (che è il raggio), poi ruota e
    sposta. L'ordine conta: schiacciare dopo aver ruotato deformerebbe la
    stella nel verso sbagliato."""
    c, s = math.cos(math.radians(gira)), math.sin(math.radians(gira))
    fuori = []
    for x, y in punti:
        x *= schiaccia
        fuori.append((dove[0] + x * c - y * s, dove[1] + x * s + y * c))
    return fuori


def percorso(punti):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in punti) + " Z"


def stelle():
    fuori = [percorso(posa(stella(PUNTA), 1, -90, (CENTRO, CENTRO)))]

    schiaccia = math.cos(math.radians(INCLINAZIONE))
    raggio = RAGGIO * math.sin(math.radians(INCLINAZIONE))
    for k in range(QUANTE):
        a = math.radians(-90 + k * 360 / QUANTE)
        dove = (CENTRO + raggio * math.cos(a), CENTRO + raggio * math.sin(a))
        fuori.append(percorso(posa(stella(PUNTA_ANELLO), schiaccia,
                                   math.degrees(a) + SFASA, dove)))
    return fuori


def documento(colore="#CBEE63"):
    corpo = "".join(f'<path d="{d}"/>' for d in stelle())
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {LATO} {LATO}" '
        f'width="{LATO}" height="{LATO}" role="img" aria-label="Dynasty League">\n'
        f'  <title>Dynasty League</title>\n'
        f'  <g fill="{colore}">{corpo}</g>\n</svg>\n'
    )


if __name__ == "__main__":
    # La riga da incollare in `app.html` al posto di quella che c'è, e il
    # file `marchio.svg` accanto.
    import pathlib
    print("const SEGNO = `" + "".join(f'<path d="{d}"/>' for d in stelle()) + "`;")
    pathlib.Path(__file__).with_name("marchio.svg").write_text(documento(), encoding="utf8")
