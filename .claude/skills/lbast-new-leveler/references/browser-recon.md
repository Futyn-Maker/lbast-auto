# Browser recon against lbast.ru

Snippets that work with the Playwright MCP tools (`browser_navigate`, `browser_evaluate`) or `page.evaluate` in a local script. All URLs are `http://` — the game has no SSL.

## Login

Open `http://lbast.ru/`, then:

```js
() => {
  document.querySelector("input[name=login]").value = LOGIN;
  document.querySelector("input[name=pass]").value = PASSWORD;
  document.querySelector("input[name=zap]").checked = true;
  document.querySelector("form").submit();
  return "ok";
};
```

`zap` is "remember me"; with it the session cookie persists across every later navigation. Success lands on `/location.php` with the user bar `Nick (HP/maxHP) (reserves) Q… D…`.

## Dump a page

Use this on every page of the route and keep the output. Direction links are `location.php?…&idem=N`, NPC/object pages are `loc.php?…&obj=NNNN`, the arena is `arena_go.php`.

```js
() =>
  document.body.innerText.slice(0, 2500) +
  "\n---LINKS---\n" +
  Array.from(document.querySelectorAll("a"))
    .map((a) => a.textContent.trim() + " => " + a.getAttribute("href"))
    .join("\n");
```

To follow a link by text in one step (page ids change on every load, so never reuse a URL you saw earlier):

```js
() => {
  const a = Array.from(document.querySelectorAll("a")).find((a) =>
    a.textContent.includes("север"),
  );
  const h = a && a.href;
  if (a) location.href = h;
  return document.body.innerText.slice(0, 900) + "\n=> " + h;
};
```

Because each step's href comes from the previous page, route steps must be sequential — one evaluate per page.

## Quest task text

```js
async () => {
  const t = await (await fetch("/pers.php?r=2347")).text();
  const d = document.createElement("div");
  d.innerHTML = t;
  const s = d.innerText;
  const i = s.indexOf("Текущее задание");
  return s.slice(i, i + 150);
};
```

Check it before taking the task (expect "нет"), right after, and after the cycle. The word you pick for `hasTask()` must appear in this line and nowhere else in `pers.php`.

## Amulet list

```js
async () => {
  const t = await (await fetch("/location.php?r=1&mod=fastway")).text();
  const d = document.createElement("div");
  d.innerHTML = t;
  return Array.from(d.querySelectorAll("a"))
    .filter((a) => /lway/.test(a.getAttribute("href") || ""))
    .map((a) => a.textContent.trim() + " => " + a.getAttribute("href"))
    .join("\n");
};
```

`lway=1` is "Последний портал" (the last teleport destination) — this is what the default `fastTargetUrl` uses from the hometown.

## Fighting a battle

On the `arena_go.php` page: use the skill once if present, then POST random hits until the log says the battle is over. Bots hit on a timer, so a 1.5 s pause between posts is enough.

```js
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let html = document.documentElement.innerHTML;
  const um = html.match(/href="([^"]*umen=1[^"]*)"/);
  if (um) html = await (await fetch(um[1].replace(/&amp;/g, "&"))).text();
  for (let i = 0; i < 80; i++) {
    const d = document.createElement("div");
    d.innerHTML = html;
    const t = d.innerText;
    if (/завершен|ернуться/.test(t)) return "DONE " + i;
    const f = d.querySelector("form");
    if (!f) {
      await sleep(3000);
      html = await (await fetch(location.pathname + location.search)).text();
      continue;
    }
    const fd = new URLSearchParams();
    fd.set("bl", 1 + Math.floor(Math.random() * 3));
    fd.set("ud", 1 + Math.floor(Math.random() * 3));
    html = await (
      await fetch(f.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fd,
      })
    ).text();
    await sleep(1500);
  }
  return "TIMEOUT";
};
```

Then reload the arena page to read the result, click "Вернуться", and dump the location page — "Продолжить квест" appears there for quests.

## Reading a page fetched in the background

Strip styles/scripts before reading text, otherwise CSS dominates the output:

```js
async () => {
  const g = await (await fetch(URL)).text();
  const d = document.createElement("div");
  d.innerHTML = g;
  d.querySelectorAll("style,script").forEach((e) => e.remove());
  return d.innerText.replace(/\s+/g, " ").slice(0, 700);
};
```

Use this to probe the engage link while tired (expect "Вы слишком устали. Требуется отдых еще N мин.") without navigating away.

## Cleanup

Teleport the character home with `location.php?r=3594&mod=fastway&lway=<2|3|6 per HOMETOWN>` and close the browser. The Playwright MCP leaves a `.playwright-mcp/` folder with snapshots in the repo root — it is not part of the change set.
