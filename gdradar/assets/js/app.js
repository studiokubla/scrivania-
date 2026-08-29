/* ============================================================
   GdRadar — router e avvio
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui, S = GD.store;

  const ROOT = () => U.$('#root');

  function parseHash() {
    const h = location.hash || '';
    if (!h || h === '#') return { route: '/', parts: [] };
    if (h.charAt(1) !== '/') return { anchor: h.slice(1) };
    const parts = h.slice(2).split('/').filter(Boolean);
    return { route: '/' + (parts[0] || ''), parts };
  }

  /* rotte che richiedono un profilo attivo */
  const PROTETTE = ['/radar', '/annunci', '/messaggi', '/fairness', '/profilo', '/sicurezza'];

  function render() {
    const { route, parts, anchor } = parseHash();
    if (anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const st = S.get();

    if (PROTETTE.indexOf(route) !== -1 && !st.me) { location.hash = '#/onboarding'; return; }
    if (route === '/onboarding' && st.me) { location.hash = '#/radar'; return; }
    if (route === '/' && st.me) { location.hash = '#/radar'; return; }

    let vista;
    switch (route) {
      case '/': vista = GD.views.landing(); break;
      case '/onboarding': vista = GD.views.onboarding(); break;
      case '/radar': vista = GD.views.radar(); break;
      case '/annunci': vista = GD.views.annunci(); break;
      case '/messaggi': vista = GD.views.messaggi(parts[1] || null); break;
      case '/fairness': vista = GD.views.fairness(); break;
      case '/profilo': vista = GD.views.profilo(parts[1] || null); break;
      case '/sicurezza': vista = GD.views.sicurezza(); break;
      case '/moderazione': vista = st.me ? GD.views.moderazione() : (location.hash = '#/onboarding', null); break;
      case '/etica': vista = GD.views.etica(); break;
      case '/privacy': vista = GD.views.privacy(); break;
      default: location.hash = st.me ? '#/radar' : '#/'; return;
    }
    if (!vista) return;
    U.mount(ROOT(), vista);
  }

  /* ---- render su cambio rotta: chiude gli overlay e riporta in alto ---- */
  function onHashChange() {
    UI.closeOverlays();
    render();
    window.scrollTo({ top: 0 });
  }

  /* ---- scorciatoie ---- */
  function bindShortcuts() {
    document.addEventListener('keydown', (ev) => {
      const ta = ev.target;
      if (ta && ta.id === 'msg-input' && ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        GD.actions.inviaMsg();
        return;
      }
      if (ev.key === '/' && document.activeElement === document.body) {
        const q = U.$('#radar-q');
        if (q) { ev.preventDefault(); q.focus(); }
      }
    });
    /* ombra sulla nav pubblica quando si scorre */
    window.addEventListener('scroll', () => {
      const nav = U.$('#pubnav');
      if (nav) nav.classList.toggle('stuck', window.scrollY > 8);
    }, { passive: true });
  }

  /* ---- avvio ---- */
  function boot() {
    U.bindDelegation();
    bindShortcuts();
    window.addEventListener('hashchange', onHashChange);
    S.subscribe(() => render());
    if (!location.hash) location.hash = S.get().me ? '#/radar' : '#/';
    render();
  }

  GD.app = { render, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.GD);
