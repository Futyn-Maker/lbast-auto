# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is a collection of Tampermonkey/Greasemonkey userscripts that automate gameplay in the Russian browser game "Последний бастион" (lbast.ru). There is **no build system, package manager, lint, or test framework** — each `*.user.js` file is installed directly into a userscript manager via its GitHub raw URL. All user-facing text (settings UI, Telegram notifications, in-script messages) is in Russian, and bot scripts detect game state by matching Russian substrings in page text.

## Architecture

### Two-tier script model

Scripts split into **shared infrastructure** (loaded on every auto-kach subdomain) and **per-bot driver scripts** (loaded on one subdomain each):

- [lbast_utils.user.js](lbast_utils.user.js) — shared library. Exposes `window.LbastUtils` with `click`, `send`, `update`, `playSound`, `sendTGMessage`, `parseHP`, `getPlayerInfo`, plus the settings-page renderer. Also owns `localStorage.lbastAuto_*` settings (HP thresholds, Telegram token, Telegram ID, click delay, sound toggles, duke-estate flag) and the `HOMETOWN` map (`light`/`dark`/`sarimat`/`neutral` → location id). Fires a `LbastUtilsReady` event and sets `window.LbastUtils.ready = true` once loaded.
- [lbast_battle.user.js](lbast_battle.user.js) — shared combat handler. `@include *auto.lbast.ru/arena_go*`, so it runs inside any bot's arena page. Handles the anti-autokach captcha, Другой IP cooldown, PvE skill-then-hit loop, group PvE refresh, and PvP response (sound + TG alert + optional poison elixir + 90s hit loop).
- Per-bot drivers — `lbast_baron`, `lbast_bleyk`, `lbast_gnom`, `lbast_gorgulya`, `lbast_moleg`, `lbast_paladin`, `lbast_volki`. Each `@include`s its own `*-auto.lbast.ru/loc*`, `/rudnik*`, and `/settings*` paths.

Every driver waits for `LbastUtilsReady` before executing; if utils is missing after 2s, the page body is replaced with an install-utils message. Always preserve this bootstrap block when editing drivers.

### Standalone scripts (different pattern)

[lbast_rabota.user.js](lbast_rabota.user.js) (auto-fort) and [lbast_ribalka.user.js](lbast_ribalka.user.js) (auto-fishing) run on the **main** game domain (`@exclude *auto.lbast.ru*`) rather than the auto-kach subdomains. They do **not** use `LbastUtils` and have their own inline `click()` helpers. They react only when the user manually initiates the activity.

### Driver control flow

All bot drivers follow the same `if/else if` chain pattern against `$("body").text()`:

1. Render settings page if URL is `/settings`.
2. Bail out with a "not configured" message if `goHP` is unset.
3. Handle incoming mail: play letter sound, TG-notify, mark-all-read via `letters.php?...mod=readall`, then `utils.update(3000)`.
4. Handle "в это место невозможно" (blocked teleport) — jump to a safe location.
5. Handle hometown detection (Центральная площадь / поднятый в / Северо-западный форпост, keyed off the alignment-derived `hometown` id): decide between going to the bot (`myHP >= goHP`), going to heal (`myHP <= houseHP`, to Кулак Хаоса via `lway=4` or duke estate via `konj&lway=22`), or scheduling a refresh via `utils.update(...)`.
6. A sequence of `~str.indexOf('...')` location-description matches that walk the character toward the target bot, each issuing `utils.click('direction')`.
7. Target-reached block: attack if HP ok, else teleport home.
8. Tail handlers: автобан reload, "В бой" entry, работа/rudnik (fort) interleaved handling, fallback "go home or go to target" default.

**Critical:** location-description matches break when the game changes location text — recent commits (`63542c0`, `14e04d2`) are fixes exactly for this. When editing these matches, keep them as substrings unique enough to avoid collisions with other locations but short enough to survive minor text tweaks.

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
10. **PvE-with-opponent branch** — click "Умение" if present, else "Ударить".
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

**Testing harness:** `testpages/captcha.js` is a CommonJS mirror of the captcha helpers (functions copied verbatim) and `testpages/test_captcha.js` runs detection + extraction + rules against the four `testpages/captcha_*.html` snapshots. AI tests are gated behind `node testpages/test_captcha.js ai <idx>...` and run one at a time so the anonymous-tier rate limit on text.pollinations.ai isn't hit. **The `testpages/` directory is throwaway scaffolding** — keep the userscript and the test mirror in sync while it exists, but expect to delete the directory before release. After deletion, the captcha module lives only in `lbast_battle.user.js`.

### State and side-effect conventions

- **Settings persistence:** all user settings go in `localStorage.lbastAuto_*` keys (`goHP`, `houseHP`, `useDukeEstate`, `TGToken`, `TGID`, `letterSound`, `alarmSound`, `timeClick`). Booleans are stored as the strings `'true'`/`'false'`. Driver-specific settings extend the settings form via `LbastUtils.registerCustomSettings(scriptId, {html, saveHandler})`.
- **Per-session state:** `sessionStorage.lbastAuto_*` — e.g. `playerNickname`, `playerAlignment` (cached by `getPlayerInfo()` to avoid re-fetching), `checkAttempted` (captcha state machine: `"rules"` / `"ai"` / `"failed"` — see captcha module section), `pvpAwaitingTurn` (set when our PvP strike fires; used to recognize the awaiting-turn page after the hit form disappears).
- **Randomized click delay:** `utils.click(text)` schedules a click with jitter derived from `localStorage.lbastAuto_timeClick` to look human. Use it instead of direct `$(...).click()` in drivers.
- **Refresh scheduling:** `utils.update(ms)` injects a footer line showing the wait time and reloads `location.php` after `ms`. Drivers multiply `rand * <multiplier>` (where `rand` is 500–1000) to stagger refreshes.
- **Telegram bot:** each user creates their own bot via @BotFather and stores the token in `localStorage.lbastAuto_TGToken`. There is no shared/hardcoded token. The chat ID is stored in `localStorage.lbastAuto_TGID`. Because localStorage is per-subdomain, users running multiple auto-catchers must enter the token and ID in each one's settings separately. Alerts go through `sendTGMessage()` which silently no-ops when the token or ID is missing/invalid.

### Versioning and release

Each script has a `// @version YYYY.MM.DD` line in its userscript header. Bump it when publishing a change so Tampermonkey offers an update to installed users. Scripts are distributed via GitHub raw URLs on `refs/heads/main`, so merging to main is the "release".
