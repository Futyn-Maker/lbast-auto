import { config } from "./config.js";
import { initDb } from "./db.js";
import { manager } from "./runner/manager.js";
import { closeBrowser } from "./runner/browser.js";
import { createBot } from "./bot/index.js";
import { sendChunked } from "./bot/notify.js";

async function main() {
  await initDb();
  console.log("Database ready.");

  const bot = createBot();

  manager.setNotifier(async (tgId, text) => {
    await sendChunked(bot.api, tgId, text);
  });

  await bot.init();
  console.log(`Bot @${bot.botInfo.username} started.`);
  console.log(`Admins: ${config.adminIds.join(", ")}`);

  bot.start({
    onStart: async () => {
      await manager.resumeAll();
      console.log("Resumed previously running auto-levelers.");
    },
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down…`);
    await bot.stop().catch(() => {});
    await manager.stopAll().catch(() => {});
    await closeBrowser().catch(() => {});
    process.exit(0);
  }
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("Fatal error during startup:", e);
  process.exit(1);
});
