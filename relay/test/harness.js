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
console.log(`\n${ok} passed, ${bad} failed`);
