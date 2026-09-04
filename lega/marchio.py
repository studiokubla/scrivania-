"""
Il marchio della lega: una coppa fatta di lame che partono dal fusto e si
aprono a ventaglio, ciascuna affilata in punta.

Non è disegnata curva per curva. Ogni lama è una spina — una bezier
quadratica — più una legge di spessore, e il contorno si ricava
campionando la spina e scostandosi di mezza larghezza lungo la normale.
Spostare una punta è cambiare due numeri; ridisegnarla a mano sarebbe
rimettere otto punti di controllo e ritrovare la simmetria.

Le lame partono tutte dallo stesso punto in fondo al fusto: è quello che
impedisce loro di incrociarsi, che è il difetto in cui si cade appena si
danno partenze diverse.
"""
import math

LARGO, ALTO = 340, 380
MEZZO = LARGO / 2

# Le lame partono tutte sull'asse — è quello che impedisce loro di
# incrociarsi — ma a quote diverse: più in alto quelle esterne, così sotto
# di loro resta scoperto un pezzo di fusto. L'asse non è il centro esatto
# ma 158: i due bracci dell'arco si specchiano a 158 e 182 e fra loro
# lasciano il vuoto nero che fa il fusto.
#      partenza      controllo     punta     base  max
LAME = [
    ((155, 316), (142, 148), (170, 14), 16, 25),  # il braccio dell'arco: fa anche il fusto
    ((157, 270), ( 98, 138), ( 82, 30),  0, 28),  # la lama di mezzo
    ((157, 252), ( 52, 216), ( 14,  92), 0, 26),  # l'ala esterna
]


def bezier(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def derivata(p0, p1, p2, t):
    u = 1 - t
    return (2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
            2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]))


def lama(partenza, ctrl, punta, base, massimo, passi=34):
    """Il contorno di una lama.

    `base` è lo spessore al fusto: zero per le lame che laggiù finiscono a
    punta, diverso da zero per le due dell'arco, che invece proseguono e
    diventano il fusto."""
    def w(t):
        if base:
            # cresce salendo, poi cade di colpo sotto la punta
            return (base * (1 - t) + massimo * t) * (1 - t ** 3.4) ** 0.55
        # affilata alle due estremità, piena in mezzo
        return massimo * (4 * t * (1 - t)) ** 0.45

    sinistra, destra = [], []
    for i in range(passi + 1):
        t = i / passi
        x, y = bezier(partenza, ctrl, punta, t)
        dx, dy = derivata(partenza, ctrl, punta, t)
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        m = w(t) / 2
        sinistra.append((x + nx * m, y + ny * m))
        destra.append((x - nx * m, y - ny * m))

    punti = sinistra + destra[::-1]
    return "M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in punti) + " Z"


def specchia(d):
    fuori = []
    for pezzo in d.replace("M", " ").replace("L", " ").replace("Z", "").split():
        x, y = pezzo.split(",")
        fuori.append(f"{LARGO - float(x):.1f},{y}")
    return "M" + " L".join(fuori) + " Z"


def coppa():
    parti = []
    for partenza, ctrl, punta, base, massimo in LAME:
        d = lama(partenza, ctrl, punta, base, massimo)
        parti.append(d)
        parti.append(specchia(d))
    return parti


def piede():
    """Il piedistallo: il collarino sotto il fusto e il piede vero.

    Il piede è una cornice — il secondo contorno buca il primo — perché un
    trapezio pieno alto quaranta pixel, sotto una coppa di lame affilate,
    pesa come un mattone."""
    return [
        "M139,306 L201,306 L209,322 L131,322 Z",
        "M62,328 L278,328 L296,372 L44,372 Z "
        "M80,340 L260,340 L276,360 L64,360 Z",
    ]


def disegno():
    return coppa() + piede()


if __name__ == "__main__":
    # Le due costanti da incollare in `app.html`, al posto di quelle che
    # ci sono: le lame (che servono anche da sole, in piccolo) e il piede.
    lame = "".join(f'<path d="{d}"/>' for d in coppa())
    base = "".join(f'<path d="{d}"/>' for d in piede())
    print("const LAME = `" + lame + "`;")
    print("const PIEDE = `" + base + "`;")
