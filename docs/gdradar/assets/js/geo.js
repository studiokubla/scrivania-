/* ============================================================
   GdRadar — geografia
   Regola di prodotto: la posizione precisa di terzi non esce mai
   da qui. Verso la UI passano solo zona pubblica e distanza
   arrotondata (vedi publicView).
   ============================================================ */
(function (GD) {
  'use strict';

  /* Città con coordinate approssimate del centro e CAP principale. */
  const CITIES = [
    { id: 'mi', nome: 'Milano', prov: 'MI', cap: '20121', lat: 45.4642, lng: 9.1900, zone: ['Navigli', 'Isola', 'Lambrate', 'Città Studi', 'Porta Romana', 'Bovisa'] },
    { id: 'mb', nome: 'Monza', prov: 'MB', cap: '20900', lat: 45.5845, lng: 9.2744, zone: ['Centro', 'San Fruttuoso'] },
    { id: 'bg', nome: 'Bergamo', prov: 'BG', cap: '24121', lat: 45.6983, lng: 9.6773, zone: ['Città Alta', 'Borgo Palazzo'] },
    { id: 'bs', nome: 'Brescia', prov: 'BS', cap: '25121', lat: 45.5416, lng: 10.2118, zone: ['Centro', 'Mompiano'] },
    { id: 'to', nome: 'Torino', prov: 'TO', cap: '10121', lat: 45.0703, lng: 7.6869, zone: ['San Salvario', 'Vanchiglia', 'Crocetta', 'Aurora'] },
    { id: 'ge', nome: 'Genova', prov: 'GE', cap: '16121', lat: 44.4056, lng: 8.9463, zone: ['Foce', 'Albaro', 'Sampierdarena'] },
    { id: 'vr', nome: 'Verona', prov: 'VR', cap: '37121', lat: 45.4384, lng: 10.9916, zone: ['Veronetta', 'Borgo Trento'] },
    { id: 'pd', nome: 'Padova', prov: 'PD', cap: '35121', lat: 45.4064, lng: 11.8768, zone: ['Portello', 'Arcella'] },
    { id: 've', nome: 'Venezia', prov: 'VE', cap: '30121', lat: 45.4408, lng: 12.3155, zone: ['Mestre', 'Cannaregio'] },
    { id: 'ts', nome: 'Trieste', prov: 'TS', cap: '34121', lat: 45.6495, lng: 13.7768, zone: ['Centro', 'San Giacomo'] },
    { id: 'bo', nome: 'Bologna', prov: 'BO', cap: '40121', lat: 44.4949, lng: 11.3426, zone: ['Bolognina', 'Santo Stefano', 'Saragozza'] },
    { id: 'mo', nome: 'Modena', prov: 'MO', cap: '41121', lat: 44.6471, lng: 10.9252, zone: ['Centro', 'Sacca'] },
    { id: 'pr', nome: 'Parma', prov: 'PR', cap: '43121', lat: 44.8015, lng: 10.3279, zone: ['Oltretorrente', 'Centro'] },
    { id: 'fi', nome: 'Firenze', prov: 'FI', cap: '50122', lat: 43.7696, lng: 11.2558, zone: ['Oltrarno', 'Rifredi', 'Campo di Marte'] },
    { id: 'pi', nome: 'Pisa', prov: 'PI', cap: '56121', lat: 43.7160, lng: 10.3966, zone: ['Centro', 'San Martino'] },
    { id: 'rm', nome: 'Roma', prov: 'RM', cap: '00184', lat: 41.9028, lng: 12.4964, zone: ['Pigneto', 'Trastevere', 'San Lorenzo', 'Ostiense', 'Monteverde'] },
    { id: 'na', nome: 'Napoli', prov: 'NA', cap: '80121', lat: 40.8518, lng: 14.2681, zone: ['Vomero', 'Chiaia', 'Fuorigrotta'] },
    { id: 'ba', nome: 'Bari', prov: 'BA', cap: '70121', lat: 41.1171, lng: 16.8719, zone: ['Murat', 'Libertà'] },
    { id: 'pa', nome: 'Palermo', prov: 'PA', cap: '90133', lat: 38.1157, lng: 13.3615, zone: ['Politeama', 'Kalsa'] },
    { id: 'ct', nome: 'Catania', prov: 'CT', cap: '95121', lat: 37.5079, lng: 15.0830, zone: ['Centro', 'Ognina'] },
    { id: 'ca', nome: 'Cagliari', prov: 'CA', cap: '09124', lat: 39.2238, lng: 9.1217, zone: ['Marina', 'Villanova'] }
  ];

  const R_EARTH = 6371;
  const toRad = (d) => (d * Math.PI) / 180;

  /* distanza in km fra due coordinate */
  function distanceKm(a, b) {
    if (!a || !b) return null;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.sqrt(h));
  }

  /* rotta in gradi (0 = nord, orario): serve solo a posizionare i blip */
  function bearing(a, b) {
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  /* sposta un punto di un offset casuale ma stabile (max ~jitterKm) */
  function jitter(point, seed, jitterKm) {
    const r = GD.util.rng(seed);
    const ang = r() * Math.PI * 2;
    const dist = (0.25 + r() * 0.75) * (jitterKm || 4);
    const dLat = (dist / 111) * Math.cos(ang);
    const dLng = (dist / (111 * Math.cos(toRad(point.lat)))) * Math.sin(ang);
    return { lat: point.lat + dLat, lng: point.lng + dLng };
  }

  const cityById = (id) => CITIES.find((c) => c.id === id) || null;

  /* Ricerca manuale per città, CAP o testo libero. */
  function lookup(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    const byCap = CITIES.find((c) => c.cap === q || q.startsWith(c.cap.slice(0, 3)) && /^\d{5}$/.test(q));
    if (/^\d{4,5}$/.test(q) && byCap) return place(byCap);
    const byName = CITIES.find((c) => c.nome.toLowerCase() === q)
      || CITIES.find((c) => c.nome.toLowerCase().startsWith(q))
      || CITIES.find((c) => c.nome.toLowerCase().includes(q) || q.includes(c.nome.toLowerCase()));
    return byName ? place(byName) : null;
  }

  function place(city, zona) {
    return {
      cityId: city.id,
      label: city.nome,
      zona: zona || null,
      prov: city.prov,
      lat: city.lat,
      lng: city.lng
    };
  }

  function suggestions(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 1) return [];
    return CITIES.filter((c) => c.nome.toLowerCase().includes(q) || c.cap.startsWith(q)).slice(0, 6);
  }

  /* Vista pubblica: quello che il frontend può mostrare degli altri. */
  function publicView(entityLoc, myLoc) {
    const city = cityById(entityLoc.cityId);
    const d = myLoc ? distanceKm(myLoc, entityLoc) : null;
    return {
      area: (entityLoc.zona ? entityLoc.zona + ', ' : '') + (city ? city.nome : entityLoc.label),
      city: city ? city.nome : entityLoc.label,
      distanceKm: d,
      distanceLabel: d === null ? null : GD.util.fmtKm(d)
    };
  }

  const RADII = [5, 10, 25, 50, 100];

  /* Scala non lineare: gli anelli restano leggibili anche a 100 km. */
  const RING_FRACTIONS = [0.30, 0.44, 0.63, 0.80, 0.95];
  /* i punti molto vicini partono comunque a distanza dal centro,
     altrimenti si accavallano sul pin "tu sei qui" */
  const MIN_FRACTION = 0.11;
  function radiusFraction(km) {
    if (km <= 0) return MIN_FRACTION;
    if (km >= RADII[RADII.length - 1]) return RING_FRACTIONS[RING_FRACTIONS.length - 1];
    let prevKm = 0, prevF = MIN_FRACTION;
    for (let i = 0; i < RADII.length; i++) {
      if (km <= RADII[i]) {
        const t = (km - prevKm) / (RADII[i] - prevKm);
        return prevF + t * (RING_FRACTIONS[i] - prevF);
      }
      prevKm = RADII[i]; prevF = RING_FRACTIONS[i];
    }
    return 0.95;
  }

  GD.geo = { CITIES, RADII, RING_FRACTIONS, distanceKm, bearing, jitter, cityById, lookup, place, suggestions, publicView, radiusFraction };
})(window.GD);
