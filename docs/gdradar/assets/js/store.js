/* ============================================================
   GdRadar — stato applicativo
   Prototipo: tutto ciò che nella V1 vive su PostgreSQL qui sta
   in localStorage. La forma dei dati segue però lo schema del
   blueprint (§9), così il passaggio a un backend è una
   sostituzione di adapter, non una riscrittura.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util;
  const KEY = 'gdradar.state.v1';
  const DAY = 86400000;

  const EMPTY = {
    v: 1,
    me: null,
    onboarding: { step: 0, draft: null },
    ricerca: {
      q: '',
      raggio: 25,
      tipi: ['utente', 'party', 'campagna', 'annuncio'],
      sistemi: [],
      ruolo: 'tutti',
      modalita: 'tutte',
      giorni: [],
      esperienza: 'tutte',
      newbieOnly: false,
      postiLiberi: false,
      ordine: 'compatibilita',
      vista: 'radar'
    },
    listings: [],
    requests: [],
    conversations: [],
    blocks: [],
    reports: [],
    feedback: [],
    pendingFeedback: [],
    notifications: [],
    cases: null,
    modRole: 'moderator',
    lettoPatto: false
  };

  let state = load();
  const subs = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      const parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(EMPTY)), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota o modalità privata */ }
  }

  function get() { return state; }
  function subscribe(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); }
  function emit() { subs.forEach((f) => f(state)); }

  /* muta lo stato, salva e notifica */
  function set(mutator, opts) {
    mutator(state);
    persist();
    if (!opts || opts.render !== false) emit();
  }
  function reset() {
    state = JSON.parse(JSON.stringify(EMPTY));
    persist();
    emit();
  }

  /* ---------------- profilo ---------------- */
  function profiloVuoto() {
    return {
      id: 'me',
      tipo: 'utente',
      nome: '',
      bio: '',
      email: '',
      dataNascita: '',
      eta: null,
      ageVerification: { status: 'none', threshold: 18, provider: null, ref: null, verified_at: null },
      ruoli: [],
      esperienza: 'principiante',
      modalita: 'entrambe',
      formati: [],
      newbie: 'si',
      stili: [],
      lingue: ['Italiano'],
      games: [],
      disponibilita: { giorni: [], fasce: [], frequenza: 'quindicinale' },
      loc: null,
      visibilita: 'attivo',
      contatti: {},
      patto: false,
      tos: false,
      fairness: { n: 0, pos: 0, ultimo: null },
      creato: Date.now()
    };
  }

  const verificato = () => !!(state.me && state.me.ageVerification.status === 'verified');

  /* ---------------- inbox dimostrativa ----------------
     Alla creazione del profilo prepariamo qualche relazione già
     avviata: serve a mostrare i flussi C (contatto) e D (fairness)
     senza dover attendere giorni.                                */
  function seedDemo() {
    const users = GD.data.users;
    const parties = GD.data.parties;
    const near = users.filter((u) => state.me.loc && u.loc.cityId === state.me.loc.cityId);
    const pool = (near.length >= 3 ? near : users);
    const a = pool[0], b = pool[1] || users[3], c = pool[2] || users[5];
    const party = parties.find((p) => state.me.loc && p.loc.cityId === state.me.loc.cityId) || parties[0];
    const t = Date.now();

    state.requests = [
      { id: U.uid('req'), dir: 'in', kind: 'utente', id2: a.id, stato: 'pending', quando: t - 4 * 3600000,
        msg: 'Ciao! Ho visto che giochi negli stessi giorni. Al nostro tavolo manca una persona, ti va di parlarne?' },
      { id: U.uid('req'), dir: 'out', kind: 'party', id2: party.id, stato: 'pending', quando: t - 2 * DAY,
        msg: 'Buonasera, sono disponibile il giovedì sera e cerco un gruppo stabile.' }
    ];

    const conv = {
      id: U.uid('conv'),
      kind: 'utente',
      id2: b.id,
      apertaIl: t - 6 * DAY,
      chiusa: false,
      exchange: { mine: false, theirs: false, done: false, canali: [] },
      relazione: { qualificata: false, confermata: false },
      messages: [
        { from: 'sys', text: 'Richiesta di contatto accettata. Da qui in avanti potete scrivervi.', ts: t - 6 * DAY },
        { from: 'them', text: 'Ciao! Grazie per la richiesta. Giochiamo il mercoledì sera, di solito ogni due settimane.', ts: t - 6 * DAY + 600000 },
        { from: 'me', text: 'Perfetto, il mercoledì lo tengo libero. Che tipo di campagna avete in mente?', ts: t - 6 * DAY + 1800000 },
        { from: 'them', text: 'Investigativa, toni cupi ma niente splatter. Usiamo carta X e giro di controllo a metà sessione.', ts: t - 5 * DAY }
      ],
      unread: 1
    };

    const convVecchia = {
      id: U.uid('conv'),
      kind: 'utente',
      id2: c.id,
      apertaIl: t - 22 * DAY,
      chiusa: false,
      exchange: { mine: true, theirs: true, done: true, canali: ['telegram'], quando: t - 17 * DAY },
      relazione: { qualificata: true, confermata: false },
      messages: [
        { from: 'sys', text: 'Richiesta di contatto accettata.', ts: t - 22 * DAY },
        { from: 'them', text: 'Se ti va ci vediamo sabato al circolo, portiamo noi i manuali.', ts: t - 20 * DAY },
        { from: 'me', text: 'Ci sono. Ti lascio il contatto così ci organizziamo.', ts: t - 18 * DAY },
        { from: 'sys', text: 'Contatti scambiati con doppio consenso: Telegram.', ts: t - 17 * DAY }
      ],
      unread: 0
    };

    state.conversations = [conv, convVecchia];
    state.pendingFeedback = [
      { id: U.uid('fb'), kind: 'utente', id2: c.id, convId: convVecchia.id, quando: t - 16 * DAY }
    ];
    state.notifications = [
      { id: U.uid('n'), tipo: 'richiesta', testo: a.nome + ' ti ha inviato una richiesta di contatto', quando: t - 4 * 3600000, letto: false },
      { id: U.uid('n'), tipo: 'messaggio', testo: 'Nuovo messaggio da ' + b.nome, quando: t - 5 * DAY, letto: false },
      { id: U.uid('n'), tipo: 'fairness', testo: 'Avete giocato con ' + c.nome + '? Lascia un feedback', quando: t - 16 * DAY, letto: false }
    ];
  }

  /* ---------------- azioni di dominio ---------------- */
  function notify(tipo, testo) {
    state.notifications.unshift({ id: U.uid('n'), tipo, testo, quando: Date.now(), letto: false });
  }

  const api = {
    get, set, subscribe, reset, persist, profiloVuoto, verificato,

    creaProfilo(profile) {
      set((s) => {
        s.me = profile;
        s.ricerca.raggio = 25;
        seedDemo();
      });
    },

    /* --- richieste di contatto (flusso C) --- */
    inviaRichiesta(kind, id2, msg) {
      let ok = false;
      set((s) => {
        if (s.requests.some((r) => r.kind === kind && r.id2 === id2 && r.dir === 'out' && r.stato === 'pending')) return;
        s.requests.unshift({ id: U.uid('req'), dir: 'out', kind, id2, stato: 'pending', quando: Date.now(), msg });
        ok = true;
      });
      return ok;
    },
    rispondiRichiesta(reqId, accetta) {
      let convId = null;
      set((s) => {
        const r = s.requests.find((x) => x.id === reqId);
        if (!r) return;
        r.stato = accetta ? 'accepted' : 'declined';
        if (!accetta) return;
        const conv = {
          id: U.uid('conv'), kind: r.kind, id2: r.id2, apertaIl: Date.now(), chiusa: false,
          exchange: { mine: false, theirs: false, done: false, canali: [] },
          relazione: { qualificata: false, confermata: false },
          messages: [{ from: 'sys', text: 'Richiesta di contatto accettata. Da qui in avanti potete scrivervi.', ts: Date.now() }],
          unread: 0
        };
        s.conversations.unshift(conv);
        convId = conv.id;
      });
      return convId;
    },
    inviaMessaggio(convId, text) {
      set((s) => {
        const c = s.conversations.find((x) => x.id === convId);
        if (!c || c.chiusa) return;
        c.messages.push({ from: 'me', text, ts: Date.now() });
      });
    },
    leggiConversazione(convId) {
      set((s) => {
        const c = s.conversations.find((x) => x.id === convId);
        if (c) c.unread = 0;
      }, { render: false });
    },

    /* --- scambio contatti a doppio consenso --- */
    proponiScambio(convId, canali) {
      set((s) => {
        const c = s.conversations.find((x) => x.id === convId);
        if (!c) return;
        c.exchange.mine = true;
        c.exchange.canali = canali;
        c.messages.push({ from: 'sys', text: 'Hai proposto lo scambio dei contatti. Serve anche il consenso dell\'altra persona.', ts: Date.now() });
        /* nel prototipo l'altra parte risponde subito: nella V1 è un evento reale */
        c.exchange.theirs = true;
        c.exchange.done = true;
        c.exchange.quando = Date.now();
        c.relazione.qualificata = true;
        c.messages.push({ from: 'sys', text: 'Contatti scambiati con doppio consenso: ' + canali.map((k) => (GD.data.CANALI_CONTATTO.find((x) => x.id === k) || {}).label).join(', ') + '.', ts: Date.now() + 1 });
        s.pendingFeedback.push({ id: U.uid('fb'), kind: c.kind, id2: c.id2, convId: c.id, quando: Date.now() });
        notify('fairness', 'Fra qualche giorno ti chiederemo com\'è andata: il feedback resta anonimo.');
      });
    },
    chiudiConversazione(convId) {
      set((s) => {
        const c = s.conversations.find((x) => x.id === convId);
        if (c) { c.chiusa = true; c.messages.push({ from: 'sys', text: 'Conversazione chiusa.', ts: Date.now() }); }
      });
    },

    /* --- fairness (flusso D) --- */
    inviaFeedback(fbId, risposte) {
      set((s) => {
        const idx = s.pendingFeedback.findIndex((x) => x.id === fbId);
        if (idx === -1) return;
        const fb = s.pendingFeedback[idx];
        s.pendingFeedback.splice(idx, 1);
        s.feedback.unshift({
          id: U.uid('fbk'), kind: fb.kind, id2: fb.id2, risposte, quando: Date.now(), anonimo: true
        });
        s.notifications = s.notifications.filter((n) => n.tipo !== 'fairness' || n.letto);
      });
    },
    saltaFeedback(fbId) {
      set((s) => { s.pendingFeedback = s.pendingFeedback.filter((x) => x.id !== fbId); });
    },

    /* --- sicurezza (flusso E) --- */
    blocca(kind, id2, nome) {
      set((s) => {
        if (s.blocks.some((b) => b.kind === kind && b.id2 === id2)) return;
        s.blocks.unshift({ kind, id2, nome, quando: Date.now() });
        s.requests = s.requests.filter((r) => !(r.kind === kind && r.id2 === id2 && r.stato === 'pending'));
        s.conversations.forEach((c) => { if (c.kind === kind && c.id2 === id2) c.chiusa = true; });
      });
    },
    sblocca(kind, id2) {
      set((s) => { s.blocks = s.blocks.filter((b) => !(b.kind === kind && b.id2 === id2)); });
    },
    segnala(kind, id2, nome, motivo, dettagli, allegaChat) {
      const id = 'CASE-' + String(1100 + state.reports.length);
      set((s) => {
        s.reports.unshift({ id, kind, id2, nome, motivo, dettagli, allegaChat, quando: Date.now(), stato: 'new' });
        const cases = api.getCases();
        cases.unshift({
          id, target: { kind, id: id2, nome },
          origine: 'report', categoria: motivoCategoria(motivo),
          severity: motivoSeverity(motivo), stato: 'new', motivo,
          sintesi: dettagli || 'Segnalazione inviata dall\'utente attraverso la scheda.',
          reporterId: 'me', assegnatoA: null, apertoIl: Date.now(),
          evidenze: [{ tipo: 'segnalazione', ref: 'REP-' + id, quando: Date.now(), nota: 'Modulo di segnalazione.' }]
            .concat(allegaChat ? [{ tipo: 'messaggi', ref: 'CONV-' + id2, quando: Date.now(), nota: 'Conversazione allegata dall\'utente, accesso vincolato al case.' }] : []),
          azioni: [],
          audit: [{ quando: Date.now(), chi: 'sistema', cosa: 'Case aperto da segnalazione utente' }]
        });
        s.cases = cases;
        notify('safety', 'Segnalazione inviata. Il case ' + id + ' è in coda di triage.');
      });
      return id;
    },

    /* --- annunci --- */
    salvaAnnuncio(annuncio) {
      set((s) => {
        const idx = s.listings.findIndex((l) => l.id === annuncio.id);
        if (idx === -1) s.listings.unshift(annuncio); else s.listings[idx] = annuncio;
      });
    },
    cambiaStatoAnnuncio(id, stato) {
      set((s) => {
        const l = s.listings.find((x) => x.id === id);
        if (l) l.stato = stato;
      });
    },

    /* --- moderazione --- */
    getCases() {
      if (!state.cases) state.cases = JSON.parse(JSON.stringify(GD.data.cases));
      return state.cases;
    },
    aggiornaCase(id, patch, auditLabel) {
      set((s) => {
        const cs = api.getCases();
        const c = cs.find((x) => x.id === id);
        if (!c) return;
        Object.assign(c, patch);
        c.audit = c.audit || [];
        c.audit.push({ quando: Date.now(), chi: s.modRole, cosa: auditLabel });
        s.cases = cs;
      });
    },
    applicaAzione(id, tipo, nota) {
      const LABEL = {
        no_action: 'Nessuna azione', warning: 'Warning', content_removal: 'Rimozione contenuto',
        feature_restriction: 'Restrizione funzionalità', temp_suspension: 'Sospensione temporanea',
        permanent_ban: 'Ban permanente', safety_lock: 'Safety Lock'
      };
      set((s) => {
        const cs = api.getCases();
        const c = cs.find((x) => x.id === id);
        if (!c) return;
        c.azioni = c.azioni || [];
        c.azioni.push({ tipo, quando: Date.now(), da: s.modRole, nota: nota || '' });
        c.stato = tipo === 'no_action' ? 'dismissed' : 'resolved';
        c.audit.push({ quando: Date.now(), chi: s.modRole, cosa: 'Azione applicata: ' + (LABEL[tipo] || tipo) });
        s.cases = cs;
      });
    },

    /* --- notifiche --- */
    leggiNotifiche() {
      set((s) => { s.notifications.forEach((n) => { n.letto = true; }); });
    },

    /* --- letture derivate --- */
    isBloccato(kind, id2) { return state.blocks.some((b) => b.kind === kind && b.id2 === id2); },
    conversazioneCon(kind, id2) { return state.conversations.find((c) => c.kind === kind && c.id2 === id2) || null; },
    richiestaVerso(kind, id2) {
      return state.requests.find((r) => r.kind === kind && r.id2 === id2 && r.dir === 'out') || null;
    },
    contaNonLetti() {
      const msg = state.conversations.reduce((n, c) => n + (c.unread || 0), 0);
      const req = state.requests.filter((r) => r.dir === 'in' && r.stato === 'pending').length;
      return { msg, req, tot: msg + req };
    },
    mieiAnnunci() { return state.listings; }
  };

  function motivoCategoria(m) {
    if (m === 'molestie' || m === 'minore' || m === 'aggressivita') return 'sicurezza';
    if (m === 'no_show' || m === 'scorrettezza') return 'affidabilita';
    if (m === 'spam') return 'abuso_piattaforma';
    return 'comportamento';
  }
  function motivoSeverity(m) {
    return { molestie: 4, minore: 4, aggressivita: 3, discriminazione: 3, scorrettezza: 2, no_show: 1, spam: 2 }[m] || 1;
  }

  GD.store = api;
})(window.GD);
