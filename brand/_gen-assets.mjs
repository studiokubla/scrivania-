// Generatore degli asset vettoriali DEZ 11.
// Modulo: 1u = 30 (un quarto dell'asta del numero).
// Nome: asta 2u, altezza 6u.  Numero: asta 4u, altezza 14u.  Interlinea 2u, area di rispetto 2u.
// Anelli del numero: 120 / 96 / 72 / 48, anima 24 (quattro anelli da 12).
import { writeFileSync } from 'node:fs';

const DEZ = (color, tx = 91, ty = 90) => `    <g transform="translate(${tx},${ty})" stroke="${color}" stroke-width="60">
      <path d="M0 120 L0 0 L44 0 C92 0 110 27 110 60 C110 93 92 120 44 120 Z"/>
      <path d="M281 0 L185 0 L185 120 L281 120"/>
      <path d="M185 60 L267 60"/>
      <path d="M356 0 L458 0 L356 120 L458 120"/>
    </g>`;

const NUM_D = 'M30 84 L120 6 L120 306 M270 84 L360 6 L360 306';
const WIDTHS = [120, 96, 72, 48, 24];

const NUM = (colors, tx = 118, ty = 354) => `    <g transform="translate(${tx},${ty})">
${WIDTHS.map((w, i) => `      <path d="${NUM_D}" stroke="${colors[i]}" stroke-width="${w}"/>`).join('\n')}
    </g>`;

const SPETTRO = `  <defs>
    <linearGradient id="spettro" x1="0" y1="0.1" x2="1" y2="0.9">
      <stop offset="0" stop-color="#FF6B4A"/>
      <stop offset="0.18" stop-color="#FFB01F"/>
      <stop offset="0.36" stop-color="#9BDD3A"/>
      <stop offset="0.54" stop-color="#21D2AE"/>
      <stop offset="0.72" stop-color="#3E9BFA"/>
      <stop offset="0.86" stop-color="#7A34E0"/>
      <stop offset="1" stop-color="#FF5FA3"/>
    </linearGradient>
  </defs>
`;

const doc = (title, vb, w, h, defs, body) =>
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" role="img" aria-label="DEZ 11">
  <title>${title}</title>
${defs}  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
${body}
  </g>
</svg>
`;

const alt = (a, b) => [a, b, a, b, a];

writeFileSync('assets/dez11-marchio-positivo.svg', doc(
  'DEZ 11 — marchio positivo', '0 0 640 780', 640, 780, '',
  [DEZ('#0B0C10'), NUM(alt('#0B0C10', '#FFFFFF'))].join('\n')));

writeFileSync('assets/dez11-marchio-negativo.svg', doc(
  'DEZ 11 — marchio negativo', '0 0 640 780', 640, 780, '',
  [DEZ('#FFFFFF'), NUM(alt('#FFFFFF', '#0B0C10'))].join('\n')));

writeFileSync('assets/dez11-marchio-spettro.svg', doc(
  'DEZ 11 — marchio spettro', '0 0 640 780', 640, 780, SPETTRO,
  [DEZ('#FFFFFF'), NUM(alt('url(#spettro)', '#0B0C10'))].join('\n')));

// Lockup orizzontale: numero 510x420 con origine 0,0 -> translate(60, 54)
// nome allineato in basso: centerline y = 420 - 30 - 120 = 270
writeFileSync('assets/dez11-marchio-orizzontale.svg', doc(
  'DEZ 11 — lockup orizzontale', '0 0 1028 420', 1028, 420, '',
  [DEZ('#0B0C10', 30, 270), NUM(alt('#0B0C10', '#FFFFFF'), 608, 54)].join('\n')));

// Icona: solo il numero. Blocco 450x420, scala 0.764 -> 344x321, centrato in 512.
writeFileSync('assets/dez11-icona.svg',
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="DEZ 11">
  <title>DEZ 11 — icona</title>
  <rect width="512" height="512" rx="116" fill="#0B0C10"/>
  <g transform="translate(84,96) scale(0.764)" fill="none" stroke-linecap="round" stroke-linejoin="round">
${NUM(alt('#FFFFFF', '#0B0C10'), 30, 54)}
  </g>
</svg>
`);

console.log('asset generati');
