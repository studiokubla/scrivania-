/* ============================================================
   GdRadar — Profilo, visibilità, verifica 18+ e Sicurezza
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  /* ---------------- azioni sul profilo ---------------- */
  GD.actions.meSet = (ds, el) => {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    S.set((s) => {
      const parts = ds.field.split('.');
      let n = s.me;
      for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]];
      n[parts[parts.length - 1]] = v;
    }, { render: !!ds.rerender });
  };
  GD.actions.mePick = (ds) => {
    S.set((s) => {
      const parts = ds.field.split('.');
      let n = s.me;
      for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]];
      n[parts[parts.length - 1]] = ds.value;
    });
    if (ds.field === 'visibilita') {
      const v = D.VISIBILITA.find((x) => x.id === ds.value);
      UI.toast(v.label + ' · ' + v.hint);
    }
  };
  GD.actions.meToggle = (ds) => {
    S.set((s) => {
      const parts = ds.field.split('.');
      let n = s.me;
      for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]];
      const key = parts[parts.length - 1];
      const arr = (n[key] || []).slice();
      const i = arr.indexOf(ds.value);
      if (i === -1) arr.push(ds.value); else arr.splice(i, 1);
      n[key] = arr;
    });
  };
  GD.actions.meSistema = (ds) => {
    S.set((s) => {
      const games = s.me.games.slice();
      const i = games.findIndex((g) => g.systemId === ds.value);
      if (i === -1) games.push({ systemId: ds.value, versione: D.systemById(ds.value).versioni[0], livello: 'giocato' });
      else games.splice(i, 1);
      s.me.games = games;
    });
  };
  GD.actions.meContatto = (ds, el) => {
    S.set((s) => {
      if (el.value.trim()) s.me.contatti[ds.canale] = el.value.trim();
      else delete s.me.contatti[ds.canale];
    }, { render: false });
  };
  GD.actions.esci = () => {
    UI.openModal({
      title: 'Uscire e azzerare il prototipo?',
      sub: 'Profilo, chat, annunci e casi di moderazione creati qui verranno cancellati da questo browser.',
      body: html`<div class="callout">${icon('info', 18, 'ico')}<div>Nel prodotto reale l\'uscita non cancella nulla: qui non esiste un server dove conservare i dati.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-danger" data-act="confermaEsci">Esci e azzera</button>`
    });
  };
  GD.actions.confermaEsci = () => { S.reset(); UI.closeOverlays(); UI.go('/'); };

  function chip(field, value, label, arr) {
    const me = S.get().me;
    const cur = field.split('.').reduce((n, k) => n[k], me);
    const on = arr ? cur.indexOf(value) !== -1 : cur === value;
    return html`<button class="chip" aria-pressed="${on}" data-act="${arr ? 'meToggle' : 'mePick'}" data-field="${field}" data-value="${value}">${label}</button>`;
  }

  /* ---------------- profilo ---------------- */
  function view(sezione) {
    const me = S.get().me;
    const av = me.ageVerification;
    const verificato = av.status === 'verified';
    const fair = GD.match.fairness(me);

    const contenuto = html`
      ${UI.pageHead('Profilo', 'Quello che scrivi qui è materiale di matching, non un curriculum: nessuno lo valuta.')}

      <div class="two-col">
        <div class="col g-20">
          <section class="card card-pad">
            <div class="row g-16 wrap">
              ${U.avatar(me.nome, 'xl', 'me')}
              <div class="grow" style="min-width:220px">
                <div class="field">
                  <label class="label" for="p-nome">Nickname</label>
                  <input class="input" id="p-nome" value="${me.nome}" data-change="meSet" data-field="nome">
                </div>
                <div class="row g-8 wrap mt-12">
                  ${verificato ? html`<span class="badge badge-accent">${icon('checkCircle', 11)}18+ verificato</span>` : html`<span class="badge badge-amber">${icon('lock', 11)}Non verificato</span>`}
                  ${me.loc ? html`<span class="badge">${icon('pin', 11)}${me.loc.label}</span>` : ''}
                  ${UI.newbieBadge(me.newbie)}
                  <span class="badge badge-line">${U.plural(me.games.length, 'sistema', 'sistemi')}</span>
                </div>
              </div>
            </div>
            <div class="field mt-20">
              <label class="label" for="p-bio">Bio</label>
              <textarea class="textarea" id="p-bio" maxlength="240" data-change="meSet" data-field="bio">${me.bio}</textarea>
            </div>
          </section>

          <section class="card card-pad" id="verifica">
            <span class="eyebrow">Verifica dell'età</span>
            <div class="row-b g-16 wrap mt-12">
              <div class="row g-12">
                <span style="color:${raw(verificato ? 'var(--accent)' : 'var(--amber)')}">${icon(verificato ? 'checkCircle' : 'lock', 24)}</span>
                <div>
                  <p class="h-md">${verificato ? 'Maggiore età verificata' : 'Verifica non completata'}</p>
                  <p class="small muted">${verificato
                    ? av.provider + ' · rif. ' + av.ref + ' · ' + U.dateLabel(av.verified_at)
                    : 'Senza verifica non puoi contattare nessuno né pubblicare annunci.'}</p>
                </div>
              </div>
              ${verificato ? html`<span class="badge badge-accent badge-lg">status: verified · threshold 18</span>`
                : html`<button class="btn btn-primary" data-act="avviaVerifica">Verifica ora</button>`}
            </div>
            <div class="callout mt-16">${icon('shield', 18, 'ico')}
              <div>Nel database restano solo <b>status</b>, <b>threshold</b>, <b>provider</b>, un <b>reference</b> non reversibile e le date.
                Nessuna foto, nessun numero di documento, nessun selfie.</div></div>
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Ruoli ed esperienza</span>
            <div class="col g-16 mt-12">
              <div class="field"><span class="label">Ruoli</span>
                <div class="row g-8 wrap">${D.RUOLI.map((r) => chip('ruoli', r.id, r.label, true))}</div></div>
              <div class="field"><span class="label">Esperienza</span>
                <div class="row g-8 wrap">${D.ESPERIENZA.map((e) => chip('esperienza', e.id, e.label))}</div></div>
              <div class="field"><span class="label">Disponibilità verso chi gioca per la prima volta</span>
                <div class="row g-8 wrap">${D.NEWBIE.map((n) => chip('newbie', n.id, n.label))}</div></div>
            </div>
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Giochi</span>
            <div class="row g-6 wrap mt-12">
              ${D.SYSTEMS.map((s) => html`<button class="chip" aria-pressed="${me.games.some((g) => g.systemId === s.id)}"
                data-act="meSistema" data-value="${s.id}">${s.nome}</button>`)}
            </div>
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Disponibilità</span>
            <div class="col g-16 mt-12">
              <div class="field"><span class="label">Giorni</span>
                <div class="row g-6 wrap">${D.GIORNI.map((g) => chip('disponibilita.giorni', g.id, g.label, true))}</div></div>
              <div class="field"><span class="label">Fasce</span>
                <div class="row g-8 wrap">${D.FASCE.map((f) => chip('disponibilita.fasce', f.id, f.label, true))}</div></div>
              <div class="field"><span class="label">Frequenza</span>
                <div class="row g-8 wrap">${D.FREQUENZE.map((f) => chip('disponibilita.frequenza', f.id, f.label))}</div></div>
              <div class="field"><span class="label">Modalità</span>
                <div class="row g-8 wrap">${D.MODALITA.map((m) => chip('modalita', m.id, m.label))}</div></div>
              <div class="field"><span class="label">Formati</span>
                <div class="row g-8 wrap">${D.FORMATI.map((f) => chip('formati', f.id, f.label, true))}</div></div>
            </div>
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Contatti esterni</span>
            <p class="small muted mt-8">Restano invisibili finché non li condividi tu, con doppio consenso, dentro una conversazione.</p>
            <div class="col g-10 mt-16">
              ${D.CANALI_CONTATTO.map((c) => html`<div class="row g-10">
                <span class="small" style="width:88px;color:var(--ink-3)">${c.label}</span>
                <input class="input grow" value="${me.contatti[c.id] || ''}" placeholder="—" data-change="meContatto" data-canale="${c.id}">
              </div>`)}
            </div>
          </section>
        </div>

        <aside class="col g-16">
          <div class="card card-pad">
            <span class="eyebrow">Visibilità sul Radar</span>
            <div class="col g-8 mt-12">
              ${D.VISIBILITA.map((v) => html`<button class="card card-flat card-pad row g-10" style="padding:12px 14px;text-align:left;cursor:pointer;border-color:${raw(me.visibilita === v.id ? 'var(--accent)' : 'var(--line)')};background:${raw(me.visibilita === v.id ? 'var(--accent-soft)' : 'var(--surface)')}"
                data-act="mePick" data-field="visibilita" data-value="${v.id}">
                <span class="dot ${raw(v.id === 'attivo' ? 'dot-live' : v.id === 'pausa' ? 'dot-amber' : 'dot-off')}" style="margin-top:6px"></span>
                <span class="grow"><b class="h-sm">${v.label}</b><br><span class="tiny muted">${v.hint}</span></span>
              </button>`)}
            </div>
          </div>

          <div class="card card-pad">
            <span class="eyebrow">Zona</span>
            <p class="h-md mt-12">${me.loc ? me.loc.label + (me.loc.zona ? ' · ' + me.loc.zona : '') : 'Non impostata'}</p>
            <p class="tiny muted mt-4">Gli altri vedono solo zona e distanza arrotondata.</p>
            <button class="btn btn-sm mt-12" data-act="zonaGps">${icon('compass', 14)}Aggiorna con il GPS</button>
            <div class="field mt-12">
              <input class="input input-search" placeholder="Cerca città o CAP" data-input="zonaCerca" autocomplete="off">
              <div id="zona-sugg" class="card card-flat" style="overflow:hidden;margin-top:6px"></div>
            </div>
          </div>

          <div class="card card-pad">
            <span class="eyebrow">La tua Fairness</span>
            <div class="mt-12">${UI.fairPips(me, { conta: true })}</div>
            <p class="small muted mt-8">${fair.visibile ? fair.nota : 'Servono ' + GD.match.SOGLIA_FEEDBACK + ' feedback qualificati: ne hai ' + me.fairness.n + '.'}</p>
            <a class="btn btn-sm mt-12" href="#/fairness">Come funziona</a>
          </div>

          <div class="card card-pad">
            <span class="eyebrow">Account</span>
            <dl class="deflist mt-12">
              <dt>Email</dt><dd>${me.email || '—'}</dd>
              <dt>Iscritto</dt><dd>${U.dateLabel(me.creato)}</dd>
              <dt>Patto</dt><dd>${me.patto ? 'accettato' : 'da accettare'}</dd>
            </dl>
            <button class="btn btn-sm btn-danger mt-16" data-act="esci">${icon('logout', 14)}Esci e azzera il prototipo</button>
          </div>
        </aside>
      </div>`;

    const out = UI.shell('/profilo', contenuto, { title: 'Profilo' });
    if (sezione === 'verifica') setTimeout(() => {
      const el = U.$('#verifica');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return out;
  }

  /* ---------------- sicurezza ---------------- */
  function sicurezza() {
    const st = S.get();
    const contenuto = html`
      ${UI.pageHead('Sicurezza', 'Blocchi, segnalazioni e controllo di quello che gli altri possono vedere di te.')}

      <div class="two-col">
        <div class="col g-20">
          <section class="card card-pad">
            <div class="row-b">
              <span class="eyebrow">Profili bloccati · ${st.blocks.length}</span>
            </div>
            ${st.blocks.length ? html`<ul class="col g-8 mt-12">
              ${st.blocks.map((b) => html`<li class="row-b g-12 card card-flat card-quiet card-pad" style="padding:12px 14px">
                <div class="row g-10">${U.avatar(b.nome, 'sm', b.id2)}
                  <div><p class="h-sm">${b.nome}</p><p class="tiny muted">bloccato ${U.timeAgo(b.quando)}</p></div></div>
                <button class="btn btn-sm" data-act="sbloccaOra" data-kind="${b.kind}" data-id="${b.id2}">Sblocca</button>
              </li>`)}
            </ul>` : html`<p class="small muted mt-12">Nessun blocco attivo. Puoi bloccare chiunque dalla sua scheda o dalla chat: è immediato e non viene notificato.</p>`}
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Segnalazioni inviate · ${st.reports.length}</span>
            ${st.reports.length ? html`<ul class="col g-8 mt-12">
              ${st.reports.map((r) => html`<li class="card card-flat card-quiet card-pad" style="padding:12px 14px">
                <div class="row-b g-12 wrap">
                  <div>
                    <p class="h-sm">${r.nome}</p>
                    <p class="tiny muted">${(D.MOTIVI_REPORT.find((m) => m.id === r.motivo) || {}).label} · ${U.timeAgo(r.quando)}</p>
                  </div>
                  <span class="badge badge-line">${r.id}</span>
                </div>
                ${r.dettagli ? html`<p class="small mt-8" style="color:var(--ink-2)">${r.dettagli}</p>` : ''}
              </li>`)}
            </ul>` : html`<p class="small muted mt-12">Nessuna segnalazione. Quando ne invii una, resti anonimo verso la persona segnalata e ricevi il codice del caso.</p>`}
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Incontrarsi dal vivo</span>
            <ul class="col g-10 mt-12">
              ${['Le prime volte in luogo pubblico: circolo, ludoteca, biblioteca, bar.',
                 'Di\' a qualcuno dove vai e con chi, anche solo un messaggio.',
                 'Nessuno può obbligarti a condividere numero, indirizzo o social.',
                 'Se qualcosa non ti convince, puoi andartene senza spiegazioni.',
                 'Dopo l\'incontro, il feedback aiuta chi verrà dopo di te.'
                ].map((t) => html`<li class="row g-10"><span style="color:var(--accent);margin-top:2px">${icon('check', 15)}</span><span class="small">${t}</span></li>`)}
            </ul>
          </section>
        </div>

        <aside class="col g-16">
          <div class="card card-pad">
            <span class="eyebrow">Cosa vedono gli altri</span>
            <ul class="col g-10 mt-12">
              ${[['Nickname e bio', true], ['Zona pubblica e distanza arrotondata', true], ['Sistemi, giorni e preferenze', true],
                 ['Fairness (da 5 feedback)', true], ['Coordinate esatte', false], ['Email e contatti esterni', false],
                 ['Chi hai bloccato o segnalato', false], ['Chi ti ha lasciato un feedback', false]
                ].map((r) => html`<li class="row-b g-8">
                  <span class="small">${r[0]}</span>
                  <span class="badge ${raw(r[1] ? 'badge-accent' : '')}">${r[1] ? 'visibile' : 'privato'}</span></li>`)}
            </ul>
          </div>
          <div class="callout">${icon('gavel', 18, 'ico')}
            <div>Nessun algoritmo decide un ban da solo: le segnalazioni aprono un caso, la decisione è umana e ricorribile.
              <a href="#/moderazione" style="color:var(--accent);font-weight:500"> Vedi il backoffice</a></div></div>
          <div class="callout accent">${icon('warn', 18, 'ico')}
            <div>In caso di pericolo immediato contatta le autorità: GdRadar non è un servizio di emergenza.</div></div>
        </aside>
      </div>`;
    return UI.shell('/sicurezza', contenuto, { title: 'Sicurezza' });
  }

  GD.views = GD.views || {};
  GD.views.profilo = view;
  GD.views.sicurezza = sicurezza;
})(window.GD);
