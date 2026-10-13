// SAVE AS: records.js · LOCATION: C:/MarvelApps/cmmgsite/relay/test/records.js
// Site records fix (Scott 10/12 "yes"): runs the REAL page scripts in Node against a tiny fake DOM and checks
//   #2 CMMG units = each pick's STORED profit (never odds x units; a missing payout -> "—", never re-priced)
//   #4 Verified Results / Weekly / Tracker / Home total PRO TRACK only; the Free Pick is its own record, never summed
//   #7 the Results range menu only offers windows the history covers; "All" names its start date
// Usage: node relay/test/records.js                       (synthetic fixture)
//        node relay/test/records.js --feed history.json --expect "151-109-5 +7.69"   (a real feed dump: the page's
//        Pro Track "All" record must equal MasterHub's canonical record for the same rows)
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
let ok = 0, bad = 0;
const check = (n, c, g) => { if (c) { ok++; console.log("  PASS ", n); } else { bad++; console.log("  FAIL ", n, g === undefined ? "" : JSON.stringify(g).slice(0, 400)); } };
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// ---------------------------------------------------------------- a fake DOM: just enough for these pages
function el(id) {
  const ls = {}, kids = [];
  const e = { id, innerHTML: "", textContent: "", value: "", hidden: false, disabled: false, dataset: {}, style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener(t, f) { (ls[t] = ls[t] || []).push(f); }, fire(t, ev) { (ls[t] || []).forEach(f => f(ev || { target: e })); },
    insertAdjacentHTML(_w, h) { e.innerHTML = h + e.innerHTML; }, closest() { return null; }, querySelector() { return null; }, showModal() {} };
  // a <select>: value must be one of its <option> values (as a browser does)
  Object.defineProperty(e, "value", { get() { const o = [...String(e.innerHTML).matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);
    return o.length && !o.includes(e._v) ? o[0] : e._v || ""; }, set(v) { e._v = String(v); } });
  return e;
}
function page(file, relay, extra = {}) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const els = {}, $ = id => (els[id] = els[id] || el(id));
  const store = {};
  const sandbox = {
    console, Math, Date, JSON, Number, String, Object, Array, Set, Map, Promise, RegExp, isFinite, isNaN, encodeURIComponent, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
    document: { getElementById: $, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, body: { insertAdjacentHTML() {} }, title: "" },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, sessionStorage: { getItem: () => null, setItem() {} },
    location: { hostname: "cmmgsports.com", pathname: "/app/", reload() {} }, crypto: {}, btoa: s => Buffer.from(s, "binary").toString("base64"),
    ICON: { sport: () => "", tier: () => "", ui: () => "" }, TIER_ICON: {}, SPORT_ICON: {},
    SHELL: { mount() {}, who() {}, membershipBox() {}, UPGRADE: "#", STORE: false, DISCORD: "#" }, ...extra,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "cmmg.js"), "utf8") + "\nthis.CMMG = CMMG;", sandbox);
  sandbox.CMMG.relay = async body => relay(body);
  sandbox.CMMG.session = () => extra.__session || null;
  for (const s of scripts) vm.runInContext(s, sandbox);
  return { $, els, sb: sandbox };
}
const tick = () => new Promise(r => setImmediate(r));
const strip = h => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- fixture
const CT = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const ago = n => new Date(new Date(CT + "T12:00:00Z").getTime() - n * 864e5).toISOString().slice(0, 10);
let FEED = [
  // Pro: 2-1-1, stored +2.40 +1.00 -1.50 0  = +1.90u   (odds x units would say +1.82 +0.91 -1.00 = +1.73u)
  { id: "a", date: ago(1), sport: "NFL", bet: "A ML", odds: -110, units: 2, tier: "ICE", result: "WIN", need: "pro", profit: 2.4 },
  { id: "b", date: ago(2), sport: "NFL", bet: "B ML", odds: -110, units: 1.1, tier: "EDGE", result: "WIN", need: "pro", profit: 1.0 },
  { id: "c", date: ago(3), sport: "NHL", bet: "C ML", odds: -120, units: 1, tier: "FIRE", result: "LOSS", need: "pro", profit: -1.5 },
  { id: "d", date: ago(40), sport: "MLB", bet: "D ML", odds: 120, units: 1, tier: "ICE", result: "PUSH", need: "pro", profit: 0 },
  // Free: 1-1, +0.85 -1.00 = -0.15u  -> its own record, never added to Pro
  { id: "f1", date: ago(1), sport: "NFL", bet: "F ML", odds: -118, units: 1, tier: "EDGE", result: "WIN", need: "free", profit: 0.85 },
  { id: "f2", date: ago(4), sport: "NBA", bet: "G ML", odds: -110, units: 1, tier: "EDGE", result: "LOSS", need: "free", profit: -1.0 },
];
let EXPECT = null;
if (arg("--feed")) { FEED = JSON.parse(fs.readFileSync(arg("--feed"), "utf8")).picks; EXPECT = arg("--expect"); }
const results = () => ({ ok: true, published: true, at: "x", picks: JSON.parse(JSON.stringify(FEED)) });

(async () => {
  console.log("\nsyntax of every page this fix touches");
  for (const f of ["app/results/index.html", "app/weekly/index.html", "app/tracker/index.html", "app/index.html", "app/scores/index.html", "app/horses/index.html"]) {
    let okS = true;
    for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { okS = e.message; } }
    check(`${f} inline scripts parse`, okS === true, okS);
  }
  for (const f of ["js/cmmg.js", "app/sw.js"]) { let okS = true; try { new vm.Script(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { okS = e.message; } check(`${f} parses`, okS === true, okS); }

  // ------------------------------------------------------------ cmmg.js helpers
  console.log("\ncmmg.js record helpers");
  const H = page("app/results/index.html", () => ({ ok: true, published: false })).sb.CMMG;
  check("pl = stored profit, not odds x units", H.pl({ result: "WIN", profit: 2.4, odds: -110, units: 2 }) === 2.4);
  check("pl: graded WIN with no stored profit = null (never re-priced)", H.pl({ result: "WIN", odds: -110, units: 1 }) === null);
  check("pl: PUSH / VOID without profit = 0", H.pl({ result: "PUSH" }) === 0 && H.pl({ result: "VOID" }) === 0);
  check("net: one missing payout makes the total unknown", H.net([{ result: "WIN", profit: 1 }, { result: "LOSS" }]) === null);
  check("net: sums stored profit", Math.abs(H.net([{ result: "WIN", profit: 1.25 }, { result: "LOSS", profit: -1.5 }]) + 0.25) < 1e-9);
  check("byNeed splits Pro (need missing = pro) from Free", H.byNeed([{ need: "free" }, {}, { need: "pro" }], "pro").length === 2);
  check("earliest = first graded date held", H.earliest([{ date: "2026-09-01" }, { date: "2026-08-28" }, { date: "" }]) === "2026-08-28");

  // ------------------------------------------------------------ Verified Results
  console.log("\n/app/results");
  const R = page("app/results/index.html", results);
  await tick(); await tick();
  const opts = [...R.$("fRange").innerHTML.matchAll(/<option value="([^"]*)">([^<]*)</g)].map(m => [m[1], m[2]]);
  const early = H.earliest(FEED);
  const cover = d => early <= new Date(new Date(CT + "T12:00:00Z").getTime() - (d - 1) * 864e5).toISOString().slice(0, 10);
  check(`#7 range menu: no window that starts before the earliest graded date (${early})`,
        opts.every(([v]) => v === "0" || v === "1" || (v === "ytd" ? early <= CT.slice(0, 4) + "-01-01" : cover(Number(v)))), opts);
  check("#7 'All' names the date it starts", opts.some(([v, l]) => v === "0" && /since/.test(l)), opts);
  if (!cover(90)) check("#7 no 'Last 90 days' when the history is shorter", !opts.some(([v]) => v === "90"), opts);
  if (early > CT.slice(0, 4) + "-01-01") check("#7 no 'Year to date' when the history starts after Jan 1", !opts.some(([v]) => v === "ytd"), opts);
  R.$("fRange").value = "0"; R.$("fRange").fire("change");
  const k = strip(R.$("kpis").innerHTML), prod = strip(R.$("prod").innerHTML);
  const S = rows => { const g = rows.filter(p => p.result === "WIN" || p.result === "LOSS"), w = g.filter(p => p.result === "WIN").length;
    const u = rows.reduce((a, p) => a + (["WIN", "LOSS", "PUSH", "VOID"].includes(p.result) ? Number(p.profit) || 0 : 0), 0);
    const pu = rows.filter(p => p.result === "PUSH").length;
    return { rec: `${w}-${g.length - w}${pu ? "-" + pu : ""}`, u: (u > 0 ? "+" : "") + u.toFixed(2) }; };
  const pro = S(FEED.filter(p => (p.need || "pro") === "pro")), free = S(FEED.filter(p => p.need === "free"));
  check(`#4 RECORD kpi = Pro Track only (${pro.rec})`, k.includes(`RECORD ${pro.rec} `), k);
  check(`#2 NET UNITS kpi = stored profit (${pro.u})`, k.includes(`NET UNITS ${pro.u}`), k);
  check("#4 the Free record is shown separately on its own card", prod.includes(`FREE PICK ${free.rec}`) && prod.includes(`${free.u}u`), prod);
  const combined = S(FEED);
  check("#4 no combined Pro+Free total anywhere in the KPIs", !k.includes(`RECORD ${combined.rec} `) || combined.rec === pro.rec, k);
  if (EXPECT) check(`real feed: page Pro Track 'All' = MasterHub canonical ${EXPECT}`, `${pro.rec.split("-").concat(["0"]).slice(0, 3).join("-")} ${pro.u}` === EXPECT
                    && k.includes(`NET UNITS ${pro.u}`), { page: k.slice(0, 120), want: EXPECT });
  R.$("prod").fire("click", { target: { closest: () => ({ dataset: { prod: "free" } }) } });
  const kf = strip(R.$("kpis").innerHTML);
  check("#4 switching to the Free card shows the Free record alone", kf.includes(`RECORD ${free.rec} `) && kf.includes(`NET UNITS ${free.u}`), kf);
  // a pick without a stored payout: units unknown, never odds x units
  FEED.push({ id: "z", date: ago(1), sport: "NFL", bet: "Z ML", odds: -110, units: 1, tier: "ICE", result: "WIN", need: "pro" });
  const R2 = page("app/results/index.html", results); await tick(); await tick();
  R2.$("fRange").value = "0"; R2.$("fRange").fire("change");
  check("#2 a graded pick with no stored profit -> NET UNITS '—', not re-priced", /NET UNITS — /.test(strip(R2.$("kpis").innerHTML)), strip(R2.$("kpis").innerHTML));
  FEED.pop();

  // ------------------------------------------------------------ Weekly
  console.log("\n/app/weekly");
  const W = page("app/weekly/index.html", b => b.task === "results" ? results() : { ok: false });
  await tick(); await tick();
  const D = s => new Date(s + "T12:00:00Z"), mon = s => { const d = D(s); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };
  const wk = mon(CT), inW = p => p.date >= wk && p.date <= new Date(D(wk).getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const wp = S(FEED.filter(p => (p.need || "pro") === "pro" && inW(p))), wf = FEED.filter(p => p.need === "free" && inW(p));
  const wk1 = strip(W.$("kpis").innerHTML);
  check(`#4 weekly RECORD = Pro Track only (${wp.rec || "0-0"})`, wk1.startsWith(`RECORD ${wp.rec}`), wk1);
  check("#4 the week's Free Pick is its own line", wf.length ? strip(W.$("freeWk").innerHTML).startsWith(S(wf).rec) : /No graded Free Pick/.test(W.$("freeWk").innerHTML), strip(W.$("freeWk").innerHTML));
  check("#7 Prev stops at the first week the data holds", (() => { for (let i = 0; i < 80 && !W.$("prev").disabled; i++) W.$("prev").fire("click"); return W.$("prev").disabled && W.$("wkLabel").textContent !== ""; })());

  // ------------------------------------------------------------ Tracker (CMMG side)
  console.log("\n/app/tracker");
  const sess = { token: "t", me: { until: "2999-01-01" } };
  const T = page("app/tracker/index.html", b => b.task === "results" ? results() : b.task === "mytracker" ? { ok: true, rows: [] } : { ok: true, date: CT }, { __session: sess });
  T.sb.RNG = "all";
  await tick(); await tick(); await tick();
  T.sb.document.addEventListener = () => {};
  vm.runInContext('RNG = "all"; draw();', T.sb);
  const tb = strip(T.$("body").innerHTML);
  check(`#4 + #2 tracker CMMG card = Pro Track at stored profit (${pro.rec}, ${pro.u})`,
        /CMMG PRO TRACK W-L-P/.test(tb) && tb.includes(`Units ${pro.u}`), tb.slice(0, 300));
  check("#4 tracker Free Pick is its own line", tb.includes("Free Pick (its own record)"), tb.slice(0, 400));
  check("#7 tracker 'All Time' names the date CMMG data starts", tb.includes("CMMG results on record from"), tb.slice(0, 400));

  // ------------------------------------------------------------ Home (today)
  console.log("\n/app/ (today's board)");
  const today = { ok: true, date: CT, at: null, picks: [
    { id: "t1", need: "pro", sport: "NFL", tier: "ICE", bet: "A ML", odds: -150, units: 1, result: "WIN", profit: 0.5 },
    { id: "t2", need: "pro", sport: "NFL", tier: "EDGE", bet: "B ML", odds: -110, units: 0.5, result: "LOSS", profit: -0.5 },
    { id: "t3", need: "free", sport: "NHL", tier: "EDGE", bet: "F ML", odds: 150, units: 1, result: "WIN", profit: 1.5 } ] };
  const Hm = page("app/index.html", b => b.task === "picks" ? today : { ok: false });
  await tick(); await tick();
  const tiles = strip(Hm.$("tiles").innerHTML), ring = strip(Hm.$("ring").innerHTML);
  check("#4 home tiles: Pro Track today 1-1, the Free win not added", /PRO TRACK TODAY 1-1/.test(tiles), tiles);
  check("#2 home tiles: Pro Track units = stored +0.0u (+0.5 -0.5), not odds math", /PRO TRACK UNITS \+?0\.0u/.test(tiles), tiles);
  check("#4 home ring: the Free Pick is its own line", /Free Pick: WON · \+1\.50u/.test(ring), ring);

  // ------------------------------------------------------------ Horses (recent finishes)
  console.log("\n/app/horses");
  const hb = { ok: true, live: true, published: true, date: CT, picks: [], history: [
    { id: "h1", sport: "HORSES", date: ago(1), time: ago(1) + "T20:00:00Z", course: "Santa Anita", race: 1, num: 4, horse: "Bravo",
      bet: "#4 Bravo - In the money (top 3)", market: "WIN", odds: 800, ml: "8/1", units: 1, result: "WIN", finish: "PLACE", profit: 1.2 } ] };
  const Ho = page("app/horses/index.html", b => b.task === "board" ? hb : { ok: false });
  await tick(); await tick();
  const ht = strip(Ho.$("hist").innerHTML);
  check("#8 a PLACE finish graded WIN shows its STORED payout +1.20u (not 8/1 x 1u = +8.00u)", /PLACE \+1\.20u/.test(ht) && !/\+8\.00/.test(ht), ht);
  check("#8 no units total on the horses page", !/TOTAL/i.test(ht), ht);

  console.log(`\n${ok} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
