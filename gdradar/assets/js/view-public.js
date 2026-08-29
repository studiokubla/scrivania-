/* ============================================================
   GdRadar — pagine pubbliche: landing, Gioco etico, privacy
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util, UI = GD.ui;
  const { html, raw, icon } = U;

  /* ---------- illustrazione radar della hero ---------- */
  function heroArt() {
    const blips = [
      { a: -32, r: 0.30, t: 'utente', s: 11 }, { a: 58, r: 0.44, t: 'party', s: 12 },
      { a: 140, r: 0.36, t: 'utente', s: 9 }, { a: -110, r: 0.63, t: 'campagna', s: 13 },
      { a: 20, r: 0.72, t: 'utente', s: 9 }, { a: 96, r: 0.80, t: 'party', s: 10 },
      { a: -160, r: 0.62, t: 'utente', s: 8 }, { a: 168, r: 0.88, t: 'campagna', s: 10 },
      { a: -68, r: 0.90, t: 'utente', s: 8 }, { a: 4, r: 0.50, t: 'annuncio', s: 9 }
    ];
    const COL = { utente: 'var(--signal)', party: 'var(--amber)', campagna: 'var(--violet)', annuncio: 'var(--steel)' };
    const C = 200, R = 178;
    const pt = (b) => {
      const rad = ((b.a - 90) * Math.PI) / 180;
      return { x: C + Math.cos(rad) * R * b.r, y: C + Math.sin(rad) * R * b.r };
    };
    return html`<div class="hero-art">
      <div class="glow"></div>
      <svg viewBox="0 0 400 400" role="img" aria-label="Illustrazione: radar con persone, Party e Campagne intorno alla tua posizione">
        <defs>
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--signal)" stop-opacity=".20"/>
            <stop offset="100%" stop-color="var(--signal)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        ${[0.30, 0.44, 0.63, 0.80, 0.95].map((f) => html`<circle cx="200" cy="200" r="${(R * f).toFixed(1)}" class="ring-line"/>`)}
        <circle cx="200" cy="200" r="${R}" class="ring-line dashed"/>
        <line x1="200" y1="${200 - R}" x2="200" y2="${200 + R}" class="cross"/>
        <line x1="${200 - R}" y1="200" x2="${200 + R}" y2="200" class="cross"/>
        <g class="sweep">
          <path d="M200 200 L200 ${200 - R} A ${R} ${R} 0 0 1 ${(200 + R * Math.cos(-Math.PI / 3.2)).toFixed(1)} ${(200 + R * Math.sin(-Math.PI / 3.2)).toFixed(1)} Z" fill="url(#sweepGrad)"/>
          <line x1="200" y1="200" x2="200" y2="${200 - R}" stroke="var(--signal)" stroke-opacity=".6" stroke-width="1.4"/>
        </g>
        ${blips.map((b, i) => {
          const p = pt(b);
          return html`<g>
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${b.s + 10}" fill="${raw(COL[b.t])}" opacity=".10"/>
            ${UI.d20(p.x, p.y, b.s, COL[b.t], 0.6 + (i % 3) * 0.13)}
          </g>`;
        })}
        <g class="me-pin">
          <circle class="pulse" cx="200" cy="200" r="26" fill="var(--accent)" opacity=".15"/>
          ${UI.d20(200, 200, 13, 'var(--accent)')}
        </g>
      </svg>
    </div>`;
  }

  const PILASTRI = [
    { n: '01', t: 'Radar', d: 'Scoperta locale per distanza reale, con raggi da 5 a 100 km. La posizione precisa non esce mai dal tuo dispositivo.' },
    { n: '02', t: 'Matching', d: 'Compatibilità calcolata su sistema, disponibilità, ruolo e modalità. Deterministica: ti mostriamo sempre il perché.' },
    { n: '03', t: 'Fairness', d: 'Reputazione comportamentale anonima. Non misura quanto giochi bene, ma se rispetti persone e accordi.' },
    { n: '04', t: 'Trust & Safety', d: 'Verifica 18+ senza documenti, blocchi immediati, segnalazioni e moderazione umana con audit.' }
  ];

  const PASSI = [
    { t: 'Dici dove e quando', d: 'Zona (anche solo la città), giorni, fasce orarie, sistemi che conosci e ruolo che vuoi coprire. Nient\'altro.' },
    { t: 'Il Radar cerca per te', d: 'Persone, Party, Campagne e annunci ordinati per compatibilità, con distanza arrotondata e motivazioni leggibili.' },
    { t: 'Contatti con calma', d: 'Prima una richiesta, poi la chat. I contatti esterni si scambiano solo con doppio consenso, e si possono interrompere.' }
  ];

  function landing() {
    return html`<div class="pub">
      <header class="pub-nav" id="pubnav">
        <div class="pub-wrap row-b" style="width:100%">
          <a href="#/">${UI.logo()}</a>
          <nav class="links grow">
            <a href="#come-funziona">Come funziona</a>
            <a href="#fairness">Fairness</a>
            <a href="#sicurezza">Sicurezza</a>
            <a href="#/etica">Gioco etico</a>
          </nav>
          <div class="row g-8">
            <button class="btn btn-ghost" data-act="demoLogin">Entra nella demo</button>
            <a class="btn btn-primary" href="#/onboarding">Crea il profilo</a>
          </div>
        </div>
      </header>

      <section class="hero">
        <div class="pub-wrap hero-grid">
          <div class="hero-copy">
            <span class="eyebrow on-accent">Discovery per giochi di ruolo · V1</span>
            <h1 class="display d-1 mt-16">Trova <em>con chi</em><br>giocare, non<br>un altro feed.</h1>
            <p class="lead">GdRadar mette in contatto giocatori, Master, Party e Campagne vicini o compatibili.
              Niente bacheche infinite, niente recensioni al veleno: una ricerca che spiega le sue scelte
              e strumenti veri per farlo in sicurezza.</p>
            <div class="cta">
              <a class="btn btn-primary btn-lg" href="#/onboarding">Crea il profilo${icon('arrowRight', 16)}</a>
              <button class="btn btn-lg" data-act="demoLogin">Guarda la demo</button>
            </div>
            <div class="fineprint">
              <span>${icon('lock', 14)}Servizio 18+ con verifica anonima</span>
              <span>${icon('eyeOff', 14)}Posizione precisa mai pubblica</span>
              <span>${icon('scale', 14)}Nessuna recensione pubblica</span>
            </div>
          </div>
          ${heroArt()}
        </div>
      </section>

      <section class="pillars">
        ${PILASTRI.map((p) => html`<article class="pillar">
          <span class="n">${p.n}</span>
          <h3>${p.t}</h3>
          <p>${p.d}</p>
        </article>`)}
      </section>

      <section class="section" id="come-funziona">
        <div class="pub-wrap">
          <div class="section-head">
            <span class="eyebrow">Come funziona</span>
            <h2 class="display d-2 mt-12">Tre passaggi, poi si gioca.</h2>
            <p class="lead">La V1 fa una cosa sola e la fa bene: portarti da “non conosco nessuno con cui giocare”
              a “giovedì abbiamo un tavolo”.</p>
          </div>
          <div class="steps">
            ${PASSI.map((p, i) => html`<article class="step-card">
              <span class="idx">${'0' + (i + 1)}</span>
              <h3>${p.t}</h3>
              <p>${p.d}</p>
            </article>`)}
          </div>
        </div>
      </section>

      <section class="section" id="fairness" style="background:var(--surface);border-block:1px solid var(--line)">
        <div class="pub-wrap split">
          <div>
            <span class="eyebrow">Fairness</span>
            <h2 class="display d-2 mt-12">Non misuriamo<br>quanto giochi bene.</h2>
            <p class="lead mt-16">Fairness racconta se le esperienze con una persona o con un Party sono state corrette:
              accordi rispettati, comunicazione, voglia di rigiocarci insieme. Un Master mediocre può avere Fairness
              eccellente; un giocatore fortissimo può averla bassa.</p>
            <ul class="mt-24 col g-12">
              ${['Feedback solo dopo una relazione qualificata nata su GdRadar',
                 'Anonimo verso chi lo riceve, tracciato internamente contro gli abusi',
                 'Nessun testo libero pubblico: solo domande chiuse',
                 'Nascosto finché non ci sono almeno 5 feedback qualificati',
                 'Stima prudenziale (Wilson): 5 su 5 non batte 97 su 100'
                ].map((t) => html`<li class="row g-10"><span style="color:var(--accent);margin-top:2px">${icon('check', 16)}</span><span class="body">${t}</span></li>`)}
            </ul>
          </div>
          <div class="card card-pad" style="padding:28px">
            <span class="eyebrow">Esempio di scheda</span>
            <div class="row g-12 mt-16">
              ${U.avatar('Marta Ombralunga', 'lg', 'u5')}
              <div class="grow">
                <p class="h-md">Marta Ombralunga</p>
                <p class="small muted">Master e Player · Esperto</p>
              </div>
              ${UI.donut(88, 52)}
            </div>
            <div class="row g-8 wrap mt-16">
              <span class="badge badge-line">${icon('dice', 11)}Il Richiamo di Cthulhu</span>
              <span class="badge">${icon('pin', 11)}Isola, Milano · 6 km</span>
              <span class="badge badge-accent">${icon('sparkles', 11)}Newbie friendly</span>
            </div>
            <div class="mt-24" style="padding-top:18px;border-top:1px solid var(--line-2)">
              ${UI.fairPips({ fairness: { n: 31, pos: 30, ultimo: Date.now() - 12 * 86400000 } }, { conta: true })}
              <p class="tiny muted mt-8">Stima prudenziale su 31 feedback qualificati. Nessun commento pubblico, mai.</p>
            </div>
            <div class="callout accent mt-16">${icon('info', 18, 'ico')}
              <div>La Fairness resta fuori dal punteggio di compatibilità: sono due segnali diversi e vanno letti separatamente.</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="sicurezza">
        <div class="pub-wrap">
          <div class="section-head">
            <span class="eyebrow">Trust &amp; Safety</span>
            <h2 class="display d-2 mt-12">La sicurezza non è<br>una pagina di aiuto.</h2>
            <p class="lead">È un sottosistema del prodotto: verifica dell'età, controllo della visibilità,
              consenso reciproco per i contatti, moderazione umana con evidenze e ricorsi.</p>
          </div>
          <div class="steps">
            ${[
              { i: 'lock', t: 'Verifica 18+ senza documenti', d: 'La prova arriva da un provider esterno privacy-preserving. Nel nostro database restano esito, soglia, riferimento non reversibile e data. Nessuna foto, nessun numero di documento.' },
              { i: 'eyeOff', t: 'La tua posizione resta tua', d: 'Gli altri vedono zona e distanza arrotondata. Le coordinate non vengono mai inviate al dispositivo di terzi: le query geografiche restano lato server.' },
              { i: 'handshake', t: 'Contatti solo con doppio consenso', d: 'Telefono, Discord o Telegram passano solo quando entrambe le persone accettano. Puoi bloccare, chiudere la conversazione e segnalare in qualsiasi momento.' }
            ].map((c) => html`<article class="step-card">
              <span style="color:var(--accent);display:block">${icon(c.i, 24)}</span>
              <h3>${c.t}</h3>
              <p>${c.d}</p>
            </article>`)}
          </div>
          <div class="mt-32 card card-pad" style="padding:clamp(22px,3vw,34px)">
            <div class="split" style="align-items:center">
              <p class="quote">Nessun algoritmo decide da solo un ban. I numeri aprono un caso: a chiuderlo è una persona, con evidenze e possibilità di ricorso.</p>
              <div>
                <span class="eyebrow">Pipeline di moderazione</span>
                <div class="pipeline mt-12">
                  <b>Report</b><span class="arrow">→</span><b>Case</b><span class="arrow">→</span><b>Triage</b><span class="arrow">→</span>
                  <b>Evidenze</b><span class="arrow">→</span><b>Revisione</b><span class="arrow">→</span><b>Azione</b><span class="arrow">→</span>
                  <b>Ricorso</b><span class="arrow">→</span><b>Audit</b>
                </div>
                <a class="btn mt-24" href="#/moderazione">Vedi il backoffice${icon('arrowRight', 16)}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" style="background:var(--surface);border-top:1px solid var(--line)">
        <div class="pub-wrap tc" style="display:flex;flex-direction:column;align-items:center;gap:22px">
          <span class="eyebrow">Pronti?</span>
          <h2 class="display d-2" style="max-width:18ch">Il tavolo giusto è più vicino di quanto pensi.</h2>
          <p class="lead" style="max-width:52ch">Bastano zona, giorni e un paio di sistemi. Al resto pensa il Radar.</p>
          <div class="row g-12 wrap" style="justify-content:center">
            <a class="btn btn-primary btn-lg" href="#/onboarding">Crea il profilo${icon('arrowRight', 16)}</a>
            <button class="btn btn-lg" data-act="demoLogin">Entra nella demo</button>
          </div>
        </div>
      </section>

      <footer class="pub-foot">
        <div class="pub-wrap">
          <div class="cols">
            <div>
              ${UI.logo()}
              <p class="mt-12" style="max-width:34ch">Infrastruttura di discovery e matchmaking per il gioco di ruolo. Prototipo funzionante della V1.</p>
            </div>
            <div><h4>Prodotto</h4><ul>
              <li><a href="#come-funziona">Come funziona</a></li>
              <li><a href="#fairness">Fairness</a></li>
              <li><a href="#/onboarding">Crea profilo</a></li>
            </ul></div>
            <div><h4>Community</h4><ul>
              <li><a href="#/etica">Gioco etico</a></li>
              <li><a href="#/etica">Patto di Community</a></li>
              <li><a href="#/etica">Newbie Friendly</a></li>
            </ul></div>
            <div><h4>Sicurezza</h4><ul>
              <li><a href="#/privacy">Privacy e dati</a></li>
              <li><a href="#/privacy">Verifica 18+</a></li>
              <li><a href="#/moderazione">Moderazione</a></li>
            </ul></div>
          </div>
          <p class="mt-32 tiny">© ${new Date().getFullYear()} GdRadar · Prototipo V1 · Nessun dato lascia questo browser.</p>
        </div>
      </footer>
    </div>`;
  }

  /* ---------- Gioco etico ---------- */
  function etica() {
    const body = html`<div class="prose">
      <span class="eyebrow">Patto di Community</span>
      <h1 class="display d-2 mt-12">Perché investiamo nel gioco etico</h1>
      <p class="lead mt-16">Questa pagina non sostituisce i Termini di servizio. Racconta la cultura che vogliamo:
        è il patto che accetti entrando e quello che ti aspetti dagli altri.</p>

      <h2>Sei impegni, in ordine di importanza</h2>
      <ul>
        <li><b>Rispetto delle persone e dei limiti concordati.</b> I limiti si dichiarano prima e si rispettano durante. Se qualcuno chiede di fermarsi, ci si ferma.</li>
        <li><b>Nessuna discriminazione per esperienza o inesperienza.</b> Chi è alla prima partita non è un peso; chi gioca da vent'anni non è un giudice.</li>
        <li><b>Correttezza negli accordi.</b> Se dici che ci sei, ci sei. Se non puoi, avvisi. È la cosa che il nostro sistema misura davvero.</li>
        <li><b>Fairness come misura comportamentale.</b> Non valutiamo la bravura: valutiamo se l'esperienza è stata corretta.</li>
        <li><b>Incontri prudenti e consapevoli.</b> I primi incontri in luogo pubblico, dire a qualcuno dove si va, nessun obbligo di condividere contatti.</li>
        <li><b>Trasparenza su blocchi, segnalazioni e moderazione.</b> Sai cosa succede quando segnali, e chi decide.</li>
      </ul>

      <h2>Newbie Friendly</h2>
      <p>È un'etichetta con tre livelli, dichiarata separatamente su profilo, Party e singola campagna o annuncio.
        Nel matching pesa l'ultima: una persona può essere disponibile in generale e avere comunque
        una campagna in corso non adatta a chi inizia.</p>
      <ul>
        <li><b>Profilo</b> — disponibilità generale verso nuovi giocatori.</li>
        <li><b>Party</b> — apertura del gruppo a chi arriva da fuori.</li>
        <li><b>Campagna o annuncio</b> — idoneità concreta alla prima esperienza.</li>
      </ul>

      <h2>Cosa non troverai qui</h2>
      <p>Niente feed, follower o like. Niente forum pubblico. Nessuna recensione testuale visibile,
        nessun marketplace, nessuna classifica di bravura. Sono scelte, non funzionalità mancanti:
        ogni volta che una piattaforma di gioco introduce un punteggio di talento pubblico, i tavoli
        smettono di accogliere chi inizia.</p>

      <h2>Se qualcosa va storto</h2>
      <p>Puoi bloccare subito, in qualsiasi momento e senza spiegazioni. La segnalazione è anonima verso
        la persona segnalata e apre un caso di moderazione con evidenze, decisione umana e possibilità di ricorso.
        Una segnalazione grave non tocca automaticamente la Fairness di nessuno: sono due sistemi separati,
        proprio per evitare che si usino le stelline come arma.</p>
    </div>`;

    if (!GD.store.get().me) {
      return html`<div class="pub">
        <header class="pub-nav"><div class="pub-wrap row-b" style="width:100%">
          <a href="#/">${UI.logo()}</a>
          <div class="grow"></div>
          <a class="btn btn-primary" href="#/onboarding">Crea il profilo</a>
        </div></header>
        <div class="pub-wrap" style="padding-top:48px;padding-bottom:80px">${body}</div>
      </div>`;
    }
    return UI.shell('/etica', body, { title: 'Gioco etico', narrow: true });
  }

  /* ---------- Privacy ---------- */
  function privacy() {
    const body = html`<div class="prose">
      <span class="eyebrow">Privacy e dati</span>
      <h1 class="display d-2 mt-12">Cosa sappiamo di te (poco)</h1>

      <h2>Verifica dell'età</h2>
      <p>GdRadar è un servizio 18+. La data di nascita dichiarata in fase di registrazione non vale come verifica:
        serve solo a impostare l'esperienza. La prova arriva da un provider esterno privacy-preserving, e da lì
        torna indietro soltanto un esito.</p>
      <ul>
        <li>Conserviamo: <code>status</code>, <code>threshold = 18</code>, <code>provider</code>, un <code>reference</code> non reversibile, <code>verified_at</code> ed eventuale <code>expires_at</code>.</li>
        <li>Non conserviamo: foto del documento, numero del documento, codice fiscale, selfie.</li>
        <li>L'architettura è provider-agnostica: quando i wallet europei di proof-of-age saranno disponibili, cambia il provider, non il modello dati.</li>
      </ul>

      <h2>Posizione</h2>
      <p>La geolocalizzazione è facoltativa: puoi sempre inserire città, CAP o indirizzo a mano.
        Le coordinate servono al server per le query geografiche; agli altri utenti arrivano solo
        zona pubblica e distanza arrotondata. Il frontend non riceve mai coordinate private di terzi.</p>

      <h2>Chat e moderazione</h2>
      <p>Le conversazioni sono private. Un moderatore non può sfogliarle liberamente: l'accesso è legato
        a un caso aperto, limitato alle evidenze pertinenti, e ogni lettura produce una riga di audit.</p>

      <h2>Feedback</h2>
      <p>Il feedback è anonimo verso chi lo riceve, ma internamente resta associato a chi lo ha scritto:
        serve a fermare chi userebbe la Fairness per vendetta. Non esiste testo libero pubblico.</p>

      <h2>Questo prototipo</h2>
      <p>Questa versione dimostrativa non ha server: tutto ciò che scrivi resta nel <code>localStorage</code>
        del tuo browser e sparisce quando svuoti i dati del sito. Le persone che vedi sul Radar sono generate.</p>
    </div>`;
    return GD.store.get().me
      ? UI.shell('/privacy', body, { title: 'Privacy', narrow: true })
      : html`<div class="pub"><header class="pub-nav"><div class="pub-wrap row-b" style="width:100%">
          <a href="#/">${UI.logo()}</a><div class="grow"></div>
          <a class="btn btn-primary" href="#/onboarding">Crea il profilo</a></div></header>
        <div class="pub-wrap" style="padding-top:48px;padding-bottom:80px">${body}</div></div>`;
  }

  GD.views = GD.views || {};
  GD.views.landing = landing;
  GD.views.etica = etica;
  GD.views.privacy = privacy;
})(window.GD);
