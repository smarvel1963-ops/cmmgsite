/* SAVE AS: motor.js · LOCATION: C:/MarvelApps/cmmgsite/js/motor.js
 * The F1 + NASCAR race pages (Scott 10/12: "build f1 and nascar pages"), one engine for both:
 *   NEXT RACE   - ESPN's public racing calendar (no key): name, circuit + city (F1), countdown to the green flag, and the
 *                 F1 weekend sessions (FP / Sprint / Qualifying / Race) in Central time
 *   OUR PICKS   - relay task "board" (f1 | nascar), the same feed + masking as /app/board/: driver, market (Win / Top 3 /
 *                 Top 5) and the model score as a meter. A locked pick never carries the driver.
 *   LAST RACE   - ESPN's finishing order (top 10); our picks are marked in it only once Verified Results are public
 *                 (RESULTS_PUBLIC), the same gate the relay puts on graded history.
 *   UP NEXT     - the next four rounds on the calendar.
 * Model picks only - these markets carry no price, so the page shows none. */
(function () {
  const E = CMMG.esc, $ = id => document.getElementById(id);
  const CT = { timeZone: "America/Chicago" };
  const when = t => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("en-US", { ...CT, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT"; };
  const dshort = t => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { ...CT, month: "short", day: "numeric" }); };
  const fmtCd = s => { if (s <= 0) return "LIGHTS OUT"; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return d ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };
  const SESS = { FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3", SS: "Sprint Shootout", SR: "Sprint", Qual: "Qualifying", Race: "Race" };
  const MKT = m => ({ WIN: "WIN", TOP3: "TOP 3", TOP5: "TOP 5", TOP10: "TOP 10", PODIUM: "PODIUM" })[String(m || "").toUpperCase()] || String(m || "").replace(/TOP/i, "TOP ");
  const espn = async (cfg, q = "") => { try { return await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard${q}`)).json(); } catch (e) { return null; } };
  const raceComp = (cfg, ev) => { const cs = (ev && ev.competitions) || []; return cs.find(c => (c.type && c.type.abbreviation) === "Race") || cs[cs.length - 1] || null; };
  const driverOf = p => { const m = String(p.bet || "").match(/^(.*?)\s+-\s+/); return (m ? m[1] : p.bet || "").trim(); };
  const scoreOf = p => { const m = String(p.detail || "").match(/model score\s+([\d.]+)/i); return m ? Number(m[1]) : null; };
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

  function mount(cfg) {
    let PICKS = [], HIST = [], PUB = false, NEXT = null, LAST = null;
    SHELL.mount(cfg.key);

    function drawNext() {
      const el = $("next"); if (!NEXT) { el.innerHTML = ""; return; }
      const r = raceComp(cfg, NEXT.ev) || {}, green = r.date || NEXT.start, cir = NEXT.ev && NEXT.ev.circuit;
      const sessions = cfg.sessions && NEXT.ev ? (NEXT.ev.competitions || []).map(c => ({ ab: (c.type && c.type.abbreviation) || "", t: c.date, st: c.status && c.status.type && c.status.type.state })) : [];
      el.innerHTML = `<div class="nrace"><div style="min-width:0"><div class="lb">NEXT ${cfg.round}</div><div class="rname">${E(NEXT.label)}</div>
        <div class="meta">${cir ? `${E(cir.fullName || "")}${cir.address ? ` · ${E([cir.address.city, cir.address.country].filter(Boolean).join(", "))}` : ""} · ` : ""}${green ? when(green) : dshort(NEXT.start)}</div>
        ${sessions.length ? `<div class="sess">${sessions.map(s => `<span class="${s.ab === "Race" ? "race" : ""} ${s.st === "post" ? "done" : ""}"><b>${E(SESS[s.ab] || s.ab)}</b>${when(s.t).replace(/ CT$/, "")}</span>`).join("")}</div>` : ""}</div>
        <div class="cd"><b data-green="${E(green || "")}">${green ? fmtCd(Math.round((new Date(green) - Date.now()) / 1000)) : ""}</b><span>${cfg.flagWord}</span></div></div>`;
    }
    function drawPicks() {
      const el = $("picks");
      if (!PICKS.length) { el.innerHTML = `<div class="box"><h3>OUR PICKS</h3><p class="game">Our ${E(cfg.name)} picks for ${NEXT ? `the ${E(NEXT.label)}` : "the next race"} post race week — check back soon.</p></div>`; return; }
      const race = PICKS.find(p => p.game) ? PICKS.find(p => p.game).game : "";
      el.innerHTML = `<div class="box"><h3>OUR PICKS${race ? ` · ${E(race).toUpperCase()}` : ""}</h3><div class="dgrid">${PICKS.map((p, i) => {
        if (p.locked) return `<div class="dcard lk"><div class="pos">${i + 1}</div><div class="dn">${ICON.ui("lock")} Members-only pick</div><div class="dm">Unlock with your CMMG Discord membership</div>
          ${SHELL.STORE ? "" : `<a class="btn pro" style="text-decoration:none;margin-top:8px" href="${SHELL.UPGRADE}">Unlock</a>`}</div>`;
        const sc = scoreOf(p);
        return `<div class="dcard"><div class="pos">${i + 1}</div><div class="mk">${E(MKT(p.market))}</div><div class="dn">${E(driverOf(p))}</div>
          ${sc != null ? `<div class="meter" title="Model score ${E(sc)}"><i style="width:${Math.max(4, Math.min(100, sc))}%"></i></div><div class="dm">Model score <b>${E(sc)}</b></div>` : ""}
          ${p.tier ? `<span class="tag ${E(p.tier)}" style="margin-top:8px">${ICON.tier(p.tier)} ${E(p.tier)}</span>` : ""}</div>`; }).join("")}</div>
        <p class="game" style="margin-top:10px">Model picks for finishing position — these markets carry no price here.</p></div>`;
    }
    function drawLast() {
      const el = $("last"); if (!LAST) { el.innerHTML = ""; return; }
      const r = raceComp(cfg, LAST), rows = ((r && r.competitors) || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)).slice(0, 10);
      if (!rows.length || !(r.status && r.status.type && r.status.type.state === "post")) { el.innerHTML = ""; return; }
      const ours = PUB ? HIST.filter(h => norm(h.game) === norm(LAST.name) || norm(h.group) === norm(LAST.name)) : [];
      const mark = name => ours.find(h => norm(driverOf(h)) === norm(name));
      el.innerHTML = `<div class="box"><h3>LAST ${cfg.round} · ${E(LAST.name).toUpperCase()}</h3><div class="fin">${rows.map(c => { const a = c.athlete || {}, o = mark(a.displayName || a.fullName);
        return `<div class="frow ${c.order <= 3 ? "p" + c.order : ""}"><span class="fp">P${E(c.order)}</span>${a.flag && a.flag.href ? `<img src="${E(a.flag.href)}" alt="" width="22" height="15" loading="lazy">` : ""}
          <span class="fd">${E(a.displayName || a.fullName || "")}</span>${o ? `<span class="ours">OUR PICK · ${E(MKT(o.market))}</span><span class="rb ${E(o.result)}">${o.result === "WIN" ? "HIT" : o.result === "LOSS" ? "MISS" : E(o.result)}</span>` : ""}</div>`; }).join("")}</div></div>`;
    }
    function drawCal(cal) {
      const up = cal.filter(c => Date.parse(c.endDate || c.startDate) > Date.now()).slice(NEXT ? 1 : 0, (NEXT ? 1 : 0) + 4);
      $("cal").innerHTML = up.length ? `<div class="box"><h3>UP NEXT</h3><div class="calr">${up.map(c => `<div><b>${E(c.label)}</b><span>${dshort(c.startDate)}${c.endDate && dshort(c.endDate) !== dshort(c.startDate) ? " – " + dshort(c.endDate) : ""}</span></div>`).join("")}</div></div>` : "";
    }

    async function load() {
      const sb = await espn(cfg), cal = ((sb && sb.leagues && sb.leagues[0] && sb.leagues[0].calendar) || []);
      const cur = sb && (sb.events || [])[0];
      const nxt = cal.find(c => Date.parse(c.endDate || c.startDate) > Date.now());
      LAST = cur && raceComp(cfg, cur) && raceComp(cfg, cur).status && raceComp(cfg, cur).status.type.state === "post" ? cur : null;
      if (nxt) {
        NEXT = { label: nxt.label, start: nxt.startDate, ev: null };
        if (cur && (cur.name === nxt.label) && !LAST) NEXT.ev = cur;
        else { const d = new Date(nxt.startDate).toISOString().slice(0, 10).replace(/-/g, ""); const s2 = await espn(cfg, `?dates=${d}`); NEXT.ev = s2 && (s2.events || []).find(e => e.name === nxt.label) || null; }
      }
      let j; try { j = await CMMG.relay({ task: "board", name: cfg.key, session: CMMG.session()?.token }); } catch (e) { j = null; }
      if (j && j.ok && j.live) { PICKS = j.picks || []; HIST = j.history || []; PUB = !!j.published; $("soon").innerHTML = ""; }
      else $("soon").innerHTML = `<div class="soonbar"><b>${E(cfg.name)} picks are coming to the site.</b> Until this board is switched on here, they post in the CMMG Discord.${SHELL.STORE ? "" : ` <a href="${SHELL.DISCORD}" style="color:var(--ice)">Open Discord</a>`}</div>`;
      drawNext(); drawPicks(); drawLast(); drawCal(cal);
    }
    setInterval(() => { const b = document.querySelector("[data-green]"); if (b && b.dataset.green) b.textContent = fmtCd(Math.round((new Date(b.dataset.green) - Date.now()) / 1000)); }, 1000);
    setInterval(load, 300000);
    load();
  }
  window.MOTOR = { mount };
})();
