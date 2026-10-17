/* SAVE AS: Code.gs · LOCATION: C:/MarvelApps/cmmgsite/relay/Code.gs
 * (the live copy is a Google Apps Script web app in Scott's Google account, project "CMMG relay" -
 *  this file is the source of record; the repo is public, so NO secrets ever go in this file)
 *
 * CMMG SPORTS EDGE RELAY v1.9.1 (v1.9.1: OWNER_IDS checked on every request, so an old session needs no re-sign-in. v1.9, Scott 10/17 "i am owner why am i locked out of live totals": the server owner holds no
 *   member role, so his session had no access. Discord user ids listed in Script Property OWNER_IDS get every access
 *   level at sign-in, whatever their roles. No OWNER_IDS = exactly as v1.8. Needs a redeploy + a fresh sign-in.
 *   v1.10 (Scott 10/17 "per sport daily and lifetime totals page by page"): scoreboard adds per-SPORT rows (Pro Track
 *   split by sport) and uses the feed's LIFETIME part ("records", cmmg_feed_lifetime.py) for pro/free/sport totals;
 *   "records" task now gated like the scoreboard. Totals still need RESULTS_PUBLIC + SCOREBOARD_TOTALS ("pro,free,sports").
 *   Also v1.9: task "scoreboard" - today's total + running total for every pick page; totals only with RESULTS_PUBLIC.)
 * was v1.8 (v1.8: "results" rows carry "profit" - each graded pick's STORED payout from MasterHub, which
 *   the site totals instead of odds x units (Scott 10/12 records fix #2). Storage guard (reviewer 10/12): putBig stores
 *   pure ASCII (non-ASCII escaped to \uXXXX, so an 8000-char chunk is 8000 bytes), feedPut refuses a part over its cap,
 *   a member keeps at most 300 tracked picks. Needs a redeploy of the live copy to take effect.)
 * was v1.7 (v1.7: "board" - extra boards Lives/Horses/F1/NASCAR/Golf/DK/PrizePicks, empty until the PC feed
 *   sends them (each board has its own OFF switch in data/cmmg_feed_config.json). v1.6: "community" - read-only Discord channel copy, OFF until DISCORD_BOT_TOKEN + COMMUNITY_CHANNELS)
 * was v1.5 (v1.5: "results" - Verified Results, OFF until RESULTS_PUBLIC=1)
 * was v1.4 (v1.4: "forget" deletes a member's stored data - Play rule)
 * was v1.3 (v1.3: My Tracker rows carry the game date/time + the member's own book/note)
 * was v1.1 (Scott 2026-10-11: "lets do it" - the website + app backend).
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
 *   OWNER_IDS       = optional, v1.9: Discord user ids (comma-separated) that get full access - Scott's own account
 */
const DISCORD_CLIENT_ID = "1558985290188857356";        // public (it's in the login link)
const GUILD_ID = "1469251277752893573";                  // the CMMG Discord server (eve_bot.EVE_GUILD_ID)
const REDIRECTS = ["https://cmmgsports.com/auth/", "http://127.0.0.1:8790/auth/"];   // second = local testing only
const SESSION_HOURS = 24;
// Access map (athena_bot WELCOME_PREMIUM_ROLE_IDS + TOP5_PASS_ROLE_ID), matched to the Winible plans Scott pointed at
// 10/11 (winible.com/cmmgsports): Free / VIP $30 mo / Elite $45 mo. "pro" = the VIP card (Pro Track, Top 10) - every
// paid role has it. "elite" = Elite-only feeds (live drops, last-minute captures, arbs) - Elite only. Override with ROLE_MAP.
const ROLE_MAP_DEFAULT = {
  "1497727207630442586": ["pro", "elite"],   // Elite Members
  "1471082166149578936": ["pro"],            // VIP Members
  "1497509875780161537": ["pro"],            // 1 Day Members
  "1496705632655511594": ["pro"],            // Server Boosters
  "1554688062812856461": ["top5"],           // Top 5 Pass
};
const CHUNK = 8000;                   // Script Property values max ~9 KB - big JSON is split
const TRACK_MAX = 300;                // a member's tracked picks kept (v1.8: 500 -> 300, Script Properties are ~500 KB in all)
// v1.8 byte caps per feed part (escaped JSON as stored). The PC exporter (cmmg_feed_export.py) caps a little lower, by
// UTF-8 bytes: history 120 KB, today 60 KB, each board 40 KB, all together ~320 KB - the margin here covers \u escapes.
const PART_CAP = { today: 64000, history: 128000, records: 44000, board: 44000 };

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
      case "results": return out(results(P));
      case "board": return out(board(P, session(P, req.session), req));
      case "scoreboard": return out(scoreboard(P, session(P, req.session)));
      case "community": return out(community(P, session(P, req.session)));
      case "track": return out(track(P, session(P, req.session), req));
      case "mytracker": return out(myTracker(P, session(P, req.session)));
      case "trackall": return out(trackAll(P, session(P, req.session), req));
      case "forget": return out(forget(P, session(P, req.session)));
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
  if (["today", "history", "records"].indexOf(req.part) < 0 && BOARDS.indexOf(String(req.part).replace(/^board_/, "")) < 0) return { ok: false, error: "unknown part" };
  const str = ascii(JSON.stringify({ at: new Date().toISOString(), data: req.data }));
  const cap = PART_CAP[/^board_/.test(req.part) ? "board" : req.part];
  if (str.length > cap) return { ok: false, error: "part too big: " + str.length + " > " + cap + " bytes - not stored (the last copy stays)" };
  putBig(P, "F_" + req.part, str);
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
  const ent = isOwner(P, user.id) ? OWNER_ENT.slice() : entitlements(P, member ? member.roles || [] : []);
  const s = { uid: String(user.id), name: String(user.global_name || user.username || "member").slice(0, 40),
              av: user.avatar ? "https://cdn.discordapp.com/avatars/" + user.id + "/" + user.avatar + ".png?size=64" : "",
              inServer: !!member, ent: ent, exp: Date.now() + SESSION_HOURS * 3600000 };
  return { ok: true, session: sign(P, s), me: publicMe(s) };
}
// v1.9 OWNER: the account(s) in OWNER_IDS see everything a member can buy (every need canSee knows: elite, pro, top5).
const OWNER_ENT = ["elite", "pro", "top5"];
function isOwner(P, uid) {
  const ids = String(P.getProperty("OWNER_IDS") || "").split(/[\s,]+/).filter(function (x) { return /^\d{15,22}$/.test(x); });
  return !!uid && ids.indexOf(String(uid)) >= 0;
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
  if (!s || !(s.exp > Date.now())) return null;
  // v1.9.1 (Scott 10/17 "live totals still have me locked out"): an owner's access is checked on EVERY request, not
  // only at sign-in - a session signed before OWNER_IDS was set (or before he was added) works at once, no re-sign-in.
  if (isOwner(P, s.uid)) s.ent = OWNER_ENT.slice();
  return s;
}

// ---------------------------------------------------------------- picks by entitlement
// A pick's "need" comes from the feed: "free", "pro", "elite" or "top5". Only the server decides what a session sees.
function canSee(s, need) { return need === "free" || (!!s && s.ent.indexOf(need) >= 0) || (!!s && need === "top5" && s.ent.indexOf("pro") >= 0); }
// v1.9 (found 10/17): today's Free Pick reached the feed UNGRADED while its graded copy was already in the history part
// (free OVER 154.5 lost 64-68; the live panel showed no L and the scoreboard called it pending). A today pick with no
// result takes its result + stored profit from the history copy with the same id. Never the other way round.
function withGrades(P, list, hist) {
  const g = {};
  if (!hist) { const h = getBig(P, "F_history"); hist = h && h.data && h.data.picks || []; }
  hist.forEach(function (p) { if (p && p.id && p.result) g[p.id] = p; });
  return list.map(function (p) { const x = p && !p.result && g[p.id];
    return x ? Object.assign({}, p, { result: x.result, profit: x.profit == null ? null : x.profit }) : p; });
}
function picks(P, s) {
  const f = getBig(P, "F_today");
  if (!f) return { ok: true, at: null, picks: [], note: "No picks published yet today." };
  const list = withGrades(P, f.data && f.data.picks || []).map(function (p) {
    if (canSee(s, p.need || "pro")) return p;
    return { id: p.id, sport: p.sport, time: p.time, tier: p.tier, need: p.need || "pro", locked: true };   // no pick/odds/line
  });
  return { ok: true, at: f.at, date: f.data && f.data.date, picks: list, me: s ? publicMe(s) : null };
}
// v1.7 BOARDS (Scott 10/11: "horses f1 nascar golf dk and prizepicks need pages", "auto live totals 3 basketball and
// football"). The feed sends part "board_<name>" = {date, picks:[...], history:[...]}. Today's picks are masked like
// Pro Track (a locked pick never carries its bet/odds); graded history only once RESULTS_PUBLIC = "1", same as Results.
const BOARDS = ["lives", "horses", "f1", "nascar", "golf", "dk", "prizepicks"];
function board(P, s, req) {
  const name = String(req.name || "");
  if (BOARDS.indexOf(name) < 0) return { ok: false, error: "unknown board" };
  const f = getBig(P, "F_board_" + name);
  if (!f) return { ok: true, live: false, picks: [] };
  const d = f.data || {};
  const list = withGrades(P, d.picks || [], d.history || []).map(function (p) {
    if (canSee(s, p.need || "pro")) return p;
    return { id: p.id, sport: p.sport, time: p.time, tier: p.tier, need: p.need || "pro", locked: true };
  });
  const pub = P.getProperty("RESULTS_PUBLIC") === "1";
  return { ok: true, live: true, at: f.at, date: d.date, picks: list, published: pub,
           history: pub ? (d.history || []).filter(function (p) { return p.result; }) : [] };
}
// v1.9 SCOREBOARD (Scott 10/17: "dashboard should be days total and running totals on all our pages we provide picks
// on"): one row per pick page - Pro Track, Free Pick, then every board. TODAY = today's graded picks (results only, no
// bet text, so a locked pick gives nothing away) + how many are still pending. RUNNING TOTAL = graded history plus
// today's graded picks not in it yet, and ONLY once RESULTS_PUBLIC = "1" (same switch as Verified Results). Units =
// each pick's STORED profit; a graded W/L with no stored profit makes that total unknown (null), never re-priced.
// Review 10/17 (masterhub-reviewer FIX FIRST + edge-auditor):
//  - TODAY counts only the picks THIS viewer can see (canSee, same rule as the picks feed); the rest are a "locked"
//    count. An anonymous visitor gets the Free Pick's day and nothing about a locked pick, not even its price.
//  - UNITS only on pages whose stored payouts are real money: Pro Track, Free Pick, Live Totals (paper alerts - the
//    page labels it). Horses (top-3 "in the money" at each finish's payout), PrizePicks (made-up -110), F1/NASCAR (no
//    odds) show W-L only.
//  - RUNNING TOTAL per page only when RESULTS_PUBLIC = "1" AND the page is listed in Script Property SCOREBOARD_TOTALS
//    (comma list, e.g. "pro,free"); none by default. It is the feed's rolling window (~45 days), shown "since <date>".
const SB_UNITS = { pro: 1, free: 1, lives: 1 };
const SB_NAMES = { pro: "Pro Track", free: "Free Pick", lives: "Live Totals", horses: "Horse Racing", f1: "F1", nascar: "NASCAR",
                   golf: "Golf", dk: "DK Lineups", prizepicks: "PrizePicks" };
function sbTally(rows) {
  const t = { w: 0, l: 0, p: 0, v: 0, pending: 0, net: 0 };
  rows.forEach(function (p) {
    const r = p.result;
    if (r === "WIN") t.w++; else if (r === "LOSS") t.l++; else if (r === "PUSH") t.p++; else if (r === "VOID") t.v++; else { t.pending++; return; }
    if (t.net === null) return;
    const v = p.profit;
    if (v !== null && v !== undefined && v !== "" && isFinite(Number(v))) t.net += Number(v);
    else if (r === "WIN" || r === "LOSS") t.net = null;
  });
  if (t.net !== null) t.net = Math.round(t.net * 100) / 100;
  return t;
}
// lt = LIFETIME tally from the feed's "records" part (cmmg_feed_lifetime.py: full archive from where it is complete,
// same dedupe/pregame/stored-profit rules) - when present the total is LIFETIME: lt + today's graded picks dated after
// lt.through. Without lt the total is the rolling ~45-day window, as before.
function sbRow(key, today, hist, s, totalsOn, lt, name) {
  const vis = today.filter(function (p) { return canSee(s, p.need || "pro"); });
  const td = sbTally(vis); td.locked = today.length - vis.length;
  if (!SB_UNITS[key] && key.indexOf("sport:") !== 0) td.net = null;
  let tot = null;
  if (totalsOn && lt) {
    const extra = sbTally(today.filter(function (p) { return p.result && String(p.date || "") > String(lt.through || ""); }));
    tot = { w: lt.w + extra.w, l: lt.l + extra.l, p: lt.p + extra.p, v: lt.v + extra.v,
            net: lt.net == null || extra.net == null ? null : Math.round((lt.net + extra.net) * 100) / 100,
            since: lt.since || "", lifetime: true };
  } else if (totalsOn) {
    const seen = {}; hist.forEach(function (p) { if (p.id) seen[p.id] = 1; });
    const all = hist.filter(function (p) { return p.result; }).concat(today.filter(function (p) { return p.result && !(p.id && seen[p.id]); }));
    tot = sbTally(all); delete tot.pending; if (!SB_UNITS[key]) tot.net = null;
    tot.since = all.reduce(function (m, p) { return /^\d{4}-\d\d-\d\d$/.test(p.date || "") && (!m || p.date < m) ? p.date : m; }, "");
  }
  return { key: key, name: name || SB_NAMES[key], units: !!SB_UNITS[key] || key.indexOf("sport:") === 0, paper: key === "lives", today: td, total: tot };
}
function scoreboard(P, s) {
  const pub = P.getProperty("RESULTS_PUBLIC") === "1", t = getBig(P, "F_today"), h = getBig(P, "F_history");
  const on = pub ? String(P.getProperty("SCOREBOARD_TOTALS") || "").split(/[\s,]+/).filter(Boolean) : [];
  const td = t && t.data || {}, tp = withGrades(P, td.picks || []), hp = h && h.data && h.data.picks || [];
  const isFree = function (p) { return (p.need || "pro") === "free"; }, notFree = function (p) { return !isFree(p); };   // same split both sides
  const rec = getBig(P, "F_records"), life = rec && rec.data || {}, lp = life.pages || {}, ls = life.sports || {};
  const rows = [sbRow("pro", tp.filter(notFree), hp.filter(notFree), s, on.indexOf("pro") >= 0, lp.pro),
                sbRow("free", tp.filter(isFree), hp.filter(isFree), s, on.indexOf("free") >= 0, lp.free)];
  BOARDS.forEach(function (b) {
    const f = getBig(P, "F_board_" + b); if (!f) return;
    const d = f.data || {}; rows.push(sbRow(b, withGrades(P, d.picks || [], d.history || []), d.history || [], s, on.indexOf(b) >= 0));
  });
  // PER SPORT (Scott 10/17 "yes per sport daily"): Pro Track's picks split by sport - every sport with a pick today or a
  // lifetime record. Totals only with "sports" in SCOREBOARD_TOTALS (and only from the lifetime part - no rolling cut).
  const sportsOn = on.indexOf("sports") >= 0, pro = tp.filter(notFree), names = {};
  pro.forEach(function (p) { names[String(p.sport || "OTHER").toUpperCase()] = 1; });
  if (sportsOn) Object.keys(ls).forEach(function (k) { names[k] = 1; });
  const sports = Object.keys(names).sort().map(function (sp) {
    return sbRow("sport:" + sp, pro.filter(function (p) { return String(p.sport || "OTHER").toUpperCase() === sp; }), [], s, sportsOn && !!ls[sp], ls[sp], sp);
  });
  return { ok: true, date: td.date || "", published: rows.concat(sports).some(function (r) { return r.total; }), rows: rows, sports: sports };
}
// v1.10: the "records" part now holds LIFETIME totals (cmmg_feed_lifetime.py) - never public on its own: served only
// with RESULTS_PUBLIC and only the pages/sports listed in SCOREBOARD_TOTALS (the scoreboard task is what the site uses).
function records(P) {
  if (P.getProperty("RESULTS_PUBLIC") !== "1") return { ok: true, at: null, records: null };
  const on = String(P.getProperty("SCOREBOARD_TOTALS") || "").split(/[\s,]+/).filter(Boolean);
  const r = getBig(P, "F_records"), d = r && r.data || {}, pages = {};
  Object.keys(d.pages || {}).forEach(function (k) { if (on.indexOf(k) >= 0) pages[k] = d.pages[k]; });
  return { ok: true, at: r ? r.at : null, records: { pages: pages, sports: on.indexOf("sports") >= 0 ? d.sports || {} : {} } };
}

// v1.5 Verified Results: every GRADED pick from the feed's history (wins, losses, pushes, voids), OFF until Scott sets
// Script Property RESULTS_PUBLIC = "1" (grade fixes + record decisions first - docs/cmmg_app/RECORD_AUDIT_2026-10-11.md).
function results(P) {
  if (P.getProperty("RESULTS_PUBLIC") !== "1") return { ok: true, published: false };
  const h = getBig(P, "F_history"), rows = (h && h.data && h.data.picks || []).filter(function (p) { return p.result; });
  return { ok: true, published: true, at: h ? h.at : null, picks: rows.map(function (p) {
    return { id: p.id, date: p.date, time: p.time, sport: p.sport, game: p.game, bet: p.bet, market: p.market, odds: p.odds,
             units: p.units, tier: p.tier, result: p.result, need: p.need, profit: p.profit == null ? null : p.profit };
  }) };
}

// v1.6 Community (design list #8): READ-ONLY copy of chosen CMMG Discord channels for the app's Community page. OFF until
// Scott sets Script Properties DISCORD_BOT_TOKEN (a read-only bot in the CMMG server) and COMMUNITY_CHANNELS =
// [{"id":"<channel id>","name":"Announcements","need":"free"}, ...]. Never posts. A channel whose "need" the session
// can't see is left out. Messages cached 60 s (CacheService) so members don't hammer Discord.
function community(P, s) {
  const token = P.getProperty("DISCORD_BOT_TOKEN"); let chans = [];
  try { chans = JSON.parse(P.getProperty("COMMUNITY_CHANNELS") || "[]"); } catch (e) { chans = []; }
  if (!token || !chans.length) return { ok: true, live: false };
  const cache = CacheService.getScriptCache(), out = [];
  chans.filter(function (c) { return canSee(s, c.need || "free"); }).slice(0, 8).forEach(function (c) {
    const key = "C_" + c.id; let msgs = null;
    try { msgs = JSON.parse(cache.get(key) || "null"); } catch (e) { msgs = null; }
    if (!msgs) {
      try {
        const r = UrlFetchApp.fetch("https://discord.com/api/v10/channels/" + encodeURIComponent(c.id) + "/messages?limit=20",
          { headers: { Authorization: "Bot " + token }, muteHttpExceptions: true });
        msgs = r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).map(function (m) {
          return { id: m.id, ts: m.timestamp, author: (m.author && (m.author.global_name || m.author.username)) || "", bot: !!(m.author && m.author.bot),
                   text: String(m.content || "").replace(/<@[!&]?\d+>/g, "@member").replace(/<#\d+>/g, "#channel").slice(0, 600),
                   reactions: (m.reactions || []).slice(0, 4).map(function (r) { return { e: (r.emoji && (r.emoji.id ? "" : r.emoji.name)) || "", n: r.count || 0 }; }).filter(function (r) { return r.e; }),
                   embed: (m.embeds && m.embeds[0] && (m.embeds[0].title || m.embeds[0].description || "")) ? String(m.embeds[0].title || m.embeds[0].description).slice(0, 300) : "" };
        }) : [];
        cache.put(key, JSON.stringify(msgs), 60);
      } catch (e) { msgs = []; }
    }
    out.push({ id: c.id, name: c.name || "channel", need: c.need || "free", messages: msgs });
  });
  return { ok: true, live: true, guild: GUILD_ID, channels: out };
}

// ---------------------------------------------------------------- I Took This Pick
function track(P, s, req) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  const id = String(req.pick || "").slice(0, 80);
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) return { ok: false, error: "bad pick" };
  // v1.1 (masterhub-reviewer 10/11): a member can only track a pick they are allowed to SEE - otherwise a free member
  // could track a locked pick's id and read its details back through My Tracker.
  const known = feedPicksById(P, true)[id];
  if (!known && !req.remove) return { ok: false, error: "that pick isn't on the board" };
  if (known && !canSee(s, known.need || "pro") && !known.result) return { ok: false, error: "that pick is for members — unlock it on Discord" };
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
// v1.4 (Google Play account-deletion rule): delete everything this relay keeps about the signed-in member - their
// tracked picks (the only per-member data; sessions are signed tokens and are not stored). Discord itself is untouched.
function forget(P, s) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const key = "T_" + s.uid, n = Number(P.getProperty(key + "#n") || 0);
    for (let i = 0; i < n; i++) P.deleteProperty(key + "#" + i);
    P.deleteProperty(key + "#n"); P.deleteProperty("A_" + s.uid);
    return { ok: true, deleted: n > 0 };
  } finally { lock.releaseLock(); }
}

// The member's tracked picks with the result from the feed's graded history (their own odds decide their units).
// "I play every CMMG pick" (Scott 10/12: "all cmmg bets are as i play them always i dont have to click them all"): a
// per-member switch (A_<uid> = "1"). ON = My Tracker also counts every Pro Track / Free pick the member can see, at CMMG's
// posted odds + stake and stored payout. A pick the member tracked or edited keeps the member's own numbers.
function trackAll(P, s, req) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  if (req.on === true || req.on === false) { if (req.on) P.setProperty("A_" + s.uid, "1"); else P.deleteProperty("A_" + s.uid); }
  return { ok: true, auto: P.getProperty("A_" + s.uid) === "1" };
}
function myTracker(P, s) {
  if (!s) return { ok: false, error: "sign in with Discord first" };
  const mine = getBig(P, "T_" + s.uid) || [];
  const byId = feedPicksById(P, true), core = feedPicksById(P);
  const auto = P.getProperty("A_" + s.uid) === "1";
  // v1.9 (Scott 10/17 "pretty sure my tracker is off on its data"): the feed only carries ~45 days, so a pick tracked by
  // hand used to fall back to PENDING with no bet text once it aged out. Now a tracked pick keeps a SNAPSHOT of its
  // graded result + details in the member's own list (m.snap); the feed's copy still wins while it has one (so a grade
  // correction flows through), and the snapshot answers after it's gone.
  // minimal (reviewer 10/17 #3: Script Properties is ONE ~500 KB pool shared with the feed - keep each snapshot ~80 bytes)
  const snapOf = function (p) { return { date: p.date || "", bet: String(p.bet || "").slice(0, 60), sport: p.sport || "",
    tier: p.tier || "", need: p.need || "pro", result: p.result, odds: p.odds != null ? p.odds : null }; };
  const fresh = {};
  mine.forEach(function (m) { const p = byId[m.pick];
    if (p && p.result) { const sn = snapOf(p); if (JSON.stringify(sn) !== JSON.stringify(m.snap || null)) fresh[m.pick] = sn; } });
  if (Object.keys(fresh).length) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(1500)) {                   // busy? skip the save - this read still answers, the next read saves it
      try { const cur = getBig(P, "T_" + s.uid) || []; cur.forEach(function (m) { if (fresh[m.pick]) m.snap = fresh[m.pick]; });
            putBig(P, "T_" + s.uid, JSON.stringify(cur.slice(-TRACK_MAX))); } finally { lock.releaseLock(); }
    }
    mine.forEach(function (m) { if (fresh[m.pick]) m.snap = fresh[m.pick]; });
  }
  // where the automatic CMMG rows start (the feed's oldest graded day) - the page says so when a range reaches back further
  const autoSince = Object.keys(core).reduce(function (a, id) { const d = core[id].date || ""; return /^\d{4}-\d\d-\d\d$/.test(d) && (!a || d < a) ? d : a; }, "");
  if (auto) {                                   // every visible Pro Track / Free pick the member hasn't tracked by hand
    const have = {}; mine.forEach(function (m) { have[m.pick] = true; });
    Object.keys(core).forEach(function (id) {
      const p = core[id];
      if (have[id] || !p || !p.bet || !canSee(s, p.need || "pro")) return;
      mine.push({ pick: id, at: p.time || p.date || "", odds: p.odds != null ? p.odds : null, units: p.units != null ? Number(p.units) : 1,
                  book: p.book || "", note: "", auto: true, cmmgProfit: p.profit != null ? Number(p.profit) : null });
    });
    mine.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }
  const rows = mine.map(function (m) {
    let p = byId[m.pick] || m.snap || {};
    if (p.id && !canSee(s, p.need || "pro") && !p.result) p = { need: p.need, sport: p.sport, tier: p.tier };   // never leak a locked pick
    const res = p.result || null, odds = m.odds != null ? m.odds : p.odds, u = m.units != null ? m.units : 1;
    let pl = null;
    if (m.auto && m.cmmgProfit != null && res) pl = m.cmmgProfit;                // AUTO row: CMMG's stored payout
    else if (res === "WIN" && odds) pl = odds > 0 ? u * odds / 100 : u * 100 / Math.abs(odds);
    else if (res === "LOSS") pl = -u; else if (res === "PUSH" || res === "VOID") pl = 0;
    return { pick: m.pick, at: m.at, date: p.date || "", time: p.time || "", game: p.game || "", bet: p.bet || "",
             sport: p.sport || "", tier: p.tier || "", need: p.need || "", myOdds: odds || null, units: u, myBook: m.book || "", note: m.note || "", auto: !!m.auto,
             result: res || "PENDING", units_pl: pl == null ? null : Math.round(pl * 100) / 100 };
  });
  const done = rows.filter(function (r) { return r.result === "WIN" || r.result === "LOSS"; });
  const w = done.filter(function (r) { return r.result === "WIN"; }).length;
  const net = rows.reduce(function (a, r) { return a + (r.units_pl || 0); }, 0);
  return { ok: true, auto: auto, auto_since: auto ? autoSince : "", rows: rows.reverse(), summary: { tracked: rows.length, won: w, lost: done.length - w,
           pushes: rows.filter(function (r) { return r.result === "PUSH"; }).length, pending: rows.filter(function (r) { return r.result === "PENDING"; }).length,
           net_units: Math.round(net * 100) / 100 } };
}

// Today's board + graded history, by id (graded history last, so a result wins over today's copy).
// boards = true adds every board's picks + history (Scott 10/12: "I Took This Pick ... on every pick for customer"), so a
// Live Totals / horses / F1 / NASCAR / golf / PrizePicks / DK pick can be tracked and shows in My Tracker. "I play every
// CMMG pick" (trackAll) stays Pro Track + Free only: boards are extra products, not the CMMG record.
function feedPicksById(P, boards) {
  const h = getBig(P, "F_history"), t = getBig(P, "F_today"), byId = {};
  let list = [].concat(t && t.data && t.data.picks || [], h && h.data && h.data.picks || []);
  if (boards) BOARDS.forEach(function (b) { const f = getBig(P, "F_board_" + b), d = f && f.data || {};
    list = list.concat(d.history || [], d.picks || []); });
  list.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
  return byId;
}

// ---------------------------------------------------------------- storage helpers (Script Properties, chunked)
// JSON with every non-ASCII character as \uXXXX: still the same JSON, and now 1 char = 1 byte, so a chunk can never
// pass the per-value byte limit however many accents / emoji a pick carries.
function ascii(str) { return String(str).replace(/[\u0080-\uffff]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")); }
function putBig(P, key, str) {
  str = ascii(str);
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
