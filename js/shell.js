/* SAVE AS: shell.js · LOCATION: C:/MarvelApps/cmmgsite/js/shell.js
 * The member-area frame shared by every page (storyboard #4): top bar with the Discord sign-in, the left menu in its
 * three groups (MAIN / MY CMMG / COMMUNITY & ACCOUNT), the membership box and the 21+ footer.
 * A page calls SHELL.mount("<page key>") and puts its own content in <main id="main">. Needs js/cmmg.js first. */
const SHELL = (() => {
  const UPGRADE = "https://winible.com/cmmgsports", DISCORD = "https://smarvel1963-ops.github.io/join/";
  const MENU = [
    ["MAIN", [["dashboard", "home", "Dashboard", "/app/dashboard/"], ["picks", "target", "Today's Picks", "/app/"], ["scores", "clock", "Live Scores", "/app/soon/?p=scores"],
              ["game", "stadium", "My Game Center", "/app/soon/?p=game"]]],
    ["MY CMMG", [["tracker", "chart", "My Tracker", "/app/tracker/"], ["results", "shield", "Verified Results", "/app/soon/?p=results"],
                 ["teams", "star", "Teams · Players · Schedules", "/app/soon/?p=teams"]]],
    ["COMMUNITY & ACCOUNT", [["community", "chat", "Discord Community", "/app/community/"], ["tools", "calc", "Tools & Education", "/app/tools/"],
                             ["account", "gear", "Settings & Membership", "/app/account/"]]],
  ];
  const SOON = { scores: 1, game: 1, results: 1, teams: 1 };
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
    let seen = false; try { seen = sessionStorage.getItem("cmmg.splash") === "1"; sessionStorage.setItem("cmmg.splash", "1"); } catch (e) {}
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
  function mount(active) {
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
    document.body.insertAdjacentHTML("afterbegin", `<header class="top">
      <a class="logo" href="/" style="display:flex;align-items:center;gap:8px"><img src="/img/lion_64.png" alt="" width="34" height="34"><span style="display:block"><b>CMMG</b><span>SPORTS EDGE</span></span></a><div class="grow"></div><div id="who"></div></header>`);
    const rail = `<nav class="rail" aria-label="CMMG menu">` + MENU.map(([g, items]) => `<h4>${E(g)}</h4>` + items.map(([k, ic, label, href]) =>
      `<a class="${k === active ? "on" : ""} ${SOON[k] ? "soonlink" : ""}" href="${href}">${typeof ICON !== "undefined" ? ICON.ui(ic) : ""}${E(label)}${SOON[k] ? ' <span class="soon">soon</span>' : ""}</a>`).join("")).join("") + `</nav>`;
    const layout = document.querySelector(".layout"); if (layout) layout.insertAdjacentHTML("afterbegin", rail);
    const flat = MENU.flatMap(([, items]) => items).filter(([k]) => !SOON[k] || k === active);
    document.querySelector("header.top").insertAdjacentHTML("afterend", `<nav class="mnav" aria-label="CMMG menu">` +
      flat.map(([k, ic, label, href]) => `<a class="${k === active ? "on" : ""}" href="${href}">${typeof ICON !== "undefined" ? ICON.ui(ic) : ""}${E(label)}</a>`).join("") + `</nav>`);
    const on = document.querySelector(".mnav a.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    document.body.insertAdjacentHTML("beforeend", `<p class="rg">Information and entertainment only - no wagering in this app. Picks are opinions. No guarantee, and past results don't promise future ones. We don't take bets or hold funds.
      21+ (18+ where allowed). Bet only where it's legal for you. Gambling problem? Call or text <b>1-800-GAMBLER</b>. CMMG Sports Edge is not affiliated with or endorsed by any league, team or sportsbook; team names are used for identification only. <a href="/privacy/">Privacy</a> · <a href="/delete-account/">Delete account</a></p>`);
    who(); membershipBox(document.getElementById("account"));
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-signin],[data-signout]"); if (!t) return;
      if (t.hasAttribute("data-signin")) CMMG.signIn(); else { CMMG.signOut(); location.reload(); }
    });
  }
  return { mount, plan, membershipBox, who, UPGRADE, DISCORD, STORE };
})();
