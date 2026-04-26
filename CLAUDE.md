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
2. Bail out silently if `getPlayerInfo()` returns no nickname (defensive — guarantees session info is reachable before doing anything).
3. **Captcha success check** — if `sessionStorage.lbastAuto_checkAttempted` is set **and** the "Для продолжения боя ответьте на вопрос" text is gone, notify via TG that the captcha was passed, clear the flag, reload.
4. **"Другой IP"** — the user opened the game on another device: schedule a 5-minute `location.php` jump and return (the driver will refresh from there).
5. **Captcha present** ("Для продолжения боя ответьте на вопрос"):
   - If `checkAttempted` is already set, this is a second failure: play alarm, TG-notify the failure, reload after 15s.
   - Otherwise: play alarm, TG-notify that an attempt is starting, set `checkAttempted = 'true'`, extract the arithmetic expression from the HTML (`/Для продолжения боя.../` regex), TG-send the raw question for visibility, detect `+`/`-`/`*`, compute the result, wait a randomized 7–15s, fill `input[name='anumb']`, then click `input[type='submit'][value='далее']` after another short delay. On any thrown error, reload after 5s.
6. **"автобан"** — schedule a 7.5s reload and return.
7. **"ернуться" / "ой завершен"** links — click them (battle cleanup states).

After those checks, the script computes `hasOpponent = $('[name="bl"]').length > 0` (presence of the hit form's block-selector) and dispatches:

8. **No opponent** (`hasOpponent === false`) — necessarily a group battle of some kind (single battles always have an opponent until cleanup links take over). Three cascaded checks, in order:
   - If the "Ударить" link is present, `utils.click('Ударить')` and return. This commits the user to a hit stance and is what prevents auto-hit in a PvP context (in a bot context it's harmless: as soon as a pair appears, the standard PvE branch fires).
   - Else if the "Сбр.пары" link is present, decide PvP vs bots from the overview via `isOverviewPvp()` (find the first `<br>VS.<br>` in body, scan from the prior boundary — `</div>`, `<hr`, or `<center>` — for any `<a>` element). If PvP, `refreshSoon()` (1000–1500 ms `location.reload()`); if bots, `utils.click('Сбр.пары')`.
   - Else `refreshSoon()`.
9. **Has opponent** — locate the per-pair opponent via `findPerPairOpponent(hitForm)`:
   - **Desktop** (`hitForm.closest('td').length > 0`): the opponent is in the last `<td>` of the form's `<tr>`. Look for an `<a>` whose text matches `^[A-Za-z0-9_]+$`.
   - **Mobile**: walk DOM siblings backwards from the form, skip the first `<hr>` (the one immediately above the form), and look for the first nickname-text `<a>` before hitting a second `<hr>` (the upper boundary of the per-pair line). The second-`<hr>` boundary is what excludes any group-overview `<a>` above the per-pair line.
   - If no `<a>` is found → bot opponent (PvE branch). Otherwise → PvP branch with `opponentLink` populated.
10. **PvE-with-opponent branch** — click "Умение" if present, else "Ударить".
11. **PvP-with-opponent branch:**
    - If "ход соперника" (opponent's turn) is on the page, schedule `utils.click('ход соперника')` after 5s and return — the in-page `Обновить` countdown does not actually reload, so clicking the wait-link is the only thing that advances state. **This must run before the alarm/poison/hit logic** because while it's the opponent's move, we cannot poison or strike anyway.
    - Otherwise play alarm and TG-notify "На вас напали!".
    - Fetch the opponent profile (sync XHR to `opponentLink.attr('href')`) and look for drink states (раздничный эль, брага, водка, вино преми, коньяк, лимонад) that indicate the opponent is drunk/poisonable.
    - If poisonable: GET `arena_go.php?r=7241&mod=invaction` to open inventory, check for "Эликсир отравления"; if present, GET the use-elixir URL (`r=6074&mod=invaction_el_otravleniya`) and click "Обновить" after 5s.
    - If no poison (or no drink state): wait 90s, then click the hit button (`input[value='Бить']` or the image-input fallback).

**Critical:**
- The captcha handler is single-shot per page load, gated by `sessionStorage.lbastAuto_checkAttempted`. Any rework must preserve that flag so a silently-failing solve attempt doesn't loop. The 90s PvP delay and 7–15s captcha delay are deliberately human-paced — do not tighten them.
- `hasOpponent` must be tested via `[name="bl"]` (the hit form), not via the "Ударить" link. In PvE the "Ударить" link is always present regardless of whether a pair exists, so it is not a reliable opponent signal.
- The "no opponent" branch uses `location.reload()` directly (via `refreshSoon()`), not `utils.update()`, because `utils.update()` jumps to `/location.php` and would break the wait-for-pair flow.
- The locator's mobile fallback depends on the per-pair line being immediately adjacent to the form, separated by exactly one `<hr>`. The "warrior row at top vs bottom" mobile setting moves the **group overview**, not the per-pair line — so the second-`<hr>` boundary still cleanly separates the two regardless of that setting.

### State and side-effect conventions

- **Settings persistence:** all user settings go in `localStorage.lbastAuto_*` keys (`goHP`, `houseHP`, `useDukeEstate`, `TGToken`, `TGID`, `letterSound`, `alarmSound`, `timeClick`). Booleans are stored as the strings `'true'`/`'false'`. Driver-specific settings extend the settings form via `LbastUtils.registerCustomSettings(scriptId, {html, saveHandler})`.
- **Per-session state:** `sessionStorage.lbastAuto_*` — e.g. `playerNickname`, `playerAlignment` (cached by `getPlayerInfo()` to avoid re-fetching), `checkAttempted` (captcha retry guard).
- **Randomized click delay:** `utils.click(text)` schedules a click with jitter derived from `localStorage.lbastAuto_timeClick` to look human. Use it instead of direct `$(...).click()` in drivers.
- **Refresh scheduling:** `utils.update(ms)` injects a footer line showing the wait time and reloads `location.php` after `ms`. Drivers multiply `rand * <multiplier>` (where `rand` is 500–1000) to stagger refreshes.
- **Telegram bot:** each user creates their own bot via @BotFather and stores the token in `localStorage.lbastAuto_TGToken`. There is no shared/hardcoded token. The chat ID is stored in `localStorage.lbastAuto_TGID`. Because localStorage is per-subdomain, users running multiple auto-catchers must enter the token and ID in each one's settings separately. Alerts go through `sendTGMessage()` which silently no-ops when the token or ID is missing/invalid.

### Versioning and release

Each script has a `// @version YYYY.MM.DD` line in its userscript header. Bump it when publishing a change so Tampermonkey offers an update to installed users. Scripts are distributed via GitHub raw URLs on `refs/heads/main`, so merging to main is the "release".
