import fs from "node:fs";
import path from "node:path";
import { Sequelize, DataTypes } from "sequelize";
import { config } from "./config.js";

function createSequelize() {
  const url = config.databaseUrl;
  if (url.startsWith("sqlite:")) {
    let storage = url.slice("sqlite:".length);
    if (storage === ":memory:" || storage === "") {
      storage = ":memory:";
    } else {
      if (!path.isAbsolute(storage)) {
        storage = path.join(config.serverRoot, storage);
      }
      fs.mkdirSync(path.dirname(storage), { recursive: true });
    }
    return new Sequelize({ dialect: "sqlite", storage, logging: false });
  }
  return new Sequelize(url, { logging: false });
}

export const sequelize = createSequelize();

export const User = sequelize.define("User", {
  tgId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  addedByTgId: { type: DataTypes.BIGINT, allowNull: true },
});

export const Character = sequelize.define("Character", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  login: { type: DataTypes.STRING, allowNull: false },
  passwordEnc: { type: DataTypes.TEXT, allowNull: false },
  cookies: { type: DataTypes.TEXT, allowNull: true },
  authStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: "ok" },
});

export const AutoLeveler = sequelize.define("AutoLeveler", {
  characterId: { type: DataTypes.INTEGER, allowNull: false },
  driverKey: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  goHP: { type: DataTypes.INTEGER, allowNull: false },
  houseHP: { type: DataTypes.INTEGER, allowNull: false, defaultValue: -1000 },
  useDukeEstate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  timeClick: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 700 },
  extraSettings: { type: DataTypes.TEXT, allowNull: true },
  desiredState: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "stopped",
  },
});

User.hasMany(Character, { foreignKey: "userId", onDelete: "CASCADE" });
Character.belongsTo(User, { foreignKey: "userId" });
Character.hasMany(AutoLeveler, {
  foreignKey: "characterId",
  onDelete: "CASCADE",
});
AutoLeveler.belongsTo(Character, { foreignKey: "characterId" });

export async function initDb() {
  await sequelize.authenticate();
  await sequelize.sync();
}
