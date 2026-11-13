const PATHS = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  labs: 'M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2V5Zm8-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6V3Z',
  paths: 'M6 3v12a3 3 0 0 0 3 3h9M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  progress: 'M4 20V10m6 10V4m6 16v-7m6 7V8',
  leaderboard: 'M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 1h2a2 2 0 0 1 0 4h-.5M7 5H5a2 2 0 0 0 0 4h.5',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v.01M11 12h1v5h1',
  contribute: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8.5-4v6m3-3h-6',
  admin: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  filter: 'M4 6h16M7 12h10M10 18h4',
  code: 'M8 8l-4 4 4 4m8-8 4 4-4 4M14 4l-4 16',
  terminal: 'M4 5h16v14H4V5Zm4 5 2 2-2 2m5 0h3',
  flag: 'M5 21V4m0 0h11l-1.5 4L16 12H5',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 8v5m0 3v.01M10.3 3.9 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5m0-9v.01',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z',
  user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowLeft: 'M19 12H5m6 6-6-6 6-6',
  play: 'M8 5v14l11-7-11-7Z',
  lock: 'M6 11h12v10H6V11Zm3 0V7a3 3 0 0 1 6 0v4',
  book: 'M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5Zm7-2h5a2 2 0 0 1 2 2v16h-7V3Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3v-.01',
  lightbulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3Z',
  external: 'M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  refresh: 'M20 11a8 8 0 1 0-2.3 6M20 4v7h-7',
  trophy: 'M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 1h2a2 2 0 0 1 0 4h-.5M7 5H5a2 2 0 0 0 0 4h.5',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  copy: 'M9 9h10v12H9V9Zm-4 6H3V3h12v2',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  sidebar: 'M4 4h16v16H4V4Zm5 0v16',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14',
  users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4.2a3.5 3.5 0 0 1 0 6.6M21 20v-1.5a4 4 0 0 0-3-3.8',
  trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13M10 11v5m4-5v5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  pencil: 'M4 20h4L20 8l-4-4L4 16v4Zm10-14 4 4',
  activity: 'M3 12h4l3 8 4-16 3 8h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3-1.9-.6a6.5 6.5 0 0 0-.6-1.5l1-1.7-2.1-2.1-1.7 1a6.5 6.5 0 0 0-1.5-.6L12.6 4h-3l-.6 1.9a6.5 6.5 0 0 0-1.5.6l-1.7-1L3.7 7.6l1 1.7a6.5 6.5 0 0 0-.6 1.5L2.2 11v3l1.9.6a6.5 6.5 0 0 0 .6 1.5l-1 1.7 2.1 2.1 1.7-1a6.5 6.5 0 0 0 1.5.6l.6 1.9h3l.6-1.9a6.5 6.5 0 0 0 1.5-.6l1.7 1 2.1-2.1-1-1.7a6.5 6.5 0 0 0 .6-1.5L22 14v-3Z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l8 4V6L6 10H4a1 1 0 0 0-1 1Zm14-5a6 6 0 0 1 0 12',
  health: 'M3 12h4l2-5 3 10 2-5h7',
  shieldCheck: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4',
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }) {
  const path = PATHS[name] || PATHS.info
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  )
}
