import type { ReactNode } from 'react';

const I = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const Icon = {
  rooms: () => <I><path d="M3 10.5 12 3l9 7.5V21H3z" /><path d="M9 21v-6h6v6" /></I>,
  sun: () => <I><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>,
  sunset: () => <I><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9v3M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M23 22H1" /></I>,
  moon: () => <I><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></I>,
  bulb: () => <I><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></I>,
  palette: () => <I><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="11" cy="7" r="1" /><circle cx="15.5" cy="8" r="1" /></I>,
  walk: () => <I><circle cx="13" cy="4" r="2" /><path d="m9 20 3-6 3 3v4M7 12l3-4 4 1 3 3" /></I>,
  orbit: () => <I><ellipse cx="12" cy="12" rx="10" ry="4" /><circle cx="12" cy="12" r="2.5" /></I>,
  home: () => <I><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></I>,
  info: () => <I><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></I>,
  full: () => <I><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></I>,
  images: () => <I><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></I>,
  plan: () => <I><rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M3 10h8V3M11 21v-6h10M15 10h6" /></I>,
  cube: () => <I><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></I>,
  chevL: () => <I><path d="m15 5-7 7 7 7" /></I>,
  chevR: () => <I><path d="m9 5 7 7-7 7" /></I>,
  close: () => <I><path d="M6 6l12 12M18 6 6 18" /></I>,
  undo: () => <I><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></I>,
  reset: () => <I><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></I>,
  compare: () => <I><path d="M12 3v18" /><rect x="3" y="5" width="18" height="14" rx="2" /></I>,
  share: () => <I><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></I>,
  door: () => <I><path d="M5 21V3h11v18M3 21h18" /><circle cx="13" cy="12" r=".8" /></I>,
  layers: () => <I><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></I>,
  help: () => <I><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17v.5" /></I>,
  settings: () => <I><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>,
};
