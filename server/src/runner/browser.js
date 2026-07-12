import { chromium } from "playwright";
import { config } from "../config.js";

let browserPromise = null;

export function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: config.headless,
      args: ["--disable-blink-features=AutomationControlled"],
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
