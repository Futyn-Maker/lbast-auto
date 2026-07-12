import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(serverRoot, ".env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  serverRoot,
  repoRoot: path.resolve(serverRoot, ".."),
  botToken: required("TG_BOT_TOKEN"),
  adminIds: (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  secretKey: required("SECRET_KEY"),
  databaseUrl: process.env.DATABASE_URL || "sqlite:data/lbast.db",
  gameUrl: (process.env.GAME_URL || "http://lbast.ru").replace(/\/+$/, ""),
  headless: process.env.HEADLESS !== "false",
  noSandbox: process.env.BROWSER_NO_SANDBOX === "true",
  userAgent:
    process.env.USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

if (config.adminIds.length === 0) {
  console.error("ADMIN_TG_IDS must contain at least one Telegram ID");
  process.exit(1);
}
