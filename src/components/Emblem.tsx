// The Deal Team 6 insignia: a six-sided patch with a trident. Six sides for the
// six, the trident for the team it is named after.

export const HEX_OUTER = "24,2.5 42.6,13.25 42.6,34.75 24,45.5 5.4,34.75 5.4,13.25";
export const HEX_INNER = "24,6 39.6,15 39.6,33 24,42 8.4,33 8.4,15";
export const TRIDENT = [
  "M24 12v25", // shaft
  "M16.5 16.5v3.2c0 3.6 3.2 5.6 7.5 5.6s7.5-2 7.5-5.6v-3.2", // the curved head
  "M21.2 14.6 24 10.8l2.8 3.8", // centre point
  "M13.9 18.3l2.6-3.6 2.6 3.6", // left point
  "M28.9 18.3l2.6-3.6 2.6 3.6", // right point
  "M21 33.2h6", // grip
];

export function Emblem({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="emblem"
    >
      <polygon points={HEX_OUTER} fill="var(--emblem-rim)" stroke="var(--emblem-rim)" strokeWidth="3" strokeLinejoin="round" />
      <polygon points={HEX_INNER} fill="var(--emblem-field)" stroke="var(--emblem-field)" strokeWidth="2" strokeLinejoin="round" />
      <g fill="none" stroke="var(--emblem-mark)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {TRIDENT.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      Deal Team <span className="wordmark-six">6</span>
    </span>
  );
}
