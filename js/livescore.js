/* SAVE AS: livescore.js · LOCATION: C:/MarvelApps/cmmgsite/js/livescore.js
 * LIVE SCORES FOR PICK CARDS (Scott 11/18: "todo list ice page has score column added" -> "Yes, the website's ICE
 * board"; built 11/20). ESPN's free public scoreboard, read in the browser like My Games / Live Totals / Scores - no key,
 * no relay part, nothing stored. The matcher and the winning / losing call are My Games' (masterhub-reviewer 10/17):
 * the game = both teams named in the pick's game text; the call leaves props, part-game and team totals uncoloured
 * ("no colour beats a wrong colour"). My Games still carries its own copy (moving it onto this file is a follow-up).
 *   LIVESCORE.find(sport, gameText, isoStart) -> Promise<game|null>  game = { state: pre|in|post, detail, teams:[away, home] }
 *   LIVESCORE.standing(bet, game) -> "win" | "lose" | "even" | ""
 *   LIVESCORE.clear()  - forget the cached scoreboards (the next find reads ESPN again)
 * CMMG Corp LLC */
(function () {
  const PATHS = { NFL: "football/nfl", NCAAF: "football/college-football", NBA: "basketball/nba",
    NCAAB: "basketball/mens-college-basketball", WNBA: "basketball/wnba", MLB: "baseball/mlb", NHL: "hockey/nhl", MLS: "soccer/usa.1" };
  const norm = s => String(s || "").toLowerCase();
  const ymd = iso => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).replace(/-/g, "");
  let CACHE = {};
  function board(l, day) {           // ESPN scoreboard for league + CT day (cached until clear())
    const k = l + day; if (CACHE[k]) return CACHE[k];
    const extra = l === "NCAAF" ? "&groups=80&limit=300" : l === "NCAAB" ? "&groups=50&limit=400" : "";
    return CACHE[k] = fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATHS[l]}/scoreboard?dates=${day}${extra}`)
      .then(r => r.json()).then(j => (j.events || []).map(e => {
        const c = e.competitions[0], st = e.status.type;
        return { id: e.id, l, date: e.date, state: st.state, detail: st.shortDetail,
          teams: c.competitors.slice().sort((a, b) => (a.homeAway === "away" ? 0 : 1) - (b.homeAway === "away" ? 0 : 1))
            .map(t => ({ abbr: t.team.abbreviation, name: t.team.displayName, short: t.team.shortDisplayName, nick: t.team.name,
                         location: t.team.location, score: t.score })) };
      })).catch(() => []);
  }
  const onGame = (txt, g) => g.teams.every(t => [t.name, t.short, t.nick].filter(n => n && n.length > 2).some(n => norm(txt).includes(norm(n))));
  async function find(sport, gameText, isoStart) {
    const l = String(sport || "").toUpperCase();
    if (!PATHS[l] || !gameText || !isoStart || isNaN(new Date(isoStart))) return null;
    const games = await board(l, ymd(isoStart));
    const hits = games.filter(g => onGame(gameText, g));
    if (hits.length <= 1) return hits[0] || null;
    const t0 = new Date(isoStart).getTime();      // same teams twice that day: the one nearest the pick's start
    return hits.slice().sort((a, b) => Math.abs(new Date(a.date) - t0) - Math.abs(new Date(b.date) - t0))[0];
  }
  // My Games' standing() (reviewed 10/17), unchanged: totals OVER/UNDER + line vs both scores; sides = the team named
  // in the bet (+ its spread, ML = 0) vs the other; anything the full-game score can't decide returns "".
  const tnames = t => [t.name, t.location, t.short, t.nick, t.abbr].filter(n => n && n.length > 1);
  const PROP_W = /\b(pts|points|reb|rebounds|ast|assists|pra|sog|shots|hits|hrr|runs|outs|yds|yards|rec|receptions|rush|pass|tds?|ks|tb|bases|saves|strikeouts|rbi|hr|threes|3pm|stl|blk|goals|fantasy|more|less)\b/i;
  const PART_W = /\b(1h|2h|1q|2q|3q|4q|1p|2p|3p|f5|f3|tt|team total|first half|second half)\b/i;
  function standing(bet, g) {
    if (!g || g.state === "pre" || !bet) return "";
    const [a, h] = g.teams, sa = Number(a.score), sh = Number(h.score); if (!isFinite(sa) || !isFinite(sh)) return "";
    const b = String(bet).trim(), cmp = d => d > 0 ? "win" : d < 0 ? "lose" : "even";
    if (PROP_W.test(b) || PART_W.test(b)) return "";
    const m = /\b(over|under)\s*([0-9]+(?:\.[0-9]+)?)(.*)$/i.exec(b) || /(?:^|[\s/])([ou])\s?([0-9]+(?:\.[0-9]+)?)(.*)$/i.exec(b);
    if (m) {
      if (/[a-z]/i.test(m[3].replace(/\(.*?\)/g, ""))) return "";
      const over = /^o/i.test(m[1]), d = sa + sh - Number(m[2]); return cmp(over ? d : -d);
    }
    const low = norm(b), esc = n => norm(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const best = t => Math.max(0, ...tnames(t).filter(n => new RegExp("(^|[^a-z])" + esc(n) + "([^a-z]|$)").test(low)).map(n => n.length));
    const la = best(a), lh = best(h); if (la === lh) return "";
    const side = la > lh ? a : h;
    const nums = (b.replace(/\(.*?\)/g, " ").match(/[+-]\d+(?:\.\d+)?/g) || []).map(Number), ln = nums.find(x => Math.abs(x) < 50);
    const line = /\bML\b|moneyline/i.test(b) || ln == null ? 0 : ln;
    const mine = side === a ? sa : sh, them = side === a ? sh : sa;
    return cmp(mine + line - them);
  }
  window.LIVESCORE = { PATHS, find, standing, clear: () => { CACHE = {}; } };
})();
