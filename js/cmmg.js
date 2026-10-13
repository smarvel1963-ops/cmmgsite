/* SAVE AS: cmmg.js · LOCATION: C:/MarvelApps/cmmgsite/js/cmmg.js
 * Shared helpers for cmmgsports.com: the relay call, Discord sign-in (Authorization Code + PKCE + one-time state),
 * the stored session, and safe HTML. Access is decided by the CMMG relay from the member's Discord roles -
 * this file only displays what the relay sends (locked picks arrive without their details). */
const CMMG = (() => {
  const RELAY = "https://script.google.com/macros/s/AKfycbz4tqd0Z-6rbVpLog-P3UCrvrvRm1drE-8dsYfWQVwqg1Y77dgzfFsSdJDZPWVpmX4C/exec";
  const CLIENT_ID = "1558985290188857356";
  const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const REDIRECT = LOCAL ? "http://127.0.0.1:8790/auth/" : "https://cmmgsports.com/auth/";
  const KEY = "cmmg.session";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };
  async function relay(body) {
    const r = await fetch(RELAY, { method: "POST", body: JSON.stringify(body) });   // text/plain: no CORS preflight
    return r.json();
  }
  async function signIn() {
    const verifier = rand(48), state = rand(24);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    sessionStorage.setItem("cmmg.oauth", JSON.stringify({ verifier, state, at: Date.now(), back: /^\/app\/[a-z/]*$/.test(location.pathname) ? location.pathname : "" }));
    const u = new URL("https://discord.com/oauth2/authorize");
    Object.entries({ client_id: CLIENT_ID, response_type: "code", redirect_uri: REDIRECT, scope: "identify guilds.members.read",
      state, code_challenge: challenge, code_challenge_method: "S256" }).forEach(([k, v]) => u.searchParams.set(k, v));
    location.assign(u.toString());
  }
  function session() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.me && Date.parse(s.me.until) > Date.now() ? s : null; } catch (e) { return null; }
  }
  const saveSession = (token, me) => { try { localStorage.setItem(KEY, JSON.stringify({ token, me })); } catch (e) { /* private mode */ } };
  const signOut = () => { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } };
  // CMMG records (Scott 10/12, site records fix): a pick's units = its STORED profit from the feed (the real payout as
  // MasterHub graded it), never odds x units. A graded WIN/LOSS without a stored profit has NO units (null) - a total
  // that includes one is unknown (null, shown "—"), never re-priced. Pro Track and the Free Pick are two records:
  // byNeed() splits them, and nothing on the site adds them together. (A member's OWN tracker rows are priced at the
  // member's odds by the relay - that is units_pl, not this.)
  const GRADED = { WIN: 1, LOSS: 1, PUSH: 1, VOID: 1 };
  const pl = p => {
    if (!p || !GRADED[p.result]) return 0;
    const v = p.profit;
    if (v !== null && v !== undefined && v !== "" && isFinite(Number(v))) return Number(v);
    return p.result === "PUSH" || p.result === "VOID" ? 0 : null;
  };
  const net = rows => { let t = 0; for (const p of rows || []) { const v = pl(p); if (v === null) return null; t += v; } return t; };
  const byNeed = (rows, need) => (rows || []).filter(p => (p.need || "pro") === need);
  const earliest = rows => (rows || []).reduce((m, p) => p && /^\d{4}-\d\d-\d\d$/.test(p.date || "") && (!m || p.date < m) ? p.date : m, "");
  return { RELAY, REDIRECT, esc, relay, signIn, session, saveSession, signOut, pl, net, byNeed, earliest };
})();
