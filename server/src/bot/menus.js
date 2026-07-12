import { InlineKeyboard } from "grammy";
import { DRIVERS } from "../game/drivers.js";
import { isAdmin } from "./access.js";

export const STATE_LABELS = {
  starting: "запускается",
  running: "работает",
  stopped: "остановлен",
  error: "ошибка",
  auth_failed: "нужна авторизация",
};

export function mainMenu(tgId) {
  const kb = new InlineKeyboard()
    .text("👤 Персонажи", "menu:chars")
    .row()
    .text("⚙️ Автокачи", "menu:levelers")
    .row();
  if (isAdmin(tgId)) {
    kb.text("🛡 Пользователи", "menu:users").row();
  }
  return kb;
}

export function backMenu(target = "menu:main") {
  return new InlineKeyboard().text("◀️ Назад", target);
}

export function charsMenu(characters) {
  const kb = new InlineKeyboard();
  for (const c of characters) {
    const mark = c.authStatus === "failed" ? " ⚠️" : "";
    kb.text(`${c.login}${mark}`, `char:${c.id}`).row();
  }
  kb.text("➕ Добавить персонажа", "char:add").row();
  kb.text("◀️ Назад", "menu:main");
  return kb;
}

export function charMenu(character) {
  const kb = new InlineKeyboard()
    .text("🔑 Обновить пароль", `char:reauth:${character.id}`)
    .row()
    .text("🗑 Удалить персонажа", `char:del:${character.id}`)
    .row()
    .text("◀️ Назад", "menu:chars");
  return kb;
}

export function levelersMenu(levelers, isRunning) {
  const kb = new InlineKeyboard();
  for (const lv of levelers) {
    const running = isRunning(lv.id);
    const icon = running ? "🟢" : "⚪️";
    kb.text(`${icon} ${lv.name}`, `lv:${lv.id}`).row();
  }
  kb.text("➕ Создать автокач", "lv:add").row();
  kb.text("◀️ Назад", "menu:main");
  return kb;
}

export function levelerMenu(leveler, running) {
  const kb = new InlineKeyboard();
  if (running) {
    kb.text("⏹ Остановить", `lv:stop:${leveler.id}`).row();
  } else {
    kb.text("▶️ Запустить", `lv:start:${leveler.id}`).row();
  }
  kb.text("📊 Статус", `lv:status:${leveler.id}`)
    .text("📷 Скриншот", `lv:shot:${leveler.id}`)
    .row()
    .text("⚙️ Настройки", `lv:settings:${leveler.id}`)
    .row()
    .text("🗑 Удалить", `lv:del:${leveler.id}`)
    .row()
    .text("◀️ Назад", "menu:levelers");
  return kb;
}

export function driverPickMenu() {
  const kb = new InlineKeyboard();
  for (const [key, { label }] of Object.entries(DRIVERS)) {
    kb.text(label, `lvadd:driver:${key}`).row();
  }
  kb.text("✖️ Отмена", "menu:levelers");
  return kb;
}

export function characterPickMenu(characters) {
  const kb = new InlineKeyboard();
  for (const c of characters) {
    kb.text(c.login, `lvadd:char:${c.id}`).row();
  }
  kb.text("✖️ Отмена", "menu:levelers");
  return kb;
}

export function yesNoMenu(yesData, noData) {
  return new InlineKeyboard().text("Да", yesData).text("Нет", noData);
}

export function confirmMenu(yesData, noData) {
  return new InlineKeyboard()
    .text("✅ Да, удалить", yesData)
    .text("✖️ Отмена", noData);
}

export function settingsMenu(leveler) {
  const duke = leveler.useDukeEstate ? "да" : "нет";
  const kb = new InlineKeyboard()
    .text(`HP для работы: ${leveler.goHP}`, `lvset:goHP:${leveler.id}`)
    .row()
    .text(`HP для лечения: ${leveler.houseHP}`, `lvset:houseHP:${leveler.id}`)
    .row()
    .text(`Лечение в поместье: ${duke}`, `lvset:duke:${leveler.id}`)
    .row()
    .text(
      `Задержка кликов: ${leveler.timeClick} мс`,
      `lvset:timeClick:${leveler.id}`,
    )
    .row();
  if (leveler.driverKey === "bleyk") {
    const extra = leveler.extraSettings
      ? JSON.parse(leveler.extraSettings)
      : {};
    kb.text(
      `Опыт X2: ${extra.expo ? "да" : "нет"}`,
      `lvset:expo:${leveler.id}`,
    ).row();
  }
  kb.text("◀️ Назад", `lv:${leveler.id}`);
  return kb;
}

export function usersMenu(users) {
  const kb = new InlineKeyboard();
  for (const u of users) {
    kb.text(`🗑 ${u.tgId}`, `user:del:${u.tgId}`).row();
  }
  kb.text("➕ Добавить пользователя", "user:add").row();
  kb.text("◀️ Назад", "menu:main");
  return kb;
}

export function fmtTime(ts) {
  if (!ts) {
    return "—";
  }
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function fmtAgo(ts) {
  if (!ts) {
    return "";
  }
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) {
    return `${secs} сек назад`;
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins} мин назад`;
  }
  return `${Math.floor(mins / 60)} ч назад`;
}
