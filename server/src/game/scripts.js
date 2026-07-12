import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { DRIVERS } from "./drivers.js";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export const scripts = {
  jquery: read(path.join(config.serverRoot, "vendor", "jquery-3.3.1.js")),
  utils: read(path.join(config.repoRoot, "lbast_utils.user.js")),
  battle: read(path.join(config.repoRoot, "lbast_battle.user.js")),
  drivers: Object.fromEntries(
    Object.entries(DRIVERS).map(([key, { file }]) => [
      key,
      read(path.join(config.repoRoot, file)),
    ]),
  ),
};
