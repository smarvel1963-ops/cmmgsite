// SAVE AS: harness.js · LOCATION: C:/MarvelApps/cmmgsite/relay/test/harness.js
// Runs relay/Code.gs in Node with fake Apps Script services and a fake Discord. Usage: node relay/test/harness.js
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
let PROPS = {}, DISCORD = {};
const b64w = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
const env = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in PROPS ? PROPS[k] : null), setProperty: (k, v) => { PROPS[k] = String(v); },
    setProperties: o => { for (const k in o) PROPS[k] = String(o[k]); }, deleteProperty: k => { delete PROPS[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Logger: { log() {} },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    base64EncodeWebSafe: v => b64w(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v.map(x => x & 255))),
    base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")],
    computeHmacSha256Signature: (v, k) => [...crypto.createHmac("sha256", k).update(v).digest()],
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(x => x & 255)).toString("utf8") }),
  },
  ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 1 } },
  UrlFetchApp: { fetch: (url, o = {}) => {
    const res = (c, b) => ({ getResponseCode: () => c, getContentText: () => JSON.stringify(b) });
    if (url.endsWith("/oauth2/token")) return o.payload.code === DISCORD.code && o.payload.code_verifier === DISCORD.verifier && o.payload.client_secret === "sek" ? res(200, { access_token: "at1" }) : res(400, { error: "invalid_grant" });
    const auth = (o.headers || {}).Authorization;
    if (auth !== "Bearer at1") return res(401, {});
    if (url.endsWith("/users/@me")) return res(200, DISCORD.user);
    if (url.includes("/guilds/")) return DISCORD.roles ? res(200, { roles: DISCORD.roles }) : res(404, {});
    return res(500, {});
  } },
};
const R = new Function(...Object.keys(env), src + "\nreturn { doPost };")(...Object.values(env));
const post = o => R.doPost({ postData: { contents: JSON.stringify(o) } });
let ok = 0, bad = 0; const check = (n, c, g) => { if (c) { ok++; console.log("  PASS ", n); } else { bad++; console.log("  FAIL ", n, JSON.stringify(g)); } };
const V = "v".repeat(50), RED = "https://cmmgsports.com/auth/";
PROPS = { CMMG_FEED: JSON.stringify({ write: "wkey" }) };

check("no Discord secret yet: sign-in refuses politely", /isn't set up/.test(post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED }).error));
PROPS.DISCORD_SECRET = "sek";
DISCORD = { code: "abcdefghijk", verifier: V, user: { id: "111", username: "fan", global_name: "Fan" }, roles: null };
check("bad redirect refused", post({ task: "login", code: "abcdefghijk", verifier: V, redirect: "https://evil.com/" }).error === "bad redirect");
check("wrong PKCE verifier refused", !post({ task: "login", code: "abcdefghijk", verifier: "w".repeat(50), redirect: RED }).ok);
let L = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED });
check("not in the CMMG server: signs in as FREE", L.ok && L.me.access.join() === "free" && L.me.inServer === false, L);
const freeS = L.session;
DISCORD.roles = ["1471082166149578936", "999"]; DISCORD.user = { id: "222", username: "vip" };
L = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED });
check("VIP role: access = pro", L.ok && L.me.access.join() === "pro", L.me);
const proS = L.session;
DISCORD.roles = ["1554688062812856461"]; DISCORD.user = { id: "333", username: "t5" };
const top5S = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED }).session;
DISCORD.roles = ["1497727207630442586"]; DISCORD.user = { id: "444", username: "elite" };
L = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED });
check("Elite role: access = pro + elite", L.ok && L.me.access.slice().sort().join() === "elite,pro", L.me);
const eliteS = L.session;

// feed
check("feed: wrong write key refused", post({ task: "put", key: "nope", part: "today", data: {} }).error === "not allowed");
const big = "x".repeat(20000);
const today = { date: "2026-10-11", picks: [
  { id: "p1", sport: "NHL", time: "2026-10-11T21:10:00Z", tier: "ICE", game: "SEA @ WSH", bet: "OVER 6.0", odds: -125, need: "pro", note: big },
  { id: "f1", sport: "NFL", time: "2026-10-11T18:00:00Z", tier: "EDGE", game: "BUF @ KC", bet: "BUF ML", odds: -145, need: "free" },
  { id: "t1", sport: "MLB", time: "2026-10-11T23:00:00Z", tier: "FIRE", game: "LAD @ SD", bet: "LAD ML", odds: -120, need: "top5" },
  { id: "e1", sport: "NBA", time: "2026-10-11T23:30:00Z", tier: "ICE", game: "BOS @ NY", bet: "UNDER 221", odds: -110, need: "elite" } ] };
check("feed: PUT today (big, chunked)", post({ task: "put", key: "wkey", part: "today", data: today }).ok && Number(PROPS["F_today#n"]) >= 3);
let p = post({ task: "picks" });
const byId = a => Object.fromEntries(a.picks.map(x => [x.id, x]));
let b = byId(p);
check("signed out: free pick shown in full", b.f1.bet === "BUF ML" && !b.f1.locked);
check("signed out: premium picks are LOCKED stubs (no bet/odds/game)", b.p1.locked && b.p1.bet === undefined && b.p1.odds === undefined && b.p1.game === undefined && b.t1.locked, b.p1);
b = byId(post({ task: "picks", session: freeS }));
check("free member: still locked", b.p1.locked && b.t1.locked);
b = byId(post({ task: "picks", session: proS }));
check("pro (VIP) member: sees the premium picks + Top 5", b.p1.bet === "OVER 6.0" && !b.p1.locked && b.t1.bet === "LAD ML");
b = byId(post({ task: "picks", session: top5S }));
check("Top 5 Pass: sees Top 5, not the other premium picks", b.t1.bet === "LAD ML" && b.p1.locked);
check("VIP: an Elite-only pick stays LOCKED", byId(post({ task: "picks", session: proS })).e1.locked);
b = byId(post({ task: "picks", session: eliteS }));
check("Elite: sees Elite-only + VIP picks + Top 5", b.e1.bet === "UNDER 221" && b.p1.bet === "OVER 6.0" && b.t1.bet === "LAD ML");
check("VIP can't track an Elite-only pick", post({ task: "track", session: proS, pick: "e1" }).ok === false);
const forged = proS.split(".")[0].slice(0, -2) + "xx." + proS.split(".")[1];
check("a tampered session is refused (treated as signed out)", byId(post({ task: "picks", session: forged })).p1.locked);
const parts = proS.split("."), payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
payload.ent = ["pro"]; payload.uid = "evil";
const fake = b64w(Buffer.from(JSON.stringify(payload))) + "." + parts[1];
check("a self-promoted session (edited roles, old signature) is refused", byId(post({ task: "picks", session: fake })).p1.locked);

// tracker
check("tracking needs sign-in", /sign in/.test(post({ task: "track", pick: "p1" }).error));
const tr1 = post({ task: "track", session: proS, pick: "p1", odds: -120, units: 2 }); check("track a pick with my own odds", tr1.ok, tr1);
check("track the free pick", post({ task: "track", session: freeS, pick: "f1", odds: -150 }).ok);
post({ task: "put", key: "wkey", part: "history", data: { picks: [ { id: "p1", sport: "NHL", game: "SEA @ WSH", bet: "OVER 6.0", odds: -125, result: "WIN" } ] } });
let mt = post({ task: "mytracker", session: proS });
check("tracker: graded with MY odds (2u at -120 = +1.67u)", mt.ok && mt.rows[0].result === "WIN" && mt.rows[0].units_pl === 1.67 && mt.summary.won === 1, mt);
mt = post({ task: "mytracker", session: freeS });
check("each member sees only their own tracked picks", mt.rows.length === 1 && mt.rows[0].pick === "f1" && mt.rows[0].result === "PENDING");

// v1.1 leak fix
const leak = post({ task: "track", session: freeS, pick: "t1" });
check("v1.1: a free member can't track a locked premium pick", leak.ok === false && /members/.test(leak.error), leak);
check("v1.1: an unknown pick id is refused", post({ task: "track", session: proS, pick: "nope123" }).ok === false);
post({ task: "put", key: "wkey", part: "today", data: { date: "2026-10-12", picks: [ { id: "p9", need: "pro", sport: "NBA", tier: "ICE", game: "LAL @ DEN", bet: "UNDER 224.5", odds: -110 } ] } });
check("pro member tracks p9", post({ task: "track", session: proS, pick: "p9" }).ok);
// role lost -> the same uid signs in free: tracked p9 must not show its details
DISCORD.roles = []; DISCORD.user = { id: "222", username: "vip" };
const downS = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED }).session;
const mt2 = post({ task: "mytracker", session: downS });
const r9 = mt2.rows.find(r => r.pick === "p9");
check("v1.1: My Tracker hides a locked, ungraded pick's game/bet", r9 && r9.game === "" && r9.bet === "", r9);
check("remove works even for a pick no longer on the board", post({ task: "track", session: proS, pick: "gone123", remove: true }).ok);
check("v1.3: tracker rows carry the game date + my book", post({ task: "mytracker", session: proS }).rows.every(r => "date" in r && "myBook" in r));
check("forget needs sign-in", /sign in/.test(post({ task: "forget" }).error));
check("forget deletes my tracked picks", post({ task: "forget", session: proS }).ok && post({ task: "mytracker", session: proS }).rows.length === 0);
check("results stay unpublished until RESULTS_PUBLIC=1", post({ task: "results" }).published === false && !post({ task: "results" }).picks);
PROPS.RESULTS_PUBLIC = "1";
check("results publish graded picks only once switched on", (r => r.published && r.picks.every(p => p.result))(post({ task: "results" })));
post({ task: "put", key: "wkey", part: "history", data: { picks: [ { id: "p1", sport: "NHL", game: "SEA @ WSH", bet: "OVER 6.0", odds: -125, units: 2, result: "WIN", profit: 1.5, need: "pro" },
  { id: "f7", sport: "NFL", game: "BUF @ KC", bet: "BUF ML", odds: -145, result: "LOSS", need: "free" } ] } });
const rp = post({ task: "results" }).picks;
check("v1.8: results carry each pick's STORED profit (not odds x units) + need", rp[0].profit === 1.5 && rp[0].need === "pro" && rp[1].need === "free", rp);
check("v1.8: a pick with no stored profit says null (the site shows no units for it)", rp[1].profit === null, rp[1]);
delete PROPS.RESULTS_PUBLIC;
check("community stays off until a bot token + channels are set", post({ task: "community" }).live === false);
// v1.7 boards
check("board: unknown name refused", post({ task: "board", name: "nope" }).ok === false);
check("board: empty until the feed sends it", (r => r.ok && r.live === false)(post({ task: "board", name: "horses" })));
check("board: bad part name refused on put", post({ task: "put", key: "wkey", part: "board_evil", data: {} }).ok === false);
check("board: wrong key refused", post({ task: "put", key: "nope", part: "board_horses", data: {} }).ok === false);
post({ task: "put", key: "wkey", part: "board_horses", data: { date: "2026-10-12", picks: [
  { id: "h1", need: "free", sport: "HORSES", tier: "ICE", game: "Keeneland R5", bet: "#4 Win", odds: 250 },
  { id: "h2", need: "pro", sport: "HORSES", tier: "EDGE", game: "Keeneland R7", bet: "#2 Win", odds: 180 } ],
  history: [ { id: "h0", sport: "HORSES", bet: "#1 Win", result: "WIN" }, { id: "hx", sport: "HORSES", bet: "#3 Win" } ] } });
const hb = post({ task: "board", name: "horses" });
check("board: free pick visible, pro pick locked with no bet/odds", hb.live && hb.picks[0].bet === "#4 Win" && hb.picks[1].locked && !hb.picks[1].bet && hb.picks[1].odds === undefined, hb);
check("board: pro member sees the pro pick", post({ task: "board", name: "horses", session: proS }).picks[1].bet === "#2 Win");
check("board: history hidden until RESULTS_PUBLIC", post({ task: "board", name: "horses" }).history.length === 0);
PROPS.RESULTS_PUBLIC = "1";
check("board: history = graded only once public", (r => r.history.length === 1 && r.history[0].result === "WIN")(post({ task: "board", name: "horses" })));
delete PROPS.RESULTS_PUBLIC;
// v1.8 storage guard
post({ task: "put", key: "wkey", part: "board_horses", data: { date: "2026-10-12", picks: [{ id: "u1", need: "free", sport: "HORSES", bet: "Señor Café 🏇 - In the money (top 3)" }], history: [] } });
const chunks = Object.keys(PROPS).filter(k => /^F_board_horses#\d+$/.test(k)).map(k => PROPS[k]);
check("v1.8: stored chunks are pure ASCII (1 char = 1 byte)", chunks.length && chunks.every(c => /^[\x00-\x7f]*$/.test(c)), chunks[0] && chunks[0].slice(0, 120));
check("v1.8: non-ASCII text reads back exactly", post({ task: "board", name: "horses" }).picks[0].bet === "Señor Café 🏇 - In the money (top 3)");
const before = PROPS["F_history#0"];
const tooBig = post({ task: "put", key: "wkey", part: "history", data: { picks: [{ id: "x", bet: "y".repeat(130000) }] } });
check("v1.8: a part over its cap is refused and the last copy stays", tooBig.ok === false && /too big/.test(tooBig.error) && PROPS["F_history#0"] === before, tooBig);
check("v1.8: a board over 44 KB is refused", post({ task: "put", key: "wkey", part: "board_lives", data: { picks: [{ bet: "z".repeat(45000) }] } }).ok === false);
let trackOk = true; for (let i = 0; i < 305; i++) { post({ task: "put", key: "wkey", part: "today", data: { date: "2026-10-12", picks: [{ id: "q" + i, need: "free", sport: "NFL", bet: "B" }] } }); trackOk = post({ task: "track", session: freeS, pick: "q" + i }).ok && trackOk; }
check("v1.8: a member keeps at most 300 tracked picks", trackOk && post({ task: "mytracker", session: freeS }).rows.length === 300);
// "I play every CMMG pick" (10/12)
post({ task: "put", key: "wkey", part: "today", data: { date: "2026-10-13", picks: [
  { id: "a1", need: "pro", sport: "NFL", tier: "ICE", game: "A @ B", bet: "A ML", odds: -110, units: 1, result: "WIN", profit: 0.91, date: "2026-10-13" },
  { id: "a2", need: "elite", sport: "NBA", tier: "FIRE", game: "C @ D", bet: "OVER 220", odds: -110, units: 2, date: "2026-10-13" },
  { id: "a3", need: "free", sport: "MLB", tier: "EDGE", game: "E @ F", bet: "F ML", odds: 120, units: 1, result: "LOSS", profit: -1, date: "2026-10-13" } ] } });
DISCORD.roles = ["1471082166149578936"]; DISCORD.user = { id: "555", username: "vip2" };
const vipS = post({ task: "login", code: "abcdefghijk", verifier: V, redirect: RED }).session;
check("trackall: needs sign-in", post({ task: "trackall", on: true }).ok === false);
check("trackall: starts OFF", post({ task: "trackall", session: vipS }).auto === false);
check("trackall: turn ON", post({ task: "trackall", session: vipS, on: true }).auto === true);
let mta = post({ task: "mytracker", session: vipS });
const ar = id => mta.rows.find(r => r.pick === id);
check("trackall ON: every visible CMMG pick is counted (pro + free)", mta.auto === true && ar("a1") && ar("a3") && ar("a1").auto, mta.rows.map(r => r.pick));
check("trackall ON: an Elite-only pick a VIP can't see is not added", !ar("a2"));
check("trackall ON: AUTO row uses CMMG's stored payout", ar("a1").units_pl === 0.91 && ar("a3").units_pl === -1, [ar("a1"), ar("a3")]);
check("trackall ON: board picks are NOT auto-added (Pro Track + Free only)", !mta.rows.some(r => /^h\d|^u1/.test(r.pick)));
check("board pick: a member can track it (Took This Pick on every pick)", post({ task: "track", session: vipS, pick: "u1", odds: 300 }).ok);
check("board pick: shows in My Tracker with its bet", (r => r && /In the money/.test(r.bet))(post({ task: "mytracker", session: vipS }).rows.find(r => r.pick === "u1")));
post({ task: "track", session: vipS, pick: "u1", remove: true });
post({ task: "track", session: vipS, pick: "a1", odds: 150, units: 3 });
mta = post({ task: "mytracker", session: vipS });
check("trackall ON: an edited pick keeps MY numbers, not AUTO", !ar("a1").auto && ar("a1").units === 3 && ar("a1").units_pl === 4.5, ar("a1"));
check("trackall ON: no duplicate row for an edited pick", mta.rows.filter(r => r.pick === "a1").length === 1);
check("trackall: turn OFF -> AUTO rows gone, my own pick stays", (post({ task: "trackall", session: vipS, on: false }).auto === false)
  && (r => !r.rows.some(x => x.auto) && r.rows.length === 1 && r.rows[0].pick === "a1")(post({ task: "mytracker", session: vipS })));
console.log(`\n${ok} passed, ${bad} failed`);
