import { config } from "../config.js";
import { newGameContext } from "./browser.js";
import { buildInitScript } from "./inject.js";
import { performLogin, isLoggedOutPage } from "../game/auth.js";

const WATCHDOG_INTERVAL_MS = 60 * 1000;
const WAKE_GRACE_MS = 5 * 60 * 1000;
const IDLE_LIMIT_MS = 45 * 60 * 1000;
const COOKIE_SAVE_INTERVAL_MS = 30 * 60 * 1000;
const MAX_STALLS = 3;
const MAX_EVENTS = 30;

export class Runner {
  constructor({ leveler, character, password, hooks }) {
    this.leveler = leveler;
    this.character = character;
    this.password = password;
    this.hooks = hooks;
    this.state = "starting";
    this.events = [];
    this.startedAt = null;
    this.lastActivityAt = Date.now();
    this.wakeAt = null;
    this.stallCount = 0;
    this.reauthInProgress = false;
    this.clickPending = false;
    this.context = null;
    this.page = null;
    this.watchdogTimer = null;
    this.lastCookieSaveAt = Date.now();
  }

  async safeGoto(url) {
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (e) {
      const msg = String(e && e.message);
      if (
        msg.includes("ERR_ABORTED") ||
        msg.includes("interrupted") ||
        msg.includes("frame was detached")
      ) {
        return;
      }
      throw e;
    }
  }

  pushEvent(type, text) {
    this.events.push({ time: Date.now(), type, text });
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }

  activity() {
    this.lastActivityAt = Date.now();
    this.stallCount = 0;
  }

  handleReport(payload) {
    if (this.state !== "running" && this.state !== "starting") {
      return;
    }
    const type = payload && payload.type;
    const text = String((payload && payload.text) || "");
    this.activity();
    if (type === "sleep") {
      this.wakeAt = Number(payload.wakeAt) || null;
      this.pushEvent("sleep", text);
    } else if (type === "action") {
      if (text.startsWith("Клик")) {
        this.clickPending = true;
      }
      this.pushEvent("action", text);
    } else if (type === "notify") {
      this.pushEvent("notify", text);
      this.hooks.onNotify(text);
    } else if (type === "error") {
      this.pushEvent("error", text);
      this.hooks.onNotify(text);
    }
  }

  async start() {
    const storageState = this.character.cookies
      ? JSON.parse(this.character.cookies)
      : undefined;
    this.context = await newGameContext(storageState);
    await this.context.exposeBinding("__lbastReport", (source, payload) => {
      this.handleReport(payload);
    });
    await this.context.addInitScript(buildInitScript(this.leveler));

    this.page = await this.context.newPage();

    this.context.on("page", (page) => {
      if (page !== this.page) {
        this.pushEvent("action", "Закрыто лишнее окно браузера");
        page.close().catch(() => {});
      }
    });

    this.page.on("framenavigated", (frame) => {
      if (frame === this.page.mainFrame()) {
        this.activity();
        this.wakeAt = null;
        if (this.clickPending) {
          this.clickPending = false;
          return;
        }
        this.pushEvent(
          "nav",
          "Переход: " + frame.url().replace(config.gameUrl, ""),
        );
      }
    });
    this.page.on("load", () => {
      this.checkAuth().catch(() => {});
    });
    this.page.on("dialog", (dialog) => {
      this.pushEvent(
        "action",
        "Диалог браузера закрыт: " + dialog.message().slice(0, 100),
      );
      dialog.dismiss().catch(() => {});
    });
    this.page.on("crash", () => {
      this.pushEvent("error", "Страница браузера упала, перезапускаю");
      this.page.reload().catch(() => {});
    });

    await this.safeGoto(config.gameUrl + "/location.php");
    if (await isLoggedOutPage(this.page)) {
      const ok = await this.tryRelogin();
      if (!ok) {
        return;
      }
    }

    this.state = "running";
    this.startedAt = Date.now();
    this.pushEvent("action", "Автокач запущен");
    this.watchdogTimer = setInterval(() => {
      this.tick().catch(() => {});
    }, WATCHDOG_INTERVAL_MS);
  }

  async checkAuth() {
    if (this.state !== "running" || this.reauthInProgress) {
      return;
    }
    if (!this.page.url().startsWith(config.gameUrl)) {
      return;
    }
    if (await isLoggedOutPage(this.page)) {
      await this.tryRelogin();
    }
  }

  async tryRelogin() {
    if (this.reauthInProgress) {
      return false;
    }
    this.reauthInProgress = true;
    try {
      this.pushEvent("action", "Сессия истекла, выполняю повторный вход");
      const result = await performLogin(
        this.page,
        this.character.login,
        this.password,
      );
      if (result.ok) {
        await this.saveCookies();
        await this.safeGoto(config.gameUrl + "/location.php");
        this.pushEvent("action", "Повторный вход выполнен");
        return true;
      }
      this.state = "auth_failed";
      this.pushEvent("error", "Ошибка авторизации: " + result.error);
      await this.shutdown();
      this.hooks.onAuthFailed(result.error);
      return false;
    } catch (e) {
      this.pushEvent("error", "Сбой повторного входа: " + e.message);
      return false;
    } finally {
      this.reauthInProgress = false;
    }
  }

  async tick() {
    if (this.state !== "running") {
      return;
    }
    const now = Date.now();

    if (now - this.lastCookieSaveAt > COOKIE_SAVE_INTERVAL_MS) {
      this.lastCookieSaveAt = now;
      await this.saveCookies().catch(() => {});
    }

    const overslept = this.wakeAt !== null && now > this.wakeAt + WAKE_GRACE_MS;
    const idle =
      this.wakeAt === null && now - this.lastActivityAt > IDLE_LIMIT_MS;
    if (!overslept && !idle) {
      return;
    }

    this.stallCount += 1;
    this.wakeAt = null;
    this.lastActivityAt = now;
    if (this.stallCount >= MAX_STALLS) {
      this.state = "error";
      this.pushEvent(
        "error",
        "Автокач завис и был остановлен после нескольких перезагрузок",
      );
      await this.shutdown();
      this.hooks.onStalled();
      return;
    }
    this.pushEvent(
      "action",
      `Сторожевой таймер: страница молчит, перезагружаю (${this.stallCount}/${MAX_STALLS})`,
    );
    await this.page
      .goto(config.gameUrl + "/location.php", { waitUntil: "domcontentloaded" })
      .catch(() => {});
  }

  async saveCookies() {
    if (!this.context) {
      return;
    }
    const state = await this.context.storageState();
    await this.hooks.onCookies(JSON.stringify(state));
  }

  async shutdown() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.context) {
      await this.saveCookies().catch(() => {});
      await this.context.close().catch(() => {});
      this.context = null;
      this.page = null;
    }
  }

  async stop() {
    if (this.state === "stopped") {
      return;
    }
    this.state = "stopped";
    this.pushEvent("action", "Автокач остановлен");
    await this.shutdown();
  }

  status() {
    return {
      state: this.state,
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
      wakeAt: this.wakeAt,
      events: [...this.events],
    };
  }

  async pageText() {
    if (!this.page) {
      return null;
    }
    const text = await this.page
      .evaluate(() => document.body.innerText)
      .catch(() => null);
    if (text === null) {
      return null;
    }
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  async screenshot() {
    if (!this.page) {
      return null;
    }
    return this.page.screenshot({ fullPage: true }).catch(() => null);
  }
}
