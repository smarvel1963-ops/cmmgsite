/* SAVE AS: tips.js · LOCATION: C:/MarvelApps/cmmgsite/js/tips.js
 * 💡 CMMG TIP side tab (Scott 10/17: "a side pop out button that when certain matching situation arise it flaches ...
 * when u open it it is a handicapping tip that that persom may need or need to learn ... even better if the are related to
 * sport he is looking at"). Scott's 100 tips + his tip -> sports list, built into /js/tips.json by data/build_tips.py,
 * with each tip's MOMENTS (the situations that make the tab flash - see build_tips.py).
 * Loaded by shell.js only when the switch is on (SHELL TIPS_ON, or owner preview: open any page with ?tips=1, ?tips=0
 * to stop). Pages raise situations with SHELL.tip(moment, sport); the tab flashes when a tip fits, and opening it shows
 * that tip - the sport being looked at first, then ALL-sports tips - never the same tip twice on this device until that
 * pool has been seen (localStorage cmmg.tips.seen). At most one flash per situation per page, and not more often than
 * every 90 seconds. Education only - nothing here is a pick. */
const CMMGTIPS = (() => {
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SEEN_KEY = "cmmg.tips.seen", LAST_KEY = "cmmg.tips.last", GAP = 90 * 1000;
  let TIPS = null, loading = null, PENDING = null, CTX = "";
  const raised = {};
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  function load() {
    if (TIPS) return Promise.resolve(TIPS);
    return loading = loading || fetch("/js/tips.json").then(r => r.json()).then(j => (TIPS = j.tips || [])).catch(() => (TIPS = []));
  }
  const fits = (t, sport) => !sport || t.sports.indexOf("ALL") >= 0 || t.sports.indexOf(String(sport).toUpperCase()) >= 0;
  // the best unseen tip for this moment: this sport's own tips first, then all-sports ones; a used-up pool starts over
  function pick(moment, sport) {
    const seen = get(SEEN_KEY, []);
    let pool = TIPS.filter(t => (!moment || t.moments.indexOf(moment) >= 0) && fits(t, sport));
    if (!pool.length && moment) pool = TIPS.filter(t => fits(t, sport));
    if (!pool.length) return null;
    const own = pool.filter(t => sport && t.sports.indexOf(String(sport).toUpperCase()) >= 0);
    const fresh = a => a.filter(t => seen.indexOf(t.n) < 0);
    const choose = fresh(own).length ? fresh(own) : fresh(pool).length ? fresh(pool) : pool;
    if (choose === pool && !fresh(pool).length) put(SEEN_KEY, seen.filter(n => !pool.some(t => t.n === n)));   // pool cycled
    return choose[Math.floor(Math.random() * choose.length)];
  }
  function ui() {
    if (document.getElementById("tipTab")) return;
    document.body.insertAdjacentHTML("beforeend", `<button id="tipTab" class="tiptab" aria-label="Handicapping tip"><span class="tb-i">💡</span><span class="tb-t">TIP</span></button>
      <aside id="tipPanel" class="tippanel" aria-hidden="true"><div class="tp-h"><b>💡 CMMG TIP</b><button class="tp-x" aria-label="Close">✕</button></div><div id="tipBody"></div>
      <div class="tp-f">Education only · not a pick · 21+ · Problem? Call 1-800-GAMBLER</div></aside>`);
    document.getElementById("tipTab").addEventListener("click", open);
    document.querySelector("#tipPanel .tp-x").addEventListener("click", close);
    document.getElementById("tipPanel").addEventListener("click", e => { if (e.target.closest("[data-tipnext]")) show(pick(PENDING ? PENDING.m : "", CTX)); if (e.target.closest("[data-tipok]")) close(); });
  }
  function show(t) {
    if (!t) { document.getElementById("tipBody").innerHTML = `<p class="tp-tx">No tip right now.</p>`; return; }
    const seen = get(SEEN_KEY, []); if (seen.indexOf(t.n) < 0) { seen.push(t.n); put(SEEN_KEY, seen); }
    const tags = t.sports.indexOf("ALL") >= 0 ? "All sports" : t.sports.join(" · ");
    document.getElementById("tipBody").innerHTML = `<div class="tp-n">TIP ${t.n} <span>${E(tags)}</span></div><h4 class="tp-ti">${E(t.title)}</h4><p class="tp-tx">${E(t.text)}</p>
      <div class="tp-b"><button class="btn go" data-tipok>Got it</button><button class="btn ghost" data-tipnext>Another tip</button></div>`;
  }
  function open() {
    document.getElementById("tipTab").classList.remove("flash");
    load().then(() => { show(PENDING ? PENDING.t : pick("", CTX)); PENDING = PENDING && { m: PENDING.m, t: null };
      const p = document.getElementById("tipPanel"); p.classList.add("on"); p.setAttribute("aria-hidden", "false"); });
  }
  function close() { const p = document.getElementById("tipPanel"); p.classList.remove("on"); p.setAttribute("aria-hidden", "true"); }
  // a situation happened: line up a fitting tip and flash the tab (once per situation per page, 90 s apart)
  function raise(moment, sport) {
    ui(); if (sport) CTX = String(sport).toUpperCase();
    const key = moment + "|" + (sport || ""); if (raised[key]) return; raised[key] = 1;
    load().then(() => {
      const t = pick(moment, sport || CTX); if (!t) return;
      PENDING = { m: moment, t };
      if (Date.now() - get(LAST_KEY, 0) < GAP) return;             // a tip is ready on the tab, it just doesn't flash yet
      put(LAST_KEY, Date.now());
      const tab = document.getElementById("tipTab"); tab.classList.remove("flash"); void tab.offsetWidth; tab.classList.add("flash");
    });
  }
  // the page opened: which sport it is about + the situations a plain page view stands for
  function page(active) {
    ui();
    const q = new URLSearchParams(location.search), l = (q.get("l") || "").toUpperCase();
    CTX = l || { tennis: "TENNIS", ufc: "UFC", golf: "GOLF", horses: "HORSES" }[active] || "";
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    const first = get("cmmg.tips.day", "") !== day; if (first) put("cmmg.tips.day", day);
    if (active === "sport" || active === "game" || CTX) raise("sport", CTX);     // a sport page: that sport's own tips first
    else if (first) raise("daily", "");
    else if (active === "results" || active === "tracker") raise("results", "");
    else if (active === "lives") raise("live", "");
  }
  // a live game's situation for SHELL.tip: "close_late" | "blowout" | "" (league-aware thresholds, last stretch only)
  function gameMoment(league, period, margin) {
    const L = String(league || "").toUpperCase(), m = Math.abs(Number(margin) || 0), p = Number(period) || 0;
    const R = { NBA: [4, 5, 18], WNBA: [4, 5, 18], NCAAB: [2, 5, 18], NFL: [4, 7, 21], NCAAF: [4, 7, 21], NHL: [3, 1, 3], MLB: [8, 1, 5], MLS: [2, 1, 3] }[L];
    if (!R) return "";
    if (m >= R[2]) return "blowout";
    return p >= R[0] && m <= R[1] ? "close_late" : "";
  }
  return { raise, page, gameMoment };
})();
