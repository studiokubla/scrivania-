/* ============================================================
   GdRadar — onboarding (flusso A)
   Account → profilo → età dichiarata → prova 18+ → Patto di
   Community → preferenze → Radar.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  const STEPS = [
    { id: 'account', titolo: 'Crea l\'account', nota: 'Ti serve solo per rientrare: nessun profilo pubblico è ancora attivo.' },
    { id: 'profilo', titolo: 'Chi sei al tavolo', nota: 'Il ruolo non è il tipo di account: puoi essere Player, Master o entrambi, e cambiare idea.' },
    { id: 'eta', titolo: 'Maggiore età', nota: 'GdRadar è un servizio 18+. La data dichiarata non è una verifica.' },
    { id: 'patto', titolo: 'Patto di Community', nota: 'Due accettazioni separate: il patto e i termini non sono la stessa cosa.' },
    { id: 'giochi', titolo: 'Cosa giochi', nota: 'Sistemi e versioni sono il primo ingrediente del matching.' },
    { id: 'zona', titolo: 'Da dove cerchi', nota: 'La posizione precisa resta sul tuo dispositivo: gli altri vedranno solo zona e distanza arrotondata.' },
    { id: 'quando', titolo: 'Quando puoi giocare', nota: 'La disponibilità pesa quanto il sistema: è la ragione più comune per cui un tavolo salta.' }
  ];

  function draft() {
    const st = S.get();
    if (!st.onboarding.draft) {
      S.set((s) => { s.onboarding.draft = S.profiloVuoto(); s.onboarding.step = 0; }, { render: false });
    }
    return S.get().onboarding.draft;
  }

  function setField(path, value) {
    S.set((s) => {
      const parts = path.split('.');
      let node = s.onboarding.draft;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
      node[parts[parts.length - 1]] = value;
    }, { render: false });
  }
  function getField(path) {
    return path.split('.').reduce((n, k) => (n ? n[k] : undefined), draft());
  }
  function toggleIn(path, value) {
    const arr = (getField(path) || []).slice();
    const i = arr.indexOf(value);
    if (i === -1) arr.push(value); else arr.splice(i, 1);
    setField(path, arr);
  }

  GD.actions.onbSet = (ds, el) => {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    setField(ds.field, v);
    if (ds.rerender) GD.app.render();
  };
  GD.actions.onbToggle = (ds) => { toggleIn(ds.field, ds.value); GD.app.render(); };
  GD.actions.onbPick = (ds) => { setField(ds.field, ds.value); GD.app.render(); };
  GD.actions.onbNext = () => step(+1);
  GD.actions.onbBack = () => step(-1);

  function step(delta) {
    const st = S.get();
    const i = st.onboarding.step;
    if (delta > 0) {
      const err = validate(STEPS[i].id);
      if (err) { UI.toast(err, 'warn'); return; }
    }
    const next = i + delta;
    if (next < 0) { UI.go('/'); return; }
    if (next >= STEPS.length) { completa(); return; }
    S.set((s) => { s.onboarding.step = next; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validate(id) {
    const d = draft();
    if (id === 'account') {
      if (!d.nome || d.nome.trim().length < 2) return 'Scegli un nickname di almeno 2 caratteri.';
      if (!/^\S+@\S+\.\S+$/.test(d.email || '')) return 'Inserisci un\'email valida.';
    }
    if (id === 'profilo' && !d.ruoli.length) return 'Scegli almeno un ruolo: Player, Master o entrambi.';
    if (id === 'eta') {
      if (!d.dataNascita) return 'Inserisci la data di nascita.';
      if (etaDa(d.dataNascita) < 18) return 'GdRadar è un servizio riservato ai maggiorenni.';
      if (d.ageVerification.status !== 'verified') return 'Completa la verifica 18+ per proseguire.';
    }
    if (id === 'patto' && !(d.patto && d.tos)) return 'Servono entrambe le accettazioni.';
    if (id === 'giochi' && !d.games.length) return 'Aggiungi almeno un sistema di gioco.';
    if (id === 'zona' && !d.loc) return 'Indica una zona: geolocalizzazione o ricerca manuale.';
    if (id === 'quando' && !d.disponibilita.giorni.length) return 'Scegli almeno un giorno.';
    return null;
  }

  function etaDa(iso) {
    if (!iso) return 0;
    const d = new Date(iso), n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
  }

  function completa() {
    const d = draft();
    d.eta = etaDa(d.dataNascita);
    d.creato = Date.now();
    S.creaProfilo(JSON.parse(JSON.stringify(d)));
    S.set((s) => { s.onboarding = { step: 0, draft: null }; });
    UI.go('/radar');
    setTimeout(() => UI.toast('Profilo attivo sul Radar. Buona caccia al tavolo.'), 300);
  }

  /* ---------------- verifica 18+ (mock provider) ---------------- */
  GD.actions.avviaVerifica = () => {
    UI.openModal({
      title: 'Verifica dei 18 anni',
      sub: 'Ti mandiamo da un provider esterno. Torna indietro solo un esito: sì o no.',
      body: html`
        <ul class="col g-10">
          ${[['Cosa esce da GdRadar', 'Una richiesta anonima: “questa persona ha 18 anni?”'],
             ['Cosa torna indietro', 'Esito, provider, riferimento non reversibile, data.'],
             ['Cosa NON conserviamo', 'Foto del documento, numero, codice fiscale, selfie.']
            ].map((r) => html`<li class="row g-10" style="align-items:flex-start">
              <span style="color:var(--accent);margin-top:2px">${icon('checkCircle', 16)}</span>
              <span><b class="h-sm">${r[0]}</b><br><span class="small muted">${r[1]}</span></span>
            </li>`)}
        </ul>
        <div class="callout mt-16">${icon('info', 18, 'ico')}<div>In questo prototipo la verifica è simulata: nessuna chiamata esce dal browser.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-primary" data-act="confermaVerifica">Vai al provider${icon('arrowRight', 16)}</button>`
    });
  };

  GD.actions.confermaVerifica = () => {
    const target = S.get().me ? 'me' : 'draft';
    const av = {
      status: 'verified', threshold: 18, provider: 'ID-Bridge EU (demo)',
      ref: 'pv_' + Math.random().toString(36).slice(2, 12), verified_at: Date.now(), expires_at: null
    };
    if (target === 'me') S.set((s) => { s.me.ageVerification = av; });
    else { setField('ageVerification', av); GD.app.render(); }
    UI.closeOverlays();
    UI.toast('Verifica 18+ completata. Nessun documento è stato conservato.');
    if (target === 'me') GD.app.render();
  };

  /* ---------------- ricerca zona ---------------- */
  GD.actions.zonaCerca = (ds, el) => {
    const q = el.value;
    const box = U.$('#zona-sugg');
    const items = GD.geo.suggestions(q);
    if (!box) return;
    box.innerHTML = items.length ? String(html`${items.map((c) => html`
      <button class="btn btn-block" style="justify-content:flex-start;border-radius:0;border:0;border-bottom:1px solid var(--line-2)"
        data-act="zonaScegli" data-city="${c.id}">${icon('pin', 15)} ${c.nome} <span class="muted small">· ${c.prov} · ${c.cap}</span></button>`)}`) : '';
  };
  GD.actions.zonaScegli = (ds) => {
    const c = GD.geo.cityById(ds.city);
    const loc = GD.geo.place(c, c.zone[0]);
    if (S.get().me) { S.set((s) => { s.me.loc = loc; }); UI.toast('Zona aggiornata: ' + c.nome); }
    else { setField('loc', loc); }
    GD.app.render();
  };
  GD.actions.zonaGps = () => {
    if (!navigator.geolocation) { UI.toast('Il browser non espone la geolocalizzazione.', 'warn'); return; }
    UI.toast('Chiedo la posizione al browser…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best = null, bestD = Infinity;
        GD.geo.CITIES.forEach((c) => {
          const d = GD.geo.distanceKm({ lat: latitude, lng: longitude }, c);
          if (d < bestD) { bestD = d; best = c; }
        });
        const loc = { cityId: best.id, label: best.nome, zona: null, prov: best.prov, lat: latitude, lng: longitude };
        if (S.get().me) S.set((s) => { s.me.loc = loc; }); else setField('loc', loc);
        GD.app.render();
        UI.toast('Posizione acquisita. Agli altri mostreremo solo ' + best.nome + '.');
      },
      () => UI.toast('Permesso negato: puoi cercare la città a mano.', 'warn'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  /* ---------------- render degli step ---------------- */
  function chip(field, value, label, round) {
    const cur = getField(field);
    const on = Array.isArray(cur) ? cur.indexOf(value) !== -1 : cur === value;
    const act = Array.isArray(cur) ? 'onbToggle' : 'onbPick';
    return html`<label class="choice ${raw(round ? 'round' : '')}">
      <input type="checkbox" ${raw(on ? 'checked' : '')} data-act="${act}" data-field="${field}" data-value="${value}">
      <span class="tick">${icon('check', 9)}</span><span>${label}</span></label>`;
  }

  function renderStep(id) {
    const d = draft();
    switch (id) {
      case 'account':
        return html`
          <div class="col g-16">
            <div class="row g-10 wrap">
              <button class="btn grow" data-act="oauthDemo">${icon('globe', 16)}Continua con Google</button>
              <button class="btn grow" data-act="oauthDemo">${icon('globe', 16)}Continua con Apple</button>
            </div>
            <div class="row g-12"><hr class="grow"><span class="tiny muted">oppure con email</span><hr class="grow"></div>
            <div class="field">
              <label class="label" for="f-nick">Nickname pubblico</label>
              <input class="input" id="f-nick" value="${d.nome}" placeholder="Come vuoi farti chiamare al tavolo"
                data-input="onbSet" data-field="nome" maxlength="34">
              <span class="hint">È l'unico nome che vedranno gli altri. Puoi non usare quello vero.</span>
            </div>
            <div class="field">
              <label class="label" for="f-mail">Email</label>
              <input class="input" id="f-mail" type="email" value="${d.email}" placeholder="tu@esempio.it" data-input="onbSet" data-field="email">
            </div>
            <div class="field">
              <label class="label" for="f-pw">Password</label>
              <input class="input" id="f-pw" type="password" placeholder="Almeno 8 caratteri" autocomplete="new-password">
              <span class="hint">Nel prototipo la password non viene salvata da nessuna parte.</span>
            </div>
          </div>`;

      case 'profilo':
        return html`
          <div class="col g-24">
            <div class="field">
              <span class="label">Ruoli che vuoi coprire</span>
              <div class="row g-8 wrap">${D.RUOLI.map((r) => chip('ruoli', r.id, r.label))}</div>
              <span class="hint">Puoi selezionarli entrambi: sono ruoli, non tipi di account.</span>
            </div>
            <div class="field">
              <span class="label">Esperienza</span>
              <div class="row g-8 wrap">${D.ESPERIENZA.map((e) => chip('esperienza', e.id, e.label, true))}</div>
            </div>
            <div class="field">
              <label class="label" for="f-bio">Due righe su di te</label>
              <textarea class="textarea" id="f-bio" maxlength="240" placeholder="Che tavoli ti piacciono? Cosa ti fa tornare la settimana dopo?"
                data-input="onbSet" data-field="bio">${d.bio}</textarea>
              <span class="hint">Massimo 240 caratteri. Niente contatti qui: si scambiano dopo, con consenso.</span>
            </div>
            <div class="field">
              <span class="label">Sei disponibile con chi gioca per la prima volta?</span>
              <div class="row g-8 wrap">${D.NEWBIE.map((n) => chip('newbie', n.id, n.label, true))}</div>
            </div>
          </div>`;

      case 'eta': {
        const verificato = d.ageVerification.status === 'verified';
        const eta = etaDa(d.dataNascita);
        return html`
          <div class="col g-20">
            <div class="field" style="max-width:240px">
              <label class="label" for="f-nasc">Data di nascita</label>
              <input class="input" id="f-nasc" type="date" value="${d.dataNascita}" data-change="onbSet" data-field="dataNascita" data-rerender="1">
            </div>
            ${d.dataNascita && eta < 18 ? html`<div class="callout danger">${icon('warn', 18, 'ico')}
              <div>Con questa data non puoi usare GdRadar: il servizio è riservato ai maggiorenni.</div></div>` : ''}
            ${d.dataNascita && eta >= 18 ? html`<div class="callout">${icon('info', 18, 'ico')}
              <div>La data dichiarata non vale come verifica: serve un secondo livello, gestito da un provider esterno.</div></div>` : ''}

            <div class="card card-pad ${raw(verificato ? '' : '')}" style="${raw(verificato ? 'border-color:var(--accent-soft-2);background:var(--accent-soft)' : '')}">
              <div class="row-b g-16 wrap">
                <div class="row g-12">
                  <span style="color:${raw(verificato ? 'var(--accent)' : 'var(--ink-3)')}">${icon(verificato ? 'checkCircle' : 'lock', 22)}</span>
                  <div>
                    <p class="h-md">${verificato ? 'Verifica completata' : 'Prova di maggiore età'}</p>
                    <p class="small muted">${verificato
                      ? 'Provider: ' + d.ageVerification.provider + ' · rif. ' + d.ageVerification.ref
                      : 'Anonima, senza documenti conservati. Obbligatoria per essere attivi.'}</p>
                  </div>
                </div>
                ${verificato ? html`<span class="badge badge-accent badge-lg">18+ verificato</span>`
                  : html`<button class="btn btn-primary" data-act="avviaVerifica" ${raw(eta >= 18 ? '' : 'disabled')}>Verifica ora</button>`}
              </div>
            </div>
          </div>`;
      }

      case 'patto':
        return html`
          <div class="col g-16">
            <div class="card card-pad card-quiet">
              <span class="eyebrow">Estratto del Patto</span>
              <ul class="col g-10 mt-12">
                ${['Rispetto le persone e i limiti concordati al tavolo.',
                   'Non discrimino nessuno per esperienza o inesperienza.',
                   'Sono corretto negli accordi: se non posso venire, avviso.',
                   'Uso segnalazioni e blocchi per la sicurezza, non per ripicca.',
                   'Se incontro qualcuno dal vivo, lo faccio con prudenza.'
                  ].map((t) => html`<li class="row g-10" style="align-items:flex-start">
                    <span style="color:var(--accent);margin-top:2px">${icon('check', 15)}</span><span class="small">${t}</span></li>`)}
              </ul>
              <a class="btn btn-sm mt-16" href="#/etica" target="_self">Leggi la versione integrale</a>
            </div>
            <label class="card card-pad row g-12" style="cursor:pointer;align-items:flex-start">
              <input type="checkbox" ${raw(d.patto ? 'checked' : '')} data-change="onbSet" data-field="patto" style="margin-top:3px;width:18px;height:18px;accent-color:var(--accent)">
              <span><b class="h-sm">Accetto il Patto di Community</b><br><span class="small muted">Riguarda il comportamento al tavolo e in chat.</span></span>
            </label>
            <label class="card card-pad row g-12" style="cursor:pointer;align-items:flex-start">
              <input type="checkbox" ${raw(d.tos ? 'checked' : '')} data-change="onbSet" data-field="tos" style="margin-top:3px;width:18px;height:18px;accent-color:var(--accent)">
              <span><b class="h-sm">Accetto i Termini di servizio e la Privacy policy</b><br><span class="small muted">Riguardano il contratto con la piattaforma e il trattamento dei dati.</span></span>
            </label>
          </div>`;

      case 'giochi': {
        const scelti = d.games;
        return html`
          <div class="col g-20">
            <div class="field">
              <span class="label">Sistemi che conosci o ti interessano</span>
              <div class="row g-8 wrap">
                ${D.SYSTEMS.map((s) => {
                  const on = scelti.some((g) => g.systemId === s.id);
                  return html`<button class="chip" aria-pressed="${on}" data-act="toggleSystem" data-sys="${s.id}">
                    ${on ? icon('check', 13) : ''}${s.nome}</button>`;
                })}
              </div>
            </div>
            ${scelti.length ? html`<div class="col g-10">
              <span class="label">Versione per ciascun sistema</span>
              ${scelti.map((g) => {
                const s = D.systemById(g.systemId);
                return html`<div class="card card-pad row-b g-12 wrap" style="padding:14px 16px">
                  <span class="h-sm">${s.nome}</span>
                  <div class="row g-8">
                    ${s.versioni.map((v) => html`<button class="chip" aria-pressed="${g.versione === v}" data-act="setVersione" data-sys="${s.id}" data-v="${v}">${v}</button>`)}
                    <button class="btn btn-icon btn-ghost" data-act="toggleSystem" data-sys="${s.id}" aria-label="Rimuovi">${icon('x', 16)}</button>
                  </div>
                </div>`;
              })}
            </div>` : html`<div class="callout">${icon('info', 18, 'ico')}<div>Scegli almeno un sistema: è il segnale più pesante del matching (26 punti su 100).</div></div>`}
          </div>`;
      }

      case 'zona': {
        const loc = d.loc;
        return html`
          <div class="col g-16">
            <button class="btn btn-block btn-lg" data-act="zonaGps">${icon('compass', 18)}Usa la mia posizione</button>
            <div class="row g-12"><hr class="grow"><span class="tiny muted">oppure</span><hr class="grow"></div>
            <div class="field">
              <label class="label" for="f-zona">Città, CAP o indirizzo</label>
              <input class="input input-search" id="f-zona" placeholder="Milano, 20121, Via…" data-input="zonaCerca" autocomplete="off">
              <div id="zona-sugg" class="card card-flat" style="overflow:hidden;margin-top:6px"></div>
            </div>
            ${loc ? html`<div class="card card-pad" style="border-color:var(--accent-soft-2);background:var(--accent-soft)">
              <div class="row-b g-12 wrap">
                <div class="row g-10"><span style="color:var(--accent)">${icon('pin', 20)}</span>
                  <div><p class="h-sm">${loc.label}${loc.zona ? ' · ' + loc.zona : ''}</p>
                    <p class="tiny" style="color:var(--accent-ink)">Gli altri vedranno solo questo, più la distanza arrotondata.</p></div>
                </div>
                <span class="badge badge-accent">Zona impostata</span>
              </div>
            </div>` : ''}
            <div class="callout">${icon('eyeOff', 18, 'ico')}<div>Le coordinate esatte non vengono mostrate a nessuno e non finiscono nei risultati di ricerca degli altri.</div></div>
          </div>`;
      }

      case 'quando':
        return html`
          <div class="col g-24">
            <div class="field">
              <span class="label">Giorni possibili</span>
              <div class="row g-8 wrap">${D.GIORNI.map((g) => chip('disponibilita.giorni', g.id, g.label))}</div>
            </div>
            <div class="field">
              <span class="label">Fasce orarie</span>
              <div class="row g-8 wrap">${D.FASCE.map((f) => chip('disponibilita.fasce', f.id, f.label))}</div>
            </div>
            <div class="field">
              <span class="label">Frequenza che regge la tua vita</span>
              <div class="row g-8 wrap">${D.FREQUENZE.map((f) => chip('disponibilita.frequenza', f.id, f.label, true))}</div>
            </div>
            <div class="field">
              <span class="label">Modalità</span>
              <div class="row g-8 wrap">${D.MODALITA.map((m) => chip('modalita', m.id, m.label, true))}</div>
            </div>
            <div class="field">
              <span class="label">Formati che ti interessano</span>
              <div class="row g-8 wrap">${D.FORMATI.map((f) => chip('formati', f.id, f.label))}</div>
            </div>
            <div class="field">
              <span class="label">Stile di gioco</span>
              <div class="row g-8 wrap">${D.STILI.map((s) => chip('stili', s, s))}</div>
              <span class="hint">Sono dati di matching, non un giudizio: nessuno li usa per valutarti.</span>
            </div>
          </div>`;
    }
    return '';
  }

  GD.actions.toggleSystem = (ds) => {
    const games = draft().games.slice();
    const i = games.findIndex((g) => g.systemId === ds.sys);
    if (i === -1) games.push({ systemId: ds.sys, versione: D.systemById(ds.sys).versioni[0], livello: 'giocato' });
    else games.splice(i, 1);
    setField('games', games);
    GD.app.render();
  };
  GD.actions.setVersione = (ds) => {
    const games = draft().games.map((g) => (g.systemId === ds.sys ? Object.assign({}, g, { versione: ds.v }) : g));
    setField('games', games);
    GD.app.render();
  };
  GD.actions.oauthDemo = () => UI.toast('Nel prototipo l\'accesso OAuth è simulato: continua con l\'email.');

  /* ---------------- entra in demo ---------------- */
  GD.actions.demoLogin = () => {
    const p = S.profiloVuoto();
    const milano = GD.geo.cityById('mi');
    Object.assign(p, {
      nome: 'Tu (demo)',
      email: 'demo@gdradar.it',
      bio: 'Profilo di prova: giocatore e Master occasionale, cerco un tavolo stabile in zona.',
      dataNascita: '1992-06-14',
      eta: 33,
      ageVerification: { status: 'verified', threshold: 18, provider: 'ID-Bridge EU (demo)', ref: 'pv_demo0001', verified_at: Date.now(), expires_at: null },
      ruoli: ['player', 'master'],
      esperienza: 'intermedio',
      modalita: 'entrambe',
      formati: ['breve', 'lunga'],
      newbie: 'si',
      stili: ['narrativo', 'investigativo', 'interpretazione'],
      games: [
        { systemId: 'dnd5', versione: '5e (2024)', livello: 'masterizzato' },
        { systemId: 'coc', versione: '7e', livello: 'giocato' },
        { systemId: 'bitd', versione: 'Core', livello: 'curioso' }
      ],
      disponibilita: { giorni: ['mar', 'gio', 'sab'], fasce: ['sera'], frequenza: 'quindicinale' },
      loc: GD.geo.place(milano, 'Navigli'),
      contatti: { telegram: '@demo', discord: 'demo#0001' },
      patto: true, tos: true,
      fairness: { n: 7, pos: 7, ultimo: Date.now() - 9 * 86400000 }
    });
    S.creaProfilo(p);
    UI.go('/radar');
    setTimeout(() => UI.toast('Demo attiva: sei a Milano, con richieste e chat già in corso.'), 350);
  };

  /* ---------------- vista ---------------- */
  function view() {
    const st = S.get();
    draft();
    const i = GD.util.clamp(st.onboarding.step, 0, STEPS.length - 1);
    const s = STEPS[i];
    const d = draft();
    return html`<div class="onb">
      <div class="onb-main">
        <div class="row-b">
          <a href="#/">${UI.logo()}</a>
          <span class="tiny muted">Passo ${i + 1} di ${STEPS.length}</span>
        </div>
        <div class="onb-body">
          <div class="stepper" style="max-width:420px">
            ${STEPS.map((x, k) => html`<span class="step ${raw(k < i ? 'done' : k === i ? 'now' : '')}"></span>`)}
          </div>
          <h1 class="display d-3 mt-24">${s.titolo}</h1>
          <p class="body mt-8" style="max-width:52ch">${s.nota}</p>
          <div class="mt-32">${renderStep(s.id)}</div>
        </div>
        <div class="onb-foot">
          <button class="btn btn-ghost" data-act="onbBack">${icon('arrowLeft', 16)}${i === 0 ? 'Esci' : 'Indietro'}</button>
          <button class="btn btn-primary btn-lg" data-act="onbNext">${i === STEPS.length - 1 ? 'Attiva il Radar' : 'Continua'}${icon('arrowRight', 16)}</button>
        </div>
      </div>

      <aside class="onb-aside">
        <span class="eyebrow">Anteprima del profilo</span>
        <div class="card card-pad">
          <div class="row g-12">
            ${U.avatar(d.nome || 'Nuovo profilo', 'lg', 'me')}
            <div class="grow" style="min-width:0">
              <p class="h-md truncate">${d.nome || 'Il tuo nickname'}</p>
              <p class="small muted">${d.ruoli.length ? d.ruoli.map((r) => (D.RUOLI.find((x) => x.id === r) || {}).label).join(' e ') : 'Ruolo da scegliere'}
                · ${D.espById(d.esperienza).label}</p>
            </div>
          </div>
          ${d.bio ? html`<p class="small mt-12">${d.bio}</p>` : ''}
          <div class="row g-8 wrap mt-16">
            ${d.ageVerification.status === 'verified' ? html`<span class="badge badge-accent">${icon('checkCircle', 11)}18+ verificato</span>` : html`<span class="badge">${icon('lock', 11)}Non verificato</span>`}
            ${d.loc ? html`<span class="badge">${icon('pin', 11)}${d.loc.label}</span>` : ''}
            ${d.newbie === 'si' ? html`<span class="badge badge-accent">${icon('sparkles', 11)}Newbie friendly</span>` : ''}
          </div>
          ${d.games.length ? html`<div class="row g-8 wrap mt-8">
            ${d.games.map((g) => html`<span class="badge badge-line">${D.systemById(g.systemId).nome}</span>`)}
          </div>` : ''}
          ${d.disponibilita.giorni.length ? html`<div class="row g-8 wrap mt-8">
            <span class="badge">${icon('calendar', 11)}${d.disponibilita.giorni.map((g) => (D.GIORNI.find((x) => x.id === g) || {}).label).join(' ')}</span>
          </div>` : ''}
          <div class="mt-16" style="padding-top:14px;border-top:1px solid var(--line-2)">
            ${UI.fairPips({ fairness: { n: 0 } })}
          </div>
        </div>
        <div class="callout accent">${icon('eyeOff', 18, 'ico')}
          <div>Finché non completi l'onboarding non compari nelle ricerche di nessuno.</div>
        </div>
      </aside>
    </div>`;
  }

  GD.views = GD.views || {};
  GD.views.onboarding = view;
})(window.GD);
