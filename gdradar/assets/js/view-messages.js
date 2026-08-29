/* ============================================================
   GdRadar — Richieste, chat e scambio contatti (flusso C)
   Richiesta → accettazione → chat → proposta di scambio →
   doppio consenso → scambio.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, D = GD.data, S = GD.store;
  const { html, raw, icon } = U;

  const nomeDi = (kind, id) => {
    const e = D.byId(kind, id);
    return e ? (e.nome || e.titolo) : 'Profilo';
  };

  /* ---------------- azioni ---------------- */
  GD.actions.apriConv = (ds) => UI.go('/messaggi/' + ds.id);

  GD.actions.rispondiRichiesta = (ds) => {
    const accetta = ds.accetta === '1';
    if (accetta && !UI.requireVerified('accettare un contatto')) return;
    const convId = S.rispondiRichiesta(ds.id, accetta);
    UI.toast(accetta ? 'Richiesta accettata: la conversazione è aperta.' : 'Richiesta rifiutata. Non riceverà nessuna notifica.');
    if (convId) UI.go('/messaggi/' + convId);
  };

  GD.actions.inviaMsg = () => {
    const ta = U.$('#msg-input');
    if (!ta) return;
    const text = ta.value.trim();
    const convId = ta.dataset.conv;
    if (!text) return;
    S.inviaMessaggio(convId, text);
    scrollGiu();
    setTimeout(() => rispostaSimulata(convId), 1400);
  };

  const RISPOSTE = [
    'Per me va bene. Confermo appena sento gli altri del tavolo.',
    'Ottimo, allora ci sentiamo. Ti mando i dettagli quando fissiamo la data.',
    'Bella domanda: di solito partiamo alle 21 e chiudiamo verso mezzanotte.',
    'Guarda, sì. L\'unica cosa che chiediamo è di avvisare se salta una serata.',
    'Perfetto. Se ti va, quando ci siamo chiariti possiamo scambiarci i contatti.'
  ];
  function rispostaSimulata(convId) {
    const st = S.get();
    const c = st.conversations.find((x) => x.id === convId);
    if (!c || c.chiusa) return;
    const testo = RISPOSTE[(c.messages.length + U.hashStr(c.id)) % RISPOSTE.length];
    S.set((s) => {
      const cc = s.conversations.find((x) => x.id === convId);
      if (cc) cc.messages.push({ from: 'them', text: testo, ts: Date.now() });
    });
    scrollGiu();
  }

  function scrollGiu() {
    setTimeout(() => {
      const box = U.$('#msg-scroll');
      if (box) box.scrollTop = box.scrollHeight;
    }, 30);
  }

  GD.actions.apriScambio = (ds) => {
    if (!UI.requireVerified('scambiare i contatti')) return;
    const me = S.get().me;
    UI.openModal({
      title: 'Proporre lo scambio dei contatti',
      sub: 'Passano solo se anche l\'altra persona accetta. Scegli tu quali condividere.',
      body: html`
        <div class="col g-8">
          ${D.CANALI_CONTATTO.map((c) => html`<label class="card card-pad row g-10" style="padding:12px 14px;cursor:pointer">
            <input type="checkbox" class="canale" value="${c.id}" ${raw(me.contatti[c.id] ? 'checked' : '')}
              style="width:17px;height:17px;accent-color:var(--accent)">
            <span class="grow"><b class="h-sm">${c.label}</b>
              ${me.contatti[c.id] ? html`<span class="small muted"> · ${me.contatti[c.id]}</span>` : html`<span class="tiny muted"> · non impostato nel profilo</span>`}</span>
          </label>`)}
        </div>
        <div class="callout mt-16">${icon('shield', 18, 'ico')}
          <div>Lo scambio viene registrato come evento di piattaforma: è ciò che rende qualificata la relazione e sblocca il feedback Fairness.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-primary" data-act="confermaScambio" data-conv="${ds.conv}">Proponi lo scambio</button>`
    });
  };
  GD.actions.confermaScambio = (ds) => {
    const canali = U.$$('.canale').filter((c) => c.checked).map((c) => c.value);
    if (!canali.length) { UI.toast('Scegli almeno un canale.', 'warn'); return; }
    S.proponiScambio(ds.conv, canali);
    UI.closeOverlays();
    UI.toast('Contatti scambiati: entrambe le parti hanno acconsentito.');
    scrollGiu();
  };

  GD.actions.chiudiConv = (ds) => {
    UI.openModal({
      title: 'Chiudere la conversazione?',
      sub: 'Resta visibile nello storico ma nessuno dei due può più scrivere.',
      body: html`<div class="callout">${icon('info', 18, 'ico')}<div>Se il problema è la persona e non la conversazione, valuta il blocco o la segnalazione: sono strumenti diversi.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Annulla</button>
        <button class="btn btn-danger" data-act="confermaChiusura" data-conv="${ds.conv}">Chiudi conversazione</button>`
    });
  };
  GD.actions.confermaChiusura = (ds) => { S.chiudiConversazione(ds.conv); UI.closeOverlays(); UI.toast('Conversazione chiusa.'); };

  /* ---------------- lista laterale ---------------- */
  function sidebar(active) {
    const st = S.get();
    const richieste = st.requests.filter((r) => r.stato === 'pending');
    return html`<aside class="msg-side">
      ${richieste.length ? html`<div style="padding:14px 15px;border-bottom:1px solid var(--line)">
        <span class="eyebrow">Richieste · ${richieste.length}</span>
        <div class="col g-8 mt-12">
          ${richieste.map((r) => html`<div class="card card-flat card-quiet card-pad" style="padding:12px">
            <div class="row g-10">
              ${U.avatar(nomeDi(r.kind, r.id2), 'sm', r.id2)}
              <div class="grow" style="min-width:0">
                <p class="h-sm truncate">${nomeDi(r.kind, r.id2)}</p>
                <p class="tiny muted">${r.dir === 'in' ? 'ti ha scritto' : 'in attesa di risposta'} · ${U.timeAgo(r.quando)}</p>
              </div>
            </div>
            ${r.msg ? html`<p class="small mt-8" style="color:var(--ink-2)">“${r.msg}”</p>` : ''}
            ${r.dir === 'in' ? html`<div class="row g-8 mt-12">
              <button class="btn btn-sm btn-primary grow" data-act="rispondiRichiesta" data-id="${r.id}" data-accetta="1">Accetta</button>
              <button class="btn btn-sm grow" data-act="rispondiRichiesta" data-id="${r.id}" data-accetta="0">Rifiuta</button>
            </div>` : html`<div class="row g-8 mt-8"><span class="badge">${icon('clock', 11)}In attesa</span></div>`}
          </div>`)}
        </div>
      </div>` : ''}

      <div class="list">
        ${st.conversations.length ? st.conversations.map((c) => html`
          <div class="msg-item ${raw(active === c.id ? 'is-on' : '')}" data-act="apriConv" data-id="${c.id}">
            ${U.avatar(nomeDi(c.kind, c.id2), 'sm', c.id2)}
            <div class="grow" style="min-width:0">
              <div class="row-b g-8">
                <span class="h-sm truncate">${nomeDi(c.kind, c.id2)}</span>
                <span class="tiny muted nowrap">${U.timeAgo(c.messages[c.messages.length - 1].ts)}</span>
              </div>
              <p class="small muted truncate">${c.messages[c.messages.length - 1].text}</p>
              ${c.exchange.done ? html`<span class="badge badge-accent mt-4">${icon('handshake', 11)}Contatti scambiati</span>` : ''}
              ${c.chiusa ? html`<span class="badge mt-4">Chiusa</span>` : ''}
            </div>
            ${c.unread ? html`<span class="un"></span>` : ''}
          </div>`)
        : UI.emptyState('message', 'Nessuna conversazione', 'Le chat si aprono solo dopo una richiesta di contatto accettata.')}
      </div>
    </aside>`;
  }

  /* ---------------- thread ---------------- */
  function thread(c) {
    if (!c) {
      return html`<section class="msg-thread">${UI.emptyState('message', 'Scegli una conversazione',
        'Le richieste in sospeso sono in cima alla colonna di sinistra.')}</section>`;
    }
    const nome = nomeDi(c.kind, c.id2);
    const entity = D.byId(c.kind, c.id2);
    S.leggiConversazione(c.id);

    return html`<section class="msg-thread">
      <header class="msg-head">
        <a class="btn btn-icon btn-ghost msg-back" href="#/messaggi" aria-label="Torna alle conversazioni">${icon('arrowLeft', 18)}</a>
        ${U.avatar(nome, 'sm', c.id2)}
        <div class="grow" style="min-width:0">
          <p class="h-sm truncate">${nome}</p>
          <p class="tiny muted truncate">${entity ? UI.identity(entity).sotto : ''}</p>
        </div>
        <button class="btn btn-sm" data-act="openSheet" data-kind="${c.kind}" data-id="${c.id2}">Scheda</button>
        <button class="btn btn-icon btn-ghost tip" data-tip="Segnala" data-act="apriSegnalazione" data-kind="${c.kind}" data-id="${c.id2}">${icon('flag', 17)}</button>
        <button class="btn btn-icon btn-ghost tip" data-tip="Blocca" data-act="apriBlocco" data-kind="${c.kind}" data-id="${c.id2}">${icon('ban', 17)}</button>
      </header>

      <div class="msg-scroll" id="msg-scroll">
        ${c.messages.map((m) => m.from === 'sys'
          ? html`<div class="sys-note">${m.text}</div>`
          : html`<div class="bubble ${raw(m.from === 'me' ? 'me' : 'them')}">${m.text}<span class="t">${U.clockTime(m.ts)}</span></div>`)}

        ${!c.exchange.done && !c.chiusa ? html`<div class="exchange-card">
          <div class="row g-10">
            <span style="color:var(--accent)">${icon('handshake', 20)}</span>
            <div class="grow">
              <p class="h-sm">Scambio dei contatti</p>
              <p class="small mt-4" style="color:var(--accent-ink)">Telefono, Discord o Telegram passano solo con il consenso di entrambi. Fino ad allora resta tutto qui dentro.</p>
              <button class="btn btn-sm btn-primary mt-12" data-act="apriScambio" data-conv="${c.id}">Proponi lo scambio</button>
            </div>
          </div>
        </div>` : ''}

        ${c.exchange.done ? html`<div class="exchange-card">
          <div class="row-b g-10 wrap">
            <div class="row g-10">
              <span style="color:var(--accent)">${icon('checkCircle', 20)}</span>
              <div>
                <p class="h-sm">Contatti scambiati</p>
                <p class="small" style="color:var(--accent-ink)">${c.exchange.canali.map((k) => (D.CANALI_CONTATTO.find((x) => x.id === k) || {}).label).join(', ')} · ${U.timeAgo(c.exchange.quando || Date.now())}</p>
              </div>
            </div>
            <span class="badge badge-accent">Relazione qualificata</span>
          </div>
        </div>` : ''}
      </div>

      ${c.chiusa
        ? html`<div class="msg-compose"><p class="small muted grow tc">Conversazione chiusa.</p></div>`
        : html`<div class="msg-compose">
            <textarea class="textarea grow" id="msg-input" data-conv="${c.id}" rows="1" placeholder="Scrivi un messaggio…"></textarea>
            <button class="btn btn-icon btn-primary" data-act="inviaMsg" aria-label="Invia">${icon('send', 17)}</button>
            <button class="btn btn-icon btn-ghost tip" data-tip="Chiudi conversazione" data-act="chiudiConv" data-conv="${c.id}">${icon('x', 17)}</button>
          </div>`}
    </section>`;
  }

  /* ---------------- vista ---------------- */
  function view(convId) {
    const st = S.get();
    let c = convId ? st.conversations.find((x) => x.id === convId) : null;
    /* su schermi larghi conviene mostrare subito l'ultima conversazione */
    if (!c && !convId && st.conversations.length && window.innerWidth > 860) c = st.conversations[0];
    const contenuto = html`
      <div class="row-b wrap g-12" style="margin-bottom:18px">
        <div>
          <h1 class="display d-3">Messaggi</h1>
          <p class="small muted mt-4">Niente file, niente vocali, niente immagini: nella V1 la chat è testo e basta.</p>
        </div>
      </div>
      <div class="msg-layout ${raw(c ? 'on-thread' : '')}">
        ${sidebar(c ? c.id : null)}
        ${thread(c)}
      </div>`;
    const out = UI.shell('/messaggi', contenuto, { title: 'Messaggi' });
    scrollGiu();
    return out;
  }

  GD.views = GD.views || {};
  GD.views.messaggi = view;
})(window.GD);
