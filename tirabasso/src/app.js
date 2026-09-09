/* ============================================================
   TIRABASSO Maison — demo funzionale
   SPA a router hash: catalogo, scheda, borsa, checkout, B2B.
   ============================================================ */
(function () {
  'use strict';

  var A = function (k) { return ASSETS[k] || ''; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var euro = function (n) { return n.toFixed(2).replace('.', ',') + ' €'; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- i mondi editoriali ---------- */
  var MONDI = [
    { id: 'Safari',     img: 'ed-fedora-oro', pos: '50% 22%', claim: 'Paglia, rafia, luce del deserto' },
    { id: 'Multicolor', img: 'ed-multicolor', pos: '50% 10%', claim: 'Bande di colore che si aprono a raggiera' },
    { id: 'Riviera',    img: 'ed-piscina',    pos: '50% 16%', claim: 'Il gesto estivo, tra costa e città' },
    { id: 'Classico',   img: 'ed-bucket-uomo',pos: '50% 14%', claim: 'Feltro, tweed, forme che restano' },
    { id: 'Ottico',     img: 'ed-bianco-blu', pos: '50% 12%', claim: 'Falde larghe, bianco assoluto' }
  ];
  var HERO = [
    { k: 'ed-palme',      pos: '50% 8%' },
    { k: 'ed-fedora-oro', pos: '50% 18%' },
    { k: 'ed-multicolor', pos: '50% 8%' },
    { k: 'ed-bianco-blu', pos: '50% 10%' }
  ];
  var CATS = ['Feltro', 'Paglia', 'Tessuto', 'Maglieria', 'Borse', 'Trolley'];
  var CATLABEL = { Trolley: 'Viaggio' };

  /* ============================================================
     STATO — borsa e preferiti (localStorage)
     ============================================================ */
  var store = {
    read: function (k, d) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
      catch (e) { return d; }
    },
    write: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var cart = store.read('tb_cart', []);
  var favs = store.read('tb_favs', []);
  var saveCart = function () { store.write('tb_cart', cart); paintCart(); };
  var saveFavs = function () { store.write('tb_favs', favs); };

  var CATORDER = { Feltro: 0, Paglia: 1, Tessuto: 2, Maglieria: 3, Borse: 4, Trolley: 5 };
  PRODUCTS.sort(function (a, b) { return CATORDER[a.cat] - CATORDER[b.cat]; });

  var product = function (id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  };
  var cartTotal = function () {
    return cart.reduce(function (s, l) {
      var p = product(l.id); return s + (p ? p.prezzo * l.q : 0);
    }, 0);
  };
  var cartCount = function () { return cart.reduce(function (s, l) { return s + l.q; }, 0); };

  function addToCart(id, taglia, q) {
    var key = id + '|' + taglia;
    var found = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].key === key) found = cart[i];
    if (found) found.q += q; else cart.push({ key: key, id: id, taglia: taglia, q: q });
    saveCart();
    toast('Aggiunto alla borsa');
    openCart();
  }

  /* ============================================================
     TOAST
     ============================================================ */
  var toastT;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }

  /* ============================================================
     BORSA — drawer
     ============================================================ */
  function openCart() {
    $('#drawer').classList.add('open'); $('#scrim').classList.add('on');
    document.body.classList.add('cart-open');
  }
  function closeCart() {
    $('#drawer').classList.remove('open'); $('#scrim').classList.remove('on');
    document.body.classList.remove('cart-open');
  }

  function paintCart() {
    var n = cartCount(), badge = $('#bagN');
    badge.textContent = n; badge.hidden = n === 0;

    var body = $('#cartBody'), foot = $('#cartFoot');
    if (!cart.length) {
      body.innerHTML = '<div style="padding:64px 0;text-align:center">'
        + '<p class="lede" style="margin-bottom:18px">La borsa è vuota.</p>'
        + '<a href="#/collezioni" class="ulink" data-close-cart>Scopri le collezioni</a></div>';
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    body.innerHTML = cart.map(function (l) {
      var p = product(l.id); if (!p) return '';
      return '<div class="li">'
        + '<a class="li__img" href="#/prodotto/' + p.id + '" data-close-cart><img src="' + p.img + '" alt=""></a>'
        + '<div class="li__d">'
        + '<div class="li__top"><a class="li__nm" href="#/prodotto/' + p.id + '" data-close-cart>' + esc(p.nome) + '</a>'
        + '<span class="li__nm">' + euro(p.prezzo * l.q) + '</span></div>'
        + '<span class="li__meta">' + esc(p.materiale) + ' — Taglia ' + esc(l.taglia) + '</span>'
        + '<div class="li__ctr">'
        + '<span class="li__q"><button data-q="-1" data-k="' + l.key + '" aria-label="Riduci">–</button>'
        + '<span>' + l.q + '</span>'
        + '<button data-q="1" data-k="' + l.key + '" aria-label="Aumenta">+</button></span>'
        + '<button class="li__rm" data-rm="' + l.key + '">Rimuovi</button>'
        + '</div></div></div>';
    }).join('');
    $('#cartTot').textContent = euro(cartTotal());
  }

  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-q]');
    if (q) {
      var k = q.getAttribute('data-k'), d = +q.getAttribute('data-q');
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].key === k) {
          cart[i].q += d;
          if (cart[i].q < 1) cart.splice(i, 1);
          break;
        }
      }
      saveCart(); if (location.hash.indexOf('/checkout') > -1) render();
      return;
    }
    var rm = e.target.closest('[data-rm]');
    if (rm) {
      cart = cart.filter(function (l) { return l.key !== rm.getAttribute('data-rm'); });
      saveCart(); if (location.hash.indexOf('/checkout') > -1) render();
      return;
    }
    if (e.target.closest('[data-close-cart]')) closeCart();

    var fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault();
      var id = fav.getAttribute('data-fav');
      if (favs.indexOf(id) > -1) { favs = favs.filter(function (f) { return f !== id; }); fav.classList.remove('on'); }
      else { favs.push(id); fav.classList.add('on'); toast('Salvato nei preferiti'); }
      saveFavs();
      return;
    }
    var quick = e.target.closest('[data-quick]');
    if (quick) {
      e.preventDefault();
      var pid = quick.getAttribute('data-quick');
      var pr = product(pid);
      if (pr) addToCart(pid, pr.taglie[Math.min(2, pr.taglie.length - 1)], 1);
    }
  });

  /* ============================================================
     COMPONENTI
     ============================================================ */
  function cardHTML(p) {
    var on = favs.indexOf(p.id) > -1 ? ' on' : '';
    return '<article class="card rv">'
      + '<a href="#/prodotto/' + p.id + '" class="card__media">'
      + '<img src="' + p.img + '" alt="' + esc(p.nome) + '" loading="lazy">'
      + '</a>'
      + '<button class="card__fav' + on + '" data-fav="' + p.id + '" aria-label="Preferiti">'
      + '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z"/></svg>'
      + '</button>'
      + '<button class="card__quick" data-quick="' + p.id + '">Aggiungi alla borsa</button>'
      + '<a href="#/prodotto/' + p.id + '" class="card__info">'
      + '<span class="card__nm">' + esc(p.nome) + '</span>'
      + '<span class="card__mt">' + esc(p.materiale) + '</span>'
      + '<span class="card__pr">' + euro(p.prezzo) + '</span>'
      + '</a></article>';
  }

  function sectionHead(eyebrow, title, link, linkLabel) {
    return '<div class="wrap max rv" style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:clamp(24px,3vw,44px)">'
      + '<div><span class="eyebrow">' + eyebrow + '</span>'
      + '<h2 class="display d2" style="margin-top:.12em">' + title + '</h2></div>'
      + (link ? '<a href="' + link + '" class="ulink">' + linkLabel + '</a>' : '')
      + '</div>';
  }

  /* ============================================================
     VIEW — HOME
     ============================================================ */
  function viewHome() {
    var novita = PRODUCTS.filter(function (p) { return p.cat === 'Feltro' || p.cat === 'Paglia'; }).slice(0, 8);

    return ''
      /* HERO */
      + '<section class="hero" id="hero">'
      + '<div class="hero__media">'
      + HERO.map(function (h, i) {
          return '<figure class="' + (i === 0 ? 'on' : '') + '">'
            + '<img src="' + A(h.k) + '" alt="" style="--pos:' + h.pos + '"></figure>';
        }).join('')
      + '</div>'
      + '<div class="hero__in wrap max">'
      + '<span class="eyebrow hero__kicker" style="color:rgba(244,241,236,.8)">Massa Fermana — Marche — dal 1967</span>'
      + '<h1 class="display d1">Performing <span class="it">hat</span></h1>'
      + '<div class="hero__cta">'
      + '<a href="#/collezioni" class="btn" style="background:var(--bone);color:var(--ink);border-color:var(--bone)">Scopri le collezioni</a>'
      + '<a href="#/jackson" class="btn ghost" style="color:var(--bone);border-color:rgba(244,241,236,.6)">Jackson — Area B2B</a>'
      + '</div></div>'
      + '<div class="hero__dots">' + HERO.map(function (_, i) {
          return '<button data-hero="' + i + '" class="' + (i === 0 ? 'on' : '') + '" aria-label="Immagine ' + (i + 1) + '"></button>';
        }).join('') + '</div>'
      + '</section>'

      /* MANIFESTO */
      + '<section class="sect wrap max">'
      + '<div class="manifesto">'
      + '<div class="rv"><span class="eyebrow">La maison</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .3em">Dove il grano<br>diventava <span class="it">intreccio</span>.</h2>'
      + '<a href="#/maison" class="ulink">La nostra storia</a></div>'
      + '<div class="rv"><p class="lede">Una famiglia, un percorso imprenditoriale nel segno costante di scelte coraggiose e lungimiranti.</p>'
      + '<div class="manifesto__cols">'
      + '<p>Grazie a questo spirito l\'azienda si è saputa evolvere, trasformando il laboratorio artigianale delle origini in una realtà che compete su scala globale: la tradizione manifatturiera del territorio, unita a una filosofia improntata all\'innovazione.</p>'
      + '<p>Una crescita costante che non ha mai perso di vista l\'obiettivo principe: produrre cappelli e accessori adatti non solo alla testa delle persone, ma soprattutto al loro stile di vita.</p>'
      + '</div></div></div></section>'

      /* MONDI */
      + '<section class="sect" style="padding-top:0">'
      + sectionHead('Le collezioni', 'I mondi', '#/collezioni', 'Vedi tutto')
      + '<div class="mondi">'
      + MONDI.map(function (m) {
          return '<a href="#/collezioni?linea=' + m.id + '"><div class="mondo">'
            + '<img class="mondo__img" src="' + A(m.img) + '" alt="' + m.id + '" loading="lazy" style="--pos:' + m.pos + '">'
            + '<div class="mondo__t"><strong>' + m.id + '</strong><span>' + m.claim + '</span></div>'
            + '</div></a>';
        }).join('')
      + '</div></section>'

      /* NOVITÀ */
      + '<section class="sect" style="padding-top:0">'
      + sectionHead('Selezione', 'Nuovi arrivi', '#/collezioni', 'Tutto il catalogo')
      + '<div class="wrap max"><div class="row">' + novita.map(cardHTML).join('') + '</div></div>'
      + '</section>'

      /* SAVOIR-FAIRE */
      + '<section class="dark">'
      + '<div class="wrap max" style="padding-block:clamp(56px,8vw,110px)">'
      + '<div class="rv" style="max-width:60ch"><span class="eyebrow">Savoir-faire</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .3em">Il distretto<br>del cappello.</h2>'
      + '<p class="prose" style="color:rgba(244,241,236,.76);max-width:56ch">Massa Fermana, Montappone, Monte Vidon Corrado e Falerone. '
      + 'Una tradizione che risale al XVIII secolo, quando dalla coltivazione del grano nasceva la paglia da intrecciare.</p>'
      + '<a href="#/savoir-faire" class="ulink" style="margin-top:8px">Entra in atelier</a></div>'
      + '</div>'
      + '<div class="sf">'
      + [['at-intreccio', 'L\'intreccio'], ['at-forme', 'Le forme in legno'], ['at-vapore', 'La conformatura']]
          .map(function (x) {
            return '<figure class="rv"><img src="' + A(x[0]) + '" alt="' + x[1] + '" loading="lazy">'
              + '<figcaption>' + x[1] + '</figcaption></figure>';
          }).join('')
      + '</div>'
      + '<div class="stats">'
      + [['1967', 'Anno di fondazione'], ['XVIII', 'Secolo della tradizione'],
         ['4', 'Comuni del distretto'], ['60+', 'Mercati nel mondo']]
          .map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('')
      + '</div></section>'

      /* SPLIT */
      + '<section class="sect" style="padding-bottom:0">'
      + sectionHead('Guardaroba', 'Donna &amp; Uomo', '', '')
      + '<div class="split">'
      + '<a href="#/collezioni?linea=Ottico"><img src="' + A('ed-fianco') + '" alt="Donna" loading="lazy" style="--pos:50% 22%">'
      + '<span class="split__c"><span class="eyebrow" style="color:rgba(244,241,236,.8)">Collezione</span>'
      + '<span class="display d3">Donna</span><span class="ulink">Scopri</span></span></a>'
      + '<a href="#/collezioni?linea=Classico"><img src="' + A('ed-check-uomo') + '" alt="Uomo" loading="lazy" style="--pos:50% 16%">'
      + '<span class="split__c"><span class="eyebrow" style="color:rgba(244,241,236,.8)">Collezione</span>'
      + '<span class="display d3">Uomo</span><span class="ulink">Scopri</span></span></a>'
      + '</div></section>'

      /* LICENZE */
      + '<section class="sect">'
      + '<div class="wrap max center rv" style="margin-bottom:clamp(22px,3vw,40px)">'
      + '<span class="eyebrow">Licenze e collaborazioni</span>'
      + '<h2 class="display d3" style="margin-top:.16em">Marchi che scelgono la nostra mano</h2></div>'
      + '<div class="wrap max"><div class="lic rv">'
      + '<div><img src="' + A('logo-byblos') + '" alt="Byblos"></div>'
      + '<div><img src="' + A('logo-roberta') + '" alt="Roberta di Camerino"></div>'
      + '<div><img src="' + A('logo-navigare') + '" alt="Navigare"></div>'
      + '<div><img src="' + A('logo-tirabasso') + '" alt="Tirabasso"></div>'
      + '</div></div></section>'

      /* JACKSON */
      + jacksonBanner()

      /* NEWSLETTER */
      + '<section class="sect wrap max">'
      + '<div class="nl rv"><span class="eyebrow">Newsletter</span>'
      + '<h2 class="display d3">Le collezioni, in anteprima.</h2>'
      + '<form data-news><input type="email" required placeholder="La tua email" aria-label="Email">'
      + '<button type="submit">Iscriviti</button></form>'
      + '<p class="small" style="margin:0">Iscrivendoti accetti la privacy policy. Niente spam, solo collezioni.</p>'
      + '</div></section>';
  }

  function jacksonBanner() {
    return '<section class="jack">'
      + '<div class="jack__bg"><img src="' + A('at-magazzino') + '" alt="" loading="lazy"></div>'
      + '<div class="jack__in wrap max rv">'
      + '<span class="eyebrow" style="color:rgba(244,241,236,.7)">Area professionale</span>'
      + '<h2 class="jack__logo">Jack<em>son</em></h2>'
      + '<p class="prose" style="color:rgba(244,241,236,.78);max-width:48ch;margin:0">'
      + 'Il portale dedicato a rivenditori, buyer e partner della distribuzione: listini riservati, '
      + 'disponibilità in tempo reale, ordini e riassortimenti.</p>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap">'
      + '<a href="#/jackson" class="btn">Accedi a Jackson</a>'
      + '<a href="#/jackson" class="btn ghost">Diventa rivenditore</a>'
      + '</div></div></section>';
  }

  /* ============================================================
     VIEW — COLLEZIONI (PLP)
     ============================================================ */
  function viewPLP(qs) {
    var cat = qs.get('cat') || '';
    var linea = qs.get('linea') || '';
    var sort = qs.get('sort') || '';

    var list = PRODUCTS.filter(function (p) {
      return (!cat || p.cat === cat) && (!linea || p.linea === linea);
    });
    if (sort === 'asc') list = list.slice().sort(function (a, b) { return a.prezzo - b.prezzo; });
    if (sort === 'desc') list = list.slice().sort(function (a, b) { return b.prezzo - a.prezzo; });

    var titolo = linea || (cat ? (CATLABEL[cat] || cat) : 'Tutte le collezioni');
    var base = function (o) {
      var p = new URLSearchParams();
      var c = o.cat !== undefined ? o.cat : cat;
      var l = o.linea !== undefined ? o.linea : linea;
      var s = o.sort !== undefined ? o.sort : sort;
      if (c) p.set('cat', c); if (l) p.set('linea', l); if (s) p.set('sort', s);
      var str = p.toString();
      return '#/collezioni' + (str ? '?' + str : '');
    };

    return '<div class="wrap max plp__head">'
      + '<span class="eyebrow">Collezioni — ' + list.length + ' pezzi</span>'
      + '<h1 class="display d2" style="margin-top:.1em">' + esc(titolo) + '</h1>'
      + '</div>'
      + '<div class="wrap max"><div class="filters">'
      + '<a class="chip' + (!cat && !linea ? ' on' : '') + '" href="' + base({ cat: '', linea: '' }) + '">Tutto</a>'
      + '<span class="filters__div"></span><span class="filters__lab">Materia</span>'
      + CATS.map(function (c) {
          return '<a class="chip' + (cat === c ? ' on' : '') + '" href="' + base({ cat: cat === c ? '' : c, linea: '' }) + '">'
            + (CATLABEL[c] || c) + '</a>';
        }).join('')
      + '<span class="filters__div"></span><span class="filters__lab">Mondi</span>'
      + MONDI.map(function (m) {
          return '<a class="chip' + (linea === m.id ? ' on' : '') + '" href="' + base({ linea: linea === m.id ? '' : m.id, cat: '' }) + '">'
            + m.id + '</a>';
        }).join('')
      + '<span class="filters__sp"><select id="sortSel" aria-label="Ordina">'
      + '<option value=""' + (!sort ? ' selected' : '') + '>Ordina</option>'
      + '<option value="asc"' + (sort === 'asc' ? ' selected' : '') + '>Prezzo crescente</option>'
      + '<option value="desc"' + (sort === 'desc' ? ' selected' : '') + '>Prezzo decrescente</option>'
      + '</select></span>'
      + '</div>'
      + (list.length
          ? '<div class="grid">' + list.map(cardHTML).join('') + '</div>'
          : '<div class="empty"><p class="lede">Nessun pezzo con questi filtri.</p>'
            + '<a href="#/collezioni" class="ulink">Rimuovi i filtri</a></div>')
      + '</div>';
  }

  /* ============================================================
     VIEW — PRODOTTO (PDP)
     ============================================================ */
  function viewPDP(id) {
    var p = product(id);
    if (!p) return '<div class="wrap max empty"><p class="lede">Pezzo non trovato.</p>'
      + '<a href="#/collezioni" class="ulink">Torna alle collezioni</a></div>';

    var simili = PRODUCTS.filter(function (x) { return x.linea === p.linea && x.id !== p.id; }).slice(0, 4);
    if (simili.length < 4) {
      simili = simili.concat(PRODUCTS.filter(function (x) {
        return x.cat === p.cat && x.id !== p.id && simili.indexOf(x) < 0;
      })).slice(0, 4);
    }
    var isFav = favs.indexOf(p.id) > -1;

    return '<div class="wrap max">'
      + '<nav class="small" style="padding-top:22px">'
      + '<a href="#/collezioni">Collezioni</a> / <a href="#/collezioni?cat=' + p.cat + '">'
      + (CATLABEL[p.cat] || p.cat) + '</a> / <span>' + esc(p.nome) + '</span></nav>'

      + '<div class="pdp">'
      + '<div><div class="pdp__media"><img id="pdpImg" src="' + p.img + '" alt="' + esc(p.nome) + '"></div></div>'

      + '<div class="pdp__col">'
      + '<span class="eyebrow">Linea ' + esc(p.linea) + '</span>'
      + '<h1 class="display d3">' + esc(p.nome) + '</h1>'
      + '<p class="small" style="margin:0">' + esc(p.materiale) + '</p>'
      + '<p class="pdp__price">' + euro(p.prezzo) + '</p>'
      + '<p class="small" style="margin:0 0 18px">IVA inclusa — spedizione gratuita da 120 €</p>'

      + '<span class="eyebrow">Taglia' + (p.taglie.length > 1 ? ' — circonferenza in cm' : '') + '</span>'
      + '<div class="sizes" id="sizes">'
      + p.taglie.map(function (t, i) {
          return '<button class="size' + (i === Math.min(2, p.taglie.length - 1) ? ' on' : '') + '" data-size="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('')
      + '</div>'

      + '<div style="display:flex;gap:12px;align-items:stretch;margin:20px 0 8px;flex-wrap:wrap">'
      + '<span class="qty"><button id="qMinus" aria-label="Riduci">–</button><span id="qVal">1</span>'
      + '<button id="qPlus" aria-label="Aumenta">+</button></span>'
      + '<button class="btn" id="addBtn" style="flex:1;min-width:200px">Aggiungi alla borsa</button>'
      + '</div>'
      + '<button class="ulink" data-fav="' + p.id + '" style="border:0;padding:0;margin-top:6px">'
      + (isFav ? '♥ Nei preferiti' : '♡ Aggiungi ai preferiti') + '</button>'

      + '<div class="notice"><span>✓</span><div><b>Made in Italy.</b> Prodotto nel distretto del cappello, '
      + 'tra Massa Fermana e Montappone.</div></div>'

      + '<div style="margin-top:26px">'
      + acc('Descrizione', esc(p.nota || 'Pezzo della collezione Tirabasso.') + ' Referenza di catalogo: ' + esc(p.ref) + '.')
      + acc('Materiali e cura', 'Composizione: ' + esc(p.materiale) + '. Conservare il cappello appoggiato sulla calotta o su forma dedicata, '
          + 'lontano da fonti di calore. Spazzolare in senso orario con spazzola morbida.')
      + acc('Spedizione e resi', 'Spedizione tracciata in 2-4 giorni lavorativi in Italia, 3-7 in Europa. '
          + 'Gratuita sopra 120 €. Reso esteso entro 30 giorni.')
      + acc('Guida alle taglie', 'Misura la circonferenza della testa a metà fronte, sopra le orecchie. '
          + 'La misura in centimetri corrisponde alla taglia: 57 cm = taglia 57. Nel dubbio, scegli la taglia superiore.')
      + '</div></div></div>'

      + (simili.length ? '<section class="sect" style="padding-top:clamp(30px,4vw,60px)">'
          + '<span class="eyebrow">Continua a esplorare</span>'
          + '<h2 class="display d3" style="margin:.14em 0 clamp(20px,2.6vw,36px)">Dalla stessa linea</h2>'
          + '<div class="row">' + simili.map(cardHTML).join('') + '</div></section>' : '')
      + '</div>';
  }

  function acc(title, body) {
    return '<div class="acc"><button class="acc__h">' + title + '<i>+</i></button>'
      + '<div class="acc__b"><div><p>' + body + '</p></div></div></div>';
  }

  /* ============================================================
     VIEW — MAISON
     ============================================================ */
  function viewMaison() {
    return '<section class="page-hero"><img src="' + A('at-forme') + '" alt="" style="--pos:50% 42%">'
      + '<div class="page-hero__c wrap max">'
      + '<span class="eyebrow" style="color:rgba(244,241,236,.8)">La maison</span>'
      + '<h1 class="display d1">Tirabasso</h1></div></section>'

      + '<section class="sect wrap max"><div class="two">'
      + '<div class="rv"><span class="eyebrow">1967 — oggi</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .34em">Una famiglia,<br>un <span class="it">percorso</span>.</h2>'
      + '<div class="prose">'
      + '<p>Tirabasso è una famiglia e un percorso imprenditoriale nel segno costante di una forte leadership, '
      + 'che da sempre punta all\'innovazione con scelte coraggiose e lungimiranti.</p>'
      + '<p>Grazie a questo spirito l\'azienda si è saputa evolvere con successo, trasformando il laboratorio '
      + 'artigianale delle origini in un\'industria sempre più proiettata a competere su scala globale: '
      + 'integrando la tradizione manifatturiera del proprio territorio con una filosofia aziendale improntata all\'innovazione.</p>'
      + '<p>Una crescita costante che non ha mai perso di vista l\'obiettivo principe: produrre cappelli e accessori '
      + 'di moda adatti non solo alla testa delle persone, ma anche e soprattutto al loro stile di vita.</p>'
      + '</div></div>'
      + '<div class="rv"><img src="' + A('ed-hood') + '" alt="" loading="lazy" style="object-position:50% 22%"></div>'
      + '</div></section>'

      + '<section class="dark"><div class="wrap max" style="padding-block:clamp(56px,8vw,110px)">'
      + '<div class="two">'
      + '<div class="rv"><img src="' + A('at-magazzino') + '" alt="" loading="lazy"></div>'
      + '<div class="rv"><span class="eyebrow">Il territorio</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .34em">Il distretto<br>del cappello.</h2>'
      + '<div class="prose">'
      + '<p>Ci troviamo nelle Marche, in provincia di Fermo. Massa Fermana, Montappone, Monte Vidon Corrado '
      + 'e Falerone compongono il distretto del cappello.</p>'
      + '<p>La tradizione della produzione a mano risale al XVIII secolo e deriva dalla coltivazione del grano, '
      + 'che veniva poi utilizzato per intrecciare i cappelli. Questa lavorazione ha permesso al distretto di '
      + 'raggiungere un ruolo predominante prima in Italia e poi nel panorama europeo.</p>'
      + '</div></div></div></div></section>'

      + '<section class="sect wrap max">'
      + '<div class="rv center" style="max-width:60ch;margin-inline:auto">'
      + '<span class="eyebrow">Identità e reputazione</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .34em">Preservare una <span class="it">tradizione</span>.</h2>'
      + '<div class="prose" style="margin-inline:auto">'
      + '<p>La grande produttività del territorio non ha solamente un carattere economico, ma soprattutto '
      + 'identitario e comunicativo. L\'obiettivo è preservare una tradizione antica che altrimenti rischierebbe '
      + 'di scomparire: la storia di un territorio e di un popolo, oltre che una fonte di lavoro.</p>'
      + '<p>L\'identità è un processo lento, che si costruisce nel tempo. Queste tappe hanno reso il distretto '
      + 'una realtà dotata di grande slancio produttivo, capace di conservare le proprie tradizioni e insieme '
      + 'di adattarsi con flessibilità al mondo globalizzato.</p>'
      + '</div></div></section>'

      + '<div class="sf">'
      + [['at-intreccio', 'Intreccio a mano'], ['at-feltro', 'Modellatura del feltro'], ['at-macro', 'Cucitura']]
          .map(function (x) {
            return '<figure class="rv"><img src="' + A(x[0]) + '" alt="' + x[1] + '" loading="lazy">'
              + '<figcaption>' + x[1] + '</figcaption></figure>';
          }).join('')
      + '</div>'
      + jacksonBanner();
  }

  /* ============================================================
     VIEW — SAVOIR-FAIRE
     ============================================================ */
  function viewSavoir() {
    var steps = [
      ['01', 'La materia', 'Feltro di lana e di lapin, paglia, rafia, carta ritorta, lino e tweed. La scelta della materia decide tutto il resto.', 'at-feltro'],
      ['02', 'L\'intreccio', 'La treccia nasce a mano o al telaio, poi viene cucita a spirale fino a formare la calotta.', 'at-intreccio'],
      ['03', 'La conformatura', 'Vapore e forme di legno: il cappello prende la sua testa. Ogni forma è un modello, ogni modello una misura.', 'at-vapore'],
      ['04', 'La finitura', 'Nastri gros grain, cinturini, cuciture a mano. È il dettaglio che distingue un cappello da un altro.', 'at-mani']
    ];
    return '<section class="page-hero"><img src="' + A('at-telaio') + '" alt="" style="--pos:50% 46%">'
      + '<div class="page-hero__c wrap max">'
      + '<span class="eyebrow" style="color:rgba(244,241,236,.8)">Savoir-faire</span>'
      + '<h1 class="display d1">La mano</h1></div></section>'

      + '<section class="sect wrap max">'
      + '<div class="rv" style="max-width:62ch">'
      + '<p class="lede">Quattro gesti, ripetuti da generazioni. Tra Massa Fermana e Montappone, '
      + 'il cappello resta una cosa che si fa con le mani.</p></div>'
      + '<div style="margin-top:clamp(34px,5vw,70px);display:grid;gap:2px">'
      + steps.map(function (s) {
          return '<div class="rv" style="display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--line)">'
            + '<div class="two" style="align-items:center;padding-block:clamp(24px,3.4vw,50px)">'
            + '<div><span class="eyebrow">' + s[0] + '</span>'
            + '<h3 class="display d3" style="margin:.1em 0 .3em">' + s[1] + '</h3>'
            + '<p class="prose" style="margin:0">' + s[2] + '</p></div>'
            + '<img src="' + A(s[3]) + '" alt="' + s[1] + '" loading="lazy" style="aspect-ratio:16/11;filter:grayscale(1)">'
            + '</div></div>';
        }).join('')
      + '</div></section>'

      + '<section class="dark"><div class="stats" style="background:rgba(244,241,236,.16)">'
      + [['100%', 'Made in Italy'], ['4', 'Comuni del distretto'], ['XVIII', 'Secolo di origine'], ['1967', 'Dalla fondazione']]
          .map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('')
      + '</div></section>'

      + '<section class="sect wrap max center">'
      + '<div class="rv" style="max-width:56ch;margin-inline:auto">'
      + '<span class="eyebrow">Su misura</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .3em">Un cappello<br>per la tua <span class="it">testa</span>.</h2>'
      + '<p class="prose" style="margin-inline:auto">Produciamo per le maison più esigenti e per chi cerca un pezzo unico. '
      + 'Raccontaci il progetto: forma, materia, quantità.</p>'
      + '<a href="#/contatti" class="btn" style="margin-top:12px">Scrivici</a></div></section>';
  }

  /* ============================================================
     VIEW — JACKSON (B2B)
     ============================================================ */
  function viewJackson() {
    var vantaggi = [
      ['Listini riservati', 'Prezzi wholesale dedicati per fascia di partner, con condizioni personalizzate.'],
      ['Disponibilità live', 'Stock aggiornato in tempo reale, per taglia e colore. Niente ordini al buio.'],
      ['Ordini e riassortimenti', 'Carrello B2B, ordini ricorrenti e riassortimento rapido di stagione.'],
      ['Materiali di vendita', 'Cartelle colore, schede tecniche, immagini campagna e listini in PDF.']
    ];
    return '<section class="page-hero"><img src="' + A('at-magazzino') + '" alt="" style="filter:grayscale(1)">'
      + '<div class="page-hero__c wrap max">'
      + '<span class="eyebrow" style="color:rgba(244,241,236,.8)">Area professionale</span>'
      + '<h1 class="display d1">Jack<span class="it">son</span></h1>'
      + '<p class="lede" style="color:rgba(244,241,236,.86);max-width:44ch;margin-top:.4em">'
      + 'Il portale B2B della maison, per rivenditori, buyer e partner della distribuzione.</p>'
      + '</div></section>'

      + '<section class="sect wrap max">'
      + '<div class="two" style="align-items:start">'
      + '<div class="rv"><span class="eyebrow">Il progetto</span>'
      + '<h2 class="display d2" style="margin:.16em 0 .34em">Un ingresso<br>separato.</h2>'
      + '<div class="prose">'
      + '<p>Jackson è la piattaforma dedicata al business: vive su un dominio proprio, con la sua identità '
      + 'e le sue regole d\'accesso. Il sito della maison resta il racconto pubblico del marchio; Jackson è '
      + 'lo strumento di lavoro quotidiano di chi ci rivende.</p>'
      + '<p>L\'accesso è riservato ai partner accreditati. Se hai già le credenziali entra dal portale, '
      + 'altrimenti richiedi l\'accreditamento: rispondiamo entro due giorni lavorativi.</p>'
      + '</div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">'
      + '<a href="https://b2b.tirabasso.com" target="_blank" rel="noopener" class="btn">Vai al portale Jackson ↗</a>'
      + '</div>'
      + '<p class="small" style="margin-top:14px">Il portale Jackson è in sviluppo: il collegamento punta '
      + 'oggi all\'area ingrosso esistente.</p>'
      + '</div>'

      + '<div class="rv card-box">'
      + '<span class="eyebrow">Richiesta accreditamento</span>'
      + '<h3 class="display d3" style="margin:.14em 0 .5em">Diventa rivenditore</h3>'
      + '<form data-b2b novalidate>'
      + '<div class="f2">'
      + field('Ragione sociale', 'azienda', 'text', true)
      + field('P. IVA / VAT', 'piva', 'text', true)
      + '</div>'
      + '<div class="f2">'
      + field('Referente', 'ref', 'text', true)
      + field('Email', 'email', 'email', true)
      + '</div>'
      + '<div class="f2">'
      + field('Paese', 'paese', 'text', true)
      + selectField('Tipo di attività', 'tipo', ['Negozio multimarca', 'Catena retail', 'Distributore', 'E-commerce', 'Altro'])
      + '</div>'
      + '<div class="field"><label for="note">Note</label>'
      + '<textarea id="note" name="note" rows="3" placeholder="Raccontaci la tua attività"></textarea></div>'
      + '<button class="btn block" type="submit">Invia la richiesta</button>'
      + '<p class="small" style="margin-top:12px">Inviando accetti il trattamento dei dati per finalità commerciali.</p>'
      + '</form></div>'
      + '</div></section>'

      + '<section class="dark"><div class="wrap max" style="padding-block:clamp(50px,7vw,96px)">'
      + '<span class="eyebrow">Cosa trovi dentro</span>'
      + '<h2 class="display d2" style="margin:.16em 0 clamp(26px,3.4vw,50px)">Gli strumenti</h2>'
      + '<div style="display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));background:rgba(244,241,236,.16)">'
      + vantaggi.map(function (v, i) {
          return '<div class="rv" style="background:var(--ink);padding:clamp(24px,3vw,40px)">'
            + '<span class="eyebrow">0' + (i + 1) + '</span>'
            + '<h3 class="display d3" style="font-size:clamp(21px,2vw,28px);margin:.2em 0 .35em">' + v[0] + '</h3>'
            + '<p class="prose" style="font-size:13.5px;margin:0">' + v[1] + '</p></div>';
        }).join('')
      + '</div></div></section>';
  }

  function field(label, name, type, req) {
    return '<div class="field"><label for="' + name + '">' + label + '</label>'
      + '<input id="' + name + '" name="' + name + '" type="' + type + '"' + (req ? ' required' : '') + '>'
      + '<span class="msg"></span></div>';
  }
  function selectField(label, name, opts) {
    return '<div class="field"><label for="' + name + '">' + label + '</label>'
      + '<select id="' + name + '" name="' + name + '">'
      + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('')
      + '</select><span class="msg"></span></div>';
  }

  /* ============================================================
     VIEW — CHECKOUT
     ============================================================ */
  function viewCheckout() {
    if (!cart.length) {
      return '<div class="wrap max empty"><p class="lede">La borsa è vuota.</p>'
        + '<a href="#/collezioni" class="ulink">Scopri le collezioni</a></div>';
    }
    var sub = cartTotal();
    var spese = sub >= 120 ? 0 : 9.9;

    return '<div class="wrap max" style="padding-block:clamp(30px,4vw,56px)">'
      + '<span class="eyebrow">Checkout</span>'
      + '<h1 class="display d2" style="margin:.1em 0 clamp(24px,3vw,44px)">Il tuo ordine</h1>'
      + '<div class="two" style="align-items:start;gap:clamp(30px,4vw,70px)">'

      + '<form class="formbox" data-checkout novalidate>'
      + '<span class="eyebrow fsec">Contatto</span>'
      + field('Email', 'cemail', 'email', true)
      + '<span class="eyebrow fsec">Spedizione</span>'
      + '<div class="f2">' + field('Nome', 'nome', 'text', true) + field('Cognome', 'cognome', 'text', true) + '</div>'
      + field('Indirizzo', 'via', 'text', true)
      + '<div class="f2">' + field('Città', 'citta', 'text', true) + field('CAP', 'cap', 'text', true) + '</div>'
      + '<div class="f2">'
      + selectField('Paese', 'paese', ['Italia', 'Francia', 'Germania', 'Spagna', 'Regno Unito', 'Stati Uniti', 'Giappone'])
      + field('Telefono', 'tel', 'text', false) + '</div>'
      + '<span class="eyebrow fsec">Pagamento</span>'
      + field('Numero carta', 'carta', 'text', true)
      + '<div class="f2">' + field('Scadenza (MM/AA)', 'scad', 'text', true) + field('CVC', 'cvc', 'text', true) + '</div>'
      + '<button class="btn block" type="submit" style="margin-top:10px">Paga ' + euro(sub + spese) + '</button>'
      + '<p class="small" style="margin-top:12px">Demo dimostrativa: nessun pagamento viene realmente elaborato.</p>'
      + '</form>'

      + '<div class="card-box">'
      + '<span class="eyebrow">Riepilogo</span><div style="height:10px"></div>'
      + cart.map(function (l) {
          var p = product(l.id); if (!p) return '';
          return '<div class="li" style="grid-template-columns:64px 1fr">'
            + '<span class="li__img"><img src="' + p.img + '" alt=""></span>'
            + '<span class="li__d"><span class="li__top"><span class="li__nm">' + esc(p.nome) + '</span>'
            + '<span class="li__nm">' + euro(p.prezzo * l.q) + '</span></span>'
            + '<span class="li__meta">Taglia ' + esc(l.taglia) + ' — Quantità ' + l.q + '</span>'
            + '<span class="li__ctr"><span class="li__q">'
            + '<button data-q="-1" data-k="' + l.key + '">–</button><span>' + l.q + '</span>'
            + '<button data-q="1" data-k="' + l.key + '">+</button></span>'
            + '<button class="li__rm" data-rm="' + l.key + '">Rimuovi</button></span></span></div>';
        }).join('')
      + '<div style="display:grid;gap:8px;padding-top:18px">'
      + '<div class="tot"><span>Subtotale</span><b>' + euro(sub) + '</b></div>'
      + '<div class="tot"><span>Spedizione</span><b>' + (spese ? euro(spese) : 'Gratuita') + '</b></div>'
      + '<div class="tot" style="font-size:17px;padding-top:10px;border-top:1px solid var(--line)">'
      + '<span>Totale</span><b>' + euro(sub + spese) + '</b></div>'
      + '</div>'
      + (spese ? '<p class="small" style="margin-top:12px">Aggiungi ' + euro(120 - sub)
          + ' per la spedizione gratuita.</p>' : '')
      + '</div></div></div>';
  }

  function viewOrdine() {
    var n = 'TB' + String(Math.floor(Math.random() * 90000) + 10000);
    return '<div class="wrap max ok">'
      + '<div class="ok__mark">✓</div>'
      + '<span class="eyebrow">Ordine confermato</span>'
      + '<h1 class="display d2">Grazie.</h1>'
      + '<p class="prose">Il tuo ordine <b>' + n + '</b> è stato registrato. '
      + 'Riceverai una email di conferma con il tracking della spedizione.</p>'
      + '<a href="#/collezioni" class="btn">Continua a esplorare</a></div>';
  }

  /* ============================================================
     VIEW — CONTATTI
     ============================================================ */
  function viewContatti() {
    return '<div class="wrap max" style="padding-block:clamp(40px,5vw,80px)">'
      + '<span class="eyebrow">Contatti</span>'
      + '<h1 class="display d2" style="margin:.1em 0 clamp(26px,3.4vw,50px)">Parliamone</h1>'
      + '<div class="two" style="align-items:start">'
      + '<div class="rv">'
      + '<div style="display:grid;gap:26px">'
      + block('Sede e stabilimento', 'Tirabasso Serafino srl<br>Massa Fermana (FM) — Marche, Italia')
      + block('Clienti privati', 'shop@tirabasso.com<br>+39 0734 000000')
      + block('Rivenditori e buyer', 'Area Jackson — <a class="ulink" href="#/jackson">richiedi l\'accreditamento</a>')
      + block('Stampa e collaborazioni', 'press@tirabasso.com')
      + '</div></div>'
      + '<div class="rv card-box">'
      + '<span class="eyebrow">Scrivici</span>'
      + '<h3 class="display d3" style="margin:.14em 0 .5em">Come possiamo aiutarti?</h3>'
      + '<form data-contact novalidate>'
      + '<div class="f2">' + field('Nome', 'cnome', 'text', true) + field('Email', 'cmail', 'email', true) + '</div>'
      + selectField('Motivo', 'motivo', ['Informazioni su un prodotto', 'Ordine e spedizione', 'Reso', 'Rivendita e B2B', 'Stampa', 'Altro'])
      + '<div class="field"><label for="msg">Messaggio</label>'
      + '<textarea id="msg" name="msg" rows="4" required></textarea><span class="msg"></span></div>'
      + '<button class="btn block" type="submit">Invia</button>'
      + '</form></div></div></div>';
  }
  function block(t, b) {
    return '<div><span class="eyebrow">' + t + '</span>'
      + '<p style="margin:.5em 0 0;font-size:15px">' + b + '</p></div>';
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var i = h.indexOf('?');
    return { path: i > -1 ? h.slice(0, i) : h, qs: new URLSearchParams(i > -1 ? h.slice(i + 1) : '') };
  }

  function render() {
    var r = parseHash(), path = r.path, view = $('#view'), html, over = false;

    if (path === '/' || path === '') { html = viewHome(); over = true; }
    else if (path === '/collezioni') html = viewPLP(r.qs);
    else if (path.indexOf('/prodotto/') === 0) html = viewPDP(path.split('/')[2]);
    else if (path === '/maison') { html = viewMaison(); over = true; }
    else if (path === '/savoir-faire') { html = viewSavoir(); over = true; }
    else if (path === '/jackson') { html = viewJackson(); over = true; }
    else if (path === '/checkout') html = viewCheckout();
    else if (path === '/ordine') html = viewOrdine();
    else if (path === '/contatti') html = viewContatti();
    else html = '<div class="wrap max empty"><p class="lede">Pagina non trovata.</p>'
      + '<a href="#/" class="ulink">Torna alla home</a></div>';

    view.innerHTML = html;

    // header trasparente sopra gli hero
    var hdr = $('#hdr');
    hdr.classList.toggle('over', over);
    if (over) onScroll();

    // nav attiva
    $$('.nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-r') === path
        || (path.indexOf('/prodotto/') === 0 && a.getAttribute('data-r') === '/collezioni'));
    });

    window.scrollTo(0, 0);
    closeCart();
    $('#mnav').classList.remove('open');
    bindView();
    observe();
  }

  /* ---------- header sopra hero ---------- */
  function onScroll() {
    var hdr = $('#hdr');
    if (!hdr.classList.contains('over') && !hdr.dataset.wasOver) return;
    var hero = $('#hero') || $('.page-hero');
    if (!hero) return;
    var limit = hero.offsetHeight - 80;
    if (window.scrollY > limit) { hdr.classList.remove('over'); hdr.dataset.wasOver = '1'; }
    else if (hdr.dataset.wasOver) { hdr.classList.add('over'); }
  }
  window.addEventListener('scroll', function () {
    var hdr = $('#hdr');
    if (hdr.classList.contains('over') || hdr.dataset.wasOver) onScroll();
  }, { passive: true });

  /* ---------- reveal ---------- */
  var io;
  function observe() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) { $$('.rv').forEach(function (e) { e.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .04 });
    $$('.rv').forEach(function (e) { io.observe(e); });
    // se qualcosa impedisce il reveal, nulla resta invisibile
    setTimeout(function () { $$('.rv').forEach(function (e) { e.classList.add('in'); }); }, 2500);
  }

  /* ============================================================
     BINDING per vista
     ============================================================ */
  function bindView() {
    /* HERO slideshow */
    var figs = $$('.hero__media figure'), dots = $$('[data-hero]');
    if (figs.length) {
      var idx = 0, timer;
      var go = function (i) {
        idx = (i + figs.length) % figs.length;
        figs.forEach(function (f, k) { f.classList.toggle('on', k === idx); });
        dots.forEach(function (d, k) { d.classList.toggle('on', k === idx); });
      };
      var loop = function () { clearInterval(timer); timer = setInterval(function () { go(idx + 1); }, 5200); };
      dots.forEach(function (d) {
        d.addEventListener('click', function () { go(+d.getAttribute('data-hero')); loop(); });
      });
      loop();
    }

    /* PLP — ordinamento */
    var sel = $('#sortSel');
    if (sel) {
      sel.addEventListener('change', function () {
        var r = parseHash();
        if (sel.value) r.qs.set('sort', sel.value); else r.qs.delete('sort');
        var s = r.qs.toString();
        location.hash = '#/collezioni' + (s ? '?' + s : '');
      });
    }

    /* PDP */
    var sizes = $('#sizes');
    if (sizes) {
      sizes.addEventListener('click', function (e) {
        var b = e.target.closest('.size');
        if (!b) return;
        $$('.size', sizes).forEach(function (s) { s.classList.remove('on'); });
        b.classList.add('on');
      });
    }
    var qv = $('#qVal');
    if (qv) {
      $('#qMinus').addEventListener('click', function () { qv.textContent = Math.max(1, +qv.textContent - 1); });
      $('#qPlus').addEventListener('click', function () { qv.textContent = Math.min(9, +qv.textContent + 1); });
    }
    var add = $('#addBtn');
    if (add) {
      add.addEventListener('click', function () {
        var id = parseHash().path.split('/')[2];
        var sz = $('.size.on');
        addToCart(id, sz ? sz.getAttribute('data-size') : 'Taglia unica', +$('#qVal').textContent);
      });
    }

    /* accordion */
    $$('.acc__h').forEach(function (h) {
      h.addEventListener('click', function () { h.parentNode.classList.toggle('open'); });
    });

    /* form */
    var news = $('[data-news]');
    if (news) news.addEventListener('submit', function (e) {
      e.preventDefault(); news.reset(); toast('Iscrizione registrata');
    });

    var b2b = $('[data-b2b]');
    if (b2b) b2b.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(b2b)) return;
      b2b.innerHTML = '<div style="padding:24px 0;text-align:center">'
        + '<div class="ok__mark" style="margin:0 auto 16px">✓</div>'
        + '<p class="lede" style="margin-bottom:6px">Richiesta inviata.</p>'
        + '<p class="small">Il nostro team commerciale ti risponde entro due giorni lavorativi.</p></div>';
    });

    var cont = $('[data-contact]');
    if (cont) cont.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(cont)) return;
      cont.innerHTML = '<div style="padding:24px 0;text-align:center">'
        + '<div class="ok__mark" style="margin:0 auto 16px">✓</div>'
        + '<p class="lede" style="margin-bottom:6px">Messaggio inviato.</p>'
        + '<p class="small">Ti rispondiamo il prima possibile.</p></div>';
    });

    var chk = $('[data-checkout]');
    if (chk) chk.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(chk)) return;
      cart = []; saveCart();
      location.hash = '#/ordine';
    });
  }

  function validate(form) {
    var ok = true;
    $$('input,select,textarea', form).forEach(function (el) {
      var f = el.closest('.field');
      if (!f) return;
      var msg = $('.msg', f);
      var bad = el.hasAttribute('required') && !el.value.trim();
      if (!bad && el.type === 'email' && el.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value)) bad = true;
      f.classList.toggle('err', bad);
      if (msg) msg.textContent = bad ? (el.type === 'email' && el.value ? 'Email non valida' : 'Campo obbligatorio') : '';
      if (bad && ok) { el.focus(); ok = false; }
    });
    return ok;
  }

  /* ============================================================
     RICERCA
     ============================================================ */
  function openSearch() {
    $('#search').classList.add('open');
    $('#mnav').classList.remove('open');
    setTimeout(function () { $('#sInput').focus(); }, 320);
  }
  function closeSearch() { $('#search').classList.remove('open'); }

  $('#sInput').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var res = $('#sRes');
    if (q.length < 2) { res.innerHTML = ''; return; }
    var hits = PRODUCTS.filter(function (p) {
      return (p.nome + ' ' + p.materiale + ' ' + p.linea + ' ' + p.cat + ' ' + p.ref).toLowerCase().indexOf(q) > -1;
    }).slice(0, 12);
    res.innerHTML = hits.length
      ? '<span class="eyebrow">' + hits.length + ' risultati</span><div class="row" style="margin-top:18px">'
        + hits.map(cardHTML).join('') + '</div>'
      : '<p class="lede">Nessun risultato per “' + esc(q) + '”.</p>';
    $$('.rv', res).forEach(function (e) { e.classList.add('in'); });
  });
  $('#sRes').addEventListener('click', function (e) {
    if (e.target.closest('a')) closeSearch();
  });

  /* ============================================================
     BOOT
     ============================================================ */
  $('#openCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#scrim').addEventListener('click', closeCart);
  $('#burger').addEventListener('click', function () { $('#mnav').classList.add('open'); });
  $('#closeM').addEventListener('click', function () { $('#mnav').classList.remove('open'); });
  $('#openSearch').addEventListener('click', openSearch);
  $('#openSearch2').addEventListener('click', openSearch);
  $('#closeS').addEventListener('click', closeSearch);
  $('#mnav').addEventListener('click', function (e) {
    if (e.target.closest('a')) $('#mnav').classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCart(); closeSearch(); $('#mnav').classList.remove('open'); }
  });

  window.addEventListener('hashchange', render);
  paintCart();
  render();
})();
