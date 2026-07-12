import { AutoLeveler, Character, User } from "../db.js";
import { decrypt } from "../crypto.js";
import { Runner } from "./runner.js";

export class RunnerManager {
  constructor() {
    this.runners = new Map();
    this.notifier = null;
  }

  setNotifier(fn) {
    this.notifier = fn;
  }

  notify(tgId, text) {
    if (this.notifier) {
      Promise.resolve(this.notifier(tgId, text)).catch(() => {});
    }
  }

  isRunning(levelerId) {
    const runner = this.runners.get(levelerId);
    return (
      !!runner && (runner.state === "running" || runner.state === "starting")
    );
  }

  getRunner(levelerId) {
    return this.runners.get(levelerId) || null;
  }

  async start(levelerId) {
    const leveler = await AutoLeveler.findByPk(levelerId, {
      include: [{ model: Character, include: [User] }],
    });
    if (!leveler) {
      throw new Error("Автокач не найден.");
    }
    const character = leveler.Character;
    const user = character.User;
    const prefix = `[${leveler.name} / ${character.login}]`;

    if (this.isRunning(leveler.id)) {
      throw new Error("Этот автокач уже запущен.");
    }
    if (character.authStatus === "failed") {
      throw new Error(
        "Авторизация персонажа не работает. Обновите пароль персонажа и попробуйте снова.",
      );
    }
    for (const [otherId, runner] of this.runners) {
      if (
        otherId !== leveler.id &&
        runner.levelerCharacterId === character.id &&
        this.isRunning(otherId)
      ) {
        throw new Error("На этом персонаже уже запущен другой автокач.");
      }
    }

    const runner = new Runner({
      leveler: leveler.get({ plain: true }),
      character: character.get({ plain: true }),
      password: decrypt(character.passwordEnc),
      hooks: {
        onNotify: (text) => {
          this.notify(user.tgId, `${prefix} ${text}`);
        },
        onAuthFailed: async (error) => {
          await character.update({ authStatus: "failed" }).catch(() => {});
          await leveler.update({ desiredState: "stopped" }).catch(() => {});
          this.notify(
            user.tgId,
            `${prefix} Автокач остановлен: не удалось войти в игру (${error}). Обновите пароль персонажа через меню.`,
          );
        },
        onStalled: async () => {
          await leveler.update({ desiredState: "stopped" }).catch(() => {});
          this.notify(
            user.tgId,
            `${prefix} Автокач завис и был остановлен. Проверьте персонажа и запустите снова.`,
          );
        },
        onCookies: async (cookiesJson) => {
          await character.update({ cookies: cookiesJson }).catch(() => {});
        },
      },
    });
    runner.levelerCharacterId = character.id;

    this.runners.set(leveler.id, runner);
    try {
      await runner.start();
    } catch (e) {
      this.runners.delete(leveler.id);
      await runner.shutdown().catch(() => {});
      throw e;
    }
    if (runner.state !== "running") {
      this.runners.delete(leveler.id);
      throw new Error("Автокач не запустился: авторизация не прошла.");
    }
    await leveler.update({ desiredState: "running" });
    return runner;
  }

  async stop(levelerId) {
    const runner = this.runners.get(levelerId);
    if (runner) {
      await runner.stop();
      this.runners.delete(levelerId);
    }
    const leveler = await AutoLeveler.findByPk(levelerId);
    if (leveler) {
      await leveler.update({ desiredState: "stopped" });
    }
  }

  async stopAll() {
    for (const [id] of this.runners) {
      await this.stop(id).catch(() => {});
    }
  }

  async resumeAll() {
    const levelers = await AutoLeveler.findAll({
      where: { desiredState: "running" },
    });
    for (const leveler of levelers) {
      try {
        await this.start(leveler.id);
      } catch (e) {
        const full = await AutoLeveler.findByPk(leveler.id, {
          include: [{ model: Character, include: [User] }],
        });
        if (full) {
          this.notify(
            full.Character.User.tgId,
            `[${full.name} / ${full.Character.login}] Не удалось возобновить автокач после перезапуска сервера: ${e.message}`,
          );
        }
      }
    }
  }
}

export const manager = new RunnerManager();
