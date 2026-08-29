# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is a collection of Tampermonkey/Greasemonkey userscripts that automate gameplay in the Russian browser game "Последний бастион" (lbast.ru). For the userscripts there is **no build system, package manager, lint, or test framework** — each `*.user.js` file is installed directly into a userscript manager via its GitHub raw URL. The optional [server/](server/) directory (see *Server mode* below) is a separate Node.js app that runs the same scripts headlessly and is managed via a Telegram bot. All user-facing text (settings UI, Telegram notifications, in-script messages) is in Russian, and bot scripts detect game state by matching Russian substrings in page text.

## Architecture

### Two-tier script model

Scripts split into **shared infrastructure** (loaded on every auto-kach subdomain) and **per-bot driver scripts** (loaded on one subdomain each):

- [lbast_utils.user.js](lbast_utils.user.js) — shared library. Exposes `window.LbastUtils` with `click`, `send`, `update`, `playSound`, `sendTGMessage`, `parseHP`, `parseReserves`, `getReserves`, `getPlayerInfo`, plus the settings-page renderer, the `driver` namespace of shared driver-flow helpers (see *Driver control flow*), and the `serverReport` bridge used in server mode (see *The utils ↔ server bridge*). Also owns `localStorage.lbastAuto_*` settings (HP thresholds, Telegram token, Telegram ID, click delay, sound toggles, duke-estate flag, X2-EXP flag) and the `HOMETOWN` map (`light`/`dark`/`sarimat`/`neutral` → location id). Fires a `LbastUtilsReady` event and sets `window.LbastUtils.ready = true` once loaded. `parseReserves(str)` reads the reserve (усталость) count from user-bar text — a parenthesised `(N)` (classic design) or a `⌚N` (modern design), found by scanning a short window right after the HP fraction so the low-durability `(!)` marker is skipped without special-casing it; `getReserves(str)` returns that number, falling back to a background `chat.php?r=4831` fetch (the chat bar always shows reserves) **only** when the main page hides it (graphical-indicator-only mode, or reserves over ~60 which the main page renders unparseably). Both return `null` when no number is obtainable.
- [lbast_battle.user.js](lbast_battle.user.js) — shared combat handler. `@include *auto.lbast.ru/arena_go*`, so it runs inside any bot's arena page. Handles the anti-autokach captcha, Другой IP cooldown, PvE skill-then-hit loop, group PvE refresh, and PvP response (sound + TG alert + optional poison elixir + 90s hit loop).
- Per-bot drivers — `lbast_baron`, `lbast_bleyk`, `lbast_glad`, `lbast_gnom`, `lbast_gorgulya`, `lbast_moleg`, `lbast_paladin`, `lbast_volki`. Each `@include`s its own `*-auto.lbast.ru/loc*`, `/rudnik*`, and `/settings*` paths.

Every driver waits for `LbastUtilsReady` before executing; if utils is missing after 2s, the page body is replaced with an install-utils message. Always preserve this bootstrap block when editing drivers.

### Standalone scripts (different pattern)

[lbast_rabota.user.js](lbast_rabota.user.js) (auto-fort) and [lbast_ribalka.user.js](lbast_ribalka.user.js) (auto-fishing) run on the **main** game domain (`@exclude *auto.lbast.ru*`) rather than the auto-kach subdomains. They do **not** use `LbastUtils` and have their own inline `click()` helpers. They react only when the user manually initiates the activity.

### Driver control flow

Every driver is a thin `if/else if` chain against `$("body").text()` built from the shared helpers in `LbastUtils.driver` (defined at the bottom of [lbast_utils.user.js](lbast_utils.user.js)). The driver starts with `const ctx = d.makeCtx({...})`, which reads `goHP`/`houseHP`/`useDukeEstate` from localStorage, parses `myHP`, resolves the hometown from `getPlayerInfo().alignment`, sets the page title, appends the `<footer>` with the settings link, and returns `null` (driver bails) when player info is unavailable. Options passed to `makeCtx`: `title`, `targetUrl` (the fastway/konj URL to the bot; used by `healPlace` and `goHomeOrTarget`), `fastTargetUrl` (hometown → bot jump, defaults to `lway=1`), `minReserves` (0 for standard bots, 5 for the paladin and gladiator quests), `negRestMult`/`fatigueRestMult` (900 standard, 1200 for the quests), `rudnikRefresh` (`"home"` or `"update"`), `hometownGo(ctx)` (override for the hometown → bot step; no driver currently uses it — the default step is `driverGoToTarget`, which honours the `lbastAuto_expo` flag: when set, it fetches `pers.php?r=3503` synchronously and, if "Опыт x2: доступно" is present, jumps to `pers.php?r=3525&mod=activateexp` instead of `fastTargetUrl`), and `fatiguePreCheck(ctx)` (the paladin/gladiator "Продолжить квест" reload hook). `ctx` also carries `rand` (500–1000), `str`, `homeUrl`, `engageHomeUrl`, `hometown`.

Each helper returns `true` when its branch matched (so the chain uses the `} else if (d.helper(ctx)) {` idiom with an empty body), and the driver interleaves its own location-description matches between them. Canonical order:

1. `d.settingsPage(extra?)` — render the settings form on `/settings`; `extra` registers driver-specific settings via `registerCustomSettings`.
2. `d.notConfigured(ctx)` — "not configured" message when `goHP` is unset.
3. `d.mail(ctx)` — letter sound, TG notify, mark-all-read via `letters.php?...mod=readall`, `update(3000)`.
4. Driver-specific "в это место невозможно" (blocked teleport) — jump to a safe location.
5. `d.hometown(ctx)` — hometown detection (Центральная площадь / поднятый в / Северо-западный форпост keyed off `ctx.hometown`): heal (`myHP <= houseHP`, Кулак Хаоса via `lway=4` or duke estate via `konj&lway=22`) > rest when reserves short > go to the bot (`myHP >= goHP`, via `hometownGo` or `fastTargetUrl`) > HP waits.
6. Driver-specific target-reached match calling `d.engageOrHome(ctx, linkText)` — click the engage link if HP ok **and reserves not short**, else teleport home via `engageHomeUrl`.
7. `d.fatigue(ctx)` — the in-game `устали` message: background teleport home, then `update(rand * fatigueRestMult)`.
8. Driver-specific `~str.indexOf('...')` location matches that walk the character toward the bot, each issuing `utils.click('direction')`.
9. `d.healPlace(ctx)` (Кулак Хаоса or estate, depending on `useDukeEstate`), `d.wheatFields(ctx)` (estate approach), `d.autoban(ctx)` (7.5s reload), `d.enterBattle(ctx)` ("В бой"), `d.pathPending(ctx)` ("путь лежит" → `update(6100)`), `d.expActivation(ctx)` (the X2-EXP confirmation pages on `/pers`: "Подтвердите активацию" → Активировать, "активировали" → В игру — every driver `@include`s its `/pers*` path for this), `d.work(ctx)` (работа/rudnik fort handling, refresh mode from `rudnikRefresh`).
10. `d.goHomeOrTarget(ctx)` — the fallback default (also reserve-gated).

**Reserve gating:** the helpers read `utils.getReserves(str)` only at the decision branches — `hometown`, `engageOrHome`, `healPlace`, `goHomeOrTarget` — so the chat fallback never fires on the walking/work branches. Priority at each branch is **heal (`myHP <= houseHP`) > rest (reserves short) > fight (`myHP >= goHP`) > mild HP waits**, so deeply negative HP still routes to fast healing regardless of reserves. In the hometown the driver sleeps in place (`update(rand * negRestMult)` for negative reserves, `rand * 480` when `0 <= reserves < minReserves`); anywhere else it teleports home with a foreground `location.href` and lets the hometown branch sleep. A `getReserves` result of `null` disables the gate — behaviour falls back to the legacy flow where `d.fatigue` triggers the background teleport home, so that handler must stay as the safety net. **lbast_paladin** sets `minReserves: 5` (a kill must not leave the quest uncompletable), and folds its `Продолжить квест` click into the `стоит склеп` crypt block so only this quest's continue-link is followed.

**Quest drivers (paladin, gladiator):** both follow the same shape — a `hasTask()`-style synchronous fetch of `pers.php?r=2347` decides at each Devtown location whether to walk toward the quest target or toward the quest giver (`Текущее задание:` mentions `склеп` for the paladin, `колизей` for the gladiator). Taking the task is a `utils.send()` of the quest-giver's `loc.php?...&mod=1` link followed by `click("В игру")`. **lbast_glad** teleports to Devtown (`lway=8`), walks west to the Колизей (`obj=5007`) for the task, then north through the Фискальный and Научный districts and two Северный тракт cells (matched by their descriptions — "На юге крупный город", "напоминающие издали колизей" — because several locations share the name) to Старый колизей, where `d.engageOrHome(ctx, "звон мечей")` is gated on `minReserves: 5`; the arena page ("призраков гладиаторов") gets a `К бою` click, `d.enterBattle` handles "В бой!", and after `Продолжить квест` the "бой дался тяжело" page gets `Уйти`. The Знак гладиатора drop is not matched (it is not guaranteed); the task simply stays active and the loop repeats after the fatigue rest.

**Adding a driver:** the project skill `lbast-new-leveler` ([.claude/skills/lbast-new-leveler/SKILL.md](.claude/skills/lbast-new-leveler/SKILL.md)) is the step-by-step procedure — flow capture, browser recon with a test character, driver skeleton, server registration, docs, and the test-before-commit hand-off.

**Critical:** location-description matches break when the game changes location text — recent commits (`63542c0`, `14e04d2`) are fixes exactly for this. When editing these matches, keep them as substrings unique enough to avoid collisions with other locations but short enough to survive minor text tweaks. Shared behaviour changes go into the `driver*` helpers in utils, not into individual drivers.

### Battle script control flow

[lbast_battle.user.js](lbast_battle.user.js) runs on every `arena_go*` page under any `*auto.lbast.ru` subdomain and follows its own `if/else if` chain against `$("body").text()` plus a few DOM checks. The first six steps are the universal pre-dispatch checks; only after those does the script branch on battle type.

1. Guard: require `window.LbastUtils.ready`; otherwise show the "install utils" message.
2. Bail out silently if `getPlayerInfo()` returns no nickname (defensive — guarantees session info is reachable before doing anything). Then, if no `ход соперника` link is on the page, clear `sessionStorage.lbastAuto_pvpAwaitingTurn` — this is the only place the flag is ever cleared. The flag is set in step 11 right before the 90s strike fires and consumed in step 8 to recognize the single-PvP awaiting-turn state where the hit form has disappeared. Clearing here means the flag survives any reload that doesn't change the situation (the user stays on the awaiting-turn page through the 5s click loop) but drops the instant the link is gone (opponent moved, battle ended, etc.).
3. **Captcha success check** — if `sessionStorage.lbastAuto_checkAttempted` is set (any value) **and** `isCaptchaPage()` is false, the captcha was solved (or the user navigated past it). If the stored value is `"failed"`, clear the flag silently; otherwise TG-notify success then clear. Reload either way.
4. **"Другой IP"** — the user opened the game on another device: schedule a 5-minute `location.php` jump and return (the driver will refresh from there).
5. **Captcha present** (`isCaptchaPage(document.body.innerHTML)`) — delegate to `handleCaptcha(utils, playerInfo)`. See the captcha module section below for the full state machine.
6. **"автобан"** — schedule a 7.5s reload and return.
7. **"ернуться" / "ой завершен"** links — click them (battle cleanup states).

After those checks, the script computes `hasOpponent = $('[name="bl"]').length > 0` (presence of the hit form's block-selector) and dispatches:

8. **No opponent** (`hasOpponent === false`) — group battles, or single PvP after our strike (the form briefly disappears while we wait for the opponent's move). Four cascaded checks, in order:
   - **Single-PvP awaiting-turn** — if `sessionStorage.lbastAuto_pvpAwaitingTurn` is set and the "ход соперника" link is on the page, schedule `utils.click('ход соперника')` after 5s and return. The flag is what distinguishes "single PvP, our strike landed first" from "group battle, no pair assigned to us" — the wait-link can appear in either (e.g. group PvE after we click "Ударить" without a pair), but we only set the flag on the PvP path in step 11. Without the flag we'd misroute a group-PvE awaiting-turn into the 5s click loop instead of dropping pairs.
   - If the "Ударить" link is present, `utils.click('Ударить')` and return. This commits the user to a hit stance and is what prevents auto-hit in a PvP context (in a bot context it's harmless: as soon as a pair appears, the standard PvE branch fires).
   - Else if the "Сбр.пары" link is present, decide PvP vs bots from the overview via `isOverviewPvp()` (find the first `<br>VS.<br>` in body, scan from the prior boundary — `</div>`, `<hr`, or `<center>` — for any `<a>` element). If PvP, `refreshSoon()` (1000–1500 ms `location.reload()`); if bots, `utils.click('Сбр.пары')`.
   - Else `refreshSoon()`.
9. **Has opponent** — locate the per-pair opponent via `findPerPairOpponent(hitForm)`:
   - **Desktop** (`hitForm.closest('td').length > 0`): the opponent is in the last `<td>` of the form's `<tr>`. Look for an `<a>` whose text matches `^[A-Za-z0-9_]+$`.
   - **Mobile**: walk DOM siblings backwards from the form, skip the first `<hr>` (the one immediately above the form), and look for the first nickname-text `<a>` before hitting a second `<hr>` (the upper boundary of the per-pair line). The second-`<hr>` boundary is what excludes any group-overview `<a>` above the per-pair line.
   - If no `<a>` is found → bot opponent (PvE branch). Otherwise → PvP branch with `opponentLink` populated.
10. **PvE-with-opponent branch** — click "Умение" if the player has a combat skill (`playerInfo.hasSkill`) and the link is present, else "Ударить". The `hasSkill` gate is required: the game keeps the "Умение" link active even for characters that never learned a skill, and clicking it then does nothing, so an ungated click loops forever on the same page.
11. **PvP-with-opponent branch:**
    - Play alarm and TG-notify "На вас напали!".
    - Fetch the opponent profile (sync XHR to `opponentLink.attr('href')`) and look for drink states (раздничный эль, брага, водка, вино преми, коньяк, лимонад) that indicate the opponent is drunk/poisonable.
    - If poisonable: GET `arena_go.php?r=7241&mod=invaction` to open inventory, check for "Эликсир отравления"; if present, GET the use-elixir URL (`r=6074&mod=invaction_el_otravleniya`) and click "Обновить" after 5s.
    - If no poison (or no drink state): `scheduleDelayedHit()` — wait 90s, then set `sessionStorage.lbastAuto_pvpAwaitingTurn = 'true'` and click the hit button (`input[value='Бить']` or the image-input fallback). The flag is set inside the timer immediately before `.click()` and gated on the button existing, so a mid-wait reload that cancels the timer leaves no stale flag. The next page load — where the form has disappeared and "ход соперника" is showing — picks the flag up in step 8's awaiting-turn branch. There is no in-branch handler for the "ход соперника" link here because once we have struck, the form is gone and `hasOpponent` is false; that case is handled exclusively by step 8 + the flag.

**Critical:**

- The 90s PvP delay and 5–8s captcha submit delay are deliberately human-paced — do not tighten them.
- `hasOpponent` must be tested via `[name="bl"]` (the hit form), not via the "Ударить" link. In PvE the "Ударить" link is always present regardless of whether a pair exists, so it is not a reliable opponent signal.
- The "no opponent" branch uses `location.reload()` directly (via `refreshSoon()`), not `utils.update()`, because `utils.update()` jumps to `/location.php` and would break the wait-for-pair flow.
- The locator's mobile fallback depends on the per-pair line being immediately adjacent to the form, separated by exactly one `<hr>`. The "warrior row at top vs bottom" mobile setting moves the **group overview**, not the per-pair line — so the second-`<hr>` boundary still cleanly separates the two regardless of that setting.
- The `pvpAwaitingTurn` flag is **set in exactly one place** (inside `scheduleDelayedHit()` right before `hitButton.click()`) and **cleared in exactly one place** (top of `initScript()` when `ход соперника` is absent from the page). Do not duplicate either side — the design intentionally consolidates the lifecycle so the flag survives every reload that doesn't change the situation and drops the moment it does. Note that "ход соперника" can appear in group PvE / group PvP after the user clicks "Ударить" without a pair; we never set the flag on those paths, so the no-opponent branch correctly falls through to `Сбр.пары` / `refreshSoon()` instead of looping the wait-link click.

### Captcha module (inside lbast_battle.user.js)

Anti-autokach checks ("Для продолжения боя ответьте на вопрос: …") are handled by a self-contained block at the top of the battle IIFE delimited by `// ===== Captcha module =====` / `// ===== End captcha module =====`. The helpers (`isCaptchaPage`, `extractCaptchaQuestion`, `escapeHtml`, `compute`, `solveCaptchaWithRules`, `parseAIAnswer`, `solveCaptchaWithAI`, `solveCaptchaWithAIRetry`, `submitCaptchaAnswer`, `runAIAttempt`, `handleCaptcha`) are deliberately written as pure-string/pure-fetch functions so they can be re-tested without a DOM.

**Detection (`isCaptchaPage`)** — true if the body HTML contains `Для продолжения боя ответьте на вопрос` _or_ an `<input name="anumb">`. The OR is the safety net: if the game ever rewords the prompt, the input field is what we'll keep dispatching on.

**Question extraction (`extractCaptchaQuestion`)** — `/Для продолжения боя ответьте на вопрос:\s*(?:<br\s*\/?>\s*)+([^<]+?)\s*<br/i`. Tolerant of self-closing or whitespace-padded `<br>` runs. Always run the result through `escapeHtml()` before passing to `sendTGMessage()` (`parse_mode=HTML` rejects `<` / `&`).

**State machine** — `sessionStorage.lbastAuto_checkAttempted` is now ternary: unset → `"rules"` → `"ai"` → `"failed"`. Transitions:

- _unset + captcha present_ — fresh check. Play alarm, TG-notify with the escaped question. Try `solveCaptchaWithRules`; on success, set state to `"rules"` and `submitCaptchaAnswer`. If rules return null, TG-notify "Правила не нашли ответ", set state to `"ai"`, call `runAIAttempt`.
- _`"rules"` + captcha present_ — the rule-based answer was _wrong_ (the form submission reloaded back into the captcha). TG-notify "Ответ по правилам оказался неверным", set state to `"ai"`, call `runAIAttempt`.
- _`"ai"` + captcha present_ — the AI answer was wrong. TG-notify failure, set state to `"failed"`, schedule a 15s reload.
- _`"failed"` + captcha present_ — silent 15s reload (we already gave up; don't re-spam Telegram).
- _any state + captcha gone_ — handled by step 3 of the main flow: success notification (unless state was `"failed"`), clear flag, reload.

`runAIAttempt` calls `solveCaptchaWithAIRetry`, which wraps `solveCaptchaWithAI` in **3 attempts with 5s pauses** for HTTP errors _or_ unrecognizable responses. Only after all 3 fail does it transition the state to `"failed"`.

**Rule-based solver (`solveCaptchaWithRules`)** — three cascaded matchers, in priority order:

1. **Symbolic math:** `/(-?\d+)\s*([+\-*\/×÷−])\s*(-?\d+)/`. Normalizes Unicode operators (`×`/`÷`/`−`) before computing.
2. **Word-form math:** four lookaround regexes for плюс / прибав\*, минус / отним\* / отня\* / выч[еи]\*, умнож\* / помнож\*, раздел\* / подел\*. Operands must still be Arabic digits; word→digit conversion is intentionally not implemented (no good JS library exists, and per spec we let the AI handle word-form numbers).
3. **"Напишите число / цифру N":** matches the words `число` or `цифр\*` and pulls the first integer from the question. Lookaround uses `(?<!\p{L})` / `(?!\p{L})` with the `/u` flag because `\b` does not work for Cyrillic in JS regex (`\w` is ASCII-only).

If none match, returns `null` and the AI takes over.

**AI solver (`solveCaptchaWithAI`)** — POSTs to `https://text.pollinations.ai/openai` (the OpenAI-compatible endpoint, anonymous tier, no key). Body: `{ model: "openai", messages: [system, user], temperature: 0.1, reasoning_effort: "low" }`. The `openai` model resolves to `gpt-oss-20b`; `reasoning_effort: "low"` measurably reduces reasoning-token usage. The system prompt instructs "answer with only a number unless the question explicitly asks otherwise"; the user message includes nickname + ISO timestamp + question. `parseAIAnswer` extracts the first `-?\d+` from the trimmed response (tolerates trailing punctuation). Non-200 / non-JSON responses throw — the retry wrapper catches them.

**Submit (`submitCaptchaAnswer`)** — randomized 5–8s wait, then `$("input[name='anumb']").val(answer)`, then 700–1200ms wait, then `.click()` on `input[type='submit'][value='далее']`. The form action reloads the page, which re-enters the state machine on the next load.

### State and side-effect conventions

- **Settings persistence:** all user settings go in `localStorage.lbastAuto_*` keys (`goHP`, `houseHP`, `useDukeEstate`, `expo`, `TGToken`, `TGID`, `letterSound`, `alarmSound`, `timeClick`). Booleans are stored as the strings `'true'`/`'false'`. Driver-specific settings extend the settings form via `LbastUtils.registerCustomSettings(scriptId, {html, saveHandler})`.
- **Per-session state:** `sessionStorage.lbastAuto_*` — e.g. `playerNickname`, `playerAlignment`, `playerHasSkill` (all three cached by `getPlayerInfo()` to avoid re-fetching; `playerHasSkill` is the string `'true'`/`'false'`, set from whether `pers.php?r=5778` contains "Боевое умение", and is exposed as the boolean `hasSkill` on the returned object), `checkAttempted` (captcha state machine: `"rules"` / `"ai"` / `"failed"` — see captcha module section), `pvpAwaitingTurn` (set when our PvP strike fires; used to recognize the awaiting-turn page after the hit form disappears).
- **Randomized click delay:** `utils.click(text)` schedules a click with jitter derived from `localStorage.lbastAuto_timeClick` to look human. Use it instead of direct `$(...).click()` in drivers.
- **Refresh scheduling:** `utils.update(ms)` injects a footer line showing the wait time and reloads `location.php` after `ms`. Drivers multiply `rand * <multiplier>` (where `rand` is 500–1000) to stagger refreshes.
- **Server-mode flag:** `window.__lbastServer` (set by the server's init script before the scripts are evaluated) switches utils into bridge mode: sounds off, `click`/`update`/`sendTGMessage` report to `window.__lbastReport`. Userscript-manager installs never set it.
- **Telegram bot:** each user creates their own bot via @BotFather and stores the token in `localStorage.lbastAuto_TGToken`. There is no shared/hardcoded token. The chat ID is stored in `localStorage.lbastAuto_TGID`. Because localStorage is per-subdomain, users running multiple auto-catchers must enter the token and ID in each one's settings separately. Alerts go through `sendTGMessage()` which silently no-ops when the token or ID is missing/invalid.

### Versioning and release

Each script has a `// @version YYYY.MM.DD` line in its userscript header. Bump it when publishing a change so Tampermonkey offers an update to installed users (the server ignores these headers and always runs whatever is on disk). Scripts are distributed via GitHub raw URLs on `refs/heads/main`, so merging to main is the "release".
## Server mode (`server/`)

[server/](server/) is an optional Node.js (ESM, Node ≥ 20) application that runs the **same** userscripts headlessly under Playwright Chromium and exposes them through a Telegram bot ([grammY](https://grammy.dev/)). It is the one part of the repo with a package manager. Nothing in the userscripts depends on it; the coupling is one-directional (server → scripts) plus the small reporting bridge in utils described below.

### Key commands

All run from `server/`:

- `npm ci` — install dependencies. `npx playwright install --with-deps chromium` — install the browser (once).
- `cp .env.example .env` — required vars: `TG_BOT_TOKEN`, `ADMIN_TG_IDS` (comma-separated), `SECRET_KEY`. Optional: `DATABASE_URL` (default `sqlite:data/lbast.db`, relative to `server/`), `GAME_URL`, `HEADLESS` (`false` to watch the browser), `BROWSER_NO_SANDBOX`, `USER_AGENT`.
- `npm start` — boot the server (`src/index.js`).
- `docker compose up -d --build` / `docker compose logs -f` / `docker compose down` — containerised run. The compose file sets `HEADLESS=true`, `BROWSER_NO_SANDBOX=true`, `shm_size: 1gb`, `restart: unless-stopped`, and bind-mounts `./data` so the SQLite file is shared with non-Docker runs. The **build context is the repo root** (`context: ..`) because the image copies `*.user.js` from there; [.dockerignore](.dockerignore) lives at the root for the same reason. The image is `mcr.microsoft.com/playwright:<version>-jammy` and must match the `playwright` version in `package.json` — bump both together.

There is still no lint or test framework.

### Architecture

Boot ([src/index.js](server/src/index.js)): `initDb()` → `createBot()` → `manager.setNotifier()` → `bot.start()` whose `onStart` calls `manager.resumeAll()` (restarts every leveler whose `desiredState` is `running`). SIGINT/SIGTERM → stop bot, `manager.stopAll()`, `closeBrowser()`.

- [src/config.js](server/src/config.js) — loads `server/.env`, exits on missing required vars or empty admin list. Exposes `serverRoot` and `repoRoot` (`serverRoot/..`).
- [src/crypto.js](server/src/crypto.js) — AES-256-GCM with a key derived from `SECRET_KEY` (SHA-256). Payload format `iv:tag:data` (base64). Changing `SECRET_KEY` makes stored passwords unreadable.
- [src/db.js](server/src/db.js) — Sequelize models, `sequelize.sync()` (no migrations; schema changes need a compatible `sync` or manual DB edits). `User` (`tgId`, `addedByTgId`) → `Character` (`login`, `passwordEnc`, `cookies` = Playwright storageState JSON, `authStatus` `ok`/`failed`) → `AutoLeveler` (`driverKey`, `name`, `goHP`, `houseHP` −1000, `useDukeEstate`, `timeClick` 700, `extraSettings` JSON text, `desiredState` `running`/`stopped`). Deletes cascade.
- [src/game/drivers.js](server/src/game/drivers.js) — `DRIVERS` registry (`key → {file, label}`) that drives the bot's driver picker and the script loader, plus `EXTRA_SETTINGS` (settings stored in the leveler's `extraSettings` JSON rather than in their own columns; currently only `expo` = X2-EXP activation, applied to every driver). Adding a driver script means adding it here; adding a JSON-backed setting means an entry here **and** a toggle in `menus.js`/`bot/index.js`.
- [src/game/scripts.js](server/src/game/scripts.js) — reads jQuery (vendored in `server/vendor/`), `lbast_utils.user.js`, `lbast_battle.user.js`, and every driver file **once at startup**. Script edits require a server restart.
- [src/game/auth.js](server/src/game/auth.js) — `performLogin(page, login, password)` fills the game's `login`/`pass` form (ticks `zap` = "remember me") and treats the presence of `user_id` + `user_pass` cookies as success; `testCredentials()` does that in a throwaway context and returns `storageState`; `isLoggedOutPage()` detects "Вы не авторизованы" or the login form.
- [src/runner/browser.js](server/src/runner/browser.js) — one shared Chromium process; each leveler gets its own `BrowserContext` (cookies isolated per character). `--disable-blink-features=AutomationControlled` always; sandbox flags only when `BROWSER_NO_SANDBOX=true`.
- [src/runner/inject.js](server/src/runner/inject.js) — builds the `addInitScript` payload: sets `window.__lbastServer = true`, writes the leveler's settings into `localStorage.lbastAuto_*` (sounds forced off, no TG token — notifications go through the bridge), then on `DOMContentLoaded` evals jQuery + utils + (battle on `/arena_go*`, or the driver on `/loc*`, `/rudnik*`, and `/pers*`). This replaces the userscript manager's `@include`/`@require`; the userscript headers are ignored here.
- [src/runner/runner.js](server/src/runner/runner.js) — one `Runner` per running leveler. Exposes `window.__lbastReport` via `context.exposeBinding`, navigates to `/location.php`, re-logs-in if needed, then runs a 60s watchdog: reload if the page slept past `wakeAt + 5 min` or was silent for 45 min; after 3 consecutive stalls → `state = "error"`, shutdown, `onStalled`. Also: closes stray pages, dismisses dialogs, reloads on crash, re-checks auth on every `load`, saves cookies every 30 min and on shutdown. Keeps a ring of the last 30 events for the Статус view; `pageText()` / `screenshot()` back the bot's status and screenshot buttons. Runner states: `starting`, `running`, `stopped`, `error`, `auth_failed`.
- [src/runner/manager.js](server/src/runner/manager.js) — `RunnerManager` singleton: `start(id)` (refuses if already running, if the character's `authStatus` is `failed`, or if another leveler is running on the same character), `stop`, `stopAll`, `resumeAll`, `isRunning`, `getRunner`. Wires runner hooks to DB updates and Telegram notifications prefixed `[leveler name / login]`. `desiredState` is the persisted intent used by `resumeAll`.
- [src/bot/](server/src/bot/) — `access.js` (admins from `ADMIN_TG_IDS`, other users from the `User` table; `accessMiddleware` attaches `ctx.dbUser`), `menus.js` (inline keyboards, `STATE_LABELS`, time formatters), `notify.js` (`sendChunked` splits at Telegram's 4096-char limit), `index.js` (all handlers). Multi-step input (add character, create leveler, edit a numeric setting, add user) is an in-memory `flows` map keyed by Telegram user id; `/cancel`, `/menu`, and any menu navigation clear it. Callback data conventions: `menu:*`, `char:*`, `lv:*`, `lvadd:*`, `lvset:*`, `user:*`. Every object lookup goes through `ownedCharacter` / `ownedLeveler` so users only see their own rows.

### The utils ↔ server bridge

`lbast_utils.user.js` has a `serverReport(payload)` helper that forwards to `window.__lbastReport` when `window.__lbastServer` is set and otherwise returns `false`. It is called from `click` (`{type:"action", text:"Клик: …"}`), `update` (`{type:"sleep", wakeAt}` — this is what the watchdog uses to know when the page is expected to reload), and `sendTGMessage` (`{type:"notify"}`; when the bridge accepts the message the browser-side Telegram call is skipped). `playSound` is a no-op in server mode. The init script also reports `{type:"error"}` if evaluating a script throws. Keep these call sites when refactoring utils — the runner's stall detection and the bot's notifications depend on them — and keep the payload shapes in sync with `Runner.handleReport`.

### Conventions

- All bot-facing text is Russian, like the userscripts. Logs to stdout are English.
- Settings apply on the next start of a leveler (the init script is built at `Runner.start`), which the bot tells the user.
- Passwords exist in plaintext only in memory (decrypted at `manager.start`); never log or send them.
- `.env`, `node_modules/`, and `server/data/*` (except `.gitkeep`) are git-ignored via the root [.gitignore](.gitignore).
