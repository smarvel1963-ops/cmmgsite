/* SAVE AS: bigday.js · LOCATION: C:/MarvelApps/cmmgsite/js/bigday.js
 * BIG DAY celebration (Scott 10/17: "cool live graphic pop up when you open picks page and it had done really well" ->
 * "go with your bar"). When a picks page opens and ITS DAY is finished and big, a gold burst + confetti card shows the
 * page's REAL record for the day - once per page per day per viewer, never blocking the page, gone in a few seconds.
 * THE BAR (fixed in advance, never hand-picked): every pick this viewer can see is graded (nothing pending, nothing
 * locked), at least 3 graded W/L, units > 0, win rate >= 67% (Scott 10/17 "anythink of 67 is great").
 * PERFECT DAY (Scott: "a perfect score on sport is even better"): every graded pick won (3+) - the bigger 💯 card. On
 * Pro Track a perfect SPORT that day ("PERFECT NHL DAY 3-0") comes first, then Pro Track's own big day. Numbers = the relay's "scoreboard" task - the same day
 * record the dashboard shows (stored payouts; a page whose units aren't real money shows W-L only).
 * Loaded by shell.js only while BIGDAY_ON or the owner preview is on (?bigday=1 / ?bigday=0; ?bigday=demo shows a
 * sample card marked PREVIEW). */
const CMMGBIG = (() => {
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BAR = { minGraded: 3, minWR: 2 / 3 - 1e-9 };       // 67% = two of every three
  const big = t => { const g = t.w + t.l; return g >= BAR.minGraded && !t.pending && !t.locked && t.w / g >= BAR.minWR && (t.net == null || t.net > 0); };
  const perfect = t => big(t) && t.l === 0;
  const sgn = n => (n > 0 ? "+" : "") + (Math.round(n * 100) / 100).toFixed(2);
  function confetti(host) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.className = "bd-conf"; host.appendChild(c);
    const W = c.width = host.offsetWidth, H = c.height = host.offsetHeight, x = c.getContext("2d");
    const cols = ["#ffd700", "#fff3a8", "#4ade80", "#7fd8ff", "#ff7a45", "#ffffff"];
    const P = Array.from({ length: 140 }, () => ({ x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 10 - 3,
      s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[Math.floor(Math.random() * cols.length)] }));
    let t = 0;
    (function f() {
      x.clearRect(0, 0, W, H);
      P.forEach(p => { p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - t / 160); x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (++t < 170) requestAnimationFrame(f); else c.remove();
    })();
  }
  function show(name, t, day, preview, perf) {
    if (document.getElementById("bigday")) return;
    const g = t.w + t.l, wr = Math.round(100 * t.w / g);
    const when = day ? new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }) : "";
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="bigday${perf ? " perfect" : " corner"}" role="status">
      <div class="bd-card"><button class="bd-x" aria-label="Close">✕</button>${preview ? '<div class="bd-prev">PREVIEW · sample numbers</div>' : ""}
        <div class="bd-burst"></div><div class="bd-k">${perf ? "💯 PERFECT DAY" : "🏆 BIG DAY"}</div><div class="bd-n">${E(name)}</div>
        <div class="bd-rec">${t.w}-${t.l}${t.p ? "-" + t.p : ""}</div>
        <div class="bd-row"><span>${wr}% won</span>${t.net != null ? `<span class="bd-u">${sgn(t.net)}u</span>` : ""}</div>
        <div class="bd-d">${when ? E(when) + " · " : ""}every pick graded</div>
        <div class="bd-f">Past results don't promise future results · 21+</div></div></div>`);
    const el = document.getElementById("bigday"), close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 450); };
    el.querySelector(".bd-x").addEventListener("click", close);
    el.addEventListener("click", e => { if (e.target === el) close(); });
    requestAnimationFrame(() => { el.classList.add("on"); confetti(el.querySelector(".bd-card")); });
    setTimeout(close, 8000);
  }
  // FIRE STREAK (Scott 10/17 + his CMMG_Fire_Streak video): a page / sport whose CURRENT straight-win run reaches 5, 10,
  // 25 or 50 - full screen, out of the dark, embers + flames, his trophy art on top (img/fire_streak_art.jpg), the real
  // numbers drawn live below. The streak only exists inside a published lifetime total (relay v1.12), so it is OFF until
  // that page's record is switched on. Once per page per level per streak.
  const LEVELS = [50, 25, 10, 5];
  const level = n => LEVELS.find(l => n >= l) || 0;
  function embers(host, n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.className = "fs-embers"; host.appendChild(c);
    const W = c.width = innerWidth, H = c.height = innerHeight, x = c.getContext("2d");
    const P = Array.from({ length: n }, () => ({ x: Math.random() * W, y: H + Math.random() * H * 0.6, v: 0.6 + Math.random() * 1.6, s: 1 + Math.random() * 2.6,
      w: Math.random() * 6.28, c: Math.random() < 0.7 ? "255,190,60" : "255,120,40" }));
    let t = 0;
    (function f() {
      x.clearRect(0, 0, W, H);
      P.forEach(p => { p.y -= p.v; p.w += 0.03; p.x += Math.sin(p.w) * 0.6; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        x.beginPath(); x.arc(p.x, p.y, p.s, 0, 6.28); x.fillStyle = `rgba(${p.c},${0.35 + 0.55 * Math.abs(Math.sin(p.w * 2))})`; x.fill(); });
      if (document.body.contains(c) && ++t < 900) requestAnimationFrame(f);
    })();
  }
  function streakCard(label, st, preview) {
    if (document.getElementById("bigday")) return;
    const roi = st.roi != null ? (st.roi > 0 ? "+" : "") + (100 * st.roi).toFixed(1) + "%" : "—";
    const span = d => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }) : "";
    const dates = st.from ? (st.from === st.to ? span(st.from) : span(st.from) + "–" + span(st.to)) : "";
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="firestreak" role="status">
      <div class="fs-card"><div class="fs-flames"></div><button class="bd-x fs-x" aria-label="Close">✕</button>
        <img class="fs-art" src="/img/fire_streak_art.jpg" alt="CMMG Fire Streak">${preview ? '<div class="bd-prev fs-prev">PREVIEW · sample numbers</div>' : ""}
        <div class="fs-plate"><b>${st.n}</b><span>WIN<br>STREAK</span></div>
        <div class="fs-who">${E(label)}${level(st.n) > 5 ? ` · <em>LEVEL ${level(st.n)}</em>` : ""}</div>
        <div class="fs-stats"><div><small>Verified Record:</small><b>${st.n} - 0 ✓</b></div><div><small>ROI:</small><b class="${st.roi > 0 ? "pos" : ""}">${roi}</b></div>
          <div><small>Sample:</small><b>Last ${st.n} Picks</b></div></div>
        <a class="fs-btn" href="/app/results/">VIEW DETAILS ›</a>
        <div class="fs-ach">🏆 ACHIEVEMENT UNLOCKED${dates ? " · " + E(dates) : ""}</div>
        <div class="fs-f">A streak is not a promise of the next result · 21+</div></div></div>`);
    const el = document.getElementById("bigday"), close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 600); };
    el.querySelector(".fs-x").addEventListener("click", close);
    el.addEventListener("click", e => { if (e.target === el) close(); });
    embers(el, 90);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
    setTimeout(close, 11000);
  }
  // EDGE UNLOCKED (Scott 10/17: CMMG_Edge_Unlocked video + HTML): a POSTED EDGE pick the model rates ELITE - radar
  // sweep, lock-on, the signal panel. A SIGNAL, not an achievement (it shows before the result): the model's own class +
  // the real count of validation gates the pick passed, never an invented % edge. Only for a pick this viewer can see,
  // once per pick, before it's graded.
  const pretty = c => String(c || "").replace(/_/g, " ").replace(/\bML\b/, "MONEYLINE");
  function edgeCard(p, preview) {
    if (document.getElementById("bigday")) return;
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="edgeun" role="dialog" aria-label="CMMG Edge Unlocked">
      <section class="eu-modal"><button class="eu-x" aria-label="Close">×</button>
        <div class="eu-brand">CMMG SPORTS EDGE<span>LIVE INTELLIGENCE EVENT</span></div>
        <div class="eu-radar" aria-hidden="true"><i class="eu-dot a"></i><i class="eu-dot b"></i><i class="eu-dot c"></i></div>
        <div class="eu-scan">SCANNING MARKET DATA...</div>
        <div class="eu-signal"><h1>EDGE UNLOCKED</h1><p>MODEL SIGNAL QUALIFIED</p><div class="eu-edge">${E(pretty(p.edge_class))}</div>
          <div class="eu-pick">${E(p.bet)}<small>${E(p.game || "")}</small></div></div>
        <div class="eu-status">${p.gates ? E(p.gates) + " VALIDATION GATES PASSED" : "VALIDATION GATES PASSED"}</div>
        <div class="eu-fine">${preview ? "PREVIEW · SAMPLE PICK<br>" : ""}Model signal · not a guarantee or a live betting recommendation · 21+</div></section></div>`);
    const el = document.getElementById("bigday"), close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 450); };
    el.querySelector(".eu-x").addEventListener("click", close);
    el.addEventListener("click", e => { if (e.target === el) close(); });
    addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); removeEventListener("keydown", k); } });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
    setTimeout(close, 12000);
  }
  async function edgeCheck() {
    let j; try { j = await CMMG.relay({ task: "board", name: "edge", session: CMMG.session()?.token }); } catch (e) { return false; }
    const p = (j && j.ok && j.picks || []).find(x => !x.locked && !x.result && /^ELITE/.test(x.edge_class || "") &&
      (() => { try { return !localStorage.getItem("cmmg.edgeun." + x.id); } catch (e) { return true; } })());
    if (!p) return false;
    try { localStorage.setItem("cmmg.edgeun." + p.id, "1"); } catch (e) {}
    edgeCard(p, false); return true;
  }
  // PLATINUM PERFORMANCE (Scott 10/17: CMMG_Platinum_Performance video + HTML): a page / sport's VERIFIED lifetime record
  // reaches 100 / 250 / 500 / 1000 graded picks AND is in profit (units > 0) - a losing record never gets a trophy. Shows
  // the record, ROI and the date the record starts (his plan: "verified record, sample size, ROI, and evaluation period").
  // Lifetime totals are published page by page (relay SCOREBOARD_TOTALS), so this is OFF until a page's record is.
  const PLAT = [1000, 500, 250, 100];
  const platLevel = t => t && t.net != null && t.net > 0 ? PLAT.find(l => (t.n || 0) >= l) || 0 : 0;
  function platCard(label, t, preview) {
    if (document.getElementById("bigday")) return;
    const since = t.since ? new Date(t.since + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "";
    const roi = t.roi != null ? (t.roi > 0 ? "+" : "") + (100 * t.roi).toFixed(1) + "%" : "—";
    const parts = Array.from({ length: 45 }, (_, i) => `<i class="pp-part" style="--x:${(i * 37.1) % 100}%;--r:${i * 43}deg;--dur:${2.5 + (i % 5) * 0.45}s;--delay:${(i % 9) * 0.31}s;background:${["#f9d676", "#eff0f4", "#f6ae52"][i % 3]}"></i>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="platperf" role="dialog" aria-modal="true" aria-label="Platinum Performance">
      <section class="pp-modal"><button class="pp-x" aria-label="Close">×</button><div class="pp-parts">${parts}</div><div class="pp-in">
        <div class="pp-eye">CMMG SPORTS EDGE</div><div class="pp-med"><span aria-hidden="true">🏆</span></div>
        <h1>PLATINUM PERFORMANCE</h1><h2>MILESTONE UNLOCKED</h2>
        <div class="pp-who">${E(label)}</div>
        <div class="pp-stats">${platLevel(t)} GRADED PICKS · VERIFIED RESULTS</div>
        <div class="pp-grid"><div><small>Record</small><b>${t.w}-${t.l}${t.p ? "-" + t.p : ""}</b></div><div><small>ROI</small><b class="${t.roi > 0 ? "pos" : ""}">${roi}</b></div>
          <div><small>Sample</small><b>${t.n} picks</b></div><div><small>Since</small><b>${E(since)}</b></div></div>
        <a class="pp-view" href="/app/results/">VIEW PERFORMANCE</a>
        <p class="pp-hint">${preview ? "PREVIEW · sample numbers · " : ""}Verified CMMG results · past results don't promise future results · 21+</p></div></section></div>`);
    const el = document.getElementById("bigday"), close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 450); };
    el.querySelector(".pp-x").addEventListener("click", close);
    el.addEventListener("click", e => { if (e.target === el) close(); });
    addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); removeEventListener("keydown", k); } });
    setTimeout(close, 12000);
  }
  // 68%+ WIN RATE (Scott 10/17: CMMG_68_Win_Rate video + still): a page / sport's VERIFIED lifetime record with 100+ graded
  // picks, a 68%+ win rate AND in profit (a win rate alone can lose money - favourites pay little), with the breakeven printed
  // beside the win % (record audit 10/11). His shield art on top (side screens with player figures trimmed - CMMG site =
  // sport themes only), live numbers below. Once per page. OFF until lifetime totals are published page by page.
  const wrOk = t => t && (t.n || 0) >= 100 && t.w + t.l > 0 && t.w / (t.w + t.l) >= 0.68 && t.net != null && t.net > 0;
  function wrCard(label, t, preview) {
    if (document.getElementById("bigday")) return;
    const wr = (100 * t.w / (t.w + t.l)).toFixed(1), be = t.be != null ? (100 * t.be).toFixed(1) + "%" : "";
    const conf = Array.from({ length: 40 }, (_, i) => `<i class="pp-part" style="--x:${(i * 41.3) % 100}%;--r:${i * 37}deg;--dur:${2.4 + (i % 5) * 0.5}s;--delay:${(i % 8) * 0.33}s;background:${["#f5c84c", "#2ee07a", "#fff2c2"][i % 3]}"></i>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="wr68" role="dialog" aria-modal="true" aria-label="68% plus win rate">
      <section class="wr-modal"><button class="wr-x" aria-label="Close">×</button><div class="pp-parts">${conf}</div>
        <img class="wr-art" src="/img/winrate68_art.jpg" alt="CMMG 68%+ win rate">
        <div class="wr-in"><div class="wr-ver">VERIFIED PAGE PERFORMANCE</div><div class="wr-who">${E(label)}</div>
          <div class="wr-stats"><div><span>🏆</span><b>${wr}%</b><small>WINS${be ? " · BE " + be : ""}</small></div><div><span>📶</span><b>${t.w} - ${t.l}</b><small>RECORD</small></div><div><span>🧾</span><b>${t.n}</b><small>PICKS</small></div></div>
          <div class="wr-bar"><b>✓</b><div>THIS PAGE HAS ACHIEVED A <em>68%+ WIN RATE</em><small>${t.net != null ? (t.net > 0 ? "+" : "") + t.net.toFixed(2) + "u" : ""} · CONSISTENT PICKS · VERIFIED RESULTS</small></div></div>
          <a class="wr-view" href="/app/results/">👑 VIEW PAGE ›</a>
          <p class="wr-f">${preview ? "PREVIEW · sample numbers · " : ""}Past results don't promise future results · 21+</p></div></section></div>`);
    const el = document.getElementById("bigday"), close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 450); };
    el.querySelector(".wr-x").addEventListener("click", close);
    el.addEventListener("click", e => { if (e.target === el) close(); });
    addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); removeEventListener("keydown", k); } });
    setTimeout(close, 12000);
  }
  const seenKey = (k, d) => "cmmg.bigday." + k + "." + d;
  // never over the loading splash: wait until it's gone (up to 8 s), then a short beat
  const afterSplash = () => new Promise(res => { const t0 = Date.now(); (function w() { if (!document.querySelector(".splash") || Date.now() - t0 > 8000) setTimeout(res, 400); else setTimeout(w, 150); })(); });
  async function check(pageKey, preview) {
    await afterSplash();
    if (preview === "demo") { show("Top 5", { w: 4, l: 2, p: 0, net: 1.62 }, "", true); return; }
    if (preview === "perfect") { show("NHL", { w: 3, l: 0, p: 0, net: 2.71 }, "", true, true); return; }
    if (preview === "winrate") { wrCard("Pro Track", { w: 163, l: 75, p: 0, n: 238, net: 31.4, be: 0.556 }, true); return; }
    if (preview === "platinum") { platCard("Pro Track", { w: 64, l: 34, p: 2, n: 100, net: 14.2, roi: 0.138, since: "2026-09-03" }, true); return; }
    if (preview === "edge") { edgeCard({ bet: "Ohio State Buckeyes -2.5", game: "Ohio State Buckeyes @ Illinois Fighting Illini", edge_class: "ELITE_SPREAD_VALUE", gates: 9 }, true); return; }
    if (preview === "streak") { streakCard("NFL · Pro Track", { n: 5, from: "2026-10-12", to: "2026-10-16", net: 4.61, roi: 0.184 }, true); return; }
    if (!pageKey) return;
    let j; try { j = await CMMG.relay({ task: "scoreboard", session: CMMG.session()?.token }); } catch (e) { return; }
    if (!j || !j.ok) return;
    const rows = (j.rows || []).concat(j.sports || []);
    const edgeFirst = pageKey === "edge";     // on the EDGE page a fresh ELITE signal comes before any day celebration
    // FIRE STREAK first: this page's (and on Pro Track its sports') current run, at a level not yet shown for this streak
    const scope = pageKey === "pro" ? rows.filter(r => r.key === "pro" || r.key.indexOf("sport:") === 0) : rows.filter(r => r.key === pageKey);
    const hot = scope.map(r => ({ r, st: r.total && r.total.streak })).filter(x => x.st && level(x.st.n)).sort((a, b) => b.st.n - a.st.n)[0];
    if (hot) {
      const k = "cmmg.firestreak." + hot.r.key + "." + hot.st.from + "." + level(hot.st.n);
      let seen = false; try { seen = !!localStorage.getItem(k); if (!seen) localStorage.setItem(k, "1"); } catch (e) {}
      if (!seen) { streakCard(hot.r.key.indexOf("sport:") === 0 && pageKey === "pro" ? hot.r.name + " · Pro Track" : hot.r.name, hot.st, false); return; }
    }
    if (edgeFirst && await edgeCheck()) return;
    // PLATINUM: a lifetime milestone not shown yet on this phone (rarer than a streak, so it comes right after it)
    const plat = scope.map(r => ({ r, lv: platLevel(r.total) })).filter(x => x.lv).sort((a, b) => b.lv - a.lv)[0];
    if (plat) {
      const k = "cmmg.platinum." + plat.r.key + "." + plat.lv;
      let seen = false; try { seen = !!localStorage.getItem(k); if (!seen) localStorage.setItem(k, "1"); } catch (e) {}
      if (!seen) { platCard(plat.r.key.indexOf("sport:") === 0 && pageKey === "pro" ? plat.r.name + " · Pro Track" : plat.r.name, plat.r.total, false); return; }
    }
    // 68%+ WIN RATE: once per page (and on Pro Track, per sport)
    const wrHit = scope.find(r => wrOk(r.total) && (() => { try { return !localStorage.getItem("cmmg.wr68." + r.key); } catch (e) { return true; } })());
    if (wrHit) {
      try { localStorage.setItem("cmmg.wr68." + wrHit.key, "1"); } catch (e) {}
      wrCard(wrHit.key.indexOf("sport:") === 0 && pageKey === "pro" ? wrHit.name + " · Pro Track" : wrHit.name, wrHit.total, false); return;
    }
    // Pro Track: a PERFECT sport that day first ("PERFECT NHL DAY"), else Pro Track's own big day; other pages: their own row
    const pool = pageKey === "pro" ? (j.sports || []).filter(r => perfect(r.today)).concat(rows.filter(r => r.key === "pro")) : rows.filter(r => r.key === pageKey);
    const row = pool.find(r => big(r.today)); if (!row) return;
    const key = row.key === pageKey ? pageKey : pageKey + ">" + row.key;
    try { if (localStorage.getItem(seenKey(key, j.date))) return; localStorage.setItem(seenKey(key, j.date), "1"); } catch (e) {}
    const perf = perfect(row.today), sportRow = row.key.indexOf("sport:") === 0;
    show(sportRow && pageKey === "pro" ? row.name + " · Pro Track" : row.name, Object.assign({}, row.today, { net: row.units ? row.today.net : null }), j.date, false, perf);
  }
  return { check, big, perfect };
})();
