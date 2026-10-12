/* SAVE AS: Code.gs · LOCATION: C:/MarvelApps/cmmgsite/relay/Code.gs
 * (the live copy is a Google Apps Script web app in Scott's Google account, project "CMMG relay" -
 *  this file is the source of record; the repo is public, so NO secrets ever go in this file)
 *
 * CMMG SPORTS EDGE RELAY v1.1 (Scott 2026-10-11: "lets do it" - the website + app backend).
 * v1.1: "I Took This Pick" only for picks the member may see; My Tracker never shows a locked pick (reviewer finding).
 * One small server for cmmgsports.com (and later the phone app):
 *   1. "Continue with Discord" - the site sends Discord's one-time code (+ PKCE verifier); the relay trades it for
 *      the member's identity, reads the member's ROLES in the CMMG server and turns them into access (DISCORD IS THE
 *      MASTER ACCESS AUTHORITY - docs/cmmg_app/MASTER_PLAN). It hands back its own signed session (24 h); the
 *      Discord token is never stored, so a role change shows up at the next sign-in (within a day).
 *   2. The picks feed - MasterHub (PC or server) PUTs today's published picks + graded history here every few
 *      minutes (cmmg_feed_export.py, write key only). The relay hands picks out by entitlement: free picks to
 *      everyone, premium picks ONLY to sessions whose roles allow them. A locked pick goes out as a stub (sport,
 *      time, tier, "locked") - never the pick, line or odds. That is checked HERE, never in the browser.
 *   3. "I Took This Pick" - a signed-in member's own tracked picks, stored per Discord id.
 *
 * Script Properties (Apps Script -> Project Settings -> Script properties):
 *   DISCORD_SECRET  = the Discord application's Client Secret (Scott pastes it; never in code)
 *   CMMG_FEED       = {"write":"<long random>"} (Scott pastes once from his clipboard; the PC config holds the same)
 *   SESSION_SECRET  = made by setup() the first time - never leaves the relay
 *   ROLE_MAP        = optional JSON override of ROLE_MAP below (role id -> list of entitlements)
 */
const DISCORD_CLIENT_ID = "1558985290188857356";        // public (it's in the login link)
const GUILD_ID = "1469251277752893573";                  // the CMMG Discord server (eve_bot.EVE_GUILD_ID)
const REDIRECTS = ["https://cmmgsports.com/auth/", "http://127.0.0.1:8790/auth/"];   // second = local testing only
const SESSION_HOURS = 24;
// v1 access map (athena_bot WELCOME_PREMIUM_ROLE_IDS + TOP5_PASS_ROLE_ID). Scott confirms what each role unlocks;
// until then every paid role = "pro" (all premium picks) and the Top 5 Pass = "top5". Override with ROLE_MAP.
const ROLE_MAP_DEFAULT = {
  "1497727207630442586": ["pro"],    // Elite Members ($20/wk)
  "1471082166149578936": ["pro"],    // VIP Members ($12/wk)
  "1497509875780161537": ["pro"],    // 1 Day Members ($7)
  "1496705632655511594": ["pro"],    // Server Boosters
  "1554688062812856461": ["top5"],   // Top 5 Pass
};
const CHUNK = 8000;                   // Script Property values max ~9 KB - big JSON is split
const TRACK_MAX = 500;                // a member's tracked picks kept

function doGet() { return out({ ok: true, app: "cmmg relay", v: 1 }); }

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const P = PropertiesService.getScriptProperties();
    switch (req.task) {
      case "put": return out(feedPut(P, req));
      case "login": return out(login(P, req));
      case "me": { const s = session(P, req.session); return out(s ? { ok: true, me: publicMe(s) } : { ok: false, error: "signed out" }); }
      case "picks": return out(picks(P, session(P, req.session)));
      case "record": return out(records(P));
      case "track": return out(track(P, session(P, req.session), req));
      case "mytracker": return out(myTracker(P, session(P, req.session)));
      default: return out({ ok: false, error: "unknown task" });
    }
  } catch (err) {
    Logger.log("cmmg relay error: " + (err && err.stack || err));
    return out({ ok: false, error: "something went wrong — try again in a minute" });
  }
}

// ---------------------------------------------------------------- feed (MasterHub -> relay)
function feedPut(P, req) {
  const cfg = JSON.parse(P.getProperty("CMMG_FEED") || "{}");
  if (!cfg.write || String(req.key || "") !== cfg.write) return { ok: false, error: "not allowed" };
  if (["today", "history", "records"].indexOf(req.part) < 0) return { ok: false, error: "unknown part" };
  putBig(P, "F_" + req.part, JSON.stringify({ at: new Date().toISOString(), data: req.data }));
  return { ok: true };
}

// ---------------------------------------------------------------- sign-in
function login(P, req) {
  const secret = P.getProperty("DISCORD_SECRET");
  if (!secret) return { ok: false, error: "sign-in isn't set up yet" };
  const redirect = String(req.redirect || "");
  if (REDIRECTS.indexOf(redirect) < 0) return { ok: false, error: "bad redirect" };
  const code = String(req.code || ""), verifier = String(req.verifier || "");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return { ok: false, error: "bad sign-in" };
  const tok = UrlFetchApp.fetch("https://discord.com/api/v10/oauth2/token", {
    method: "post", muteHttpExceptions: true,
    payload: { client_id: DISCORD_CLIENT_ID, client_secret: secret, grant_type: "authorization_code",
               code: code, redirect_uri: redirect, code_verifier: verifier },
  });
  if (tok.getResponseCode() !== 200) { Logger.log("token " + tok.getResponseCode() + " " + tok.getContentText().slice(0, 200)); return { ok: false, error: "Discord sign-in didn't go through — try again" }; }
  const at = JSON.parse(tok.getContentText()).access_token;
  const H = { headers: { Authorization: "Bearer " + at }, muteHttpExceptions: true };
  const u = UrlFetchApp.fetch("https://discord.com/api/v10/users/@me", H);
  if (u.getResponseCode() !== 200) return { ok: false, error: "couldn't read your Discord account" };
  const user = JSON.parse(u.getContentText());
  const m = UrlFetchApp.fetch("https://discord.com/api/v10/users/@me/guilds/" + GUILD_ID + "/member", H);
  const member = m.getResponseCode() === 200 ? JSON.parse(m.getContentText()) : null;   // 404 = not in the CMMG server
  const ent = entitlements(P, member ? member.roles || [] : []);
  const s = { uid: String(user.id), name: String(user.global_name || user.username || "member").slice(0, 40),
              av: user.avatar ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=64" : "",
              inServer: !!member, ent: ent, exp: Date.now() + SESSION_HOURS * 3600000 };
  return { ok: true, session: sign(P, s), me: publicMe(s) };
}
function entitlements(P, roles) {
  let map = ROLE_MAP_DEFAULT;
  try { const o = JSON.parse(P.getProperty("ROLE_MAP") || "null"); if (o && typeof o === "object") map = o; } catch (e) { /* default */ }
  const set = {};
  roles.forEach(function (r) { (map[String(r)] || []).forEach(function (x) { set[x] = true; }); });
  return Object.keys(set).sort();
}
const publicMe = s => ({ name: s.name, avatar: s.av, inServer: s.inServer, access: s.ent.length ? s.ent : ["free"], until: new Date(s.exp).toISOString() });

// A session = base64(payload) + "." + HMAC - the relay keeps no session list, it just checks its own signature.
function sessionSecret(P) {
  let k = P.getProperty("SESSION_SECRET");
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); P.setProperty("SESSION_SECRET", k); }
  return k;
}
function sign(P, s) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(s));
  const mac = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, sessionSecret(P)));
  return body + "." + mac;
}
function session(P, tok) {
  const t = String(tok || ""), i = t.indexOf(".");
  if (i < 1) return null;
  const body = t.slice(0, i), mac = t.slice(i + 1);
  const want = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, sessionSecret(P)));
  if (mac !== want) return null;
  const s = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString());
  return s && s.exp > Date.now() ? s : null;
}

// ---------------------------------------------------------------- picks by entitlement
// A pick's "need" comes from the feed: "free", "pro" or "top5". Only the server decides what a session sees.
function canSee(s, need) { return need === "free" || (!!s && s.ent.indexOf(need) >= 0) || (!!s && need === "top5" && s.ent.indexOf("pro") >= 0); }
function picks(P, s) {
  const f = getBig(P, "F_today");
  if (!f) return { ok: true, at: null, picks: [], note: "No picks published yet today." };
  const list = (f.data && f.data.picks || []).map(function (p) {
    if (canSee(s, p.need || "pro")) return p;
    return { id: p.id, sport: p.sport, time: p.time, tier: p.tier, need: p.need || "pro", locked: true };   // no pick/odds/line
  });
  return { ok: true, at: f.at, date: f.data && f.data.date, picks: list, me: s ? publicMe(s) : null };
}
function records(P) {
  const r = getBig(P, "F_records");
  return { ok: true, at: r ? r.at : null, records: r ? r.data : null };
}

// ---------------------------------------------------------------- I Took This Pick
function track(P, s, req) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  const id = String(req.pick || "").slice(0, 80);
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) return { ok: false, error: "bad pick" };
  // v1.1 (masterhub-reviewer 10/11): a member can only track a pick they are allowed to SEE - otherwise a free member
  // could track a locked pick's id and read its details back through My Tracker.
  const known = feedPicksById(P)[id];
  if (!known) return { ok: false, error: "that pick isn't on the board" };
  if (!canSee(s, known.need || "pro") && !known.result) return { ok: false, error: "that pick is for members — unlock it on Discord" };
  const num = (v, lo, hi) => { const n = Number(v); return isFinite(n) && n >= lo && n <= hi ? n : null; };
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const key = "T_" + s.uid, list = getBig(P, key) || [];
    const rec = { pick: id, at: new Date().toISOString(), odds: num(req.odds, -100000, 100000), line: String(req.line || "").slice(0, 20),
                  units: num(req.units, 0, 100), book: String(req.book || "").slice(0, 30), note: String(req.note || "").slice(0, 200) };
    const i = list.findIndex(function (x) { return x.pick === id; });
    if (req.remove) { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) list[i] = Object.assign(list[i], rec, { edited: rec.at }); else list.push(rec);
    putBig(P, key, JSON.stringify(list.slice(-TRACK_MAX)));
    return { ok: true, count: list.length };
  } finally { lock.releaseLock(); }
}
// The member's tracked picks with the result from the feed's graded history (their own odds decide their units).
function myTracker(P, s) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  const mine = getBig(P, "T_" + s.uid) || [];
  const byId = feedPicksById(P);
  const rows = mine.map(function (m) {
    let p = byId[m.pick] || {};
    if (p.id && !canSee(s, p.need || "pro") && !p.result) p = { need: p.need, sport: p.sport, tier: p.tier };   // never leak a locked pick
    const res = p.result || null, odds = m.odds != null ? m.odds : p.odds, u = m.units != null ? m.units : 1;
    let pl = null;
    if (res === "WIN" && odds) pl = odds > 0 ? u * odds / 100 : u * 100 / Math.abs(odds);
    else if (res === "LOSS") pl = -u; else if (res === "PUSH" || res === "VOID") pl = 0;
    return { pick: m.pick, at: m.at, game: p.game || "", bet: p.bet || "", sport: p.sport || "", tier: p.tier || "",
             myOdds: odds || null, units: u, result: res || "PENDING", units_pl: pl == null ? null : Math.round(pl * 100) / 100 };
  });
  const done = rows.filter(function (r) { return r.result === "WIN" || r.result === "LOSS"; });
  const w = done.filter(function (r) { return r.result === "WIN"; }).length;
  const net = rows.reduce(function (a, r) { return a + (r.units_pl || 0); }, 0);
  return { ok: true, rows: rows.reverse(), summary: { tracked: rows.length, won: w, lost: done.length - w,
           pushes: rows.filter(function (r) { return r.result === "PUSH"; }).length, pending: rows.filter(function (r) { return r.result === "PENDING"; }).length,
           net_units: Math.round(net * 100) / 100 } };
}

// Today's board + graded history, by id (graded history last, so a result wins over today's copy).
function feedPicksById(P) {
  const h = getBig(P, "F_history"), t = getBig(P, "F_today"), byId = {};
  [].concat(t && t.data && t.data.picks || [], h && h.data && h.data.picks || []).forEach(function (p) { byId[p.id] = p; });
  return byId;
}

// ---------------------------------------------------------------- storage helpers (Script Properties, chunked)
function putBig(P, key, str) {
  const old = Number(P.getProperty(key + "#n") || 0), n = Math.max(1, Math.ceil(str.length / CHUNK)), all = {};
  for (let i = 0; i < n; i++) all[key + "#" + i] = str.slice(i * CHUNK, (i + 1) * CHUNK);
  all[key + "#n"] = String(n);
  P.setProperties(all);
  for (let i = n; i < old; i++) P.deleteProperty(key + "#" + i);
}
function getBig(P, key) {
  const n = Number(P.getProperty(key + "#n") || 0); if (!n) return null;
  let s = ""; for (let i = 0; i < n; i++) s += P.getProperty(key + "#" + i) || "";
  try { return JSON.parse(s); } catch (e) { return null; }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Run ONCE from the editor: creates the session secret (it never leaves the relay).
function setup() { sessionSecret(PropertiesService.getScriptProperties()); Logger.log("ready"); }
