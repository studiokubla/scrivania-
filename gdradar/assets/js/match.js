/* ============================================================
   GdRadar — matching e Fairness
   Il matching è deterministico e spiegabile: nessun modello,
   nessun punteggio opaco. Ogni componente restituisce i punti
   ottenuti e la frase che li giustifica.
   La Fairness NON entra nel punteggio di compatibilità: viaggia
   come segnale separato (blueprint §3.6).
   ============================================================ */
(function (GD) {
  'use strict';
  const D = GD.data;

  /* ---------------- componenti del punteggio ---------------- */
  const PESI = {
    sistema: 26,
    distanza: 22,
    disponibilita: 20,
    ruolo: 14,
    modalita: 10,
    esperienza: 8
  };

  const norm = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  /* Sistema e versione: match pieno se coincide anche la versione. */
  function scoreSistema(me, t) {
    const miei = norm(me.games).map((g) => g.systemId);
    const mieVer = {};
    norm(me.games).forEach((g) => { mieVer[g.systemId] = g.versione; });
    const suoi = t.systemId ? [{ systemId: t.systemId, versione: t.versione }] : norm(t.games);
    let best = null;
    suoi.forEach((g) => {
      if (miei.indexOf(g.systemId) === -1) return;
      const sameVer = mieVer[g.systemId] === g.versione;
      if (!best || sameVer) best = { systemId: g.systemId, sameVer };
    });
    if (!best) {
      const nomi = suoi.map((g) => (D.systemById(g.systemId) || {}).nome).filter(Boolean);
      return { got: 0, why: 'Sistema diverso dai tuoi' + (nomi.length ? ': ' + nomi[0] : ''), neg: true };
    }
    const nome = D.systemById(best.systemId).nome;
    return best.sameVer
      ? { got: PESI.sistema, why: nome + ', stessa versione' }
      : { got: Math.round(PESI.sistema * 0.75), why: nome + ', versione diversa dalla tua' };
  }

  /* Distanza: piena entro 1/3 del raggio scelto, decrescente fino al limite.
     Chi gioca solo online non viene penalizzato dalla distanza. */
  function scoreDistanza(me, t, ctx) {
    const raggio = (ctx && ctx.raggio) || 25;
    const soloOnline = t.modalita === 'online' || me.modalita === 'online';
    if (soloOnline) return { got: PESI.distanza, why: 'Si gioca online, la distanza non conta' };
    const d = GD.geo.distanceKm(me.loc, t.loc);
    if (d === null) return { got: Math.round(PESI.distanza * 0.5), why: 'Posizione non disponibile' };
    if (d > raggio) return { got: 0, why: 'Fuori dal raggio di ' + raggio + ' km', neg: true };
    const vicino = raggio / 3;
    const q = d <= vicino ? 1 : 1 - ((d - vicino) / (raggio - vicino)) * 0.7;
    return { got: Math.round(PESI.distanza * q), why: 'A ' + GD.util.fmtKm(d) + ' da te' };
  }

  /* Disponibilità: giorni in comune, poi fasce, poi frequenza. */
  function scoreDisponibilita(me, t) {
    const a = me.disponibilita || { giorni: [], fasce: [] };
    const b = t.disponibilita || { giorni: [], fasce: [] };
    const giorni = norm(a.giorni).filter((g) => norm(b.giorni).indexOf(g) !== -1);
    const fasce = norm(a.fasce).filter((f) => norm(b.fasce).indexOf(f) !== -1);
    if (!giorni.length) return { got: 0, why: 'Nessun giorno in comune', neg: true };
    const labels = giorni.map((g) => (D.GIORNI.find((x) => x.id === g) || {}).label);
    let q = 0.55 + Math.min(0.25, (giorni.length - 1) * 0.12);
    if (fasce.length) q += 0.2;
    if (a.frequenza === b.frequenza) q = Math.min(1, q + 0.1);
    const fasciaLab = fasce.length ? ' ' + (D.FASCE.find((x) => x.id === fasce[0]) || {}).label.toLowerCase() : '';
    return {
      got: Math.round(PESI.disponibilita * Math.min(1, q)),
      why: 'Disponibili entrambi: ' + labels.join(', ') + fasciaLab
    };
  }

  /* Ruolo: la compatibilità è complementarità, non somiglianza. */
  function scoreRuolo(me, t) {
    const mieiRuoli = norm(me.ruoli);
    if (t.tipo === 'campagna' || t.tipo === 'party' || t.kindWanted) {
      const cerca = t.kindWanted || 'player';
      const ok = mieiRuoli.indexOf(cerca) !== -1;
      return ok
        ? { got: PESI.ruolo, why: 'Cercano un ' + (cerca === 'master' ? 'Master' : 'Player') + ', ruolo che dichiari' }
        : { got: 0, why: 'Cercano un ' + (cerca === 'master' ? 'Master' : 'Player'), neg: true };
    }
    const suoi = norm(t.ruoli);
    const complementare = (mieiRuoli.indexOf('master') !== -1 && suoi.indexOf('player') !== -1)
      || (mieiRuoli.indexOf('player') !== -1 && suoi.indexOf('master') !== -1);
    if (complementare) return { got: PESI.ruolo, why: 'Ruoli complementari al tavolo' };
    if (suoi.indexOf('master') !== -1 && mieiRuoli.indexOf('master') !== -1) {
      return { got: Math.round(PESI.ruolo * 0.5), why: 'Entrambi Master: utile per scambiarsi il tavolo' };
    }
    return { got: Math.round(PESI.ruolo * 0.45), why: 'Stesso ruolo, serve comunque un Master' };
  }

  function scoreModalita(me, t) {
    const a = me.modalita, b = t.modalita;
    if (a === b) return { got: PESI.modalita, why: 'Stessa modalità: ' + (D.MODALITA.find((m) => m.id === a) || {}).label.toLowerCase() };
    if (a === 'entrambe' || b === 'entrambe') return { got: Math.round(PESI.modalita * 0.8), why: 'Modalità compatibili' };
    return { got: 0, why: 'Uno gioca solo online, l\'altro solo in presenza', neg: true };
  }

  /* Tipo di esperienza: formato desiderato + livello + Newbie Friendly. */
  function scoreEsperienza(me, t) {
    const mieiFormati = norm(me.formati);
    const suoFormato = t.formato || (norm(t.formati)[0]);
    const formatoOk = !suoFormato || mieiFormati.indexOf(suoFormato) !== -1;
    const mioLiv = D.espById(me.esperienza).ord;
    const suoLiv = D.espById(t.esperienza || t.esperienzaRichiesta || 'principiante').ord;
    const gap = Math.abs(mioLiv - suoLiv);

    /* Newbie Friendly ha la precedenza sul livello per chi è alle prime armi. */
    if (mioLiv <= 1) {
      if (t.newbie === 'esperti') return { got: 0, why: 'Preferiscono giocatori esperti', neg: true };
      if (t.newbie === 'si') {
        return { got: PESI.esperienza, why: 'Adatto alla prima esperienza', star: true };
      }
    }
    let q = formatoOk ? 0.6 : 0.25;
    q += gap === 0 ? 0.4 : gap === 1 ? 0.25 : 0;
    const fmtLab = suoFormato ? (D.FORMATI.find((f) => f.id === suoFormato) || {}).label : null;
    return {
      got: Math.round(PESI.esperienza * Math.min(1, q)),
      why: (fmtLab ? fmtLab + (formatoOk ? ', come cerchi' : ', diverso da quel che cerchi') : 'Formato non specificato')
    };
  }

  const LABELS = {
    sistema: 'Sistema di gioco',
    distanza: 'Distanza',
    disponibilita: 'Disponibilità',
    ruolo: 'Ruolo',
    modalita: 'Modalità',
    esperienza: 'Tipo di esperienza'
  };

  /* ---------------- punteggio complessivo ---------------- */
  function compatibilita(me, target, ctx) {
    if (!me) return { score: 0, parts: [], fascia: fasciaDi(0) };
    const t = normalizeTarget(target);
    const parts = [
      Object.assign({ key: 'sistema', max: PESI.sistema, label: LABELS.sistema }, scoreSistema(me, t)),
      Object.assign({ key: 'distanza', max: PESI.distanza, label: LABELS.distanza }, scoreDistanza(me, t, ctx)),
      Object.assign({ key: 'disponibilita', max: PESI.disponibilita, label: LABELS.disponibilita }, scoreDisponibilita(me, t)),
      Object.assign({ key: 'ruolo', max: PESI.ruolo, label: LABELS.ruolo }, scoreRuolo(me, t)),
      Object.assign({ key: 'modalita', max: PESI.modalita, label: LABELS.modalita }, scoreModalita(me, t)),
      Object.assign({ key: 'esperienza', max: PESI.esperienza, label: LABELS.esperienza }, scoreEsperienza(me, t))
    ];
    const score = GD.util.clamp(Math.round(parts.reduce((s, p) => s + p.got, 0)), 0, 100);
    return {
      score,
      fascia: fasciaDi(score),
      parts,
      motivi: parts.filter((p) => !p.neg && p.got > 0).sort((a, b) => b.got - a.got).slice(0, 3),
      ostacoli: parts.filter((p) => p.neg)
    };
  }

  /* Un annuncio eredita i dati del suo autore per il calcolo. */
  function normalizeTarget(t) {
    if (t.tipo === 'annuncio') {
      const kindWanted = t.sottotipo === 'cerco_master' ? 'master' : 'player';
      return Object.assign({}, t, { kindWanted });
    }
    return t;
  }

  function fasciaDi(score) {
    if (score >= 82) return { id: 'ottima', label: 'Ottima compatibilità', tone: 'accent' };
    if (score >= 64) return { id: 'buona', label: 'Buona compatibilità', tone: 'accent' };
    if (score >= 45) return { id: 'discreta', label: 'Compatibilità parziale', tone: 'amber' };
    return { id: 'bassa', label: 'Poco compatibile', tone: 'line' };
  }

  /* ---------------- Fairness ---------------- */
  const SOGLIA_FEEDBACK = 5;

  /* Wilson lower bound al 95%: 5/5 non deve sembrare meglio di 97/100. */
  function wilsonLower(pos, n, z) {
    if (!n) return 0;
    const zz = z || 1.96;
    const p = pos / n;
    const den = 1 + (zz * zz) / n;
    const centro = p + (zz * zz) / (2 * n);
    const margine = zz * Math.sqrt((p * (1 - p) + (zz * zz) / (4 * n)) / n);
    return Math.max(0, (centro - margine) / den);
  }

  const BANDE = [
    { min: 0.86, id: 'eccellente', label: 'Eccellente', pips: 5 },
    { min: 0.72, id: 'solida', label: 'Solida', pips: 4 },
    { min: 0.55, id: 'buona', label: 'Buona', pips: 3 },
    { min: 0.35, id: 'incostante', label: 'Incostante', pips: 2 },
    { min: 0, id: 'critica', label: 'Da monitorare', pips: 1 }
  ];

  const FASCE_ESPERIENZE = [
    { min: 100, label: 'oltre 100 esperienze' },
    { min: 50, label: '50+ esperienze' },
    { min: 20, label: '20+ esperienze' },
    { min: 10, label: '10+ esperienze' },
    { min: 5, label: '5+ esperienze' }
  ];

  function fairness(entity) {
    const f = (entity && entity.fairness) || { n: 0, pos: 0 };
    if (f.n < SOGLIA_FEEDBACK) {
      return {
        visibile: false, n: f.n, mancanti: SOGLIA_FEEDBACK - f.n,
        label: 'Fairness non ancora disponibile',
        nota: 'Servono almeno ' + SOGLIA_FEEDBACK + ' feedback qualificati.',
        pips: 0
      };
    }
    let value = wilsonLower(f.pos, f.n);
    /* lieve peso sulla recenza: se l'ultimo feedback è vecchio, il segnale invecchia */
    if (f.ultimo) {
      const mesi = (Date.now() - f.ultimo) / (30 * 86400000);
      if (mesi > 6) value *= 0.96;
      if (mesi > 12) value *= 0.94;
    }
    const banda = BANDE.find((b) => value >= b.min) || BANDE[BANDE.length - 1];
    const fascia = FASCE_ESPERIENZE.find((x) => f.n >= x.min);
    return {
      visibile: true, n: f.n, value,
      percent: Math.round(value * 100),
      label: banda.label, id: banda.id, pips: banda.pips,
      esperienze: fascia ? fascia.label : f.n + ' esperienze',
      nota: 'Stima prudenziale su ' + f.n + ' feedback qualificati.'
    };
  }

  GD.match = { PESI, compatibilita, fasciaDi, fairness, wilsonLower, SOGLIA_FEEDBACK, BANDE };
})(window.GD);
