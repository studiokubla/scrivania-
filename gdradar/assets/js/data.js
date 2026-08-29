/* ============================================================
   GdRadar — vocabolari di dominio e dati seed
   I dati sono generati in modo deterministico (seed fisso) così
   che il Radar mostri sempre la stessa mappa fra un refresh e
   l'altro, pur restando ricchi.
   ============================================================ */
(function (GD) {
  'use strict';
  const U = GD.util;

  /* ---------- vocabolari ---------- */
  const SYSTEMS = [
    { id: 'dnd5', nome: 'Dungeons & Dragons', versioni: ['5e (2014)', '5e (2024)'], tag: 'fantasy' },
    { id: 'pf2', nome: 'Pathfinder', versioni: ['2e Remaster', '2e'], tag: 'fantasy' },
    { id: 'coc', nome: 'Il Richiamo di Cthulhu', versioni: ['7e'], tag: 'horror' },
    { id: 'vtm', nome: 'Vampiri: la Masquerade', versioni: ['V5', 'V20'], tag: 'urban' },
    { id: 'cpr', nome: 'Cyberpunk RED', versioni: ['Core'], tag: 'sci-fi' },
    { id: 'bitd', nome: 'Blades in the Dark', versioni: ['Core'], tag: 'heist' },
    { id: 'brancalonia', nome: 'Brancalonia', versioni: ['5e'], tag: 'fantasy' },
    { id: 'wfrp', nome: 'Warhammer Fantasy', versioni: ['4e'], tag: 'grim' },
    { id: 'alien', nome: 'ALIEN RPG', versioni: ['Core'], tag: 'horror' },
    { id: 'morkborg', nome: 'Mörk Borg', versioni: ['Core'], tag: 'grim' },
    { id: 'fate', nome: 'Fate Core', versioni: ['Core', 'Accelerato'], tag: 'generico' },
    { id: 'dw', nome: 'Dungeon World', versioni: ['Core'], tag: 'fantasy' },
    { id: 'savage', nome: 'Savage Worlds', versioni: ['SWADE'], tag: 'generico' },
    { id: 'numenera', nome: 'Numenera', versioni: ['Discovery'], tag: 'sci-fi' },
    { id: 'tdm', nome: 'Avventure nella Terra di Mezzo', versioni: ['5e'], tag: 'fantasy' }
  ];
  const systemById = (id) => SYSTEMS.find((s) => s.id === id);

  const RUOLI = [
    { id: 'player', label: 'Player' },
    { id: 'master', label: 'Master' }
  ];

  const ESPERIENZA = [
    { id: 'prima', label: 'Prima esperienza', ord: 0 },
    { id: 'principiante', label: 'Principiante', ord: 1 },
    { id: 'intermedio', label: 'Intermedio', ord: 2 },
    { id: 'esperto', label: 'Esperto', ord: 3 }
  ];
  const espById = (id) => ESPERIENZA.find((e) => e.id === id) || ESPERIENZA[1];

  const MODALITA = [
    { id: 'presenza', label: 'In presenza' },
    { id: 'online', label: 'Online' },
    { id: 'entrambe', label: 'Entrambe' }
  ];

  const FORMATI = [
    { id: 'one_shot', label: 'One-shot' },
    { id: 'breve', label: 'Campagna breve' },
    { id: 'lunga', label: 'Campagna lunga' }
  ];

  const GIORNI = [
    { id: 'lun', label: 'Lun' }, { id: 'mar', label: 'Mar' }, { id: 'mer', label: 'Mer' },
    { id: 'gio', label: 'Gio' }, { id: 'ven', label: 'Ven' }, { id: 'sab', label: 'Sab' }, { id: 'dom', label: 'Dom' }
  ];
  const FASCE = [
    { id: 'pomeriggio', label: 'Pomeriggio' },
    { id: 'sera', label: 'Sera' },
    { id: 'tarda_sera', label: 'Tarda sera' }
  ];
  const FREQUENZE = [
    { id: 'settimanale', label: 'Settimanale' },
    { id: 'quindicinale', label: 'Ogni due settimane' },
    { id: 'mensile', label: 'Mensile' },
    { id: 'saltuaria', label: 'Quando capita' }
  ];

  const NEWBIE = [
    { id: 'si', label: 'Sì, volentieri' },
    { id: 'dipende', label: 'Dipende dalla campagna' },
    { id: 'esperti', label: 'Preferisco giocatori esperti' }
  ];

  const STILI = ['narrativo', 'tattico', 'esplorazione', 'horror', 'commedia', 'sandbox', 'intrigo', 'combattimento', 'interpretazione'];
  const LINGUE = ['Italiano', 'Inglese', 'Spagnolo', 'Francese', 'Tedesco'];

  const VISIBILITA = [
    { id: 'attivo', label: 'Attivo sul Radar', hint: 'Compari nelle ricerche compatibili.' },
    { id: 'nascosto', label: 'Nascosto', hint: 'Nessuno ti trova, tu continui a cercare.' },
    { id: 'pausa', label: 'Temporaneamente non disponibile', hint: 'Resti visibile ma segnalato come non disponibile.' }
  ];

  const CANALI_CONTATTO = [
    { id: 'telefono', label: 'Telefono' },
    { id: 'email', label: 'Email' },
    { id: 'discord', label: 'Discord' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'signal', label: 'Signal' }
  ];

  const MOTIVI_REPORT = [
    { id: 'no_show', label: 'Non si è presentato / ha sparito' },
    { id: 'scorrettezza', label: 'Scorrettezza negli accordi' },
    { id: 'molestie', label: 'Molestie o contenuti sessuali indesiderati' },
    { id: 'aggressivita', label: 'Aggressività o insulti' },
    { id: 'discriminazione', label: 'Discriminazione' },
    { id: 'spam', label: 'Spam o uso improprio della piattaforma' },
    { id: 'minore', label: 'Sospetto profilo minorenne' },
    { id: 'altro', label: 'Altro' }
  ];

  /* ---------- pool nomi ---------- */
  const NICK = [
    'Aurelia Vantés', 'Corvo di Mezzanotte', 'Tessa Braccoferro', 'Ilario Nove', 'Marta Ombralunga',
    'Dario Pellegrini', 'Vesna', 'Il Cartografo', 'Nilde Fanti', 'Rovo', 'Ludovica Sarti',
    'Gaspare Ruta', 'Miriam Cinque', 'Sasha Bellini', 'Fosco Tarli', 'Elia Verdi', 'Nora Sabbia',
    'Il Guardiano di Soglia', 'Bianca Tessari', 'Ruggero Malta', 'Adele Priore', 'Timoteo Rand',
    'Isa Notturna', 'Camillo Fabbri', 'Delia Roverso', 'Otto Merli', 'Gilda Ferrante',
    'Piero Alto', 'Vittoria Sanna', 'Lupo Marino', 'Cleo Manzi', 'Serse Baldi'
  ];

  const BIO_TEMPLATES = [
    'Gioco da {anni} anni, mi piacciono i tavoli dove si parla molto e si tira poco.',
    'Master {stile1}: preparo poco a tavolino e improvviso sul serio, con una rete di sicurezza per tutti.',
    'Cerco un gruppo stabile, con {freq} fisso e persone che avvisano quando non possono venire.',
    'Vengo dal teatro, porto al tavolo {stile1} e il gusto per le voci sbagliate.',
    'Ho iniziato durante il lockdown, ora non riesco più a smettere. Preferisco {stile1}.',
    'Dopo la pausa figli sono tornata a giocare: poche sessioni ma buone.',
    'Costruisco mondi lentamente. Se ti va di scrivere il background insieme, sono la persona giusta.',
    'Zero tolleranza per i tavoli tossici, molta pazienza per chi impara.',
    'Gioco {stile1} e {stile2}. Il mio dado preferito è quello che non tiro.',
    'Organizzo tavoli aperti in ludoteca una volta al mese, chiunque può provare.',
    'Sono qui soprattutto per one-shot: la vita non mi lascia spazio per campagne lunghe.',
    'Master da {anni} anni, giocatore da sempre. Mi interessa che tutti tornino la volta dopo.'
  ];

  const PARTY_NOMI = [
    'La Compagnia del Tavolo Storto', 'Ordine del Sestante', 'I Falchi di Via Vittoria', 'Cantina 12',
    'Le Sorelle del Rovo', 'Circolo Dadi & Dintorni', 'I Randagi di Porta Nuova', 'Vecchia Guardia',
    'Il Consiglio del Giovedì', 'Compagnia della Lanterna'
  ];

  const CAMPAGNA_NOMI = [
    'La Discesa nel Sale', 'Nessuno torna da Vallescura', 'Le Rovine di Portomanto', 'Sotto la Città Bianca',
    'Il Lungo Inverno di Praga', 'Nove Notti a Innsmouth', 'Il Contratto della Torre', 'Frontiera Cremisi',
    'Sangue sui Navigli', 'Le Mappe Impossibili', 'Il Patto di Vallescura', 'Ultimo Turno su Marte'
  ];

  const ANNUNCIO_TITOLI = {
    cerco_player: ['Cerchiamo {n} giocatori per {sys}', 'Un posto libero al tavolo di {sys}', 'Nuovo tavolo {sys}: {n} posti'],
    cerco_master: ['Gruppo cerca Master per {sys}', 'Cerchiamo chi ci porti in {sys}', 'Master cercasi, {freq}'],
    cerco_party: ['Giocatore cerca gruppo stabile ({sys})', 'Cerco tavolo {mod} di {sys}', 'Disponibile come player: {sys}'],
    cerco_campagna: ['Cerco campagna {sys} da seguire', 'Disponibile per campagna {fmt}', 'Cerco tavolo aperto {sys}']
  };

  /* ---------- generazione seed ---------- */
  const SEED = 'gdradar-v1-seed-07';
  const now = Date.now();
  const DAY = 86400000;

  function makeAvailability(r) {
    const giorni = U.pickMany(r, GIORNI.map((g) => g.id), 1 + Math.floor(r() * 3));
    const fasce = U.pickMany(r, FASCE.map((f) => f.id), 1 + Math.floor(r() * 2));
    return { giorni, fasce, frequenza: U.pick(r, FREQUENZE).id };
  }

  function makeGames(r, n) {
    return U.pickMany(r, SYSTEMS, n).map((s) => ({
      systemId: s.id,
      versione: U.pick(r, s.versioni),
      livello: U.pick(r, ['curioso', 'giocato', 'masterizzato'])
    }));
  }

  function fairnessSeed(r) {
    const n = Math.floor(r() * 34);
    if (n === 0) return { n: 0, pos: 0, ultimo: null };
    /* la maggioranza delle persone si comporta bene: distribuzione sbilanciata in alto */
    const badRate = r() < 0.16 ? 0.08 + r() * 0.22 : r() * 0.07;
    const pos = Math.max(0, Math.round(n * (1 - badRate)));
    return { n, pos, ultimo: now - Math.floor(r() * 120) * DAY };
  }

  function buildUsers() {
    const users = [];
    const cityWeights = ['mi', 'mi', 'mi', 'mi', 'rm', 'rm', 'rm', 'to', 'to', 'bo', 'bo', 'fi', 'na', 'pd', 'vr', 'ge', 'mb', 'bg', 'bs', 'mo', 'pr', 'pi', 'ba', 'ct', 'pa', 've', 'ts', 'ca'];
    NICK.forEach((nome, i) => {
      const r = U.rng(SEED + '-user-' + i);
      const cityId = cityWeights[i % cityWeights.length];
      const city = GD.geo.cityById(cityId);
      const zona = U.pick(r, city.zone);
      const coord = GD.geo.jitter(city, SEED + nome, 5);
      const isMaster = r() < 0.42;
      const isPlayer = !isMaster || r() < 0.55;
      const esp = U.pick(r, ESPERIENZA).id;
      const bio = U.pick(r, BIO_TEMPLATES)
        .replace('{anni}', String(2 + Math.floor(r() * 22)))
        .replace('{stile1}', U.pick(r, STILI))
        .replace('{stile2}', U.pick(r, STILI))
        .replace('{freq}', U.pick(r, FREQUENZE).label.toLowerCase());
      users.push({
        id: 'u' + (i + 1),
        tipo: 'utente',
        nome,
        bio,
        eta: 19 + Math.floor(r() * 28),
        verificato18: r() > 0.06,
        ruoli: [isPlayer && 'player', isMaster && 'master'].filter(Boolean),
        esperienza: esp,
        modalita: U.pick(r, MODALITA).id,
        formati: U.pickMany(r, FORMATI.map((f) => f.id), 1 + Math.floor(r() * 2)),
        newbie: U.pick(r, NEWBIE).id,
        stili: U.pickMany(r, STILI, 2 + Math.floor(r() * 2)),
        lingue: ['Italiano'].concat(r() < 0.4 ? ['Inglese'] : []),
        games: makeGames(r, 2 + Math.floor(r() * 3)),
        disponibilita: makeAvailability(r),
        loc: { cityId, zona, lat: coord.lat, lng: coord.lng },
        visibilita: r() < 0.9 ? 'attivo' : 'pausa',
        fairness: fairnessSeed(r),
        attivoDa: now - Math.floor(r() * 400) * DAY,
        ultimoAccesso: now - Math.floor(r() * 6) * DAY
      });
    });
    return users;
  }

  function buildParties(users) {
    return PARTY_NOMI.map((nome, i) => {
      const r = U.rng(SEED + '-party-' + i);
      const host = users[Math.floor(r() * users.length)];
      const membri = U.pickMany(r, users.filter((u) => u.loc.cityId === host.loc.cityId && u.id !== host.id), 2 + Math.floor(r() * 3))
        .map((u) => ({ userId: u.id, ruolo: u.ruoli.includes('master') ? 'master' : 'player' }));
      const coord = GD.geo.jitter(GD.geo.cityById(host.loc.cityId), SEED + nome, 4);
      return {
        id: 'p' + (i + 1),
        tipo: 'party',
        nome,
        bio: U.pick(r, [
          'Gruppo storico, ci vediamo a casa di qualcuno e ordiniamo qualcosa.',
          'Ci troviamo in ludoteca. Tavolo aperto, ma con regole chiare.',
          'Siamo un gruppo misto per età ed esperienza: la cosa ci piace.',
          'Party nato da un one-shot finito male e mai più sciolto.',
          'Giochiamo poco e bene: due sessioni al mese, sempre le stesse persone.'
        ]),
        membri: [{ userId: host.id, ruolo: 'host' }].concat(membri),
        newbie: U.pick(r, NEWBIE).id,
        stili: U.pickMany(r, STILI, 2),
        games: makeGames(r, 1 + Math.floor(r() * 2)),
        disponibilita: makeAvailability(r),
        modalita: r() < 0.75 ? 'presenza' : 'entrambe',
        loc: { cityId: host.loc.cityId, zona: U.pick(r, GD.geo.cityById(host.loc.cityId).zone), lat: coord.lat, lng: coord.lng },
        postiLiberi: Math.floor(r() * 3),
        fairness: fairnessSeed(r),
        creato: now - Math.floor(r() * 700) * DAY
      };
    });
  }

  function buildCampaigns(users, parties) {
    return CAMPAGNA_NOMI.map((nome, i) => {
      const r = U.rng(SEED + '-camp-' + i);
      const party = r() < 0.6 ? parties[Math.floor(r() * parties.length)] : null;
      const masterPool = users.filter((u) => u.ruoli.includes('master'));
      const master = party
        ? users.find((u) => u.id === party.membri[0].userId)
        : masterPool[Math.floor(r() * masterPool.length)];
      const sys = U.pick(r, SYSTEMS);
      const cityId = (party || master).loc.cityId;
      const coord = GD.geo.jitter(GD.geo.cityById(cityId), SEED + nome, 4);
      const modalita = r() < 0.62 ? 'presenza' : (r() < 0.6 ? 'online' : 'entrambe');
      return {
        id: 'c' + (i + 1),
        tipo: 'campagna',
        nome,
        bio: U.pick(r, [
          'Campagna investigativa lenta, con una città viva e conseguenze che restano.',
          'Sandbox: il gruppo decide dove andare, io preparo le reazioni del mondo.',
          'Storia già scritta a grandi linee, ma i personaggi possono romperla.',
          'Toni cupi ma non gratuiti: usiamo strumenti di sicurezza al tavolo.',
          'Avventura classica con dungeon, mercati e un drago che tratta.'
        ]),
        masterId: master.id,
        partyId: party ? party.id : null,
        systemId: sys.id,
        versione: U.pick(r, sys.versioni),
        formato: U.pick(r, FORMATI).id,
        modalita,
        newbie: U.pick(r, NEWBIE).id,
        stili: U.pickMany(r, STILI, 2),
        disponibilita: makeAvailability(r),
        loc: { cityId, zona: U.pick(r, GD.geo.cityById(cityId).zone), lat: coord.lat, lng: coord.lng },
        postiTotali: 4 + Math.floor(r() * 3),
        postiLiberi: Math.floor(r() * 3),
        esperienzaRichiesta: U.pick(r, ESPERIENZA).id,
        fairness: fairnessSeed(r),
        creato: now - Math.floor(r() * 300) * DAY
      };
    });
  }

  function buildListings(users, parties, campaigns) {
    const out = [];
    let n = 0;
    /* i titoli sono da template: qui aggiustiamo i singolari */
    const fixPlurale = (t) => String(t)
      .replace(/\b1 giocatori\b/, '1 giocatore')
      .replace(/\b1 posti\b/, '1 posto');
    const push = (o) => {
      n++;
      o.titolo = fixPlurale(o.titolo);
      out.push(Object.assign({ id: 'l' + n, tipo: 'annuncio', stato: 'attivo' }, o));
    };

    campaigns.forEach((c, i) => {
      if (c.postiLiberi <= 0) return;
      const r = U.rng(SEED + '-lc-' + i);
      const sys = systemById(c.systemId);
      push({
        sottotipo: 'cerco_player',
        autore: { kind: 'campagna', id: c.id },
        titolo: U.pick(r, ANNUNCIO_TITOLI.cerco_player).replace('{n}', String(c.postiLiberi)).replace('{sys}', sys.nome),
        testo: c.bio,
        systemId: c.systemId, versione: c.versione, modalita: c.modalita, formato: c.formato,
        loc: c.loc, disponibilita: c.disponibilita, posti: c.postiLiberi,
        esperienza: c.esperienzaRichiesta, newbie: c.newbie, stili: c.stili,
        pubblicato: now - Math.floor(r() * 26) * DAY, fairnessRef: c.fairness
      });
    });

    parties.forEach((p, i) => {
      const r = U.rng(SEED + '-lp-' + i);
      if (p.postiLiberi > 0) {
        const g = p.games[0]; const sys = systemById(g.systemId);
        push({
          sottotipo: 'cerco_player',
          autore: { kind: 'party', id: p.id },
          titolo: U.pick(r, ANNUNCIO_TITOLI.cerco_player).replace('{n}', String(p.postiLiberi)).replace('{sys}', sys.nome),
          testo: p.bio,
          systemId: g.systemId, versione: g.versione, modalita: p.modalita, formato: U.pick(r, FORMATI).id,
          loc: p.loc, disponibilita: p.disponibilita, posti: p.postiLiberi,
          esperienza: U.pick(r, ESPERIENZA).id, newbie: p.newbie, stili: p.stili,
          pubblicato: now - Math.floor(r() * 40) * DAY, fairnessRef: p.fairness
        });
      } else if (r() < 0.5) {
        const g = p.games[0]; const sys = systemById(g.systemId);
        push({
          sottotipo: 'cerco_master',
          autore: { kind: 'party', id: p.id },
          titolo: U.pick(r, ANNUNCIO_TITOLI.cerco_master).replace('{sys}', sys.nome).replace('{freq}', U.pick(r, FREQUENZE).label.toLowerCase()),
          testo: 'Siamo un gruppo già rodato, ci manca chi tenga lo schermo.',
          systemId: g.systemId, versione: g.versione, modalita: p.modalita, formato: 'lunga',
          loc: p.loc, disponibilita: p.disponibilita, posti: 1,
          esperienza: 'intermedio', newbie: p.newbie, stili: p.stili,
          pubblicato: now - Math.floor(r() * 50) * DAY, fairnessRef: p.fairness
        });
      }
    });

    users.forEach((u, i) => {
      const r = U.rng(SEED + '-lu-' + i);
      if (r() > 0.55) return;
      const g = u.games[0]; const sys = systemById(g.systemId);
      const isMaster = u.ruoli.includes('master') && r() < 0.5;
      const tipo = isMaster ? 'cerco_player' : (r() < 0.5 ? 'cerco_party' : 'cerco_campagna');
      const titoli = ANNUNCIO_TITOLI[tipo];
      push({
        sottotipo: tipo,
        autore: { kind: 'utente', id: u.id },
        titolo: U.pick(r, titoli)
          .replace('{sys}', sys.nome).replace('{n}', String(1 + Math.floor(r() * 3)))
          .replace('{mod}', u.modalita === 'online' ? 'online' : 'in presenza')
          .replace('{fmt}', U.pick(r, FORMATI).label.toLowerCase())
          .replace('{freq}', U.pick(r, FREQUENZE).label.toLowerCase()),
        testo: u.bio,
        systemId: g.systemId, versione: g.versione, modalita: u.modalita, formato: u.formati[0],
        loc: u.loc, disponibilita: u.disponibilita, posti: isMaster ? 1 + Math.floor(r() * 3) : 1,
        esperienza: u.esperienza, newbie: u.newbie, stili: u.stili,
        pubblicato: now - Math.floor(r() * 30) * DAY, fairnessRef: u.fairness
      });
    });

    return out;
  }

  const users = buildUsers();
  const parties = buildParties(users);
  const campaigns = buildCampaigns(users, parties);
  const listings = buildListings(users, parties, campaigns);

  /* ---------- casi di moderazione seed (backoffice dimostrativo) ---------- */
  function buildCases() {
    const r = U.rng(SEED + '-mod');
    const base = [
      { cat: 'sicurezza', sev: 4, stato: 'under_review', motivo: 'molestie', note: 'Tre segnalazioni indipendenti nella stessa settimana, contenuti a sfondo sessuale in chat privata.' },
      { cat: 'affidabilita', sev: 2, stato: 'new', motivo: 'no_show', note: 'Segnalato per due mancate presentazioni consecutive dopo scambio contatti.' },
      { cat: 'comportamento', sev: 3, stato: 'action_required', motivo: 'aggressivita', note: 'Insulti in chat dopo il rifiuto di una richiesta di contatto.' },
      { cat: 'abuso_piattaforma', sev: 2, stato: 'new', motivo: 'spam', note: 'Nove annunci quasi identici pubblicati in due giorni su città diverse.' },
      { cat: 'sicurezza', sev: 3, stato: 'waiting', motivo: 'minore', note: 'Sospetto profilo minorenne: verifica 18+ superata ma indizi contrari nel profilo.' },
      { cat: 'comportamento', sev: 1, stato: 'resolved', motivo: 'discriminazione', note: 'Commento sgradevole verso giocatori alle prime armi. Warning applicato.' },
      { cat: 'affidabilita', sev: 0, stato: 'dismissed', motivo: 'altro', note: 'Segnalazione priva di elementi: nessuna relazione qualificata fra le parti.' },
      { cat: 'sicurezza', sev: 4, stato: 'appealed', motivo: 'molestie', note: 'Ban permanente contestato: ricorso in valutazione da Senior Moderator.' }
    ];
    return base.map((b, i) => {
      const target = i % 3 === 2 ? parties[i % parties.length] : users[(i * 3 + 4) % users.length];
      const reporter = users[(i * 7 + 1) % users.length];
      const apertoIl = now - Math.floor(r() * 20 + 1) * DAY;
      return {
        id: 'CASE-' + String(1043 + i),
        target: { kind: target.tipo === 'party' ? 'party' : 'utente', id: target.id, nome: target.nome },
        origine: i % 4 === 0 ? 'system_flag' : 'report',
        categoria: b.cat,
        severity: b.sev,
        stato: b.stato,
        motivo: b.motivo,
        sintesi: b.note,
        reporterId: reporter.id,
        assegnatoA: b.stato === 'new' ? null : U.pick(r, ['mod.giulia', 'mod.karim', 'senior.anna']),
        apertoIl,
        evidenze: [
          { tipo: 'segnalazione', ref: 'REP-' + (2200 + i), quando: apertoIl, nota: 'Modulo di segnalazione con categoria e motivo.' },
          i % 2 === 0 ? { tipo: 'messaggi', ref: 'CONV-' + (900 + i), quando: apertoIl - DAY, nota: 'Estratto conversazione, accesso vincolato al case.' } : null,
          i % 3 === 0 ? { tipo: 'blocchi', ref: 'BLK-' + (77 + i), quando: apertoIl - 2 * DAY, nota: 'Blocchi indipendenti da utenti non collegati fra loro.' } : null
        ].filter(Boolean),
        azioni: b.stato === 'resolved'
          ? [{ tipo: 'warning', quando: apertoIl + DAY, da: 'mod.giulia', nota: 'Richiamo formale con riferimento al Patto di Community.' }]
          : b.stato === 'appealed'
            ? [{ tipo: 'permanent_ban', quando: apertoIl + DAY, da: 'senior.anna', nota: 'Ban permanente dopo revisione delle evidenze.' }]
            : [],
        audit: [
          { quando: apertoIl, chi: 'sistema', cosa: 'Case aperto da ' + (i % 4 === 0 ? 'flag automatico' : 'segnalazione utente') },
          b.stato !== 'new' ? { quando: apertoIl + 3600000, chi: 'mod.giulia', cosa: 'Triage completato, severity assegnata S' + b.sev } : null,
          i % 2 === 0 && b.stato !== 'new' ? { quando: apertoIl + 7200000, chi: 'mod.karim', cosa: 'Accesso a evidenze di chat registrato' } : null
        ].filter(Boolean)
      };
    });
  }

  GD.data = {
    SYSTEMS, systemById, RUOLI, ESPERIENZA, espById, MODALITA, FORMATI, GIORNI, FASCE,
    FREQUENZE, NEWBIE, STILI, LINGUE, VISIBILITA, CANALI_CONTATTO, MOTIVI_REPORT,
    users, parties, campaigns, listings, cases: buildCases(),
    byId(kind, id) {
      const map = { utente: users, party: parties, campagna: campaigns, annuncio: listings };
      return (map[kind] || []).find((x) => x.id === id) || null;
    }
  };
})(window.GD);
