/* ============================================================
   GdRadar — Fairness (flusso D)
   Relazione qualificata → conferma esperienza → feedback →
   punteggio. Anonimo verso il destinatario, tracciato verso
   l'autore, mai testo libero pubblico.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store, M = GD.match;
  const { html, raw, icon } = U;

  const DOMANDE = [
    { id: 'corretta', testo: 'L\'esperienza è stata complessivamente corretta?' },
    { id: 'accordi', testo: 'Ha rispettato gli accordi presi?' },
    { id: 'comunicazione', testo: 'La comunicazione è stata rispettosa?' },
    { id: 'dinuovo', testo: 'Giocheresti di nuovo con questa persona o con questo Party?' }
  ];

  let risposte = {};

  GD.actions.apriFeedback = (ds) => {
    const st = S.get();
    const fb = st.pendingFeedback.find((x) => x.id === ds.id);
    if (!fb) return;
    risposte = {};
    disegnaFeedback(fb);
  };

  GD.actions.fbRisposta = (ds) => {
    risposte[ds.q] = ds.v === '1';
    const fb = S.get().pendingFeedback.find((x) => x.id === ds.fb);
    if (fb) disegnaFeedback(fb);
  };
  GD.actions.fbMotivo = (ds) => {
    risposte.motivo = ds.value;
    const fb = S.get().pendingFeedback.find((x) => x.id === ds.fb);
    if (fb) disegnaFeedback(fb);
  };

  GD.actions.inviaFeedback = (ds) => {
    if (Object.keys(risposte).filter((k) => k !== 'motivo').length < DOMANDE.length) {
      UI.toast('Rispondi a tutte e quattro le domande.', 'warn');
      return;
    }
    const negativo = DOMANDE.some((d) => risposte[d.id] === false);
    if (negativo && !risposte.motivo) { UI.toast('Indica il motivo: resta privato, serve alla moderazione.', 'warn'); return; }
    S.inviaFeedback(ds.id, JSON.parse(JSON.stringify(risposte)));
    UI.closeOverlays();
    UI.toast('Feedback inviato in forma anonima. Grazie: è così che il sistema resta utile.');
  };
  GD.actions.saltaFeedback = (ds) => {
    S.saltaFeedback(ds.id);
    UI.closeOverlays();
    UI.toast('Nessun problema: il promemoria non tornerà.');
  };
  GD.actions.nonAvvenuto = (ds) => {
    S.saltaFeedback(ds.id);
    UI.closeOverlays();
    UI.toast('Registrato: senza incontro non c\'è feedback, e la relazione non conta per la Fairness.');
  };

  function disegnaFeedback(fb) {
    const e = D.byId(fb.kind, fb.id2);
    const nome = e ? (e.nome || e.titolo) : 'questa persona';
    const negativo = DOMANDE.some((d) => risposte[d.id] === false);
    UI.openModal({
      title: 'Com\'è andata con ' + nome + '?',
      sub: 'Quattro domande chiuse. Anonime verso chi le riceve, e non servono a giudicare quanto giochi bene.',
      body: html`
        <div class="col g-12">
          ${DOMANDE.map((d) => html`<div class="card card-pad" style="padding:14px 16px">
            <div class="row-b g-12 wrap">
              <span class="small grow" style="min-width:180px">${d.testo}</span>
              <div class="segmented on-white">
                <button aria-pressed="${risposte[d.id] === true}" data-act="fbRisposta" data-fb="${fb.id}" data-q="${d.id}" data-v="1">Sì</button>
                <button aria-pressed="${risposte[d.id] === false}" data-act="fbRisposta" data-fb="${fb.id}" data-q="${d.id}" data-v="0">No</button>
              </div>
            </div>
          </div>`)}

          ${negativo ? html`<div class="field mt-4">
            <span class="label">Motivo (privato, visibile solo alla moderazione)</span>
            <div class="row g-8 wrap">
              ${D.MOTIVI_REPORT.filter((m) => ['no_show', 'scorrettezza', 'molestie', 'aggressivita', 'altro'].indexOf(m.id) !== -1)
                .map((m) => html`<button class="chip" aria-pressed="${risposte.motivo === m.id}" data-act="fbMotivo" data-fb="${fb.id}" data-value="${m.id}">${m.label}</button>`)}
            </div>
            <span class="hint">Un motivo negativo non applica sanzioni da solo: se serve, apre il percorso di moderazione.</span>
          </div>` : ''}

          <div class="callout">${icon('lock', 18, 'ico')}
            <div>${nome} vedrà solo il punteggio aggregato, mai chi ha risposto cosa. Internamente il feedback resta legato a te: serve a fermare gli abusi.</div></div>
        </div>`,
      foot: html`
        <button class="btn btn-ghost" data-act="nonAvvenuto" data-id="${fb.id}">Non ci siamo visti</button>
        <button class="btn" data-act="saltaFeedback" data-id="${fb.id}">Più tardi</button>
        <button class="btn btn-primary" data-act="inviaFeedback" data-id="${fb.id}">Invia</button>`
    });
  }

  /* ---------------- grafico Wilson ---------------- */
  function wilsonDemo() {
    const casi = [
      { l: '5 su 5', pos: 5, n: 5 },
      { l: '9 su 10', pos: 9, n: 10 },
      { l: '28 su 30', pos: 28, n: 30 },
      { l: '97 su 100', pos: 97, n: 100 }
    ];
    return html`<div class="col g-12">
      ${casi.map((c) => {
        const w = Math.round(M.wilsonLower(c.pos, c.n) * 100);
        const media = Math.round((c.pos / c.n) * 100);
        return html`<div>
          <div class="row-b tiny"><span>${c.l}</span><span class="muted">media ${media}% → stima ${w}%</span></div>
          <div class="meter mt-4" style="height:7px"><i style="width:${w}%"></i></div>
        </div>`;
      })}
    </div>`;
  }

  /* ---------------- vista ---------------- */
  function view() {
    const st = S.get();
    const me = st.me;
    const f = M.fairness(me);
    const dati = me.fairness;
    const dateFeedback = st.feedback;

    const contenuto = html`
      ${UI.pageHead('Fairness', 'Misura la correttezza delle esperienze, non la bravura. Nessuna recensione pubblica, nessun commento visibile.')}

      ${st.pendingFeedback.length ? html`<section class="col g-10" style="margin-bottom:28px">
        <span class="eyebrow">In attesa di una risposta · ${st.pendingFeedback.length}</span>
        ${st.pendingFeedback.map((fb) => {
          const e = D.byId(fb.kind, fb.id2);
          const nome = e ? (e.nome || e.titolo) : 'Profilo';
          return html`<article class="card card-pad">
            <div class="row-b wrap g-12">
              <div class="row g-12">
                ${U.avatar(nome, 'md', fb.id2)}
                <div>
                  <p class="h-md">Avete giocato insieme?</p>
                  <p class="small muted">${nome} · contatti scambiati ${U.timeAgo(fb.quando)}</p>
                </div>
              </div>
              <button class="btn btn-primary" data-act="apriFeedback" data-id="${fb.id}">Rispondi</button>
            </div>
          </article>`;
        })}
      </section>` : ''}

      <div class="two-col">
        <div class="col g-20">
          <section class="card card-pad">
            <span class="eyebrow">La tua Fairness</span>
            <div class="row g-20 wrap mt-16" style="align-items:center">
              ${f.visibile ? UI.donut(f.percent, 92, 7) : html`<div class="donut" style="width:92px;height:92px">
                <svg width="92" height="92"><circle cx="46" cy="46" r="42" fill="none" stroke="var(--line)" stroke-width="7" stroke-dasharray="4 7"/></svg>
                <span class="val" style="color:var(--ink-4)">${icon('lock', 20)}</span></div>`}
              <div class="grow" style="min-width:200px">
                <p class="h-lg">${f.visibile ? f.label : 'Non ancora disponibile'}</p>
                <p class="small muted mt-4">${f.visibile
                  ? f.nota + ' Il numero grande è la stima prudenziale, non la media.'
                  : 'Hai ' + U.plural(dati.n, 'feedback qualificato', 'feedback qualificati') + ': ne servono ' + M.SOGLIA_FEEDBACK + '. Mancano ' + f.mancanti + '.'}</p>
                <div class="mt-12">${UI.fairPips(me, { conta: true })}</div>
              </div>
            </div>
            ${!f.visibile ? html`<div class="meter mt-20"><i style="width:${Math.round((dati.n / M.SOGLIA_FEEDBACK) * 100)}%"></i></div>
              <p class="tiny muted mt-8">Sotto la soglia non mostriamo nulla a nessuno: con pochi dati un punteggio è rumore travestito da certezza.</p>` : ''}
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Come si calcola</span>
            <p class="body mt-12">Non usiamo la media aritmetica. Con il <b>Wilson lower bound</b> al 95% un piccolo campione
              perfetto vale meno di un campione grande quasi perfetto: è il modo onesto di dire “non lo sappiamo ancora”.</p>
            <div class="mt-20">${wilsonDemo()}</div>
            <p class="tiny muted mt-16">Un lieve peso sulla recenza fa invecchiare i segnali molto vecchi. Il numero di esperienze resta sempre leggibile per fasce.</p>
          </section>

          <section class="card card-pad">
            <span class="eyebrow">Le quattro domande</span>
            <ul class="col g-10 mt-12">
              ${DOMANDE.map((d) => html`<li class="row g-10"><span class="muted">${icon('checkCircle', 16)}</span>
                <span class="small">${d.testo} <span class="muted">· Sì / No</span></span></li>`)}
              <li class="row g-10"><span class="muted">${icon('lock', 16)}</span>
                <span class="small">In caso di risposta negativa: motivo scelto da un elenco chiuso, <b>privato</b>.</span></li>
            </ul>
          </section>
        </div>

        <aside class="col g-16">
          <div class="card card-pad">
            <span class="eyebrow">Regole non negoziabili</span>
            <ul class="col g-10 mt-12">
              ${['Il feedback si sblocca solo dopo una relazione qualificata nata su GdRadar',
                 'Lo scambio contatti deve essere bilaterale e registrato',
                 'Anonimo verso chi lo riceve, tracciato internamente verso chi lo scrive',
                 'Nessun testo libero pubblico',
                 'Una segnalazione grave non tocca il punteggio: apre un caso'
                ].map((t) => html`<li class="row g-8"><span style="color:var(--accent);margin-top:2px">${icon('check', 14)}</span><span class="small">${t}</span></li>`)}
            </ul>
          </div>

          <div class="card card-pad">
            <span class="eyebrow">Fairness del Party</span>
            <p class="small mt-12" style="color:var(--ink-2)">Un Party ha una Fairness propria, che nasce dalle esperienze con il
              gruppo. <b>Non</b> è la media dei suoi membri: si può stare bene in un gruppo fatto di persone difficili,
              e male in un gruppo di brave persone.</p>
          </div>

          <div class="card card-pad">
            <span class="eyebrow">Feedback che hai lasciato</span>
            ${dateFeedback.length ? html`<ul class="col g-8 mt-12">
              ${dateFeedback.map((x) => {
                const e = D.byId(x.kind, x.id2);
                const positivo = DOMANDE.every((d) => x.risposte[d.id]);
                return html`<li class="row-b g-8">
                  <span class="small truncate">${e ? (e.nome || e.titolo) : 'Profilo'}</span>
                  <span class="badge ${raw(positivo ? 'badge-accent' : 'badge-amber')}">${positivo ? 'Positivo' : 'Con riserve'}</span>
                </li>`;
              })}
            </ul>` : html`<p class="small muted mt-12">Nessuno ancora. Compaiono qui solo per te: chi lo riceve non saprà mai che è tuo.</p>`}
          </div>
        </aside>
      </div>`;

    return UI.shell('/fairness', contenuto, { title: 'Fairness' });
  }

  GD.views = GD.views || {};
  GD.views.fairness = view;
})(window.GD);
