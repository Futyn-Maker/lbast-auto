import { config } from "../config.js";
import { newGameContext } from "../runner/browser.js";

function hasAuthCookies(cookies) {
  const names = new Set(cookies.map((c) => c.name));
  return names.has("user_id") && names.has("user_pass");
}

function cleanPageError(text) {
  const message = String(text)
    .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?\s*/, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s*(Вернуться|Авторизация|Обновить).*$/u, "")
    .trim();
  return message.slice(0, 200) || "неизвестная ошибка";
}

export async function performLogin(page, login, password) {
  await page.goto(config.gameUrl + "/", { waitUntil: "domcontentloaded" });

  const loginInput = page.locator('input[name="login"]').first();
  if (!(await loginInput.count())) {
    const cookies = await page.context().cookies();
    if (hasAuthCookies(cookies)) {
      return { ok: true };
    }
    return { ok: false, error: "Не найдена форма входа на странице игры." };
  }

  await loginInput.fill(login);
  await page.locator('input[name="pass"]').first().fill(password);
  const zap = page.locator('input[name="zap"]').first();
  if ((await zap.count()) && !(await zap.isChecked().catch(() => true))) {
    await zap.check().catch(() => {});
  }

  await page.locator('input[type="submit"]').first().click();
  await page.waitForLoadState("domcontentloaded");

  const cookies = await page.context().cookies();
  if (hasAuthCookies(cookies)) {
    return { ok: true };
  }

  const text = await page
    .evaluate(() => document.body.innerText)
    .catch(() => "");
  return { ok: false, error: cleanPageError(text) };
}

export async function testCredentials(login, password) {
  const context = await newGameContext(null);
  try {
    const page = await context.newPage();
    const result = await performLogin(page, login, password);
    if (result.ok) {
      result.storageState = await context.storageState();
    }
    return result;
  } finally {
    await context.close().catch(() => {});
  }
}

export async function isLoggedOutPage(page) {
  return page
    .evaluate(() => {
      if (
        document.body &&
        document.body.innerText.indexOf("Вы не авторизованы") !== -1
      ) {
        return true;
      }
      return (
        !!document.querySelector('input[name="login"]') &&
        !!document.querySelector('input[name="pass"]')
      );
    })
    .catch(() => false);
}
