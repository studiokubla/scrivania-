/* ============================================================
   GdRadar — Moderation Core (obbligatorio in V1)
   REPORT / BLOCK / FAIRNESS EVENT / SYSTEM FLAG → CASE →
   TRIAGE → EVIDENZE → REVISIONE → AZIONE → RICORSO → AUDIT
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  const STATI = {
    new: 'Nuovo', under_review: 'In revisione', action_required: 'Azione richiesta',
    waiting: 'In attesa', resolved: 'Risolto', dismissed: 'Archiviato', appealed: 'In ricorso'
  };
  const CATEGORIE = {
    comportamento: 'Comportamento', affidabilita: 'Affidabilità',
    sicurezza: 'Sicurezza', abuso_piattaforma: 'Abuso della piattaforma'
  };
  const SEVERITY = ['S0 informativo', 'S1 basso', 'S2 medio', 'S3 grave', 'S4 critico'];

  const RUOLI_BO = [
    { id: 'support', label: 'Support', puo: [] },
    { id: 'moderator', label: 'Moderator', puo: ['no_action', 'warning', 'content_removal', 'feature_restriction', 'safety_lock'] },
    { id: 'senior', label: 'Senior Moderator', puo: ['no_action', 'warning', 'content_removal', 'feature_restriction', 'safety_lock', 'temp_suspension', 'permanent_ban'] },
    { id: 'admin', label: 'Admin', puo: ['no_action', 'warning', 'content_removal', 'feature_restriction', 'safety_lock', 'temp_suspension', 'permanent_ban'] }
  ];
  const AZIONI = [
    { id: 'no_action', label: 'Nessuna azione', hint: 'Il caso viene archiviato senza provvedimenti.' },
    { id: 'warning', label: 'Warning', hint: 'Richiamo formale con riferimento al Patto di Community.' },
    { id: 'content_removal', label: 'Rimozione contenuto', hint: 'Annuncio o messaggio rimosso, account intatto.' },
    { id: 'feature_restriction', label: 'Restrizione funzionalità', hint: 'Limita annunci, richieste o chat per un periodo.' },
    { id: 'safety_lock', label: 'Safety Lock', hint: 'Invisibile sul Radar, niente nuove richieste, annunci o scambi. Resta l\'accesso a ricorso e comunicazioni.' },
    { id: 'temp_suspension', label: 'Sospensione temporanea', hint: 'Account sospeso per un periodo definito.' },
    { id: 'permanent_ban', label: 'Ban permanente', hint: 'Solo Senior Moderator o Admin, con evidenze consolidate.' }
  ];

  let selectedId = null;
  let filtro = 'aperti';

  GD.actions.modSelect = (ds) => { selectedId = ds.id; GD.app.render(); };
  GD.actions.modFiltro = (ds) => { filtro = ds.value; GD.app.render(); };
  GD.actions.modRuolo = (ds) => { S.set((s) => { s.modRole = ds.value; }); };
  GD.actions.modPrendi = (ds) => {
    S.aggiornaCase(ds.id, { stato: 'under_review', assegnatoA: S.get().modRole }, 'Case preso in carico');
    UI.toast('Case assegnato a te.');
  };
  GD.actions.modAttesa = (ds) => {
    S.aggiornaCase(ds.id, { stato: 'waiting' }, 'Case messo in attesa di ulteriori elementi');
    UI.toast('Case in attesa.');
  };
  GD.actions.modSeverity = (ds) => {
    S.aggiornaCase(ds.id, { severity: Number(ds.value) }, 'Severity aggiornata a S' + ds.value);
  };
  GD.actions.modEvidenza = (ds) => {
    S.aggiornaCase(ds.id, {}, 'Accesso a evidenza ' + ds.ref + ' registrato');
    UI.openModal({
      title: 'Evidenza ' + ds.ref,
      sub: 'L\'accesso è vincolato a questo caso ed è appena stato scritto nell\'audit log.',
      body: html`<div class="callout">${icon('lock', 18, 'ico')}
          <div>Un moderatore non può sfogliare liberamente le conversazioni: vede solo ciò che è collegato al caso, e ogni lettura lascia traccia.</div></div>
        <div class="card card-pad card-quiet mt-16">
          <p class="tiny muted">Estratto conversazione · ${ds.ref}</p>
          <div class="col g-8 mt-12">
            <div class="bubble them" style="max-width:100%">Ci vediamo sabato? Ti mando l'indirizzo.</div>
            <div class="bubble them" style="max-width:100%">[contenuto oggetto della segnalazione]</div>
          </div>
        </div>`,
      foot: html`<button class="btn btn-primary" data-act="closeOverlays">Chiudi</button>`
    });
  };
  GD.actions.modAzione = (ds) => {
    const a = AZIONI.find((x) => x.id === ds.tipo);
    UI.openModal({
      title: a.label,
      sub: a.hint,
      body: html`<div class="field">
          <label class="label" for="mod-nota">Motivazione (finisce nell'audit e nel ricorso)</label>
          <textarea class="textarea" id="mod-nota" placeholder="Elementi considerati e ragione della proporzione scelta."></textarea>
        </div>
        ${ds.tipo === 'permanent_ban' ? html`<div class="callout danger mt-16">${icon('warn', 18, 'ico')}
          <div>Azione irreversibile per l'utente, ma ricorribile. Richiede evidenze consolidate, non il solo numero di segnalazioni.</div></div>` : ''}`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn ${raw(ds.tipo === 'permanent_ban' ? 'btn-danger' : 'btn-primary')}" data-act="modConferma" data-id="${ds.id}" data-tipo="${ds.tipo}">Applica</button>`
    });
  };
  GD.actions.modConferma = (ds) => {
    const nota = (U.$('#mod-nota') || {}).value || '';
    S.applicaAzione(ds.id, ds.tipo, nota.trim());
    UI.closeOverlays();
    UI.toast('Azione registrata con motivazione e audit.');
  };
  GD.actions.modRicorso = (ds) => {
    S.aggiornaCase(ds.id, { stato: 'appealed' }, 'Ricorso aperto: passa a Senior Moderator');
    UI.toast('Ricorso aperto: la revisione spetta a un Senior Moderator.');
  };

  /* ---------------- lista ---------------- */
  function lista(cases) {
    const aperti = ['new', 'under_review', 'action_required', 'waiting', 'appealed'];
    const filtrati = cases.filter((c) => {
      if (filtro === 'aperti') return aperti.indexOf(c.stato) !== -1;
      if (filtro === 'gravi') return c.severity >= 3;
      if (filtro === 'chiusi') return ['resolved', 'dismissed'].indexOf(c.stato) !== -1;
      return true;
    }).sort((a, b) => (b.severity - a.severity) || (b.apertoIl - a.apertoIl));

    /* il caso aperto nel pannello resta in lista anche se il filtro lo escluderebbe:
       dopo un'azione il fascicolo non deve sparire da sotto le mani di chi lavora */
    if (selectedId && !filtrati.some((c) => c.id === selectedId)) {
      const sel = cases.find((c) => c.id === selectedId);
      if (sel) filtrati.unshift(sel);
    }

    return html`<div class="card card-flat" style="overflow:hidden">
      <div class="row-b wrap g-12" style="padding:16px 18px;border-bottom:1px solid var(--line)">
        <div class="segmented on-white">
          ${[['aperti', 'Aperti'], ['gravi', 'S3–S4'], ['chiusi', 'Chiusi'], ['tutti', 'Tutti']].map((f) =>
            html`<button aria-pressed="${filtro === f[0]}" data-act="modFiltro" data-value="${f[0]}">${f[1]}</button>`)}
        </div>
        <span class="tiny muted">${U.plural(filtrati.length, 'caso', 'casi')}</span>
      </div>
      <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>Caso</th><th>Target</th><th>Categoria</th><th>Severity</th><th>Stato</th><th>Aperto</th></tr></thead>
          <tbody>
            ${filtrati.map((c) => html`<tr data-act="modSelect" data-id="${c.id}" class="${raw(selectedId === c.id ? 'is-active' : '')}">
              <td class="mod-table-id"><span class="h-sm">${c.id}</span><br><span class="tiny muted">${c.origine === 'system_flag' ? 'flag automatico' : 'segnalazione'}</span></td>
              <td><div class="row g-8">${U.avatar(c.target.nome, 'xs', c.target.id)}<span class="small truncate" style="max-width:130px">${c.target.nome}</span></div></td>
              <td><span class="small">${CATEGORIE[c.categoria]}</span></td>
              <td><span class="sev sev-${c.severity}"><i></i>S${c.severity}</span></td>
              <td><span class="badge ${raw(c.stato === 'new' ? 'badge-amber' : c.stato === 'resolved' || c.stato === 'dismissed' ? '' : 'badge-line')}">${STATI[c.stato]}</span></td>
              <td><span class="tiny muted">${U.timeAgo(c.apertoIl)}</span></td>
            </tr>`)}
          </tbody>
        </table>
        ${!filtrati.length ? UI.emptyState('gavel', 'Nessun caso in questa vista', 'Cambia filtro per vedere i casi chiusi o l\'intero storico.') : ''}
      </div>
    </div>`;
  }

  /* ---------------- dettaglio ---------------- */
  function dettaglio(c) {
    if (!c) {
      return html`<div class="card">${UI.emptyState('gavel', 'Seleziona un caso',
        'Ogni caso porta con sé target, evidenze, decisioni e audit: è il fascicolo, non una riga di log.')}</div>`;
    }
    const ruolo = RUOLI_BO.find((r) => r.id === S.get().modRole) || RUOLI_BO[1];
    const chiuso = ['resolved', 'dismissed'].indexOf(c.stato) !== -1;

    return html`<div class="col g-16">
      <section class="card card-pad">
        <div class="row-b wrap g-12">
          <div>
            <span class="eyebrow">${c.id}</span>
            <h2 class="h-lg mt-4">${c.target.nome}</h2>
            <p class="small muted">${c.target.kind === 'party' ? 'Party' : 'Utente'} · ${CATEGORIE[c.categoria]} · ${c.origine === 'system_flag' ? 'flag automatico' : 'segnalazione utente'}</p>
          </div>
          <span class="badge badge-lg ${raw(c.stato === 'new' ? 'badge-amber' : 'badge-line')}">${STATI[c.stato]}</span>
        </div>

        <p class="body mt-16">${c.sintesi}</p>

        <div class="row g-8 wrap mt-16">
          <span class="sev sev-${c.severity}"><i></i>${SEVERITY[c.severity]}</span>
          <span class="badge">${icon('clock', 11)}aperto ${U.timeAgo(c.apertoIl)}</span>
          <span class="badge">${icon('user', 11)}${c.assegnatoA || 'non assegnato'}</span>
        </div>

        <div class="row g-8 wrap mt-16">
          ${c.stato === 'new' ? html`<button class="btn btn-sm btn-primary" data-act="modPrendi" data-id="${c.id}">Prendi in carico</button>` : ''}
          ${!chiuso ? html`<button class="btn btn-sm" data-act="modAttesa" data-id="${c.id}">Metti in attesa</button>` : ''}
          ${c.azioni && c.azioni.length && c.stato !== 'appealed' ? html`<button class="btn btn-sm" data-act="modRicorso" data-id="${c.id}">Registra ricorso</button>` : ''}
        </div>

        ${!chiuso ? html`<div class="mt-20">
          <span class="eyebrow">Severity</span>
          <div class="row g-6 wrap mt-8">
            ${[0, 1, 2, 3, 4].map((s) => html`<button class="chip" aria-pressed="${c.severity === s}" data-act="modSeverity" data-id="${c.id}" data-value="${s}">S${s}</button>`)}
          </div>
        </div>` : ''}
      </section>

      <section class="card card-pad">
        <span class="eyebrow">Evidenze · ${c.evidenze.length}</span>
        <p class="tiny muted mt-4">L'accesso a contenuti privati è legato a questo caso e produce una riga di audit.</p>
        <div class="col g-8 mt-12">
          ${c.evidenze.map((e) => html`<div class="row-b g-12 card card-flat card-quiet card-pad" style="padding:12px 14px">
            <div class="grow" style="min-width:0">
              <p class="h-sm">${e.tipo} · ${e.ref}</p>
              <p class="tiny muted">${e.nota}</p>
            </div>
            <button class="btn btn-sm" data-act="modEvidenza" data-id="${c.id}" data-ref="${e.ref}">${icon('eye', 14)}Apri</button>
          </div>`)}
        </div>
      </section>

      <section class="card card-pad">
        <span class="eyebrow">Azioni proporzionate</span>
        ${ruolo.puo.length ? html`<div class="col g-8 mt-12">
          ${AZIONI.map((a) => {
            const abilitata = ruolo.puo.indexOf(a.id) !== -1 && !chiuso;
            return html`<button class="card card-flat card-pad row-b g-10" style="padding:12px 14px;text-align:left;cursor:${raw(abilitata ? 'pointer' : 'not-allowed')};opacity:${raw(abilitata ? '1' : '.45')}"
              ${raw(abilitata ? 'data-act="modAzione" data-id="' + c.id + '" data-tipo="' + a.id + '"' : 'disabled')}>
              <span class="grow"><b class="h-sm">${a.label}</b><br><span class="tiny muted">${a.hint}</span></span>
              ${abilitata ? icon('chevronRight', 16) : icon('lock', 14)}
            </button>`;
          })}
        </div>` : html`<div class="callout mt-12">${icon('lock', 18, 'ico')}
          <div>Con il ruolo <b>Support</b> vedi stato e metadati essenziali, ma non decidi sanzioni. Cambia ruolo in alto per simulare gli altri livelli.</div></div>`}
      </section>

      ${c.azioni && c.azioni.length ? html`<section class="card card-pad">
        <span class="eyebrow">Decisioni</span>
        <ul class="col g-10 mt-12">
          ${c.azioni.map((a) => html`<li class="card card-flat card-quiet card-pad" style="padding:12px 14px">
            <div class="row-b g-8"><b class="h-sm">${(AZIONI.find((x) => x.id === a.tipo) || {}).label || a.tipo}</b>
              <span class="tiny muted">${U.timeAgo(a.quando)} · ${a.da}</span></div>
            ${a.nota ? html`<p class="small muted mt-4">${a.nota}</p>` : ''}
          </li>`)}
        </ul>
      </section>` : ''}

      <section class="card card-pad">
        <span class="eyebrow">Audit log</span>
        <ul class="timeline mt-16">
          ${c.audit.map((a, i) => html`<li class="${raw(i === c.audit.length - 1 ? 'mark' : '')}">
            <p class="small">${a.cosa}</p>
            <p class="tiny muted">${a.chi} · ${U.dateLabel(a.quando)} ${U.clockTime(a.quando)}</p>
          </li>`)}
        </ul>
      </section>
    </div>`;
  }

  /* ---------------- vista ---------------- */
  function view() {
    const cases = S.getCases();
    if (!selectedId && cases.length) selectedId = cases[0].id;
    const sel = cases.find((c) => c.id === selectedId) || null;
    const ruolo = S.get().modRole;

    const contenuto = html`
      ${UI.pageHead('Moderazione', 'Backoffice dimostrativo: triage, evidenze vincolate al caso, azioni proporzionate, ricorsi e audit.',
        html`<div class="col g-6" style="align-items:flex-end">
          <span class="tiny muted">Ruolo di backoffice</span>
          <div class="segmented">
            ${RUOLI_BO.map((r) => html`<button aria-pressed="${ruolo === r.id}" data-act="modRuolo" data-value="${r.id}">${r.label}</button>`)}
          </div>
        </div>`)}

      <div class="card card-pad" style="margin-bottom:18px">
        <span class="eyebrow">Pipeline</span>
        <div class="pipeline mt-10">
          <b>Report / Block / Fairness event / System flag</b><span class="arrow">→</span><b>Case</b><span class="arrow">→</span>
          <b>Triage</b><span class="arrow">→</span><b>Evidenze</b><span class="arrow">→</span><b>Revisione</b><span class="arrow">→</span>
          <b>Azione</b><span class="arrow">→</span><b>Ricorso</b><span class="arrow">→</span><b>Audit</b>
        </div>
        <p class="tiny muted mt-12">I flag automatici (blocchi multipli indipendenti, report gravi ripetuti, pattern di spam, tentativi di ban evasion)
          aprono un caso ma non decidono: il numero di segnalazioni non è una prova.</p>
      </div>

      <div class="mod-layout">
        ${lista(cases)}
        ${dettaglio(sel)}
      </div>`;

    return UI.shell('/moderazione', contenuto, { title: 'Moderazione' });
  }

  GD.views = GD.views || {};
  GD.views.moderazione = view;
})(window.GD);
