---
name: lbast-new-leveler
description: Step-by-step workflow for adding a new auto-leveler / auto-grinder driver script (lbast_NAME.user.js) to this repo — a new bot to farm, a new quest, or any repeatable in-game route in "Последний бастион" (lbast.ru). Use this whenever the user describes a quest or bot flow they want automated, asks for a new автокач / driver / userscript for a subdomain like NAME-auto.lbast.ru, or gives test character credentials and a location walk-through — even if they never say "driver" or "script". Covers reviewing existing drivers, walking the route in a browser first (Playwright) when credentials are available, writing the driver from the shared LbastUtils.driver helpers, registering it for server mode, updating README/CLAUDE.md, and the test-before-commit hand-off.
---

# Adding a new auto-leveler

Every driver in this repo is a thin `if/else if` chain over the page text, built from the shared helpers in `LbastUtils.driver`. New drivers are written by analogy with the closest existing one, so most of the work is (1) understanding the flow precisely, (2) verifying it against the real game, and (3) picking match substrings that survive contact with the game's text. The steps below are in the order that has worked; do not skip the review and recon steps to save time — the expensive failures in this repo have all been wrong or colliding location substrings, which recon catches and guesswork does not.

## 1. Pin down the flow from the user's description

The user describes the route in free form: how to reach the target, what to click, what the game says at each step. Extract, and write down for yourself before touching code:

- **Kind**: a _bot_ driver (walk to a location, click an engage link, fight, repeat) or a _quest_ driver (take a task from an NPC, walk to a target, fight, "Продолжить квест", repeat; the task state lives in `pers.php` under `Текущее задание:`).
- **Script name and subdomain**: `lbast_<name>.user.js` on `<name>-auto.lbast.ru` (the user usually states both; ask only if genuinely missing).
- **Entry teleport**: which amulet `lway=N` gets closest (Devtown is `lway=8`, hometowns come from `HOMETOWN`, Кулак Хаоса is `lway=4`). This becomes `targetUrl`.
- **The route**: ordered list of location pages, each with the full description text the user quoted and the direction/object link to click.
- **The engage step**: the link that starts the fight ("смотреть", "звон мечей", "К бою", …) — this is where reserve gating applies.
- **Post-battle pages**: what appears after the arena ("Продолжить квест", an item-found page, "Уйти" links), and which of those texts are _not_ guaranteed (random drops — never match on them).
- **Rest rules**: how many reserves a full cycle consumes (`minReserves`), and whether the cycle ends in the big quest fatigue (`negRestMult`/`fatigueRestMult` 1200) or the standard one (900).
- **Loop hazards**: any state where the driver could click the same thing forever (a task already taken, a draw, a "nothing found" page) and what breaks the loop.

If the description leaves a branch unspecified, note it as an open question; you will either answer it during recon or list it as untested in the hand-off.

## 2. Review the nearest existing driver and the shared helpers

Read, in this order:

1. The **Driver control flow** and **Reserve gating** sections of `CLAUDE.md` — the canonical chain order and the meaning of every `makeCtx` option.
2. The bottom of `lbast_utils.user.js` (from `makeDriverCtx` to the `window.LbastUtils = {` export) — the actual helper implementations, since the doc summarises them.
3. The closest driver: `lbast_paladin.user.js` / `lbast_glad.user.js` for quests, `lbast_baron.user.js` / `lbast_volki.user.js` for plain bots, `lbast_bleyk.user.js` if the target needs special settings. Copy its skeleton (userscript header, bootstrap block, `makeCtx`, chain, `LbastUtilsReady` listener) verbatim and change only what differs.

Decide now whether anything in the new flow is _shared_ behaviour (a new page every driver could hit, a new setting). Shared behaviour goes into a `driver*` helper in utils and gets a version bump there; driver-specific location matches stay in the driver.

## 3. Walk the route in a browser if you can

If the user gave test credentials and browser tools are available (the Playwright MCP tools `browser_navigate` / `browser_evaluate`, or a local Playwright script), do the whole cycle yourself before writing code. The point is to capture the exact page text, link hrefs and post-battle states — the user's quoted descriptions are usually right, but the details that matter (which link text the engage step really has, whether the task text in `pers.php` differs from the NPC's wording, what the fatigue page says, how many reserves the cycle costs) only show up live. Read `references/browser-recon.md` for the login and page-dump snippets that work against the game and for the battle loop.

Ground rules for recon:

- The game has no SSL: use `http://lbast.ru`. Log in through the form (tick `zap` so cookies persist across navigations).
- Page ids (`?r=NNNN`) are per-page tokens; never hard-code one you saw — always follow the link from the current page. Fixed `r=` values in existing drivers are arbitrary and the game ignores them, which is why `utils.send(location.origin + "/loc.php?r=1659&obj=…&mod=1")` works.
- Dump `document.body.innerText` plus every `<a>` text→href on each page and keep the dumps; you will mine them for substrings in step 4.
- Fetch `pers.php` at the start and after taking the task to learn the exact `Текущее задание:` wording (it may differ from the NPC dialogue — e.g. "Девгарда" vs "Девтаун").
- Fetch the amulet page (`location.php?…&mod=fastway`) somewhere on the route to see the `lway` list and confirm "Последний портал" semantics.
- Fight the battle yourself (see the reference) and record the arena result page, the location page after "Вернуться" (look for "Продолжить квест"), and every page until the cycle is closed.
- After the cycle, try the engage link again while tired to confirm the "устали" text, and, if the quest has a `Продолжить квест` step, try that step while tired too (expect "Вам нужно отдохнуть еще N мин.") — `d.fatigue` keys on both wordings and must see `Продолжить квест` in `location.php` to wait in place instead of going home.
- Watch the reserve counter in the user bar `(N)` across the cycle; that number is `minReserves`.
- Leave the character in a sane state (teleport home with `location.php?r=…&mod=fastway&lway=<hometown>`) and close the browser. Do not waste reserves on extra runs; one full cycle is enough, and a second only if a branch was ambiguous.
- Recon is a run in the real game with the user's character; do not do anything outside the described route (no shopping, no PvP, no quests they did not mention).

If recon is impossible (no credentials, no browser tools, or the character cannot reach the route), say so, implement from the description as given, and be explicit in the hand-off about which branches are unverified.

## 4. Write the driver

Create `lbast_<name>.user.js` from the copied skeleton:

- Header: `@name lbast_<name>`, `@version` = today's date `YYYY.MM.DD`, `@include`s for `/loc*`, `/pers*`, `/rudnik*`, `/settings*` on the new subdomain (all four — `/pers*` is needed for X2-EXP activation, `/loc*` also covers `loc.php` NPC pages).
- `makeCtx` options: `title` ("Автокач (<что>), Последний Бастион"), `targetUrl`, and for quests `minReserves` and the 1200 multipliers copied from the paladin.
- Chain in the canonical order (settings → notConfigured → mail → blocked-teleport → hometown → **engage** → post-battle pages → fatigue → walking matches → healPlace/wheatFields/autoban → enterBattle → expActivation → work → goHomeOrTarget). Keep engage-type pages and any page containing "устали" _before_ `d.fatigue`, and any page that contains "В бой" but needs a different click _before_ `d.enterBattle`.
- Engage through `d.engageOrHome(ctx, linkText)` so the reserve/HP gate applies; fold "Продолжить квест" into the same block so only this quest's continue-link is followed.
- For quests, a `hasTask()` helper doing a synchronous `pers.php?r=2347` fetch and testing a word unique to this quest's `Текущее задание:` line; use it at every location where the route to the NPC and the route to the target diverge.
- Taking the task: `utils.send(<NPC loc.php link with &mod=1>)` then `utils.click("В игру")`, mirroring the paladin; add a branch for the NPC page after the task was already taken (usually a lone "Уйти").
- Walking: one `~str.indexOf("…")` per location, clicking the direction with `utils.click("север")`-style substrings. Include the reverse directions only if the character can plausibly arrive from there; the `goHomeOrTarget` fallback teleports from anywhere else.
- Random-drop or optional texts (an item found, a "you won but…" flavour line) must not be what a branch keys on unless the _page_ is what you are matching; match the stable part of that page instead.

Choosing substrings — the part that breaks most often:

- Prefer a distinctive fragment of the location _description_, not its name; names repeat ("Северный тракт" is several cells). 3–6 words from the middle of the description is the sweet spot: unique, yet robust to small edits.
- Check every candidate against the other pages in your dumps (and against link texts, which are part of `body.text()` too: "в торговый район" as a link does not collide with "Девтаун. Торговый район", but a bare "торговый район" would).
- Check it against the hometown / heal-place / fatigue texts the shared helpers match, and against pages that appear _earlier_ in the chain.
- Avoid characters the game might normalise (nbsp, quotes, dashes) inside the substring where you can.

Run `node --check lbast_<name>.user.js`. There is no other test harness. Match the repo's style: no explanatory comments, Russian only in player-facing strings.

## 5. Server mode and docs

- `server/src/game/drivers.js`: add `<name>: { file: "lbast_<name>.user.js", label: "<Russian label>" }`. The bot's driver picker, the script loader and the Docker image all derive from this map, so nothing else is needed for a plain driver. A new driver-specific setting additionally needs an `EXTRA_SETTINGS` entry; a `choice` setting with `options` and `drivers: ["<name>"]` is rendered and cycled generically (see `yantarBot`), while a `boolean` also needs its own toggle in `menus.js` / `bot/index.js` (see `expo`). On the userscript side the same setting is a `registerCustomSettings` block in the driver's `d.settingsPage(...)` callback, reading and writing the matching `localStorage.lbastAuto_*` key. The server must be restarted to load the new file.
- `readme.md`: add the script to the install list (raw GitHub URL on `refs/heads/main`) and the subdomain to the "Ссылки" list; extend the behaviour section if the driver has a rule users must know (e.g. the reserve gate for quests). Russian, like the rest of the file.
- `CLAUDE.md`: add the driver to the per-bot driver list and a short paragraph on anything non-obvious (quest task detection word, unusual `makeCtx` options, deliberately unmatched pages). English.

## 6. Hand off for testing — do not commit yet

Stop before committing. Report to the user: what was verified live vs. taken on trust, the substrings chosen for each location, the reserve/fatigue assumptions, and any branch you could not observe (e.g. the random-drop completion of a quest, "Доложить о задании"). The user installs the script on the new subdomain (or restarts the server and creates a leveler) and lets it run a few cycles.

Fix whatever they report — usually a substring that did not match or an unforeseen page — and re-run `node --check`. Only when the user confirms it works, commit in the repo's style: one commit, subject in the form `lbast_<name>: <what it does>; server: register <name> driver; docs`, mirroring `git log --oneline`. Push only when asked; merging to `main` is the release because installs update from the raw URL. Leave scratch artefacts like `.playwright-mcp/` out of the commit.
