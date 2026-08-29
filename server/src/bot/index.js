import { Bot, InputFile } from "grammy";
import { config } from "../config.js";
import { Character, AutoLeveler } from "../db.js";
import { encrypt } from "../crypto.js";
import { manager } from "../runner/manager.js";
import { testCredentials } from "../game/auth.js";
import { DRIVERS, EXTRA_SETTINGS } from "../game/drivers.js";
import { accessMiddleware, isAdmin } from "./access.js";
import { User } from "../db.js";
import { sendChunked } from "./notify.js";
import {
  mainMenu,
  backMenu,
  charsMenu,
  charMenu,
  levelersMenu,
  levelerMenu,
  driverPickMenu,
  characterPickMenu,
  yesNoMenu,
  confirmMenu,
  settingsMenu,
  usersMenu,
  STATE_LABELS,
  fmtTime,
  fmtAgo,
} from "./menus.js";

export function createBot() {
  const bot = new Bot(config.botToken);
  const flows = new Map();

  bot.use(accessMiddleware());

  function setFlow(ctx, flow) {
    flows.set(ctx.from.id, flow);
  }
  function clearFlow(ctx) {
    flows.delete(ctx.from.id);
  }

  async function ownedCharacter(ctx, id) {
    return Character.findOne({ where: { id, userId: ctx.dbUser.id } });
  }
  async function ownedLeveler(ctx, id) {
    return AutoLeveler.findOne({
      where: { id },
      include: [{ model: Character, where: { userId: ctx.dbUser.id } }],
    });
  }

  async function showMain(ctx, edit) {
    const text = "Главное меню автокача. Выберите раздел:";
    const kb = mainMenu(ctx.from.id);
    if (edit && ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: kb }).catch(() => {});
    } else {
      await ctx.reply(text, { reply_markup: kb });
    }
  }

  async function showChars(ctx) {
    const characters = await Character.findAll({
      where: { userId: ctx.dbUser.id },
      order: [["id", "ASC"]],
    });
    const text = characters.length
      ? "Ваши персонажи:"
      : "У вас пока нет персонажей. Добавьте персонажа, чтобы создавать автокачи.";
    await ctx
      .editMessageText(text, { reply_markup: charsMenu(characters) })
      .catch(() => {});
  }

  async function showChar(ctx, character) {
    const status =
      character.authStatus === "failed"
        ? "⚠️ требуется обновить пароль"
        : "✅ авторизация в порядке";
    const text = `Персонаж: ${character.login}\nСтатус: ${status}`;
    await ctx
      .editMessageText(text, { reply_markup: charMenu(character) })
      .catch(() => {});
  }

  async function showLevelers(ctx) {
    const characters = await Character.findAll({
      where: { userId: ctx.dbUser.id },
    });
    const charIds = characters.map((c) => c.id);
    const levelers = await AutoLeveler.findAll({
      where: { characterId: charIds },
      order: [["id", "ASC"]],
    });
    const text = levelers.length
      ? "Ваши автокачи:"
      : "У вас пока нет автокачей. Создайте новый автокач.";
    await ctx
      .editMessageText(text, {
        reply_markup: levelersMenu(levelers, (id) => manager.isRunning(id)),
      })
      .catch(() => {});
  }

  async function showLeveler(ctx, leveler) {
    const running = manager.isRunning(leveler.id);
    const driver = DRIVERS[leveler.driverKey];
    const stateLabel = running
      ? STATE_LABELS.running
      : STATE_LABELS[leveler.desiredState] || "остановлен";
    const text =
      `Автокач: ${leveler.name}\n` +
      `Персонаж: ${leveler.Character.login}\n` +
      `Бот/квест: ${driver ? driver.label : leveler.driverKey}\n` +
      `Состояние: ${stateLabel}`;
    await ctx
      .editMessageText(text, { reply_markup: levelerMenu(leveler, running) })
      .catch(() => {});
  }

  // ===== Commands =====
  bot.command("start", async (ctx) => {
    clearFlow(ctx);
    await showMain(ctx, false);
  });
  bot.command("menu", async (ctx) => {
    clearFlow(ctx);
    await showMain(ctx, false);
  });
  bot.command("cancel", async (ctx) => {
    clearFlow(ctx);
    await ctx.reply("Действие отменено.", {
      reply_markup: mainMenu(ctx.from.id),
    });
  });

  // ===== Navigation callbacks =====
  bot.callbackQuery("menu:main", async (ctx) => {
    clearFlow(ctx);
    await ctx.answerCallbackQuery();
    await showMain(ctx, true);
  });
  bot.callbackQuery("menu:chars", async (ctx) => {
    clearFlow(ctx);
    await ctx.answerCallbackQuery();
    await showChars(ctx);
  });
  bot.callbackQuery("menu:levelers", async (ctx) => {
    clearFlow(ctx);
    await ctx.answerCallbackQuery();
    await showLevelers(ctx);
  });

  // ===== Characters =====
  bot.callbackQuery("char:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    setFlow(ctx, { kind: "char_add", step: "login", data: {} });
    await ctx.reply("Введите логин персонажа в игре (или /cancel для отмены):");
  });

  bot.callbackQuery(/^char:reauth:(\d+)$/, async (ctx) => {
    const character = await ownedCharacter(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!character) {
      return;
    }
    setFlow(ctx, {
      kind: "char_reauth",
      step: "password",
      data: { id: character.id },
    });
    await ctx.reply(
      `Введите новый пароль для персонажа ${character.login} (или /cancel):`,
    );
  });

  bot.callbackQuery(/^char:del:(\d+)$/, async (ctx) => {
    const character = await ownedCharacter(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!character) {
      return;
    }
    const levelers = await AutoLeveler.findAll({
      where: { characterId: character.id },
    });
    await ctx.editMessageText(
      `Удалить персонажа ${character.login}? Это остановит и удалит все его автокачи (${levelers.length}).`,
      {
        reply_markup: confirmMenu(
          `char:delok:${character.id}`,
          `char:${character.id}`,
        ),
      },
    );
  });

  bot.callbackQuery(/^char:delok:(\d+)$/, async (ctx) => {
    const character = await ownedCharacter(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!character) {
      return;
    }
    const levelers = await AutoLeveler.findAll({
      where: { characterId: character.id },
    });
    for (const lv of levelers) {
      await manager.stop(lv.id).catch(() => {});
    }
    await character.destroy();
    await showChars(ctx);
  });

  bot.callbackQuery(/^char:(\d+)$/, async (ctx) => {
    const character = await ownedCharacter(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!character) {
      return;
    }
    await showChar(ctx, character);
  });

  // ===== Leveler creation =====
  bot.callbackQuery("lv:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    const characters = await Character.findAll({
      where: { userId: ctx.dbUser.id },
    });
    if (!characters.length) {
      await ctx.editMessageText(
        "Сначала добавьте персонажа в разделе «Персонажи».",
        { reply_markup: backMenu("menu:levelers") },
      );
      return;
    }
    setFlow(ctx, { kind: "lv_add", step: "pick_char", data: {} });
    await ctx.editMessageText("Выберите персонажа для автокача:", {
      reply_markup: characterPickMenu(characters),
    });
  });

  bot.callbackQuery(/^lvadd:char:(\d+)$/, async (ctx) => {
    const flow = flows.get(ctx.from.id);
    const character = await ownedCharacter(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!flow || flow.kind !== "lv_add" || !character) {
      return;
    }
    flow.data.characterId = character.id;
    flow.step = "pick_driver";
    await ctx.editMessageText("Выберите бота/квест для прокачки:", {
      reply_markup: driverPickMenu(),
    });
  });

  bot.callbackQuery(/^lvadd:driver:(\w+)$/, async (ctx) => {
    const flow = flows.get(ctx.from.id);
    const key = ctx.match[1];
    await ctx.answerCallbackQuery();
    if (!flow || flow.kind !== "lv_add" || !DRIVERS[key]) {
      return;
    }
    flow.data.driverKey = key;
    flow.step = "name";
    const character = await Character.findByPk(flow.data.characterId);
    const login = character ? character.login : "персонаж";
    await ctx.editMessageText(`Выбрано: ${DRIVERS[key].label}`);
    await ctx.reply(
      `Введите название для этого автокача (например, «${DRIVERS[key].label} на ${login}»):`,
    );
  });

  // ===== Leveler view =====
  bot.callbackQuery(/^lv:(\d+)$/, async (ctx) => {
    clearFlow(ctx);
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await showLeveler(ctx, leveler);
  });

  // ===== Leveler actions =====
  bot.callbackQuery(/^lv:start:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await ctx.editMessageText(
      "Запускаю автокач, это может занять несколько секунд…",
    );
    try {
      await manager.start(leveler.id);
      const fresh = await ownedLeveler(ctx, leveler.id);
      await showLeveler(ctx, fresh);
    } catch (e) {
      await ctx.editMessageText(`Не удалось запустить: ${e.message}`, {
        reply_markup: levelerMenu(leveler, false),
      });
    }
  });

  bot.callbackQuery(/^lv:stop:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await manager.stop(leveler.id);
    const fresh = await ownedLeveler(ctx, leveler.id);
    await showLeveler(ctx, fresh);
  });

  bot.callbackQuery(/^lv:status:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    const runner = manager.getRunner(leveler.id);
    if (!runner) {
      await ctx.reply(`[${leveler.name}] Автокач не запущен.`);
      return;
    }
    const st = runner.status();
    let head = `Состояние: ${STATE_LABELS[st.state] || st.state}`;
    if (st.state === "running" && st.wakeAt) {
      head += ` (спит до ${fmtTime(st.wakeAt)})`;
    }
    if (st.startedAt) {
      head += `\nЗапущен: ${fmtTime(st.startedAt)}`;
    }
    head += `\nПоследняя активность: ${fmtAgo(st.lastActivityAt)}`;
    const events = st.events
      .slice(-8)
      .map((e) => `• ${fmtTime(e.time)} ${e.text}`)
      .join("\n");
    const pageText = await runner.pageText();
    let msg = `📊 ${leveler.name}\n${head}`;
    if (events) {
      msg += `\n\nПоследние действия:\n${events}`;
    }
    if (pageText) {
      msg += `\n\n— Текст страницы —\n${pageText}`;
    }
    await sendChunked(ctx.api, ctx.chat.id, msg);
  });

  bot.callbackQuery(/^lv:shot:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    const runner = manager.getRunner(leveler.id);
    const shot = runner ? await runner.screenshot() : null;
    if (!shot) {
      await ctx.reply(
        `[${leveler.name}] Скриншот недоступен (автокач не запущен).`,
      );
      return;
    }
    await ctx.replyWithPhoto(new InputFile(shot, "status.png"), {
      caption: leveler.name,
    });
  });

  bot.callbackQuery(/^lv:del:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await ctx.editMessageText(`Удалить автокач «${leveler.name}»?`, {
      reply_markup: confirmMenu(`lv:delok:${leveler.id}`, `lv:${leveler.id}`),
    });
  });

  bot.callbackQuery(/^lv:delok:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await manager.stop(leveler.id).catch(() => {});
    await leveler.destroy();
    await showLevelers(ctx);
  });

  // ===== Leveler settings =====
  bot.callbackQuery(/^lv:settings:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await ctx.editMessageText(
      "Что изменить? (изменения применятся после перезапуска автокача)",
      {
        reply_markup: settingsMenu(leveler),
      },
    );
  });

  bot.callbackQuery(/^lvset:duke:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    await leveler.update({ useDukeEstate: !leveler.useDukeEstate });
    const fresh = await ownedLeveler(ctx, leveler.id);
    await ctx.editMessageText(
      `Лечение в поместье: ${fresh.useDukeEstate ? "да" : "нет"}`,
      {
        reply_markup: settingsMenu(fresh),
      },
    );
  });

  bot.callbackQuery(/^lvset:expo:(\d+)$/, async (ctx) => {
    const leveler = await ownedLeveler(ctx, Number(ctx.match[1]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    const extra = leveler.extraSettings
      ? JSON.parse(leveler.extraSettings)
      : {};
    extra.expo = !extra.expo;
    await leveler.update({ extraSettings: JSON.stringify(extra) });
    const fresh = await ownedLeveler(ctx, leveler.id);
    await ctx.editMessageText(`Опыт X2: ${extra.expo ? "да" : "нет"}`, {
      reply_markup: settingsMenu(fresh),
    });
  });

  bot.callbackQuery(/^lvset:choice:(\w+):(\d+)$/, async (ctx) => {
    const def = EXTRA_SETTINGS.find(
      (s) => s.type === "choice" && s.key === ctx.match[1],
    );
    const leveler = await ownedLeveler(ctx, Number(ctx.match[2]));
    await ctx.answerCallbackQuery();
    if (!leveler || !def) {
      return;
    }
    const extra = leveler.extraSettings
      ? JSON.parse(leveler.extraSettings)
      : {};
    const values = Object.keys(def.options);
    const current = extra[def.key] !== undefined ? extra[def.key] : def.default;
    extra[def.key] = values[(values.indexOf(current) + 1) % values.length];
    await leveler.update({ extraSettings: JSON.stringify(extra) });
    const fresh = await ownedLeveler(ctx, leveler.id);
    await ctx.editMessageText(
      `${def.label}: ${def.options[extra[def.key]]}`,
      {
        reply_markup: settingsMenu(fresh),
      },
    );
  });

  bot.callbackQuery(/^lvset:(goHP|houseHP|timeClick):(\d+)$/, async (ctx) => {
    const field = ctx.match[1];
    const leveler = await ownedLeveler(ctx, Number(ctx.match[2]));
    await ctx.answerCallbackQuery();
    if (!leveler) {
      return;
    }
    const prompts = {
      goHP: "Введите минимальное HP, при котором автокач работает:",
      houseHP: "Введите отрицательное HP, при котором идти лечиться:",
      timeClick: "Введите задержку между кликами в миллисекундах:",
    };
    setFlow(ctx, {
      kind: "lv_setfield",
      step: "value",
      data: { id: leveler.id, field },
    });
    await ctx.reply(prompts[field] + " (или /cancel)");
  });

  // ===== Admin: users =====
  bot.callbackQuery("menu:users", async (ctx) => {
    clearFlow(ctx);
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    const users = await User.findAll({ order: [["id", "ASC"]] });
    const nonAdmins = users.filter((u) => !isAdmin(u.tgId));
    await ctx.editMessageText(
      nonAdmins.length
        ? "Пользователи с доступом:"
        : "Пока нет добавленных пользователей (кроме администраторов).",
      { reply_markup: usersMenu(nonAdmins) },
    );
  });

  bot.callbackQuery("user:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    setFlow(ctx, { kind: "user_add", step: "id", data: {} });
    await ctx.reply(
      "Перешлите сообщение от пользователя или отправьте его числовой Telegram ID (или /cancel):",
    );
  });

  bot.callbackQuery(/^user:del:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    const tgId = Number(ctx.match[1]);
    await ctx.editMessageText(
      `Удалить доступ пользователя ${tgId}? Его персонажи и автокачи будут удалены.`,
      {
        reply_markup: confirmMenu(`user:delok:${tgId}`, "menu:users"),
      },
    );
  });

  bot.callbackQuery(/^user:delok:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) {
      return;
    }
    const tgId = Number(ctx.match[1]);
    const user = await User.findOne({ where: { tgId } });
    if (user) {
      const chars = await Character.findAll({ where: { userId: user.id } });
      for (const c of chars) {
        const lvs = await AutoLeveler.findAll({ where: { characterId: c.id } });
        for (const lv of lvs) {
          await manager.stop(lv.id).catch(() => {});
        }
      }
      await user.destroy();
    }
    const users = await User.findAll({ order: [["id", "ASC"]] });
    const nonAdmins = users.filter((u) => !isAdmin(u.tgId));
    await ctx.editMessageText("Пользователи с доступом:", {
      reply_markup: usersMenu(nonAdmins),
    });
  });

  // ===== Text input dispatch =====
  bot.on("message", async (ctx) => {
    const flow = flows.get(ctx.from.id);
    if (!flow) {
      await ctx.reply("Используйте /menu для открытия меню.");
      return;
    }
    try {
      await handleFlowMessage(ctx, flow);
    } catch (e) {
      clearFlow(ctx);
      await ctx.reply(`Ошибка: ${e.message}`, {
        reply_markup: mainMenu(ctx.from.id),
      });
    }
  });

  async function handleFlowMessage(ctx, flow) {
    const text = (ctx.message.text || "").trim();

    if (flow.kind === "char_add") {
      if (flow.step === "login") {
        if (!text) {
          await ctx.reply("Логин не может быть пустым. Введите логин:");
          return;
        }
        flow.data.login = text;
        flow.step = "password";
        await ctx.reply("Введите пароль персонажа:");
        return;
      }
      if (flow.step === "password") {
        flow.data.password = text;
        clearFlow(ctx);
        const wait = await ctx.reply("Проверяю вход в игру, подождите…");
        const result = await testCredentials(
          flow.data.login,
          flow.data.password,
        );
        if (!result.ok) {
          await ctx.api.editMessageText(
            ctx.chat.id,
            wait.message_id,
            `Не удалось войти как ${flow.data.login}: ${result.error}`,
            { reply_markup: mainMenu(ctx.from.id) },
          );
          return;
        }
        await Character.create({
          userId: ctx.dbUser.id,
          login: flow.data.login,
          passwordEnc: encrypt(flow.data.password),
          cookies: JSON.stringify(result.storageState),
          authStatus: "ok",
        });
        await ctx.api.editMessageText(
          ctx.chat.id,
          wait.message_id,
          `Персонаж ${flow.data.login} добавлен и авторизован.`,
          { reply_markup: mainMenu(ctx.from.id) },
        );
        return;
      }
    }

    if (flow.kind === "char_reauth" && flow.step === "password") {
      const character = await ownedCharacter(ctx, flow.data.id);
      clearFlow(ctx);
      if (!character) {
        return;
      }
      const wait = await ctx.reply("Проверяю новый пароль…");
      const result = await testCredentials(character.login, text);
      if (!result.ok) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          wait.message_id,
          `Пароль не подошёл: ${result.error}`,
          {
            reply_markup: mainMenu(ctx.from.id),
          },
        );
        return;
      }
      await character.update({
        passwordEnc: encrypt(text),
        cookies: JSON.stringify(result.storageState),
        authStatus: "ok",
      });
      await ctx.api.editMessageText(
        ctx.chat.id,
        wait.message_id,
        `Пароль персонажа ${character.login} обновлён.`,
        { reply_markup: mainMenu(ctx.from.id) },
      );
      return;
    }

    if (flow.kind === "lv_add") {
      if (flow.step === "name") {
        if (!text) {
          await ctx.reply("Название не может быть пустым. Введите название:");
          return;
        }
        flow.data.name = text;
        flow.step = "goHP";
        await ctx.reply(
          "Введите минимальное HP, при котором автокач будет работать (например, 1200):",
        );
        return;
      }
      if (flow.step === "goHP") {
        const n = parseInt(text, 10);
        if (Number.isNaN(n)) {
          await ctx.reply("Введите число:");
          return;
        }
        flow.data.goHP = n;
        flow.step = "duke";
        await ctx.reply("Лечиться в поместье герцога вместо Кулака Хаоса?", {
          reply_markup: yesNoMenu("lvadd:duke:1", "lvadd:duke:0"),
        });
        return;
      }
    }

    if (flow.kind === "lv_setfield" && flow.step === "value") {
      const leveler = await ownedLeveler(ctx, flow.data.id);
      clearFlow(ctx);
      if (!leveler) {
        return;
      }
      const n = parseInt(text, 10);
      if (Number.isNaN(n)) {
        await ctx.reply("Введите число. Изменение отменено.", {
          reply_markup: mainMenu(ctx.from.id),
        });
        return;
      }
      await leveler.update({ [flow.data.field]: n });
      await ctx.reply(
        "Настройка сохранена. Перезапустите автокач, чтобы применить.",
        { reply_markup: mainMenu(ctx.from.id) },
      );
      return;
    }

    if (flow.kind === "user_add" && flow.step === "id") {
      let tgId = null;
      if (ctx.message.forward_from) {
        tgId = ctx.message.forward_from.id;
      } else if (/^\d+$/.test(text)) {
        tgId = Number(text);
      }
      clearFlow(ctx);
      if (!tgId) {
        await ctx.reply(
          "Не удалось определить ID (пользователь мог скрыть пересылку). Отправьте числовой ID.",
          {
            reply_markup: mainMenu(ctx.from.id),
          },
        );
        return;
      }
      await User.findOrCreate({
        where: { tgId },
        defaults: { tgId, addedByTgId: ctx.from.id },
      });
      await ctx.reply(`Пользователь ${tgId} добавлен.`, {
        reply_markup: mainMenu(ctx.from.id),
      });
      return;
    }

    await ctx.reply(
      "Не понимаю ввод в текущем состоянии. /cancel чтобы отменить.",
    );
  }

  bot.callbackQuery(/^lvadd:duke:(0|1)$/, async (ctx) => {
    const flow = flows.get(ctx.from.id);
    await ctx.answerCallbackQuery();
    if (!flow || flow.kind !== "lv_add" || flow.step !== "duke") {
      return;
    }
    flow.data.useDukeEstate = ctx.match[1] === "1";
    await ctx.editMessageText(
      `Лечение в поместье: ${flow.data.useDukeEstate ? "да" : "нет"}`,
    );
    await finalizeLeveler(ctx, flow);
  });

  async function finalizeLeveler(ctx, flow) {
    clearFlow(ctx);
    const d = flow.data;
    await AutoLeveler.create({
      characterId: d.characterId,
      driverKey: d.driverKey,
      name: d.name,
      goHP: d.goHP,
      useDukeEstate: !!d.useDukeEstate,
      desiredState: "stopped",
    });
    await ctx.reply(
      `Автокач «${d.name}» создан. Настройки лечения и задержки можно изменить в его меню. Откройте раздел «Автокачи», чтобы запустить.`,
      {
        reply_markup: mainMenu(ctx.from.id),
      },
    );
  }

  return bot;
}
