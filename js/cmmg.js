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
    sessionStorage.setItem("cmmg.oauth", JSON.stringify({ verifier, state, at: Date.now() }));
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
  return { RELAY, REDIRECT, esc, relay, signIn, session, saveSession, signOut };
})();
