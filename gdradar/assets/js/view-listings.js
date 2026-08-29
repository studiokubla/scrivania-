/* ============================================================
   GdRadar — Annunci
   Un annuncio può essere pubblicato da un utente, da un Party o
   da una Campagna. Stati: bozza / attivo / sospeso / chiuso.
   Un annuncio chiuso resta come storico ma esce dal Radar.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  const STATI = {
    bozza: { label: 'Bozza', badge: 'badge-line' },
    attivo: { label: 'Attivo', badge: 'badge-accent' },
    sospeso: { label: 'Sospeso', badge: 'badge-amber' },
    chiuso: { label: 'Chiuso', badge: '' }
  };

  function nuovoAnnuncio() {
    const me = S.get().me;
    return {
      id: U.uid('ann'),
      tipo: 'annuncio',
      sottotipo: 'cerco_player',
      autore: { kind: 'utente', id: 'me' },
      titolo: '',
      testo: '',
      systemId: (me.games[0] || { systemId: 'dnd5' }).systemId,
      versione: (me.games[0] || {}).versione || D.systemById('dnd5').versioni[0],
      modalita: me.modalita,
      formato: me.formati[0] || 'breve',
      loc: me.loc,
      disponibilita: JSON.parse(JSON.stringify(me.disponibilita)),
      posti: 2,
      esperienza: 'tutte',
      newbie: me.newbie,
      stili: me.stili.slice(0, 3),
      stato: 'bozza',
      pubblicato: Date.now(),
      fairnessRef: me.fairness
    };
  }

  /* bozza in editing: resta fuori dallo store finché non si salva */
  let editing = null;

  GD.actions.nuovoAnnuncio = () => {
    if (!UI.requireVerified('pubblicare un annuncio')) return;
    editing = nuovoAnnuncio();
    apriEditor();
  };
  GD.actions.modificaAnnuncio = (ds) => {
    const l = S.mieiAnnunci().find((x) => x.id === ds.id);
    if (!l) return;
    editing = JSON.parse(JSON.stringify(l));
    apriEditor();
  };
  GD.actions.annSet = (ds, el) => {
    const v = el.type === 'checkbox' ? el.checked : el.value;
    editing[ds.field] = ds.field === 'posti' ? Number(v) : v;
    if (ds.field === 'systemId') editing.versione = D.systemById(v).versioni[0];
    if (ds.rerender) apriEditor();
  };
  GD.actions.annPick = (ds) => { salvaTesti(); editing[ds.field] = ds.value; apriEditor(); };
  GD.actions.annGiorno = (ds) => {
    salvaTesti();
    const arr = editing.disponibilita.giorni.slice();
    const i = arr.indexOf(ds.value);
    if (i === -1) arr.push(ds.value); else arr.splice(i, 1);
    editing.disponibilita.giorni = arr;
    apriEditor();
  };

  /* i campi di testo vivono nel DOM: li recuperiamo prima di ridisegnare */
  function salvaTesti() {
    const t = U.$('#ann-titolo'), d = U.$('#ann-testo');
    if (t) editing.titolo = t.value;
    if (d) editing.testo = d.value;
  }

  GD.actions.salvaAnnuncio = (ds) => {
    salvaTesti();
    if ((editing.titolo || '').trim().length < 6) { UI.toast('Dai un titolo leggibile all\'annuncio.', 'warn'); return; }
    editing.titolo = editing.titolo.trim();
    editing.testo = (editing.testo || '').trim();
    editing.stato = ds.stato;
    editing.pubblicato = Date.now();
    S.salvaAnnuncio(JSON.parse(JSON.stringify(editing)));
    UI.closeOverlays();
    UI.toast(ds.stato === 'attivo' ? 'Annuncio pubblicato: ora è indicizzato dal Radar.' : 'Bozza salvata.');
  };
  GD.actions.statoAnnuncio = (ds) => {
    S.cambiaStatoAnnuncio(ds.id, ds.stato);
    UI.toast(ds.stato === 'chiuso'
      ? 'Annuncio chiuso: resta nello storico per audit, ma non è più ricercabile.'
      : 'Stato aggiornato: ' + STATI[ds.stato].label.toLowerCase() + '.');
  };

  function chipRow(field, opts, value) {
    return html`<div class="row g-8 wrap">${opts.map((o) => html`<button class="chip"
      aria-pressed="${value === o.id}" data-act="annPick" data-field="${field}" data-value="${o.id}">${o.label}</button>`)}</div>`;
  }

  function apriEditor() {
    const a = editing;
    const sys = D.systemById(a.systemId);
    UI.openDrawer({
      title: a.stato === 'bozza' && !a.titolo ? 'Nuovo annuncio' : 'Modifica annuncio',
      body: html`
        <div class="col g-24">
          <div class="field">
            <span class="label">Tipo di annuncio</span>
            ${chipRow('sottotipo', Object.keys(UI.TIPO_ANNUNCIO).map((k) => ({ id: k, label: UI.TIPO_ANNUNCIO[k] })), a.sottotipo)}
          </div>
          <div class="field">
            <label class="label" for="ann-titolo">Titolo</label>
            <input class="input" id="ann-titolo" maxlength="80" value="${a.titolo}" placeholder="Es. Cerchiamo 2 giocatori per una campagna investigativa">
          </div>
          <div class="field">
            <label class="label" for="ann-testo">Descrizione</label>
            <textarea class="textarea" id="ann-testo" maxlength="600" placeholder="Che tavolo è, che toni, cosa vi aspettate da chi arriva.">${a.testo}</textarea>
          </div>
          <div class="row g-12 wrap">
            <div class="field grow">
              <label class="label" for="ann-sys">Sistema</label>
              <select class="select" id="ann-sys" data-change="annSet" data-field="systemId" data-rerender="1">
                ${D.SYSTEMS.map((s) => html`<option value="${s.id}" ${raw(s.id === a.systemId ? 'selected' : '')}>${s.nome}</option>`)}
              </select>
            </div>
            <div class="field grow">
              <label class="label" for="ann-ver">Versione</label>
              <select class="select" id="ann-ver" data-change="annSet" data-field="versione">
                ${sys.versioni.map((v) => html`<option value="${v}" ${raw(v === a.versione ? 'selected' : '')}>${v}</option>`)}
              </select>
            </div>
          </div>
          <div class="field">
            <span class="label">Modalità</span>
            ${chipRow('modalita', D.MODALITA, a.modalita)}
          </div>
          <div class="field">
            <span class="label">Formato</span>
            ${chipRow('formato', D.FORMATI, a.formato)}
          </div>
          <div class="field">
            <span class="label">Giorni proposti</span>
            <div class="row g-6 wrap">${D.GIORNI.map((g) => html`<button class="chip" style="padding:0 10px"
              aria-pressed="${a.disponibilita.giorni.indexOf(g.id) !== -1}" data-act="annGiorno" data-value="${g.id}">${g.label}</button>`)}</div>
          </div>
          <div class="row g-12 wrap">
            <div class="field" style="max-width:130px">
              <label class="label" for="ann-posti">Posti</label>
              <input class="input" id="ann-posti" type="number" min="1" max="8" value="${a.posti}" data-change="annSet" data-field="posti">
            </div>
            <div class="field grow">
              <label class="label" for="ann-esp">Esperienza richiesta</label>
              <select class="select" id="ann-esp" data-change="annSet" data-field="esperienza">
                <option value="tutte" ${raw(a.esperienza === 'tutte' ? 'selected' : '')}>Qualsiasi livello</option>
                ${D.ESPERIENZA.map((e) => html`<option value="${e.id}" ${raw(a.esperienza === e.id ? 'selected' : '')}>${e.label}</option>`)}
              </select>
            </div>
          </div>
          <div class="field">
            <span class="label">Adatto alla prima esperienza</span>
            ${chipRow('newbie', D.NEWBIE, a.newbie)}
            <span class="hint">Qui pesa più del Newbie Friendly del profilo: vale per questo tavolo specifico.</span>
          </div>
          <div class="callout">${icon('pin', 18, 'ico')}
            <div>Zona pubblica: <b>${a.loc ? a.loc.label + (a.loc.zona ? ' · ' + a.loc.zona : '') : '—'}</b>. Chi legge vedrà solo questo e la distanza arrotondata.</div>
          </div>
        </div>`,
      foot: html`<div class="row g-10">
        <button class="btn grow" data-act="salvaAnnuncio" data-stato="bozza">Salva bozza</button>
        <button class="btn btn-primary grow" data-act="salvaAnnuncio" data-stato="attivo">Pubblica</button>
      </div>`
    });
  }

  /* ---------------- vista ---------------- */
  function card(l) {
    const st = STATI[l.stato] || STATI.bozza;
    const sys = D.systemById(l.systemId);
    return html`<article class="card card-pad">
      <div class="row-b wrap g-12" style="align-items:flex-start">
        <div class="grow" style="min-width:0">
          <div class="row g-8 wrap">
            <span class="badge ${raw(st.badge)}">${st.label}</span>
            <span class="badge badge-line">${UI.TIPO_ANNUNCIO[l.sottotipo]}</span>
            ${UI.newbieBadge(l.newbie)}
          </div>
          <h3 class="h-md mt-8">${l.titolo || 'Senza titolo'}</h3>
          <p class="small muted mt-4">${sys.nome} · ${l.versione} · ${U.plural(l.posti, 'posto', 'posti')} · ${U.timeAgo(l.pubblicato)}</p>
          ${l.testo ? html`<p class="small mt-8" style="color:var(--ink-2)">${l.testo}</p>` : ''}
        </div>
        <div class="row g-8 wrap">
          <button class="btn btn-sm" data-act="modificaAnnuncio" data-id="${l.id}">${icon('edit', 14)}Modifica</button>
          ${l.stato === 'attivo' ? html`<button class="btn btn-sm" data-act="statoAnnuncio" data-id="${l.id}" data-stato="sospeso">Sospendi</button>` : ''}
          ${l.stato === 'sospeso' || l.stato === 'bozza' ? html`<button class="btn btn-sm btn-soft" data-act="statoAnnuncio" data-id="${l.id}" data-stato="attivo">Pubblica</button>` : ''}
          ${l.stato !== 'chiuso' ? html`<button class="btn btn-sm btn-danger" data-act="statoAnnuncio" data-id="${l.id}" data-stato="chiuso">Chiudi</button>` : ''}
        </div>
      </div>
    </article>`;
  }

  function view() {
    const mine = S.mieiAnnunci();
    const attivi = mine.filter((l) => l.stato === 'attivo');
    const altri = mine.filter((l) => l.stato !== 'attivo');

    const contenuto = html`
      ${UI.pageHead('Annunci', 'L\'annuncio è l\'oggetto che il Radar indicizza davvero: uno per ogni domanda o offerta attiva.',
        html`<button class="btn btn-primary" data-act="nuovoAnnuncio">${icon('plus', 16)}Nuovo annuncio</button>`)}

      ${!mine.length ? html`<div class="card">${UI.emptyState('document', 'Nessun annuncio pubblicato',
          'Pubblica cosa cerchi — un Player, un Master, un Party o una campagna — e lascia che ti trovino.',
          html`<button class="btn btn-primary mt-8" data-act="nuovoAnnuncio">${icon('plus', 16)}Crea il primo annuncio</button>`)}</div>` : ''}

      ${attivi.length ? html`<section class="col g-10">
        <span class="eyebrow">Attivi sul Radar · ${attivi.length}</span>
        ${attivi.map(card)}
      </section>` : ''}

      ${altri.length ? html`<section class="col g-10 mt-32">
        <span class="eyebrow">Bozze, sospesi e storico · ${altri.length}</span>
        ${altri.map(card)}
      </section>` : ''}

      <div class="callout mt-32">${icon('info', 18, 'ico')}
        <div>Un annuncio chiuso non viene cancellato: resta nello storico per audit e moderazione, ma smette di essere ricercabile.</div></div>`;

    return UI.shell('/annunci', contenuto, { title: 'Annunci', narrow: true });
  }

  GD.views = GD.views || {};
  GD.views.annunci = view;
})(window.GD);
