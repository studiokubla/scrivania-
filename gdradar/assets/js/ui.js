/* ============================================================
   GdRadar — componenti condivisi e guscio dell'app
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, D = GD.data, S = GD.store;
  const { html, raw, icon, avatar } = U;

  /* ---------------- navigazione ---------------- */
  function go(route) {
    if (location.hash === '#' + route) GD.app.render();
    else location.hash = route;
  }

  /* ---------------- toast ---------------- */
  function toast(text, tone) {
    const root = U.$('#toast-root');
    const node = document.createElement('div');
    node.className = 'toast' + (tone === 'warn' ? ' warn' : '');
    node.innerHTML = String(html`${icon(tone === 'warn' ? 'warn' : 'checkCircle', 15)}<span>${text}</span>`);
    root.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .25s, transform .25s';
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      setTimeout(() => node.remove(), 260);
    }, 3200);
  }

  /* ---------------- drawer / modal ---------------- */
  let onCloseDrawer = null;

  function openDrawer(opts) {
    const root = U.$('#drawer-root');
    onCloseDrawer = opts.onClose || null;
    root.innerHTML = String(html`
      <div class="scrim" data-act="closeOverlays"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${opts.title || 'Dettaglio'}">
        <header class="drawer-head">
          <div class="row g-10 grow">${opts.head || html`<span class="h-md">${opts.title}</span>`}</div>
          <button class="btn btn-icon btn-ghost" data-act="closeOverlays" aria-label="Chiudi">${icon('x', 18)}</button>
        </header>
        <div class="drawer-body">${opts.body}</div>
        ${opts.foot ? html`<footer class="drawer-foot">${opts.foot}</footer>` : ''}
      </aside>`);
    document.body.style.overflow = 'hidden';
    if (opts.after) opts.after();
  }

  function openModal(opts) {
    const root = U.$('#modal-root');
    root.innerHTML = String(html`
      <div class="modal-wrap">
        <div class="scrim" data-act="closeOverlays"></div>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${opts.title || ''}">
          ${opts.title ? html`<h2 class="h-lg" style="padding-right:24px">${opts.title}</h2>` : ''}
          ${opts.sub ? html`<p class="small muted mt-8">${opts.sub}</p>` : ''}
          <div class="mt-16">${opts.body}</div>
          ${opts.foot ? html`<div class="mt-24 row g-10" style="justify-content:flex-end">${opts.foot}</div>` : ''}
        </div>
      </div>`);
    document.body.style.overflow = 'hidden';
    if (opts.after) opts.after();
  }

  function closeOverlays() {
    U.$('#drawer-root').innerHTML = '';
    U.$('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
    if (onCloseDrawer) { const f = onCloseDrawer; onCloseDrawer = null; f(); }
  }
  GD.actions.closeOverlays = closeOverlays;

  /* ---------------- micro-componenti ---------------- */
  function donut(score, size, thick) {
    const s = size || 46, w = thick || 4;
    const r = (s - w) / 2, c = 2 * Math.PI * r;
    const off = c * (1 - GD.util.clamp(score, 0, 100) / 100);
    const col = score >= 82 ? 'var(--accent)' : score >= 64 ? 'var(--accent)' : score >= 45 ? 'var(--amber)' : 'var(--ink-4)';
    return html`<div class="donut ${raw(s > 60 ? 'donut-lg' : '')}" style="width:${s}px;height:${s}px" role="img" aria-label="Compatibilità ${score} su 100">
      <svg width="${s}" height="${s}">
        <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${w}"/>
        <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${raw(col)}" stroke-width="${w}"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <span class="val">${score}</span>
    </div>`;
  }

  function fairPips(entity, opts) {
    const f = GD.match.fairness(entity);
    const pips = [1, 2, 3, 4, 5].map((i) => html`<i class="${raw(f.visibile && i <= f.pips ? 'on' : '')}"></i>`);
    if (!f.visibile) {
      return html`<span class="fair tip" data-tip="Servono ${GD.match.SOGLIA_FEEDBACK} feedback qualificati">
        <span class="fair-pips locked">${pips}</span>
        <span class="fair-label muted">Fairness non disponibile</span></span>`;
    }
    return html`<span class="fair tip" data-tip="${f.nota}">
      <span class="fair-pips">${pips}</span>
      <span class="fair-label">${f.label}${opts && opts.conta ? ' · ' + f.esperienze : ''}</span></span>`;
  }

  const TIPO_META = {
    utente: { label: 'Persona', badge: 'badge-accent', dot: 'dot-live', ico: 'user' },
    party: { label: 'Party', badge: 'badge-amber', dot: 'dot-amber', ico: 'users' },
    campagna: { label: 'Campagna', badge: 'badge-violet', dot: 'dot-violet', ico: 'book' },
    annuncio: { label: 'Annuncio', badge: 'badge-line', dot: 'dot-off', ico: 'document' }
  };

  const TIPO_ANNUNCIO = {
    cerco_player: 'Cerca Player',
    cerco_master: 'Cerca Master',
    cerco_party: 'Cerca Party',
    cerco_campagna: 'Cerca Campagna'
  };

  /* nome, sottotitolo, seme avatar per qualunque entità */
  function identity(e) {
    if (e.tipo === 'annuncio') {
      const autore = D.byId(e.autore.kind, e.autore.id) || S.get().me;
      return {
        nome: e.titolo,
        sotto: (autore ? autore.nome : 'Tu') + ' · ' + (TIPO_ANNUNCIO[e.sottotipo] || 'Annuncio'),
        seed: e.id, tipo: 'annuncio', autore
      };
    }
    const sotto = e.tipo === 'utente'
      ? e.ruoli.map((r) => (D.RUOLI.find((x) => x.id === r) || {}).label).join(' e ') + ' · ' + D.espById(e.esperienza).label
      : e.tipo === 'party'
        ? U.plural(e.membri.length, 'persona', 'persone') + (e.postiLiberi ? ' · ' + U.plural(e.postiLiberi, 'posto libero', 'posti liberi') : ' · al completo')
        : (D.systemById(e.systemId) || {}).nome + ' · ' + (D.FORMATI.find((f) => f.id === e.formato) || {}).label;
    return { nome: e.nome, sotto, seed: e.id, tipo: e.tipo };
  }

  function tipoBadge(tipo, sottotipo) {
    const m = TIPO_META[tipo] || TIPO_META.utente;
    const label = tipo === 'annuncio' && sottotipo ? TIPO_ANNUNCIO[sottotipo] : m.label;
    return html`<span class="badge ${raw(m.badge)}">${label}</span>`;
  }

  function newbieBadge(v) {
    if (v !== 'si') return '';
    return html`<span class="badge badge-accent">${icon('sparkles', 11)}Newbie friendly</span>`;
  }

  function luogoBadge(e, me) {
    if (e.modalita === 'online') return html`<span class="badge">${icon('globe', 11)}Online</span>`;
    const pv = GD.geo.publicView(e.loc, me && me.loc);
    return html`<span class="badge">${icon('pin', 11)}${pv.area}${pv.distanceLabel ? ' · ' + pv.distanceLabel : ''}</span>`;
  }

  function dispoBadge(e) {
    const d = e.disponibilita;
    if (!d || !d.giorni || !d.giorni.length) return '';
    const gg = d.giorni.map((g) => (D.GIORNI.find((x) => x.id === g) || {}).label).join(' ');
    return html`<span class="badge">${icon('calendar', 11)}${gg}</span>`;
  }

  function sistemaBadge(e) {
    const sysId = e.systemId || (e.games && e.games[0] && e.games[0].systemId);
    if (!sysId) return '';
    const s = D.systemById(sysId);
    const extra = e.games && e.games.length > 1 ? ' +' + (e.games.length - 1) : '';
    return html`<span class="badge badge-line">${icon('dice', 11)}${s.nome}${extra}</span>`;
  }

  /* ---------------- card risultato ---------------- */
  function resultCard(e, comp, me) {
    const id = identity(e);
    return html`<article class="card card-hover result" data-act="openSheet" data-kind="${e.tipo}" data-id="${e.id}">
      ${avatar(id.nome, 'md', id.seed)}
      <div class="grow">
        <div class="row-b" style="align-items:flex-start">
          <div class="grow">
            <div class="row g-8 wrap">
              ${tipoBadge(e.tipo, e.sottotipo)}
              ${newbieBadge(e.newbie)}
            </div>
            <h3 class="h-md mt-8" style="line-height:1.3">${id.nome}</h3>
            <p class="small muted">${id.sotto}</p>
          </div>
          ${donut(comp.score, 46)}
        </div>
        <div class="meta">
          ${sistemaBadge(e)}${luogoBadge(e, me)}${dispoBadge(e)}
        </div>
        <div class="row-b mt-12">
          ${fairPips(e)}
          <span class="tiny muted">${e.pubblicato ? U.timeAgo(e.pubblicato) : ''}</span>
        </div>
        ${comp.motivi && comp.motivi.length ? html`<div class="why">
          ${comp.motivi.slice(0, 2).map((m) => html`<span>${icon('check', 11)}${m.why}</span>`)}
        </div>` : ''}
      </div>
    </article>`;
  }

  /* ---------------- guscio applicativo ---------------- */
  const NAV = [
    { route: '/radar', label: 'Radar', ico: 'radar' },
    { route: '/annunci', label: 'Annunci', ico: 'document' },
    { route: '/messaggi', label: 'Messaggi', ico: 'message', badge: 'msg' },
    { route: '/fairness', label: 'Fairness', ico: 'scale' },
    { route: '/sicurezza', label: 'Sicurezza', ico: 'shield' }
  ];

  function logo(size) {
    return html`<span class="logo">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="${raw(size ? 'width:' + size + 'px;height:' + size + 'px' : '')}">
        <circle cx="16" cy="16" r="13.2" stroke="var(--accent)" stroke-opacity=".28"/>
        <circle cx="16" cy="16" r="8.4" stroke="var(--accent)" stroke-opacity=".22"/>
        <circle cx="16" cy="16" r="3.6" stroke="var(--accent)" stroke-opacity=".5"/>
        <path d="M16 16 27 10.4" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="21.4" cy="20.6" r="2.5" fill="var(--amber)"/>
      </svg>
      <span class="word">Gd<b>Radar</b></span></span>`;
  }

  function shell(active, content, opts) {
    const st = S.get();
    const counts = S.contaNonLetti();
    const o = opts || {};
    return html`<div class="shell">
      <aside class="rail">
        <a class="brand" href="#/radar">${logo()}</a>
        <nav>
          ${NAV.map((n) => html`<a class="nav-item ${raw(active === n.route ? 'is-on' : '')}" href="#${n.route}">
            ${icon(n.ico, 18)}<span>${n.label}</span>
            ${n.badge === 'msg' && counts.tot ? html`<span class="pip">${counts.tot}</span>` : ''}
          </a>`)}
        </nav>
        <div class="sep"></div>
        <nav>
          <a class="nav-item ${raw(active === '/moderazione' ? 'is-on' : '')}" href="#/moderazione">${icon('gavel', 18)}<span>Moderazione</span></a>
          <a class="nav-item ${raw(active === '/etica' ? 'is-on' : '')}" href="#/etica">${icon('handshake', 18)}<span>Gioco etico</span></a>
        </nav>
        <div class="foot">
          <div class="sep"></div>
          <a class="rail-user" href="#/profilo">
            ${avatar(st.me.nome, 'sm', 'me')}
            <span class="grow" style="min-width:0">
              <span class="h-sm truncate" style="display:block">${st.me.nome}</span>
              <span class="tiny muted">${(D.VISIBILITA.find((v) => v.id === st.me.visibilita) || {}).label}</span>
            </span>
          </a>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          ${o.topLeft || html`<span class="h-md">${o.title || ''}</span>`}
          <div class="grow"></div>
          ${o.topRight || ''}
          <button class="btn btn-icon btn-ghost tip" data-tip="Notifiche" data-act="openNotifiche" aria-label="Notifiche" style="position:relative">
            ${icon('bell', 18)}
            ${st.notifications.some((n) => !n.letto) ? raw('<span style="position:absolute;top:7px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--bg)"></span>') : ''}
          </button>
        </header>
        <main class="page ${raw(o.narrow ? 'page-narrow' : '')}" id="main">${content}</main>
      </div>

      <nav class="tabbar">
        ${NAV.slice(0, 4).map((n) => html`<a class="${raw(active === n.route ? 'is-on' : '')}" href="#${n.route}">
          ${icon(n.ico, 20)}<span>${n.label}</span>
          ${n.badge === 'msg' && counts.tot ? html`<span class="pip">${counts.tot}</span>` : ''}
        </a>`)}
        <a class="${raw(active === '/profilo' ? 'is-on' : '')}" href="#/profilo">${icon('user', 20)}<span>Profilo</span></a>
      </nav>
    </div>`;
  }

  /* pannello notifiche */
  GD.actions.openNotifiche = function () {
    const st = S.get();
    openDrawer({
      title: 'Notifiche',
      body: st.notifications.length ? html`<ul class="col g-2">
        ${st.notifications.map((n) => html`<li class="card card-flat card-quiet card-pad" style="padding:14px 16px;margin-bottom:8px">
          <div class="row g-10">
            <span class="dot ${raw(n.letto ? 'dot-off' : 'dot-live')}" style="margin-top:6px"></span>
            <div class="grow">
              <p class="small">${n.testo}</p>
              <p class="tiny muted mt-4">${U.timeAgo(n.quando)}</p>
            </div>
          </div>
        </li>`)}
      </ul>` : emptyState('bell', 'Nessuna notifica', 'Qui arrivano richieste di contatto, messaggi e promemoria di feedback.'),
      foot: html`<button class="btn btn-block" data-act="leggiNotifiche">Segna tutte come lette</button>`
    });
    setTimeout(() => S.leggiNotifiche(), 400);
  };
  GD.actions.leggiNotifiche = function () { S.leggiNotifiche(); closeOverlays(); };

  function emptyState(ico, titolo, testo, cta) {
    return html`<div class="empty">
      <span class="glyph">${icon(ico, 24)}</span>
      <p class="h-md" style="color:var(--ink)">${titolo}</p>
      <p class="small" style="max-width:44ch">${testo}</p>
      ${cta || ''}
    </div>`;
  }

  function pageHead(titolo, sotto, right) {
    return html`<div class="page-head row-b wrap g-16">
      <div>
        <h1 class="display d-3">${titolo}</h1>
        ${sotto ? html`<p class="body mt-8" style="max-width:60ch">${sotto}</p>` : ''}
      </div>
      ${right || ''}
    </div>`;
  }

  /* gate: molte azioni sociali richiedono la verifica 18+ */
  function requireVerified(azione) {
    if (S.verificato()) return true;
    openModal({
      title: 'Serve la verifica dei 18 anni',
      sub: 'GdRadar è un servizio per maggiorenni. Per ' + azione + ' devi completare la verifica: è anonima e non conserviamo documenti.',
      body: html`<div class="callout accent">${icon('lock', 18, 'ico')}<div>Della verifica salviamo solo: esito, soglia 18+, provider, riferimento non reversibile e data.</div></div>`,
      foot: html`<button class="btn" data-act="closeOverlays">Più tardi</button>
        <button class="btn btn-primary" data-act="goVerifica">Verifica ora</button>`
    });
    return false;
  }
  GD.actions.goVerifica = function () { closeOverlays(); go('/profilo/verifica'); };

  GD.ui = {
    go, toast, openDrawer, openModal, closeOverlays, donut, fairPips, identity,
    tipoBadge, newbieBadge, luogoBadge, dispoBadge, sistemaBadge, resultCard,
    shell, logo, emptyState, pageHead, requireVerified, TIPO_META, TIPO_ANNUNCIO
  };
})(window.GD);
