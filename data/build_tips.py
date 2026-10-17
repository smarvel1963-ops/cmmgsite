"""SAVE AS: build_tips.py · LOCATION: C:/MarvelApps/cmmgsite/data/
Builds js/tips.json for the website's 💡 TIP side tab (Scott 10/17) from Scott's two verbatim lists:
  data/tips_source_2026-10-17.txt  (the 100 tips, title + text)
  data/tips_sports_2026-10-17.txt  (tip -> sports; "ALL SPORTS" = every sport)
plus MOMENTS below - Claude's mapping of each tip to the on-site situations that make the tab flash (Scott reviews it
before the switch goes on). Run: python data/build_tips.py  (rewrites js/tips.json; the lists are never edited)."""
import json, re, pathlib

HERE = pathlib.Path(__file__).parent
SPORT = {"SOCCER": "MLS", "MLS": "MLS", "TENNIS": "TENNIS", "GOLF": "GOLF"}   # the feed's sport codes

# situations (where the site raises them):
#  daily        first page of the day                      took         "I Took This Pick" opened
#  worse_price  took at worse odds than posted             parlay       a leg added to the parlay slip
#  sport        a sport page / game opened                  live         a live game / Live Totals open
#  close_late   a watched game close in the last stretch    blowout      a watched game lopsided
#  pick_losing  a tracked pick losing live / graded LOSS     pick_winning a tracked pick winning / graded WIN
#  losing_day   My Tracker: today in the red               winning_day  My Tracker: today in the green
#  results      Results / Tracker pages (records, samples)
MOMENTS = {
    1: "daily took", 2: "losing_day pick_losing", 3: "took daily", 4: "winning_day pick_winning", 5: "daily losing_day",
    6: "daily", 7: "took", 8: "results", 9: "parlay", 10: "losing_day", 11: "daily", 12: "parlay took", 13: "winning_day",
    14: "losing_day", 15: "losing_day results",
    16: "took sport", 17: "results took", 18: "took sport", 19: "took sport", 20: "worse_price took", 21: "sport",
    22: "worse_price took", 23: "worse_price sport", 24: "pick_losing results", 25: "took daily", 26: "took", 27: "took",
    28: "sport", 29: "daily results", 30: "sport daily",
    31: "sport", 32: "sport", 33: "sport", 34: "sport", 35: "sport", 36: "sport", 37: "sport", 38: "sport", 39: "sport",
    40: "sport live", 41: "sport", 42: "sport blowout", 43: "sport", 44: "sport pick_losing", 45: "sport",
    46: "live", 47: "live", 48: "live", 49: "close_late live", 50: "live", 51: "live", 52: "live", 53: "close_late",
    54: "blowout", 55: "live worse_price", 56: "live daily", 57: "live", 58: "blowout pick_losing", 59: "live sport",
    60: "close_late results",
    61: "results daily", 62: "results", 63: "results", 64: "results", 65: "results", 66: "results took", 67: "results",
    68: "results", 69: "results sport", 70: "results", 71: "results", 72: "results", 73: "results", 74: "pick_losing results",
    75: "results daily",
    76: "sport took", 77: "took daily", 78: "sport pick_winning", 79: "winning_day pick_winning", 80: "took",
    81: "pick_losing losing_day", 82: "winning_day pick_winning", 83: "blowout", 84: "live daily", 85: "losing_day",
    86: "sport", 87: "sport", 88: "sport", 89: "sport", 90: "sport live", 91: "sport", 92: "sport", 93: "sport", 94: "sport",
    95: "sport",
    96: "took daily", 97: "parlay", 98: "took results", 99: "results", 100: "daily losing_day",
}

src = (HERE / "tips_source_2026-10-17.txt").read_text(encoding="utf-8")
tips = {}
for m in re.finditer(r"^CMMG TIP (\d+) — (.+)\n(.+)$", src, re.M):
    tips[int(m.group(1))] = {"n": int(m.group(1)), "title": m.group(2).strip(), "text": m.group(3).strip()}
sports = {}
for line in (HERE / "tips_sports_2026-10-17.txt").read_text(encoding="utf-8").splitlines():
    m = re.match(r"^(\d+)\s+(.+)$", line)
    if m:
        v = m.group(2).strip()
        sports[int(m.group(1))] = ["ALL"] if v.upper() == "ALL SPORTS" else sorted({SPORT.get(x.strip().upper(), x.strip().upper()) for x in v.split(",")})
assert sorted(tips) == list(range(1, 101)), sorted(set(range(1, 101)) - set(tips))
assert sorted(sports) == list(range(1, 101)) and sorted(MOMENTS) == list(range(1, 101))
out = [dict(tips[n], sports=sports[n], moments=MOMENTS[n].split()) for n in range(1, 101)]
(HERE.parent / "js" / "tips.json").write_text(json.dumps({"v": "2026-10-17", "tips": out}, ensure_ascii=False, indent=0), encoding="utf-8")
print(f"{len(out)} tips -> js/tips.json")
