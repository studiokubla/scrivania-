/* ============================================================
   GdRadar — utilità di base: template, formattazione, icone
   Nessuna dipendenza esterna. Tutto vive sotto window.GD.
   ============================================================ */
window.GD = window.GD || {};

(function (GD) {
  'use strict';

  /* ---------- template HTML sicuro ----------
     html`...` restituisce un oggetto Html: le interpolazioni vengono
     sempre escapate, tranne altri Html o valori marcati con raw().     */
  class Html {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
  }

  const esc = (v) => String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function part(v) {
    if (v === null || v === undefined || v === false) return '';
    /* i booleani veri servono negli attributi ARIA (aria-pressed="true") */
    if (v === true) return 'true';
    if (v instanceof Html) return v.s;
    if (Array.isArray(v)) return v.map(part).join('');
    return esc(v);
  }

  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
    return new Html(out);
  }
  const raw = (s) => new Html(String(s));

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function mount(target, htmlValue) {
    const node = typeof target === 'string' ? $(target) : target;
    if (node) node.innerHTML = String(htmlValue);
    return node;
  }

  /* Delegazione: ogni elemento con data-act="nome" invoca GD.actions.nome */
  GD.actions = {};
  function bindDelegation() {
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const fn = GD.actions[el.dataset.act];
      if (!fn) return;
      ev.preventDefault();
      fn(el.dataset, el, ev);
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-change]');
      if (!el) return;
      const fn = GD.actions[el.dataset.change];
      if (fn) fn(el.dataset, el, ev);
    });
    document.addEventListener('input', (ev) => {
      const el = ev.target.closest('[data-input]');
      if (!el) return;
      const fn = GD.actions[el.dataset.input];
      if (fn) fn(el.dataset, el, ev);
    });
    document.addEventListener('submit', (ev) => {
      const el = ev.target.closest('[data-submit]');
      if (!el) return;
      ev.preventDefault();
      const fn = GD.actions[el.dataset.submit];
      if (fn) fn(el.dataset, el, ev);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') GD.ui && GD.ui.closeOverlays();
    });
  }

  /* ---------- numeri, date, testo ---------- */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad = (n) => String(n).padStart(2, '0');

  function fmtKm(km) {
    if (km === null || km === undefined) return '—';
    if (km < 1) return 'meno di 1 km';
    if (km < 10) return Math.round(km) + ' km';
    if (km < 100) return Math.round(km / 5) * 5 + ' km';
    return Math.round(km / 10) * 10 + ' km';
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'adesso';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min fa';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' h fa';
    const d = Math.round(h / 24);
    if (d === 1) return 'ieri';
    if (d < 30) return d + ' giorni fa';
    const mo = Math.round(d / 30);
    return mo + (mo === 1 ? ' mese fa' : ' mesi fa');
  }

  function clockTime(ts) {
    const d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function dateLabel(ts) {
    const d = new Date(ts);
    const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    return d.getDate() + ' ' + mesi[d.getMonth()] + ' ' + d.getFullYear();
  }

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  function listJoin(arr, max) {
    const a = arr.filter(Boolean);
    if (!a.length) return '—';
    if (!max || a.length <= max) return a.join(' · ');
    return a.slice(0, max).join(' · ') + ' +' + (a.length - max);
  }

  /* ---------- id e casualità deterministica ---------- */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  function pickMany(r, arr, n) {
    const copy = arr.slice(); const out = [];
    for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
    return out;
  }
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);

  /* ---------- avatar deterministico ---------- */
  const AV_COLORS = [
    ['#0E7C66', '#14A184'], ['#5A4BC4', '#7A6BE0'], ['#A5701A', '#C89434'],
    ['#2F6D8F', '#4B90B4'], ['#8A3F63', '#AE5A80'], ['#3C6B3A', '#578A54'],
    ['#8F4B2F', '#B26A4A'], ['#4A4F63', '#6B7186']
  ];
  function avatarStyle(seed) {
    const c = AV_COLORS[hashStr(String(seed)) % AV_COLORS.length];
    return 'background:linear-gradient(140deg,' + c[1] + ',' + c[0] + ')';
  }
  function initials(name) {
    const parts = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function avatar(name, size, seed) {
    const cls = { xs: 'avatar-xs', sm: 'avatar-sm', md: '', lg: 'avatar-lg', xl: 'avatar-xl' }[size || 'md'];
    return html`<div class="avatar ${raw(cls)}" style="${avatarStyle(seed || name)}" aria-hidden="true">${initials(name)}<span class="ring"></span></div>`;
  }

  /* ---------- icone (stroke 1.6, 24×24) ---------- */
  const PATHS = {
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.6"/><path d="M12 12 19 7.6"/><circle cx="15.4" cy="14.8" r="1.5" fill="currentColor" stroke="none"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-1.8 4.2L9 15l1.8-4.2z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.4-3.1 2.8-5 5.5-5s5.1 1.9 5.5 5"/><path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.6 14.9c2 .5 3.4 2.2 3.7 4.6"/>',
    book: '<path d="M4.5 4.8h9a3 3 0 0 1 3 3v11a2.4 2.4 0 0 0-2.4-2.4h-9.6z"/><path d="M19.5 4.8v13.5"/>',
    message: '<path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20.5l1.7-3.7A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z"/>',
    scale: '<path d="M12 4.5v15M7 19.5h10"/><path d="M12 7 5 9m7-2 7 2"/><path d="M5 9 2.8 14a2.6 2.6 0 0 0 4.4 0Zm14 0-2.2 5a2.6 2.6 0 0 0 4.4 0Z"/>',
    shield: '<path d="M12 3.5 5 6v6.2c0 3.6 2.8 6.9 7 8.3 4.2-1.4 7-4.7 7-8.3V6z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
    gavel: '<path d="M4 20h9"/><path d="m6.6 13.4 4.2-4.2"/><path d="m9.4 6.6 4.2 4.2"/><rect x="12.2" y="3.2" width="7.4" height="4.2" rx="1.2" transform="rotate(45 15.9 5.3)"/>',
    user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c.6-3.6 3.6-5.8 7.2-5.8s6.6 2.2 7.2 5.8"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.6" r="2.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4v4.9l3 1.8"/>',
    calendar: '<rect x="3.8" y="5.4" width="16.4" height="14.2" rx="2.4"/><path d="M3.8 9.6h16.4M8.4 3.4v3.6M15.6 3.4v3.6"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
    checkCircle: '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.2 2.5 2.5 4.7-5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    filter: '<path d="M4 6.4h16M7 12h10M10 17.6h4"/>',
    sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    arrowRight: '<path d="M5 12h13M13 6.6 18.4 12 13 17.4"/>',
    arrowLeft: '<path d="M19 12H6M11 17.4 5.6 12 11 6.6"/>',
    chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    chevronDown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
    lock: '<rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2.4"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
    eye: '<path d="M2.6 12S6.4 5.8 12 5.8 21.4 12 21.4 12 17.6 18.2 12 18.2 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.9"/>',
    eyeOff: '<path d="M4 4l16 16"/><path d="M9.6 6.2A9.6 9.6 0 0 1 12 5.8c5.6 0 9.4 6.2 9.4 6.2a17 17 0 0 1-3 3.6M6.4 8.3A17.6 17.6 0 0 0 2.6 12S6.4 18.2 12 18.2c1.2 0 2.3-.3 3.3-.7"/>',
    bell: '<path d="M6.4 10.4a5.6 5.6 0 1 1 11.2 0c0 4 1.4 5.4 1.4 5.4H5s1.4-1.4 1.4-5.4Z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
    flag: '<path d="M6 21V4.4h11.4l-2 3.6 2 3.6H6"/>',
    ban: '<circle cx="12" cy="12" r="8.6"/><path d="m6.2 6.2 11.6 11.6"/>',
    spark: '<path d="M12 3.6 13.7 9l5.4 1.7-5.4 1.7L12 17.8l-1.7-5.4L4.9 10.7 10.3 9z"/>',
    handshake: '<path d="m8.4 12.6 2.4 2.4a1.6 1.6 0 0 0 2.3 0"/><path d="M3.2 10.4 7 6.6h4l2.6 2.2h3.4l3.8 3.6-3.2 4.2-2-1.6-2.4 2.4a1.7 1.7 0 0 1-2.4 0l-4-4"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.2 2.4 3.3 5.4 3.3 8.6s-1.1 6.2-3.3 8.6c-2.2-2.4-3.3-5.4-3.3-8.6S9.8 5.8 12 3.4Z"/>',
    home: '<path d="M4.4 10.6 12 4.4l7.6 6.2V19a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6z"/>',
    dice: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4"/><circle cx="9" cy="9" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>',
    sparkles: '<path d="M10 4.2 11.2 8 15 9.2 11.2 10.4 10 14.2 8.8 10.4 5 9.2 8.8 8z"/><path d="M17 14.2 17.7 16.4 20 17.1l-2.3.7-.7 2.2-.7-2.2-2.3-.7 2.3-.7z"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 8.1v.1"/>',
    warn: '<path d="M12 4.6 21 19.4H3z"/><path d="M12 10v3.6M12 16.4v.1"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.2 4.2"/>',
    send: '<path d="M20.4 3.6 3.6 10.4l6.6 2.8 2.8 6.6z"/><path d="m10.2 13.2 4.2-4.2"/>',
    logout: '<path d="M14 7.4V5.6a1.8 1.8 0 0 0-1.8-1.8H5.8A1.8 1.8 0 0 0 4 5.6v12.8a1.8 1.8 0 0 0 1.8 1.8h6.4a1.8 1.8 0 0 0 1.8-1.8v-1.8"/><path d="M9.4 12h11M17 8.6l3.4 3.4-3.4 3.4"/>',
    edit: '<path d="M5 19h3.2L18.6 8.6a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M4.6 20.4h14.8"/>',
    trash: '<path d="M5.6 7.2h12.8M9.4 7.2V5.6a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6"/><path d="M7.2 7.2 8 19a1.6 1.6 0 0 0 1.6 1.5h4.8A1.6 1.6 0 0 0 16 19l.8-11.8"/>',
    document: '<path d="M13.4 3.6H7.2A1.8 1.8 0 0 0 5.4 5.4v13.2a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8.4z"/><path d="M13.4 3.6v4.8h5.2"/>',
    star: '<path d="m12 4 2.4 5 5.5.8-4 3.9.95 5.5L12 16.6l-4.9 2.6.95-5.5-4-3.9 5.5-.8z"/>'
  };

  function icon(name, size, cls) {
    const d = PATHS[name] || PATHS.info;
    const s = size || 24;
    return raw('<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || '') + '" aria-hidden="true">' + d + '</svg>');
  }

  GD.util = {
    Html, html, raw, esc, $, $$, mount, bindDelegation,
    clamp, pad, fmtKm, timeAgo, clockTime, dateLabel, plural, listJoin,
    hashStr, rng, pick, pickMany, uid, avatar, avatarStyle, initials, icon
  };
})(window.GD);
