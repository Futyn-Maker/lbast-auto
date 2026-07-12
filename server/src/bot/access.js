import { config } from "../config.js";
import { User } from "../db.js";

export function isAdmin(tgId) {
  return config.adminIds.includes(Number(tgId));
}

export async function isAllowed(tgId) {
  if (isAdmin(tgId)) {
    return true;
  }
  const user = await User.findOne({ where: { tgId } });
  return !!user;
}

export async function ensureUser(tgId) {
  const [user] = await User.findOrCreate({
    where: { tgId },
    defaults: { tgId, addedByTgId: null },
  });
  return user;
}

export function accessMiddleware() {
  return async (ctx, next) => {
    const tgId = ctx.from && ctx.from.id;
    if (tgId && (await isAllowed(tgId))) {
      ctx.dbUser = await ensureUser(tgId);
      await next();
      return;
    }
    if (ctx.callbackQuery) {
      await ctx
        .answerCallbackQuery({ text: "Нет доступа.", show_alert: true })
        .catch(() => {});
    } else if (ctx.message) {
      await ctx
        .reply("У вас нет доступа к этому боту. Обратитесь к администратору.")
        .catch(() => {});
    }
  };
}
