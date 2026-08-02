// ─── Petites icônes ligne (SVG maison, pas de dépendance) ────────────────────
export const ICON_PATHS = {
  price: 'M16.8 5.2C15.2 3.8 13.2 3 11 3c-4.4 0-8 4-8 9s3.6 9 8 9c2.2 0 4.2-.8 5.8-2.2M2 10.3h9.5M2 13.7h8.3',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M17 8a3 3 0 1 0 0-6M21.5 20c0-3-2-5.2-5-5.8',
  check: 'M8 12.5l2.6 2.6L16.5 9M12 3l2.3 1.6 2.8-.3 1 2.6 2.6 1-.3 2.8L21 12l-1.6 2.3.3 2.8-2.6 1-1 2.6-2.8-.3L12 21l-2.3-1.6-2.8.3-1-2.6-2.6-1 .3-2.8L3 12l1.6-2.3-.3-2.8 2.6-1 1-2.6 2.8.3Z',
  shield: 'M12 3l7 3v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3ZM9 12l2 2 4-4.5',
  calendar: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13ZM4 9.5h16M8 3v3M16 3v3',
  bell: 'M6 10a6 6 0 1 1 12 0c0 3.4 1 5.2 1.6 6H4.4C5 15.2 6 13.4 6 10ZM9.7 19a2.3 2.3 0 0 0 4.6 0',
  mail: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-11ZM4.5 6.5 12 12.5l7.5-6',
  cap: 'M12 4 3 8.5 12 13l9-4.5L12 4ZM6.5 10.7v4.3c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3M19.5 9v6',
  info: 'M12 8.2h.01M11.3 11h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  arrowRight: 'M4 12h15.2M13.5 6l6 6-6 6',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z M12 16.2a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z',
  user: 'M12 12a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM5 19.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5',
  chevronDown: 'M5 8.5l7 7 7-7',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
};

export default function Icon({ name, size = 20, style, ...props }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }} {...props}>
      <path d={d} />
    </svg>
  );
}
