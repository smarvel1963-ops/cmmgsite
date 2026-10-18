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
    document.body.insertAdjacentHTML("beforeend", `<div id="bigday" class="bigday${perf ? " perfect" : ""}" role="status">
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
  const seenKey = (k, d) => "cmmg.bigday." + k + "." + d;
  async function check(pageKey, preview) {
    if (preview === "demo") { show("Top 5", { w: 4, l: 2, p: 0, net: 1.62 }, "", true); return; }
    if (preview === "perfect") { show("NHL", { w: 3, l: 0, p: 0, net: 2.71 }, "", true, true); return; }
    if (!pageKey) return;
    let j; try { j = await CMMG.relay({ task: "scoreboard", session: CMMG.session()?.token }); } catch (e) { return; }
    if (!j || !j.ok) return;
    const rows = (j.rows || []).concat(j.sports || []);
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
