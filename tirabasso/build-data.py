# -*- coding: utf-8 -*-
"""Arricchisce il catalogo reale (scraped) con nomi/linee in chiave maison."""
import json, re

# nome maison, linea editoriale, materiale, note scheda
CURATED = {
 'p000': ("Estiva",            "Riviera",   "Rafia intrecciata",        "Borsa da giorno in rafia naturale, manici tubolari."),
 'p001': ("Rattan Tracolla",   "Riviera",   "Rattan / pelle vegan",     "Tracolla in rattan intrecciato con profili in ecopelle."),
 'p002': ("Rattan Clip",       "Riviera",   "Rattan / pelle vegan",     "Versione con chiusura a clip metallica."),
 'p003': ("Ocean Pack",        "Navigare",  "Tessuto water proof",      "Sacca impermeabile arrotolabile. Linea Navigare."),
 'p004': ("Cabin 40",          "Navigare",  "Nylon tecnico",            "Zaino cabina 40×29×19, conforme ai vettori low cost."),
 'p005': ("Capri",             "Riviera",   "Rafia Made in Italy",      "Borsa in rafia coordinata al cappello Capri."),
 'p006': ("Alpino Asimmetrico","Classico",  "Feltro di lana",           "Ala asimmetrica, cordoncino in tono. Made in Italy."),
 'p007': ("Alpino",            "Classico",  "Feltro di lana",           "La forma alpina nella sua versione essenziale."),
 'p008': ("Lana Pura",         "Classico",  "100% lana",                "Feltro di pura lana, finitura liscia. Made in Italy."),
 'p009': ("Cloche Cuore",      "Multicolor","Feltro di lana",           "Cloche con cuore applicato a contrasto."),
 'p010': ("Lapin",             "Classico",  "100% lapin",               "Pelo di lepre, il feltro più nobile della casa."),
 'p011': ("Cuore",             "Multicolor","Feltro di lana",           "Dettaglio a cuore, gesto ironico sulla calotta."),
 'p012': ("Fedora Bicolore",   "Classico",  "Feltro di lana",           "Fedora bicolore con nastro in tono. Made in Italy."),
 'p013': ("Fedora Catena",     "Classico",  "Feltro di lana",           "Catena sottogola in metallo brunito."),
 'p014': ("Lapin Fedora",      "Classico",  "100% lapin",               "Feltrino e automatici, tesa modellabile."),
 'p015': ("Original Smooth",   "Classico",  "Feltro premium",           "La collezione Original Smooth, premium quality."),
 'p016': ("Pork Pie",          "Classico",  "Feltro di lana",           "Calotta cilindrica, tesa corta rialzata. Made in Italy."),
 'p017': ("Falda Larga",       "Ottico",    "Feltro di lana",           "Tesa ampia con gros grain in seta."),
 'p018': ("Fedora Strass",     "Multicolor","Feltro di lana",           "Cinturino gioiello con strass applicati."),
 'p019': ("Coppola Spinata",   "Coppola",   "Feltro spinato",           "Coppola in spinato, foderata. Made in Italy."),
 'p020': ("Anello",            "Ottico",    "Feltro di lana",           "Nuova forma con cinturino ad anello."),
 'p021': ("Coppola",           "Coppola",   "Feltro di lana",           "La coppola di casa, taglio classico. Made in Italy."),
 'p022': ("Porkpie Diamante",  "Classico",  "Feltro di lana",           "Testa a diamante con grosgrain."),
 'p023': ("Crimpata",          "Ottico",    "Feltro di lana",           "Falda larga crimpata, cinturino ad anelli."),
 'p024': ("Balaclava",         "Inverno",   "Maglia a coste",           "Passamontagna a coste con bordino. Made in Italy."),
 'p025': ("Degradé Set",       "Inverno",   "Misto lana",               "Set cuffia e sciarpa, effetto degradé. Made in Italy."),
 'p026': ("Fascia Cashmere",   "Inverno",   "Cashmere",                 "Fascia in cashmere, lavorazione a maglia. Made in Italy."),
 'p027': ("Set Lana",          "Inverno",   "Misto lana",               "Cuffia e sciarpa coordinate. Made in Italy."),
 'p028': ("Kagoule Trapuntato","Inverno",   "Nylon imbottito",          "Cappuccio-sciarpa trapuntato, imbottito."),
 'p029': ("Set Degradé",       "Inverno",   "Misto lana",               "Cuffia e sciarpa, sfumatura continua. Made in Italy."),
 'p030': ("Rafia Intrecciata", "Safari",    "100% rafia naturale",      "Falda intrecciata a mano, rafia naturale."),
 'p031': ("Rafia Extrafino",   "Safari",    "100% rafia",               "Intreccio extra-fino, il grado più alto della casa."),
 'p032': ("Pescatore Lino",    "Riviera",   "Rafia e lino",             "Bucket in rafia e lino, tesa morbida."),
 'p033': ("Panama Traforato",  "Safari",    "Paglia giapponese",        "Traforo aperto, massima traspirazione."),
 'p034': ("Panasoft",          "Safari",    "Paglia Panasoft",          "Testa tonda e cresta, ispirazione Montecristi."),
 'p035': ("Panama",            "Safari",    "Paglia Panama",            "Il Panama della casa, nastro gros grain."),
 'p036': ("Panama Donna",      "Safari",    "Paglia",                   "Tre colorazioni, tesa flessibile."),
 'p037': ("Square",            "Safari",    "Paglia intrecciata a mano","Ref. SQUARE, intreccio a mano originale."),
 'p038': ("Carta Ritorta",     "Multicolor","Carta ritorta",            "Tinta unita, palette pastello."),
 'p039': ("SS/21",             "Riviera",   "Paglia",                   "Archivio collezione Spring Summer 21."),
 'p040': ("Albicocca",         "Multicolor","Paglia",                   "Colore albicocca, nastro in tono."),
 'p041': ("Rafia Naturale",    "Safari",    "100% rafia",               "Rafia naturale extra-fino, tesa larga."),
 'p042': ("Spring Summer",     "Riviera",   "Paglia",                   "Archivio collezione Spring Summer."),
 'p043': ("Fedora Paglia",     "Safari",    "Paglia",                   "Fedora estiva con cinturino in ecopelle."),
 'p044': ("Traforato",         "Safari",    "Paglia di carta",          "Traforo traspirante, nastro gros grain."),
 'p045': ("Fedora Carta",      "Safari",    "Paglia di carta",          "Fedora leggera con cinturino."),
 'p046': ("Zig Zag",           "Multicolor","Rafia naturale",           "Cuciture zig zag a contrasto."),
 'p047': ("Coppola Juta",      "Coppola",   "Juta / cotone",            "Juta con fodera in cotone. Made in Italy."),
 'p048': ("Coppola Lino",      "Coppola",   "Lino / cotone",            "Misto lino cotone, produzione italiana."),
 'p049': ("Coppola Lino Puro", "Coppola",   "100% lino",                "Lino puro, fodera in cotone."),
 'p050': ("Pescatore Nappa",   "Ottico",    "Lana e nappa",             "Bucket 50% lana 50% nappa."),
 'p051': ("Berretto Lino",     "Coppola",   "100% lino",                "Berretto in lino con fodera in cotone."),
 'p052': ("Tweed Irlandese",   "Classico",  "Lana tweed irlandese",     "Berrettone in tweed irlandese. Made in Italy."),
 'p053': ("Tweed Inglese",     "Classico",  "Lana tweed inglese",       "Berrettone in tweed inglese. Made in Italy."),
 'p054': ("Coppola Trapuntata","Coppola",   "Lana",                     "Fodera trapuntata, caldo invernale. Made in Italy."),
 'p055': ("Coppola Pregiata",  "Coppola",   "Tessuto pregiato",         "Tessuto pregiato, taglio sartoriale."),
 'p056': ("Baseball Paillettes","Multicolor","Cotone e paillettes",     "Stampa e paillettes. 100% Made in Italy."),
 'p057': ("Fidel",             "Riviera",   "100% lino",                "Modello Fidel in lino. Made in Italy."),
 'p058': ("Soft 8",            "Navigare",  "Nylon morbido",            "Trolley morbido 8 ruote, linea Soft."),
 'p059': ("Soft Set 3",        "Navigare",  "Nylon morbido",            "Set di tre trolley coordinati, linea Soft."),
 'p060': ("Linea 1806",        "Navigare",  "ABS rigido",               "Trolley rigido 20\" 8 ruote, linea 1806."),
 'p061': ("Rough 20",          "Navigare",  "ABS rigido",               "Trolley rigido Rough 20\", 8 ruote."),
}

SIZES = {'Feltro':["55","56","57","58","59","60","61"],
         'Paglia':["55","56","57","58","59","60","61"],
         'Tessuto':["55","56","57","58","59","60","61"],
         'Maglieria':["Taglia unica"],
         'Borse':["Taglia unica"],
         'Trolley':["Cabina","Medio","Grande"]}

def main():
    cat=json.load(open('catalog.json'))
    out=[]
    for p in cat:
        pid=p['id']
        nome,linea,materiale,nota = CURATED.get(pid,(p['name'][:28],'Classico','—',''))
        out.append({
            'id': pid,
            'nome': nome,
            'linea': linea,
            'cat': p['cat'],
            'materiale': materiale,
            'nota': nota,
            'ref': p['name'],
            'prezzo': p['price'],
            'img': 'prod/'+p['file'],
            'taglie': SIZES[p['cat']],
        })
    json.dump(out,open('src/products.json','w'),ensure_ascii=False,indent=1)
    from collections import Counter
    print('prodotti:',len(out))
    print('linee:',dict(Counter(p['linea'] for p in out)))
    print('categorie:',dict(Counter(p['cat'] for p in out)))

if __name__=='__main__': main()
