/* SAVE AS: icons.js · LOCATION: C:/MarvelApps/cmmgsite/js/icons.js
 * CMMG neon icon set - our own line drawings (no league or team marks) replacing emoji, which render differently on every
 * phone and read as cheap (Scott 10/11: "takes away cheapness and look new age"). Same symbols as the locked tier map:
 * ICE = snowflake, EDGE = dagger (never a bolt / arrow), FIRE = flame. Every icon uses currentColor, so CSS colours it.
 *   ICON.tier("ICE")  ICON.sport("NFL")  ICON.ui("tv")   -> inline <svg> string */
const ICON = (() => {
  const svg = (body, cls) => `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const P = {
    // tiers (locked symbols)
    ICE: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4l3.4-.9-.9-3.4M20.4 13.6l-3.4.9.9 3.4M3.6 13.6l3.4.9-.9 3.4M20.4 10.4l-3.4-.9.9-3.4"/>',
    EDGE: '<path d="M14.5 2.5 21.5 2.5 21.5 9.5 11 20"/><path d="M8 13l3 3M5.5 15.5l3 3M3 21l3.5-3.5"/><path d="M13.5 10.5 9.5 14.5"/>',
    FIRE: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.7-2.6-6.1-4.2-8.7-.5 2-1.6 3.2-2.8 3.7.4-3.3-.9-6.3-3.6-8.2.3 3.6-1.6 5.6-3 7.5C4.2 11.2 5 13 5 15.2 5 19.2 8 22 12 22z"/><path d="M12 22c-1.8 0-3-1.3-3-3 0-2 1.6-3 2.4-4.6.6 1.2 1.6 1.8 2.6 2 .6.9 1 1.6 1 2.6 0 1.7-1.2 3-3 3z"/>',
    // sports
    fb: '<path d="M4.5 19.5C3 15 4.6 8.6 8.8 5.6 12 3.4 17 3 19.5 4.5 21 9 19.4 15.4 15.2 18.4 12 20.6 7 21 4.5 19.5z"/><path d="M4.8 19.2 19.2 4.8M10 11l1.5 1.5M12.5 8.5 14 10M7.5 13.5 9 15"/>',
    bb: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5v19M5.3 5.3c3.3 3.3 3.3 10.1 0 13.4M18.7 5.3c-3.3 3.3-3.3 10.1 0 13.4"/>',
    hk: '<ellipse cx="12" cy="9" rx="8.5" ry="3.5"/><path d="M3.5 9v5c0 1.9 3.8 3.5 8.5 3.5s8.5-1.6 8.5-3.5V9"/>',
    base: '<circle cx="12" cy="12" r="9.5"/><path d="M6.5 4.5c1.8 2 2.8 4.6 2.8 7.5s-1 5.5-2.8 7.5M17.5 4.5c-1.8 2-2.8 4.6-2.8 7.5s1 5.5 2.8 7.5"/><path d="M7.6 7.5l1.8-.6M8.6 10.5l1.9-.2M8.6 13.6l1.9.2M7.6 16.5l1.8.6M16.4 7.5l-1.8-.6M15.4 10.5l-1.9-.2M15.4 13.6l-1.9.2M16.4 16.5l-1.8.6"/>',
    soc: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.2l4.2 3-1.6 4.9H9.4l-1.6-4.9z"/><path d="M12 7.2V2.6M16.2 10.2l4.4-1.4M14.6 15.1l2.7 3.8M9.4 15.1l-2.7 3.8M7.8 10.2 3.4 8.8"/>',
    ten: '<circle cx="12" cy="12" r="9.5"/><path d="M4.5 6.2c3.6 2.2 3.6 9.4 0 11.6M19.5 6.2c-3.6 2.2-3.6 9.4 0 11.6"/>',
    fight: '<path d="M6 10V7a3 3 0 0 1 3-3h5a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5H10a4 4 0 0 1-4-4z"/><path d="M6 12H4.5A1.5 1.5 0 0 1 3 10.5V9a1.5 1.5 0 0 1 3 0M8 18v3h8v-3M10 8h6"/>',
    golf: '<path d="M8 21V3l9 4-9 4"/><path d="M4 21h10"/>',
    other: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    // ui
    tv: '<rect x="2.5" y="5" width="19" height="13" rx="2"/><path d="M8 21h8M9 2l3 3 3-3"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    stadium: '<path d="M3 9c2-2 5.5-3 9-3s7 1 9 3v9c-2 2-5.5 3-9 3s-7-1-9-3z"/><path d="M3 9c2 2 5.5 3 9 3s7-1 9-3"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    phone: '<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
  };
  const FAM = { NFL: "fb", NCAAF: "fb", CFL: "fb", NBA: "bb", NCAAB: "bb", WNBA: "bb", NHL: "hk", MLB: "base", KBO: "base",
    NPB: "base", NCAABB: "base", MLS: "soc", SOCCER: "soc", TENNIS: "ten", UFC: "fight", MMA: "fight", GOLF: "golf" };
  return {
    tier: t => P[String(t || "").toUpperCase()] ? svg(P[String(t).toUpperCase()], "t-" + String(t).toUpperCase()) : "",
    sport: s => svg(P[FAM[String(s || "").toUpperCase()] || "other"], "s-" + (FAM[String(s || "").toUpperCase()] || "other")),
    ui: n => P[n] ? svg(P[n], "u-" + n) : "",
  };
})();
