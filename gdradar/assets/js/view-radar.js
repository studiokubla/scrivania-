/* ============================================================
   GdRadar — Radar: ricerca, filtri, visualizzazione, scheda
   (flusso B: località → filtri → risultati → scheda →
   compatibilità → richiesta di contatto)
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  /* ---------------- selezione candidati ---------------- */
  function candidati() {
    const st = S.get();
    const me = st.me;
    const f = st.ricerca;
    const out = [];

    const bloccato = (kind, id) => S.isBloccato(kind, id);

    if (f.tipi.indexOf('utente') !== -1) {
      D.users.forEach((u) => {
        if (u.visibilita === 'nascosto' || bloccato('utente', u.id)) return;
        out.push(u);
      });
    }
    if (f.tipi.indexOf('party') !== -1) D.parties.forEach((p) => { if (!bloccato('party', p.id)) out.push(p); });
    if (f.tipi.indexOf('campagna') !== -1) D.campaigns.forEach((c) => { if (!bloccato('campagna', c.id)) out.push(c); });
    if (f.tipi.indexOf('annuncio') !== -1) {
      D.listings.forEach((l) => {
        if (l.stato !== 'attivo') return;
        if (bloccato(l.autore.kind, l.autore.id)) return;
        out.push(l);
      });
    }

    return out.filter((e) => passaFiltri(e, f, me)).map((e) => {
      const comp = GD.match.compatibilita(me, e, { raggio: f.raggio });
      const dist = e.modalita === 'online' ? null : GD.geo.distanceKm(me.loc, e.loc);
      return { e, comp, dist };
    }).sort(ordinatore(f.ordine));
  }

  function passaFiltri(e, f, me) {
    /* raggio: chi gioca online resta sempre raggiungibile */
    if (e.modalita !== 'online') {
      const d = GD.geo.distanceKm(me.loc, e.loc);
      if (d !== null && d > f.raggio) return false;
    }
    if (f.sistemi.length) {
      const sys = e.systemId ? [e.systemId] : (e.games || []).map((g) => g.systemId);
      if (!sys.some((s) => f.sistemi.indexOf(s) !== -1)) return false;
    }
    if (f.modalita !== 'tutte') {
      if (f.modalita === 'presenza' && e.modalita === 'online') return false;
      if (f.modalita === 'online' && e.modalita === 'presenza') return false;
    }
    if (f.ruolo !== 'tutti' && !ruoloCoperto(e, f.ruolo)) return false;
    if (f.giorni.length) {
      const gg = (e.disponibilita && e.disponibilita.giorni) || [];
      if (!f.giorni.some((g) => gg.indexOf(g) !== -1)) return false;
    }
    if (f.esperienza !== 'tutte') {
      const liv = e.esperienza || e.esperienzaRichiesta;
      if (liv && liv !== f.esperienza) return false;
    }
    if (f.newbieOnly && e.newbie !== 'si') return false;
    if (f.postiLiberi) {
      const posti = e.postiLiberi !== undefined ? e.postiLiberi : (e.posti !== undefined ? e.posti : null);
      if (posti !== null && posti <= 0) return false;
    }
    if (f.q) {
      const q = f.q.toLowerCase();
      const sys = (e.systemId ? [e.systemId] : (e.games || []).map((g) => g.systemId))
        .map((s) => (D.systemById(s) || {}).nome).join(' ');
      const blob = [e.nome, e.titolo, e.bio, e.testo, sys, (e.stili || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* Il filtro "ruolo cercato" guarda il ruolo che l'altra parte copre:
     un annuncio che cerca Player è, dall'altro lato del tavolo, un Master. */
  function ruoloCoperto(e, ruolo) {
    if (e.tipo === 'utente') return (e.ruoli || []).indexOf(ruolo) !== -1;
    if (e.tipo === 'campagna') return ruolo === 'master';
    if (e.tipo === 'party') return true;
    if (e.tipo === 'annuncio') {
      const autore = D.byId(e.autore.kind, e.autore.id);
      if (e.sottotipo === 'cerco_player') return ruolo === 'master';
      if (e.sottotipo === 'cerco_master') return ruolo === 'player';
      return autore ? (autore.ruoli || []).indexOf(ruolo) !== -1 : true;
    }
    return true;
  }

  function ordinatore(ordine) {
    if (ordine === 'distanza') return (a, b) => (a.dist === null ? 1e9 : a.dist) - (b.dist === null ? 1e9 : b.dist);
    if (ordine === 'recenza') return (a, b) => (b.e.pubblicato || b.e.creato || 0) - (a.e.pubblicato || a.e.creato || 0);
    return (a, b) => b.comp.score - a.comp.score;
  }

  /* ---------------- filtri: azioni ---------------- */
  function setFiltro(patch) {
    S.set((s) => { Object.assign(s.ricerca, patch); });
  }
  GD.actions.filtroToggleTipo = (ds) => {
    const st = S.get(); const arr = st.ricerca.tipi.slice();
    const i = arr.indexOf(ds.value);
    if (i === -1) arr.push(ds.value); else if (arr.length > 1) arr.splice(i, 1);
    setFiltro({ tipi: arr });
  };
  GD.actions.filtroToggleSistema = (ds) => {
    const arr = S.get().ricerca.sistemi.slice();
    const i = arr.indexOf(ds.value);
    if (i === -1) arr.push(ds.value); else arr.splice(i, 1);
    setFiltro({ sistemi: arr });
  };
  GD.actions.filtroToggleGiorno = (ds) => {
    const arr = S.get().ricerca.giorni.slice();
    const i = arr.indexOf(ds.value);
    if (i === -1) arr.push(ds.value); else arr.splice(i, 1);
    setFiltro({ giorni: arr });
  };
  GD.actions.filtroSet = (ds, el) => {
    const v = el && el.type === 'checkbox' ? el.checked : (ds.value !== undefined ? ds.value : el.value);
    const patch = {}; patch[ds.field] = ds.field === 'raggio' ? Number(v) : v;
    setFiltro(patch);
  };
  GD.actions.filtroRaggio = (ds, el) => {
    const val = GD.geo.RADII[Number(el.value)];
    setFiltro({ raggio: val });
  };
  GD.actions.filtroQuery = (ds, el) => {
    S.set((s) => { s.ricerca.q = el.value; });
    const inp = U.$('#radar-q');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };
  GD.actions.filtroReset = () => setFiltro({
    q: '', sistemi: [], giorni: [], ruolo: 'tutti', modalita: 'tutte',
    esperienza: 'tutte', newbieOnly: false, postiLiberi: false, raggio: 25
  });
  GD.actions.filtriMobile = () => {
    UI.openDrawer({ title: 'Filtri', body: filtri(true), foot: html`<div class="row g-10">
      <button class="btn grow" data-act="filtroReset">Azzera</button>
      <button class="btn btn-primary grow" data-act="closeOverlays">Vedi risultati</button></div>` });
  };

  /* ---------------- pannello filtri ---------------- */
  function filtri() {
    const f = S.get().ricerca;
    const raggioIdx = Math.max(0, GD.geo.RADII.indexOf(f.raggio));
    const attivi = (f.sistemi.length ? 1 : 0) + (f.giorni.length ? 1 : 0)
      + (f.ruolo !== 'tutti' ? 1 : 0) + (f.modalita !== 'tutte' ? 1 : 0)
      + (f.esperienza !== 'tutte' ? 1 : 0) + (f.newbieOnly ? 1 : 0) + (f.postiLiberi ? 1 : 0);

    return html`<div class="filters-rail-inner col g-20">
      <div class="filter-group">
        <div class="h-sm">Raggio<span class="badge badge-accent">${f.raggio} km</span></div>
        <input class="range" type="range" min="0" max="${GD.geo.RADII.length - 1}" step="1" value="${raggioIdx}" data-input="filtroRaggio" aria-label="Raggio di ricerca">
        <div class="row-b tiny muted">${GD.geo.RADII.map((r) => html`<span>${r}</span>`)}</div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Cosa cerchi</span>
        <div class="row g-8 wrap">
          ${[['utente', 'Persone'], ['party', 'Party'], ['campagna', 'Campagne'], ['annuncio', 'Annunci']].map((t) =>
            html`<button class="chip" aria-pressed="${f.tipi.indexOf(t[0]) !== -1}" data-act="filtroToggleTipo" data-value="${t[0]}">${t[1]}</button>`)}
        </div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Ruolo cercato</span>
        <div class="segmented on-white">
          ${[['tutti', 'Tutti'], ['player', 'Player'], ['master', 'Master']].map((r) =>
            html`<button aria-pressed="${f.ruolo === r[0]}" data-act="filtroSet" data-field="ruolo" data-value="${r[0]}">${r[1]}</button>`)}
        </div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Modalità</span>
        <div class="segmented on-white">
          ${[['tutte', 'Tutte'], ['presenza', 'Presenza'], ['online', 'Online']].map((r) =>
            html`<button aria-pressed="${f.modalita === r[0]}" data-act="filtroSet" data-field="modalita" data-value="${r[0]}">${r[1]}</button>`)}
        </div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Giorni</span>
        <div class="row g-6 wrap">
          ${D.GIORNI.map((g) => html`<button class="chip" style="padding:0 10px" aria-pressed="${f.giorni.indexOf(g.id) !== -1}"
            data-act="filtroToggleGiorno" data-value="${g.id}">${g.label}</button>`)}
        </div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Sistema</span>
        <div class="row g-6 wrap">
          ${D.SYSTEMS.slice(0, 9).map((s) => html`<button class="chip" aria-pressed="${f.sistemi.indexOf(s.id) !== -1}"
            data-act="filtroToggleSistema" data-value="${s.id}">${s.nome}</button>`)}
        </div>
      </div>

      <div class="filter-group">
        <span class="h-sm">Esperienza</span>
        <select class="select" data-change="filtroSet" data-field="esperienza">
          <option value="tutte" ${raw(f.esperienza === 'tutte' ? 'selected' : '')}>Qualsiasi livello</option>
          ${D.ESPERIENZA.map((e) => html`<option value="${e.id}" ${raw(f.esperienza === e.id ? 'selected' : '')}>${e.label}</option>`)}
        </select>
      </div>

      <div class="filter-group">
        <label class="switch"><input type="checkbox" ${raw(f.newbieOnly ? 'checked' : '')} data-change="filtroSet" data-field="newbieOnly">
          <span class="track"><span class="thumb"></span></span><span class="small">Adatto alla prima esperienza</span></label>
        <label class="switch"><input type="checkbox" ${raw(f.postiLiberi ? 'checked' : '')} data-change="filtroSet" data-field="postiLiberi">
          <span class="track"><span class="thumb"></span></span><span class="small">Solo con posti liberi</span></label>
      </div>

      ${attivi ? html`<button class="btn btn-sm" data-act="filtroReset">${icon('x', 14)}Azzera ${attivi} filtri</button>` : ''}
    </div>`;
  }

  /* ---------------- visualizzazione radar ---------------- */
  const COLORE = { utente: 'var(--signal)', party: 'var(--amber)', campagna: 'var(--violet)', annuncio: 'var(--steel)' };

  function radarSvg(risultati) {
    const st = S.get();
    const C = 300, R = 268;
    const onRing = [];
    const blips = risultati.slice(0, 44).map((r, i) => {
      const e = r.e;
      const online = e.modalita === 'online' || r.dist === null;
      let ang, frac;
      if (online) {
        onRing.push(i);
        ang = (onRing.length * 37 + 12) % 360;
        frac = 1.06;
      } else {
        ang = GD.geo.bearing(st.me.loc, e.loc);
        frac = GD.geo.radiusFraction(r.dist);
        /* separa i punti che cadrebbero uno sull'altro */
        ang += ((U.hashStr(e.id) % 22) - 11) * 0.5;
      }
      const rad = ((ang - 90) * Math.PI) / 180;
      const size = 6.5 + (r.comp.score / 100) * 6.5;
      return {
        e, r,
        x: C + Math.cos(rad) * R * frac,
        y: C + Math.sin(rad) * R * frac,
        size,
        col: COLORE[e.tipo] || COLORE.utente,
        op: 0.35 + (r.comp.score / 100) * 0.6
      };
    });

    return html`<div class="radar-canvas">
      <svg viewBox="-20 -20 640 640" role="img" aria-label="Radar: ${risultati.length} risultati intorno a te">
        <defs>
          <radialGradient id="sw" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--signal)" stop-opacity=".18"/>
            <stop offset="100%" stop-color="var(--signal)" stop-opacity="0"/>
          </radialGradient>
        </defs>

        ${GD.geo.RING_FRACTIONS.map((f, i) => html`
          <circle cx="${C}" cy="${C}" r="${(R * f).toFixed(1)}" class="ring-line"/>
          <text class="ring-label" x="${C + 4}" y="${(C - R * f + 12).toFixed(1)}">${GD.geo.RADII[i]} km</text>`)}
        <circle cx="${C}" cy="${C}" r="${(R * 1.06).toFixed(1)}" class="ring-line dashed"/>
        <text class="ring-label" x="${C + 4}" y="${(C - R * 1.06 - 6).toFixed(1)}">ONLINE</text>
        <line x1="${C}" y1="${C - R}" x2="${C}" y2="${C + R}" class="cross"/>
        <line x1="${C - R}" y1="${C}" x2="${C + R}" y2="${C}" class="cross"/>

        <g class="sweep">
          <path d="M${C} ${C} L${C} ${C - R} A ${R} ${R} 0 0 1 ${(C + R * Math.cos(-Math.PI / 3)).toFixed(1)} ${(C + R * Math.sin(-Math.PI / 3)).toFixed(1)} Z" fill="url(#sw)"/>
          <line x1="${C}" y1="${C}" x2="${C}" y2="${C - R}" stroke="var(--signal)" stroke-opacity=".45" stroke-width="1.3"/>
        </g>

        ${blips.map((b) => html`<g class="blip" data-act="openSheet" data-kind="${b.e.tipo}" data-id="${b.e.id}"
            tabindex="0" role="button" aria-label="${(b.e.nome || b.e.titolo)}, compatibilità ${b.r.comp.score}">
          <circle class="halo" cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.size + 13}" fill="${raw(b.col)}" opacity=".16"/>
          <g class="core">${UI.d20(b.x, b.y, b.size, b.col, b.op)}</g>
          <title>${(b.e.nome || b.e.titolo)} · ${b.r.dist === null ? 'online' : U.fmtKm(b.r.dist)} · compatibilità ${b.r.comp.score}</title>
        </g>`)}

        <g class="me-pin">
          <circle class="pulse" cx="${C}" cy="${C}" r="30" fill="var(--accent)" opacity=".13"/>
          ${UI.d20(C, C, 13, 'var(--accent)')}
        </g>
      </svg>
    </div>`;
  }

  /* ---------------- scheda entità (drawer) ---------------- */
  GD.actions.openSheet = (ds) => {
    const kind = ds.kind;
    const e = D.byId(kind, ds.id) || (S.get().listings || []).find((l) => l.id === ds.id);
    if (!e) return;
    const st = S.get();
    const comp = GD.match.compatibilita(st.me, e, { raggio: st.ricerca.raggio });
    const id = UI.identity(e);
    const fair = GD.match.fairness(e);
    const bloccato = S.isBloccato(kind, e.id);
    const conv = S.conversazioneCon(kind, e.id);
    const req = S.richiestaVerso(kind, e.id);

    UI.openDrawer({
      head: html`${UI.tipoBadge(e.tipo, e.sottotipo)}
        <span class="h-md truncate">${id.nome}</span>`,
      body: html`
        <div class="sheet-hero">
          ${U.avatar(id.nome, 'lg', id.seed)}
          <div class="grow">
            <h2 class="display d-4">${id.nome}</h2>
            <p class="small muted mt-4">${id.sotto}</p>
            <div class="row g-8 wrap mt-12">
              ${UI.newbieBadge(e.newbie)}
              ${UI.luogoBadge(e, st.me)}
              ${UI.sistemaBadge(e)}
            </div>
          </div>
        </div>

        ${e.bio || e.testo ? html`<p class="body mt-16">${e.bio || e.testo}</p>` : ''}

        <div class="sheet-section">
          <span class="eyebrow">Compatibilità</span>
          <div class="row g-16">
            ${UI.donut(comp.score, 72, 6)}
            <div class="grow">
              <p class="h-md">${comp.fascia.label}</p>
              <p class="small muted mt-4">Punteggio deterministico: stessi dati, stesso risultato. Nessuna Fairness dentro il calcolo.</p>
            </div>
          </div>
          <div class="mt-16">
            ${comp.parts.map((p) => html`<div class="why-row">
              <span class="lab">${p.label}<br><span class="tiny muted">${p.why}</span></span>
              <span class="bar"><span class="meter ${raw(p.neg ? 'amber' : '')}"><i style="width:${Math.round((p.got / p.max) * 100)}%"></i></span></span>
              <span class="pts">${p.got}/${p.max}</span>
            </div>`)}
          </div>
        </div>

        <div class="sheet-section">
          <span class="eyebrow">Fairness</span>
          ${fair.visibile ? html`
            <div class="row-b g-12 wrap">
              ${UI.fairPips(e, { conta: true })}
              <span class="badge badge-lg">${fair.esperienze}</span>
            </div>
            <p class="small muted mt-8">${fair.nota} Stima prudenziale (Wilson): un 5 su 5 non supera un 97 su 100.</p>`
          : html`
            <div class="row g-10">${icon('lock', 18)}<span class="small">${fair.label}</span></div>
            <p class="small muted mt-8">${fair.nota} Fino ad allora non mostriamo nessun numero: sarebbe rumore, non un segnale.</p>`}
        </div>

        ${dettagliSpecifici(e, st)}

        <div class="sheet-section">
          <span class="eyebrow">Sicurezza</span>
          <div class="row g-8 wrap mt-4">
            <button class="btn btn-sm" data-act="apriBlocco" data-kind="${kind}" data-id="${e.id}">${icon('ban', 14)}${bloccato ? 'Sbloccato' : 'Blocca'}</button>
            <button class="btn btn-sm btn-danger" data-act="apriSegnalazione" data-kind="${kind}" data-id="${e.id}">${icon('flag', 14)}Segnala</button>
          </div>
          <p class="tiny muted mt-8">Il blocco è immediato e non viene comunicato. La segnalazione è anonima verso chi la riceve e apre un caso di moderazione.</p>
        </div>`,
      foot: bloccato
        ? html`<div class="row-b"><span class="small muted">Hai bloccato questo profilo.</span>
            <button class="btn" data-act="sbloccaOra" data-kind="${kind}" data-id="${e.id}">Sblocca</button></div>`
        : conv
          ? html`<a class="btn btn-primary btn-block" href="#/messaggi/${conv.id}" data-act="closeOverlays">${icon('message', 16)}Vai alla conversazione</a>`
          : req && req.stato === 'pending'
            ? html`<button class="btn btn-block" disabled>${icon('clock', 16)}Richiesta inviata · in attesa</button>`
            : html`<button class="btn btn-primary btn-block btn-lg" data-act="apriRichiesta" data-kind="${kind}" data-id="${e.id}">
                ${icon('handshake', 16)}Richiedi il contatto</button>`
    });
  };

  function dettagliSpecifici(e, st) {
    const rows = [];
    const dd = (k, v) => rows.push({ k, v });
    if (e.tipo === 'utente') {
      dd('Ruoli', e.ruoli.map((r) => (D.RUOLI.find((x) => x.id === r) || {}).label).join(' e '));
      dd('Esperienza', D.espById(e.esperienza).label);
      dd('Sistemi', e.games.map((g) => D.systemById(g.systemId).nome + ' · ' + g.versione).join('\n'));
      dd('Stile', U.listJoin(e.stili));
      dd('Lingue', U.listJoin(e.lingue));
      dd('Attivo da', U.dateLabel(e.attivoDa));
    } else if (e.tipo === 'party') {
      dd('Persone', String(e.membri.length));
      dd('Posti liberi', e.postiLiberi ? String(e.postiLiberi) : 'nessuno al momento');
      dd('Sistemi', e.games.map((g) => D.systemById(g.systemId).nome).join(', '));
      dd('Gruppo dal', U.dateLabel(e.creato));
    } else if (e.tipo === 'campagna') {
      const master = D.byId('utente', e.masterId);
      dd('Master', master ? master.nome : '—');
      dd('Sistema', D.systemById(e.systemId).nome + ' · ' + e.versione);
      dd('Formato', (D.FORMATI.find((f) => f.id === e.formato) || {}).label);
      dd('Posti', e.postiLiberi + ' liberi su ' + e.postiTotali);
      dd('Livello atteso', D.espById(e.esperienzaRichiesta).label);
      if (e.partyId) { const p = D.byId('party', e.partyId); if (p) dd('Party collegato', p.nome); }
    } else {
      const autore = D.byId(e.autore.kind, e.autore.id);
      dd('Pubblicato da', (autore ? autore.nome : 'Tu') + ' (' + e.autore.kind + ')');
      dd('Tipo', UI.TIPO_ANNUNCIO[e.sottotipo] || '—');
      dd('Sistema', D.systemById(e.systemId).nome + ' · ' + e.versione);
      dd('Posti', String(e.posti));
      dd('Pubblicato', U.timeAgo(e.pubblicato));
    }
    const disp = e.disponibilita;
    if (disp && disp.giorni && disp.giorni.length) {
      dd('Quando', disp.giorni.map((g) => (D.GIORNI.find((x) => x.id === g) || {}).label).join(', ')
        + ' · ' + disp.fasce.map((f) => (D.FASCE.find((x) => x.id === f) || {}).label.toLowerCase()).join(', ')
        + ' · ' + (D.FREQUENZE.find((f) => f.id === disp.frequenza) || {}).label.toLowerCase());
    }
    if (e.modalita) dd('Modalità', (D.MODALITA.find((m) => m.id === e.modalita) || {}).label);
    if (e.newbie) dd('Newbie Friendly', (D.NEWBIE.find((n) => n.id === e.newbie) || {}).label);
    if (e.loc && e.modalita !== 'online') {
      const pv = GD.geo.publicView(e.loc, st.me.loc);
      dd('Zona', pv.area + (pv.distanceLabel ? ' · a ' + pv.distanceLabel + ' da te' : ''));
    }

    return html`<div class="sheet-section">
      <span class="eyebrow">Dettagli</span>
      <dl class="deflist">${rows.map((r) => html`<dt>${r.k}</dt><dd>${r.v}</dd>`)}</dl>
    </div>`;
  }

  /* ---------------- richiesta di contatto ---------------- */
  GD.actions.apriRichiesta = (ds) => {
    if (!UI.requireVerified('contattare qualcuno')) return;
    const e = D.byId(ds.kind, ds.id) || (S.get().listings || []).find((l) => l.id === ds.id);
    const nome = e.nome || e.titolo;
    UI.openModal({
      title: 'Richiesta di contatto',
      sub: 'Prima del messaggio serve un sì. Finché non accettano, non potete scrivervi.',
      body: html`
        <div class="row g-12">${U.avatar(nome, 'sm', e.id)}<div><p class="h-sm">${nome}</p>
          <p class="tiny muted">${UI.identity(e).sotto}</p></div></div>
        <div class="field mt-16">
          <label class="label" for="req-msg">Messaggio di presentazione</label>
          <textarea class="textarea" id="req-msg" maxlength="400" placeholder="Chi sei, quando puoi giocare, perché scrivi proprio a loro.">Ciao! Cerco un tavolo compatibile con i miei giorni e ho visto che potremmo incastrarci bene. Ti va di parlarne?</textarea>
          <span class="hint">Niente numeri di telefono o contatti esterni: si scambiano dopo, con doppio consenso.</span>
        </div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-primary" data-act="inviaRichiesta" data-kind="${ds.kind}" data-id="${ds.id}">Invia richiesta</button>`,
      after: () => { const t = U.$('#req-msg'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
    });
  };

  GD.actions.inviaRichiesta = (ds) => {
    const msg = (U.$('#req-msg') || {}).value || '';
    const ok = S.inviaRichiesta(ds.kind, ds.id, msg.trim());
    UI.closeOverlays();
    UI.toast(ok ? 'Richiesta inviata. Ti avvisiamo appena rispondono.' : 'Hai già una richiesta in attesa con questo profilo.', ok ? null : 'warn');
  };

  /* ---------------- blocco e segnalazione ---------------- */
  GD.actions.apriBlocco = (ds) => {
    const e = D.byId(ds.kind, ds.id);
    const nome = e ? (e.nome || e.titolo) : 'questo profilo';
    if (S.isBloccato(ds.kind, ds.id)) { S.sblocca(ds.kind, ds.id); UI.toast('Sbloccato.'); UI.closeOverlays(); return; }
    UI.openModal({
      title: 'Bloccare ' + nome + '?',
      sub: 'Il blocco è immediato. Non riceve nessuna notifica.',
      body: html`<ul class="col g-8">
        ${['Sparisce dai tuoi risultati e tu dai suoi',
           'Le richieste di contatto in sospeso vengono annullate',
           'Le conversazioni aperte vengono chiuse',
           'Puoi sbloccare quando vuoi da Sicurezza'
          ].map((t) => html`<li class="row g-8"><span class="muted">${icon('check', 15)}</span><span class="small">${t}</span></li>`)}
      </ul>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-danger" data-act="confermaBlocco" data-kind="${ds.kind}" data-id="${ds.id}">Blocca</button>`
    });
  };
  GD.actions.confermaBlocco = (ds) => {
    const e = D.byId(ds.kind, ds.id);
    S.blocca(ds.kind, ds.id, e ? (e.nome || e.titolo) : ds.id);
    UI.closeOverlays();
    UI.toast('Bloccato. Lo trovi in Sicurezza se cambi idea.');
  };
  GD.actions.sbloccaOra = (ds) => { S.sblocca(ds.kind, ds.id); UI.closeOverlays(); UI.toast('Sbloccato.'); };

  GD.actions.apriSegnalazione = (ds) => {
    const e = D.byId(ds.kind, ds.id);
    const nome = e ? (e.nome || e.titolo) : 'profilo';
    UI.openModal({
      title: 'Segnala ' + nome,
      sub: 'La segnalazione è anonima verso chi la riceve e apre un caso di moderazione con revisione umana.',
      body: html`
        <div class="field">
          <span class="label">Motivo</span>
          <select class="select" id="rep-motivo">
            ${D.MOTIVI_REPORT.map((m) => html`<option value="${m.id}">${m.label}</option>`)}
          </select>
        </div>
        <div class="field mt-16">
          <label class="label" for="rep-note">Cosa è successo</label>
          <textarea class="textarea" id="rep-note" placeholder="Fatti, date, cosa è stato detto. Più è concreto, più il triage è rapido."></textarea>
        </div>
        <label class="row g-10 mt-16" style="cursor:pointer;align-items:flex-start">
          <input type="checkbox" id="rep-chat" checked style="margin-top:3px;width:17px;height:17px;accent-color:var(--accent)">
          <span class="small">Allega la conversazione come evidenza.<br>
            <span class="muted tiny">Solo il moderatore assegnato al caso potrà leggerla, e ogni accesso resta a registro.</span></span>
        </label>
        <div class="callout danger mt-16">${icon('warn', 18, 'ico')}
          <div>Se sei in pericolo immediato, contatta le autorità locali. GdRadar non sostituisce un intervento di emergenza.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-danger" data-act="inviaSegnalazione" data-kind="${ds.kind}" data-id="${ds.id}">Invia segnalazione</button>`
    });
  };
  GD.actions.inviaSegnalazione = (ds) => {
    const motivo = (U.$('#rep-motivo') || {}).value || 'altro';
    const note = (U.$('#rep-note') || {}).value || '';
    const chat = (U.$('#rep-chat') || {}).checked;
    const e = D.byId(ds.kind, ds.id);
    const id = S.segnala(ds.kind, ds.id, e ? (e.nome || e.titolo) : ds.id, motivo, note.trim(), chat);
    UI.closeOverlays();
    UI.toast('Segnalazione inviata: caso ' + id + ' in coda di triage.');
  };

  /* ---------------- vista ---------------- */
  function view() {
    const st = S.get();
    const f = st.ricerca;
    const ris = candidati();
    const pv = st.me.loc ? st.me.loc.label + (st.me.loc.zona ? ' · ' + st.me.loc.zona : '') : 'zona non impostata';

    const topLeft = html`<div class="row g-10 grow" style="max-width:420px">
      <input class="input input-search" id="radar-q" placeholder="Cerca sistema, nome, stile…" value="${f.q}" data-input="filtroQuery">
    </div>`;


    const testa = html`<div class="row-b wrap g-12" style="margin-bottom:18px">
      <div>
        <h1 class="display d-3">Radar</h1>
        <p class="small muted mt-4">${U.plural(ris.length, 'risultato', 'risultati')} · ${f.raggio} km da ${pv}${st.me.visibilita !== 'attivo' ? ' · sei ' + (st.me.visibilita === 'nascosto' ? 'nascosto' : 'in pausa') : ''}</p>
      </div>
      <div class="row g-8 wrap">
        <div class="segmented">
          <button aria-pressed="${f.vista === 'radar'}" data-act="filtroSet" data-field="vista" data-value="radar">Radar</button>
          <button aria-pressed="${f.vista === 'lista'}" data-act="filtroSet" data-field="vista" data-value="lista">Lista</button>
        </div>
        <button class="btn btn-sm" data-act="filtriMobile">${icon('sliders', 15)}Filtri</button>
        <select class="select" style="min-height:34px;width:auto;font-size:13px" data-change="filtroSet" data-field="ordine">
          <option value="compatibilita" ${raw(f.ordine === 'compatibilita' ? 'selected' : '')}>Ordina per compatibilità</option>
          <option value="distanza" ${raw(f.ordine === 'distanza' ? 'selected' : '')}>Ordina per distanza</option>
          <option value="recenza" ${raw(f.ordine === 'recenza' ? 'selected' : '')}>Ordina per recenza</option>
        </select>
      </div>
    </div>`;

    const contenuto = html`<div class="radar-layout">
      <aside class="filters-rail">${filtri()}</aside>
      <div class="col g-16">
        ${testa}
        ${!ris.length ? html`<div class="card">${UI.emptyState('search', 'Nessun risultato con questi filtri',
            'Prova ad allargare il raggio, togliere qualche sistema o includere chi gioca online.',
            html`<button class="btn mt-8" data-act="filtroReset">Azzera i filtri</button>`)}</div>` : ''}

        ${ris.length && f.vista === 'radar' ? html`
          <div class="radar-stage">
            ${radarSvg(ris)}
            <div class="radar-legend">
              <span>${UI.d20Icon(13, 'var(--signal)')}Persone</span>
              <span>${UI.d20Icon(13, 'var(--amber)')}Party</span>
              <span>${UI.d20Icon(13, 'var(--violet)')}Campagne</span>
              <span>${UI.d20Icon(13, 'var(--steel)')}Annunci</span>
              <span>${UI.d20Icon(13, 'var(--accent)')}Tu</span>
              <span class="muted">· dado più grande = più compatibile · anello tratteggiato = solo online</span>
            </div>
          </div>` : ''}

        ${ris.length ? html`<div class="col g-10">
          <div class="row-b">
            <span class="eyebrow">${f.vista === 'radar' ? 'I più compatibili' : 'Risultati'}</span>
            <span class="tiny muted">${f.vista === 'radar' ? 'primi ' + Math.min(8, ris.length) + ' di ' + ris.length : ris.length + ' totali'}</span>
          </div>
          <div class="${raw(f.vista === 'radar' ? 'result-list' : 'results-grid')}">
            ${(f.vista === 'radar' ? ris.slice(0, 8) : ris).map((r) => UI.resultCard(r.e, r.comp, st.me))}
          </div>
        </div>` : ''}
      </div>
    </div>`;

    return UI.shell('/radar', contenuto, { topLeft });
  }

  GD.views = GD.views || {};
  GD.views.radar = view;
})(window.GD);
