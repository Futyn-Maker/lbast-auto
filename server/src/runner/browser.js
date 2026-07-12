import { chromium } from "playwright";
import { config } from "../config.js";

let browserPromise = null;

export function getBrowser() {
  if (!browserPromise) {
    const args = ["--disable-blink-features=AutomationControlled"];
    if (config.noSandbox) {
      args.push(
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      );
    }
    browserPromise = chromium.launch({
      headless: config.headless,
      args,
    });
  }
  return browserPromise;
}

export async function newGameContext(storageState) {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: config.userAgent,
    storageState: storageState || undefined,
  });
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close().catch(() => {});
    browserPromise = null;
  }
}
