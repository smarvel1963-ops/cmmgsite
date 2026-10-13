/* SAVE AS: shell.js · LOCATION: C:/MarvelApps/cmmgsite/js/shell.js
 * The member-area frame shared by every page (storyboard #4): top bar with the Discord sign-in, the left menu in its
 * three groups (MAIN / MY CMMG / COMMUNITY & ACCOUNT), the membership box and the 21+ footer.
 * A page calls SHELL.mount("<page key>") and puts its own content in <main id="main">. Needs js/cmmg.js first. */
const SHELL = (() => {
  const UPGRADE = "https://winible.com/cmmgsports", DISCORD = "https://smarvel1963-ops.github.io/join/";
  const MENU = [
    ["MAIN", [["picks", "target", "Pro Track", "/app/"], ["dashboard", "home", "Dashboard", "/app/dashboard/"], ["scores", "clock", "Live Scores", "/app/scores/"], ["sport", "stadium", "Sport Hubs", "/app/sport/"],
              ["lives", "clock", "Live Totals", "/app/lives/"], ["board", "chart", "More Boards", "/app/board/?b=golf"],
              ["game", "stadium", "My Game Center", "/app/game/"]]],
    ["MY CMMG", [["mygames", "target", "My Games", "/app/mygames/"], ["tracker", "chart", "My Tracker", "/app/tracker/"], ["results", "shield", "Verified Results", "/app/results/"],  ["weekly", "chart", "Weekly Report", "/app/weekly/"],
                 ["teams", "star", "Schedules & My Teams", "/app/schedule/"], ["standings", "chart", "Standings", "/app/standings/"]]],
    ["COMMUNITY & ACCOUNT", [["alerts", "bell", "Alerts", "/app/alerts/"], ["community", "chat", "Discord Community", "/app/community/"], ["tools", "calc", "Strategy & Tools", "/app/tools/"], ["learn", "star", "Learn & Improve", "/app/learn/"], ["ask", "chat", "Ask CMMG", "/app/ask/"],
                             ["account", "gear", "Settings & Membership", "/app/account/"]]],
  ];
  const SOON = {};
  // STORE MODE (Google Play payments rule): when the app was opened from the Play Store build (start URL ?src=play, or
  // launched by the Android app), every link to the paid plans is hidden - members who pay elsewhere just sign in.
  // Remembered for the browser session so it holds on every page.
  let STORE = false;
  try {
    if (/[?&]src=(play|twa)\b/.test(location.search) || String(document.referrer).startsWith("android-app://")) sessionStorage.setItem("cmmg.store", "play");
    STORE = sessionStorage.getItem("cmmg.store") === "play";
  } catch (e) { STORE = /[?&]src=(play|twa)\b/.test(location.search); }
  if (STORE) document.documentElement.classList.add("store-play");
  const E = CMMG.esc;
  function plan(s) {
    if (!s) return { key: "out", name: "SIGNED OUT", paid: false };
    const has = a => s.me.access.indexOf(a) >= 0;
    if (has("elite")) return { key: "elite", name: "ELITE MEMBER", paid: true };
    if (has("pro")) return { key: "vip", name: "VIP MEMBER", paid: true };
    if (has("top5")) return { key: "top5", name: "TOP 5 PASS", paid: true };
    return { key: "free", name: "FREE MEMBER", paid: false };
  }
  function who() {
    const s = CMMG.session(), el = document.getElementById("who"); if (!el) return;
    if (!s) { el.innerHTML = `<button class="btn disc" data-signin>Continue with Discord</button>`; return; }
    const p = plan(s);
    el.innerHTML = `<a class="me" href="/app/account/" style="text-decoration:none">${s.me.avatar ? `<img src="${E(s.me.avatar)}" alt="">` : ""}<div><b>${E(s.me.name)}</b><br><span class="pill ${p.paid ? "pro" : ""}">${p.name}</span></div></a>`;
  }
  function membershipBox(el) {
    if (!el) return;
    const s = CMMG.session(), p = plan(s);
    if (!s) { el.innerHTML = `<h3>MEMBERSHIP</h3><p style="color:var(--dim);font-size:13px;margin:0 0 10px">Sign in with the Discord account you use in the CMMG server. Your access matches your Discord membership, so you never buy twice.</p><button class="btn disc" data-signin>Continue with Discord</button>`; return; }
    el.innerHTML = `<h3>MEMBERSHIP</h3>
      <div class="row"><span>Discord</span><span>✅ Connected${s.me.inServer ? "" : " (not in the CMMG server yet)"}</span></div>
      <div class="row"><span>Plan</span><span>${p.name}</span></div>
      ${p.paid ? "" : `<a class="btn" style="background:var(--gold);color:#241a00;text-decoration:none;display:inline-block;margin-top:10px" href="${UPGRADE}">See plans · VIP $30 · Elite $45</a>`}
      <p style="margin:10px 0 0"><a href="/app/account/" style="color:var(--ice);font-size:13px">Manage membership →</a></p>`;
  }
  function splash() {
    let seen = false; try { seen = sessionStorage.getItem("cmmg.splash") === "1" || localStorage.getItem("cmmg.nosplash") === "1"; sessionStorage.setItem("cmmg.splash", "1"); } catch (e) {}
    if (seen) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="splash" aria-label="CMMG Sports Edge loading"><div class="art"><div class="track"><div class="fill"></div></div></div></div>`);
    const el = document.querySelector(".splash"), fill = el.querySelector(".fill"), t0 = Date.now();
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = "85%"; }));
    const done = () => { fill.style.width = "100%"; setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 500); }, 350); };
    const ready = () => setTimeout(done, Math.max(0, 1500 - (Date.now() - t0)));
    if (document.readyState === "complete") ready(); else addEventListener("load", ready);
    setTimeout(done, 5000);                                   // never hold the page longer than this
    el.addEventListener("click", done);
  }
  function welcomeGate() {   // first visit while signed out -> the welcome / sign-in screen (design list #1)
    try {
      if (!CMMG.session() && localStorage.getItem("cmmg.welcomed") !== "1" && !/^\/app\/welcome\//.test(location.pathname)) {
        location.replace("/app/welcome/"); return true;
      }
    } catch (e) {}
    return false;
  }
  // SPORT THEME (Scott 10/11: "stick to sports themes no team or person themes"): the member picks a sport and the app
  // background becomes that sport's playing surface, drawn in CSS (css/app.css .theme-*). Never a team or a player.
  const THEMES = { fb: "Football field", bb: "Basketball court", base: "Baseball diamond", hk: "Hockey rink", soc: "Soccer pitch", ten: "Tennis court" };
  function theme() { try { const t = localStorage.getItem("cmmg.sporttheme"); return THEMES[t] ? t : null; } catch (e) { return null; } }
  function applyTheme() {
    try { localStorage.removeItem("cmmg.theme"); } catch (e) {}          // retired team-colour theme (10/11)
    Object.keys(THEMES).forEach(k => document.body.classList.remove("theme-" + k));
    const t = theme(); if (t) document.body.classList.add("theme-" + t);
  }
  function setTheme(t) { try { t ? localStorage.setItem("cmmg.sporttheme", t) : localStorage.removeItem("cmmg.sporttheme"); } catch (e) {} applyTheme(); }
  async function bell(active) {   // unseen alerts count: new picks + results not yet seen on the Alerts page (cached 5 min)
    const el = document.getElementById("bellN"); if (!el || active === "alerts") return;
    let ids;
    try { const c = JSON.parse(sessionStorage.getItem("cmmg.bellc") || "null"); if (c && Date.now() - c.t < 300000) ids = c.ids; } catch (e) {}
    if (!ids) { try { const j = await CMMG.relay({ task: "picks", session: CMMG.session()?.token });
      ids = (j.picks || []).flatMap(p => p.result && !p.locked ? ["pick:" + p.id, "res:" + p.id] : ["pick:" + p.id]);
      sessionStorage.setItem("cmmg.bellc", JSON.stringify({ t: Date.now(), ids })); } catch (e) { return; } }
    let seen = {}; try { seen = JSON.parse(localStorage.getItem("cmmg.alertseen") || "{}") || {}; } catch (e) {}
    const n = ids.filter(i => !seen[i]).length; if (n) { el.hidden = false; el.textContent = n > 9 ? "9+" : n; }
  }
  function cine() {   // turn the page's hero (or its first h1 + .sub) into the cinematic banner from Scott's designs
    let h = document.querySelector("main .vhero, main .phero, main .hero, main .thero, main .shero");
    if (!h) { const h1 = document.querySelector("main h1"); if (!h1) return;
      const sub = h1.nextElementSibling && h1.nextElementSibling.classList.contains("sub") ? h1.nextElementSibling : null;
      h = document.createElement("div"); h.className = "vhero"; h1.replaceWith(h); h.appendChild(h1); if (sub) { const p = document.createElement("p"); p.textContent = sub.textContent; sub.remove(); h.appendChild(p); } }
    if (h.classList.contains("cine")) return;
    h.classList.add("cine");
    const body = document.createElement("div"); body.className = "cine-t"; while (h.firstChild) body.appendChild(h.firstChild);
    h.innerHTML = `<div class="cine-wm" aria-hidden="true"><b>CMMG</b><i>SPORTS EDGE</i></div>`; h.appendChild(body);
  }
  // PULL-OUTS (Scott 10/11 "i like left side pull out ... right side pull out which would be live texts from discord or site")
  let LPT = "site", lpTimer = null;
  function openDrawer(which) {
    document.body.classList.toggle("dl-open", which === "left"); document.body.classList.toggle("dr-open", which === "right");
    if (which === "right") livefeed(); else { clearTimeout(lpTimer); }
  }
  function pullouts() {
    document.addEventListener("click", e => {
      const b = e.target.closest("[data-drawer]"); if (b) { const w = b.dataset.drawer; openDrawer(w === "close" || document.body.classList.contains(w === "left" ? "dl-open" : "dr-open") ? null : w); return; }
      const t = e.target.closest("[data-lpt]"); if (t) { LPT = t.dataset.lpt; document.querySelectorAll("[data-lpt]").forEach(x => x.classList.toggle("on", x === t)); livefeed(); }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") openDrawer(null); });
  }
  const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; };
  async function livefeed() {
    const el = document.getElementById("lpBody"); if (!el) return; clearTimeout(lpTimer);
    if (LPT === "discord") {
      let j; try { j = await CMMG.relay({ task: "community", session: CMMG.session()?.token }); } catch (e) { j = null; }
      const msgs = j && j.live ? (j.channels || []).flatMap(c => (c.messages || []).map(m => ({ ...m, ch: c.name }))).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 40) : [];
      el.innerHTML = msgs.length ? msgs.map(m => `<div class="lp-m"><div class="lp-a">${E((m.author || "?").slice(0, 1).toUpperCase())}</div><div><b>${E(m.author)}</b> <span class="lp-t">#${E(m.ch)} · ${ago(Date.parse(m.ts))}</span>
          ${m.text ? `<p>${E(m.text)}</p>` : ""}${m.embed ? `<p class="lp-e">${E(m.embed)}</p>` : ""}</div></div>`).join("") + `<a class="btn disc lp-open" href="${DISCORD}">Open in Discord</a>`
        : `<p class="lp-empty">Live Discord messages show here once the CMMG feed is connected.</p><a class="btn disc lp-open" href="${DISCORD}">Open the CMMG Discord</a>`;
    } else {
      let j; try { j = await CMMG.relay({ task: "picks", session: CMMG.session()?.token }); } catch (e) { j = null; }
      const ps = j && j.ok ? j.picks || [] : [], now = Date.now(), out = [], posted = j && j.at ? Date.parse(j.at) : now;
      ps.forEach(p => { const t = Date.parse(p.time);
        if (p.result && !p.locked) out.push([t + 3 * 36e5 < now ? t + 3 * 36e5 : now - 1, `<b class="rb ${E(p.result)}">${E(p.result[0])}</b> ${E(p.bet)} <span class="lp-t">${E(p.sport)}</span>`]);
        else if (!p.result && t > now - 3 * 36e5 && t <= now) out.push([t, `${typeof ICON !== "undefined" ? ICON.ui("clock") : ""} <b>Game on</b> · ${p.locked ? E(p.sport) + " members-only pick" : E(p.bet)}`]);
        else if (!p.result && t > now && t - now < 60 * 6e4) out.push([t - 60 * 6e4, `<b>Starting soon</b> · ${p.locked ? E(p.sport) + " members-only pick" : E(p.bet)} · ${new Date(t).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })} CT`]);
        out.push([posted, `<span class="tag ${E(p.tier)}" style="font-size:10px;padding:1px 6px">${E(p.tier || "")}</span> New pick · ${p.locked ? E(p.sport) + " · members only" : E(p.bet)}`]); });
      out.sort((a, b) => b[0] - a[0]);
      el.innerHTML = out.length ? out.slice(0, 40).map(([t, h]) => `<div class="lp-s"><span class="lp-t">${ago(t)}</span><div>${h}</div></div>`).join("") : `<p class="lp-empty">No live updates yet today.</p>`;
    }
    if (document.body.classList.contains("dr-open")) lpTimer = setTimeout(livefeed, 60000);
  }
  // STAT TILES (Scott 10/11 mockups): big glowing colour icon picked from the tile's label + matching glow
  const KMAP = [[/LIVE/, "live", "red"], [/WIN ?%|WIN RATE|RECORD/, "trophy", "gold"], [/UNIT/, "coins", "green"], [/ROI/, "bars", "green"], [/ODDS/, "target", "red"],
    [/STREAK/, "flame", "orange"], [/FINAL|GRADED|RESULT/, "check", "green"], [/UPCOMING|NEXT|START|STILL OPEN|PENDING/, "clock", "blue"], [/ALERT/, "bell", "gold"],
    [/ACCESS|PLAN/, "crown", "gold"], [/PICK|GAMES|TOTAL|TRACKED/, "clip", "blue"]];
  function tiles() {
    document.querySelectorAll(".kpi:not(.kdeco), .tile:not(.kdeco)").forEach(k => {
      k.classList.add("kdeco"); if (k.querySelector("svg") && !k.closest(".tiles")) return;
      const l = (k.querySelector(".l") || k).textContent.toUpperCase(), t = ["ICE", "EDGE", "FIRE"].find(x => k.classList.contains(x.toLowerCase()));
      if (t) { const old = k.querySelector(".l svg"); if (old) old.remove(); k.insertAdjacentHTML("afterbegin", `<span class="kic">${ICON.tier(t)}</span>`); k.classList.add("kx", "k-" + t.toLowerCase()); return; }
      const m = KMAP.find(([re]) => re.test(l)); if (!m || typeof ICON.color !== "function") return;
      k.insertAdjacentHTML("afterbegin", `<span class="kic">${ICON.color(m[1])}</span>`); k.classList.add("kx", "k-" + m[2]);
    });
  }
  function mount(active) {
    if (welcomeGate()) return;
    applyTheme();
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
    // "Install app" only when the browser offers it (Android / desktop Chrome / Edge); iPhone uses Share -> Add to
    // Home Screen (steps on the Settings page). Hidden once installed.
    addEventListener("beforeinstallprompt", ev => {
      ev.preventDefault(); const prompt = ev;
      if (document.getElementById("installBtn")) return;
      document.getElementById("who")?.insertAdjacentHTML("beforebegin", `<button class="btn ghost" id="installBtn" style="margin-right:8px">Install app</button>`);
      document.getElementById("installBtn").addEventListener("click", async () => { prompt.prompt(); await prompt.userChoice.catch(() => {}); document.getElementById("installBtn")?.remove(); });
    });
    addEventListener("appinstalled", () => document.getElementById("installBtn")?.remove());
    splash();
    // DESIGN FRAME (Scott's designs): top icon nav + search + bell + member, a sport chip row, cinematic page banner.
    const ic = n => typeof ICON !== "undefined" ? ICON.ui(n) : "";
    const NAV = [["picks", "target", "Pro Track", "/app/"], ["dashboard", "home", "Dashboard", "/app/dashboard/"], ["scores", "clock", "Live Scores", "/app/scores/"],
      ["mygames", "star", "My Games", "/app/mygames/"], ["teams", "stadium", "Teams", "/app/schedule/"], ["results", "shield", "Results", "/app/results/"],
      ["tracker", "chart", "Tracker", "/app/tracker/"], ["alerts", "bell", "Alerts", "/app/alerts/"], ["tools", "calc", "Tools", "/app/tools/"],
      ["learn", "star", "Learn", "/app/learn/"], ["community", "chat", "Community", "/app/community/"]];
    const SPORTCHIPS = ["NFL", "NCAAF", "NBA", "NCAAB", "WNBA", "MLB", "NHL", "MLS"];
    // extra boards (Scott 10/11) - their own page, not an ESPN sport hub
    const BOARDCHIPS = [["tennis", "TENNIS", "TENNIS"], ["lives", "LIVES", "LIVE TOTALS"], ["horses", "HORSES", "HORSES"], ["f1", "F1", "F1"], ["nascar", "NASCAR", "NASCAR"], ["golf", "GOLF", "GOLF"], ["dk", "DK", "DK"], ["prizepicks", "PRIZEPICKS", "PRIZEPICKS"]];
    const BOARDHREF = { tennis: "/app/tennis/", lives: "/app/lives/", horses: "/app/horses/", f1: "/app/f1/", nascar: "/app/nascar/" };   // boards that grew their own page (Scott 10/12 "build web horses page")
    const curBoard = active === "board" ? (new URLSearchParams(location.search).get("b") || "lives") : "";
    const curSport = new URLSearchParams(location.search).get("l");
    document.body.insertAdjacentHTML("afterbegin", `<header class="top">
      <button class="drawbtn" data-drawer="left" aria-label="Menu"><span class="hb"><i></i><i></i><i></i></span></button>
      <a class="logo wm" href="/"><img src="/img/lion_64.png" alt="" width="40" height="40"><span><b>CMMG</b><i>SPORTS EDGE</i></span></a>
      <nav class="topnav" aria-label="CMMG">${NAV.map(([k, i2, l, h]) => `<a class="${k === active ? "on" : ""}" href="${h}">${ic(i2)}<span>${l}</span></a>`).join("")}</nav>
      <form class="tsearch" action="/app/schedule/"><input name="q" placeholder="Search teams, games…" aria-label="Search"><button aria-label="Search">${ic("target")}</button></form>
      <div class="grow"></div>${STORE ? "" : `<a class="crown" href="/app/account/" title="Membership">${typeof ICON.color === "function" ? ICON.color("crown") : ic("star")}</a>`}
      <a class="bell" href="/app/alerts/" aria-label="Alerts">${typeof ICON.color === "function" ? ICON.color("bell") : ic("bell")}<b id="bellN" hidden></b></a><button class="drawbtn livebtn" data-drawer="right" aria-label="Live feed">${ic("chat")}<span>LIVE</span><b class="ldot"></b></button><div id="who"></div></header>
      <nav class="sportrow" aria-label="Sports">${SPORTCHIPS.map(k => `<a class="${active === "sport" && curSport === k ? "on" : ""}" href="/app/sport/?l=${k}">${typeof ICON !== "undefined" ? ICON.sport(k) : ""}${k === "MLS" ? "SOCCER" : k}</a>`).join("")}
        ${BOARDCHIPS.map(([k, ik, l]) => `<a class="${curBoard === k || active === k ? "on" : ""}" href="${BOARDHREF[k] || "/app/board/?b=" + k}">${typeof ICON !== "undefined" ? ICON.sport(ik) : ""}${l}</a>`).join("")}
        <a href="/app/standings/" class="${active === "standings" ? "on" : ""}">${ic("chart")}STANDINGS</a></nav>`);
    const rail = `<nav class="rail" aria-label="CMMG menu">` + MENU.map(([g, items]) => `<h4>${E(g)}</h4>` + items.map(([k, ic, label, href]) =>
      `<a class="${k === active ? "on" : ""} ${SOON[k] ? "soonlink" : ""}" href="${href}">${typeof ICON !== "undefined" ? ICON.ui(ic) : ""}${E(label)}${SOON[k] ? ' <span class="soon">soon</span>' : ""}</a>`).join("")).join("") + `</nav>`;
    document.body.insertAdjacentHTML("beforeend", rail.replace('<nav class="rail"', '<nav class="rail drawer-l" id="leftDrawer"') +
      `<aside class="drawer-r" id="livePanel" aria-label="Live feed"><div class="lp-h"><b>${ic("chat")} LIVE FEED</b><button data-drawer="close" aria-label="Close">✕</button></div>
        <div class="lp-tabs"><button data-lpt="site" class="on">CMMG</button><button data-lpt="discord">Discord</button></div><div id="lpBody" class="lp-b">Loading…</div></aside>
      <div class="drawer-bg" data-drawer="close"></div>`);
    pullouts();
    const flat = MENU.flatMap(([, items]) => items).filter(([k]) => !SOON[k] || k === active);
    document.querySelector("header.top").insertAdjacentHTML("afterend", `<nav class="mnav" aria-label="CMMG menu">` +
      flat.map(([k, ic, label, href]) => `<a class="${k === active ? "on" : ""}" href="${href}">${typeof ICON !== "undefined" ? ICON.ui(ic) : ""}${E(label)}</a>`).join("") + `</nav>`);
    const on = document.querySelector(".mnav a.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    // PHONE LAYOUT (Scott's design list #2): bottom tab bar Home / Picks / Scores / Tracker / More; More = sheet with the
    // rest of the menu. CSS shows it only on narrow screens (the rail stays on desktop).
    const TABS = [["picks", "target", "Pro Track", "/app/"], ["dashboard", "home", "Home", "/app/dashboard/"], ["scores", "clock", "Scores", "/app/scores/"],
                  ["tracker", "chart", "Tracker", "/app/tracker/"]];
    const inTabs = TABS.some(([k]) => k === active);
    document.body.insertAdjacentHTML("beforeend", `<nav class="tabbar" aria-label="CMMG app">` +
      TABS.map(([k, i, label, href]) => `<a class="${k === active ? "on" : ""}" href="${href}">${ic(i)}<span>${label}</span></a>`).join("") +
      `<button class="${inTabs ? "" : "on"}" data-more>${ic("gear")}<span>More</span></button></nav>
      <div class="moresheet" id="moreSheet" hidden><div class="ms-bg" data-more></div><div class="ms-panel"><div class="ms-grab"></div>` +
      MENU.flatMap(([, items]) => items).filter(([k]) => !TABS.some(([t]) => t === k)).map(([k, i, label, href]) =>
        `<a class="${k === active ? "on" : ""}" href="${href}">${ic(i)}${E(label)}</a>`).join("") +
      `<div class="ms-foot"><a href="/">${ic("home")}cmmgsports.com</a>${CMMG.session() ? `<button data-signout>${ic("shield")}Sign out</button>` : `<button data-signin>${ic("shield")}Sign in with Discord</button>`}</div></div></div>`);
    document.addEventListener("click", e => {
      if (!e.target.closest("[data-more]")) return;
      const sh = document.getElementById("moreSheet"); sh.hidden = !sh.hidden;
    });
    document.body.insertAdjacentHTML("beforeend", `<p class="rg">Information and entertainment only - no wagering in this app. Picks are opinions. No guarantee, and past results don't promise future ones. We don't take bets or hold funds.
      21+ (18+ where allowed). Bet only where it's legal for you. Gambling problem? Call or text <b>1-800-GAMBLER</b>. CMMG Sports Edge is not affiliated with or endorsed by any league, team or sportsbook; team names are used for identification only. <a href="/privacy/">Privacy</a> · <a href="/delete-account/">Delete account</a></p>`);
    tiles(); let tq = 0; new MutationObserver(() => { if (!tq) tq = requestAnimationFrame(() => { tq = 0; tiles(); }); }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    cine(); new MutationObserver(() => { if (document.querySelector("main .thero:not(.cine)")) cine(); }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    who(); membershipBox(document.getElementById("account"));
    bell(active);
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-signin],[data-signout]"); if (!t) return;
      if (t.hasAttribute("data-signin")) CMMG.signIn(); else { CMMG.signOut(); location.reload(); }
    });
  }
  return { mount, plan, membershipBox, who, UPGRADE, DISCORD, STORE, theme, setTheme, THEMES };
})();
