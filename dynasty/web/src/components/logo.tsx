/**
 * Il marchio: una D tagliata in tre fasce.
 *
 * Una dinastia è una successione — tre generazioni che formano una cosa sola.
 * Le fasce sono la successione, la D è la lega. Niente corona, niente pallone:
 * a sedici pixel sopravvive solo la forma.
 *
 * Prende il colore dal testo che lo contiene, così funziona in positivo e in
 * negativo senza varianti.
 */
export function Logo({ size = 26, title }: { size?: number; title?: string }) {
  // L'identificativo del ritaglio deve essere unico per pagina: due marchi con
  // lo stesso id farebbero riferimento allo stesso clipPath.
  const id = `fasce-${size}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={id}>
          <rect x="0" y="8" width="100" height="25" />
          <rect x="0" y="39" width="100" height="22" />
          <rect x="0" y="67" width="100" height="25" />
        </clipPath>
      </defs>
      <path
        d="M14 8 H48 A42 42 0 0 1 48 92 H14 Z M32 26 H48 A24 24 0 0 1 48 74 H32 Z"
        fillRule="evenodd"
        clipPath={`url(#${id})`}
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({ nome }: { nome: string }) {
  return (
    <span className="marchio">
      <Logo size={26} title={nome} />
      <b>{nome}</b>
    </span>
  );
}
