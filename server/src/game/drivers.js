export const DRIVERS = {
  baron: {
    file: "lbast_baron.user.js",
    label: "Призрак барона, Призрак воина",
  },
  volki: {
    file: "lbast_volki.user.js",
    label: "Волк вожак стаи, Матерый волк",
  },
  bleyk: { file: "lbast_bleyk.user.js", label: "Призрак Блейка, Пират" },
  gorgulya: { file: "lbast_gorgulya.user.js", label: "Горгулья" },
  moleg: { file: "lbast_moleg.user.js", label: "Молег" },
  gnom: { file: "lbast_gnom.user.js", label: "Дух гнома" },
  paladin: {
    file: "lbast_paladin.user.js",
    label: "Прокачка подкласса «Паладин»",
  },
  glad: {
    file: "lbast_glad.user.js",
    label: "Прокачка подкласса «Гладиатор»",
  },
  yantar: {
    file: "lbast_yantar.user.js",
    label: "Янтарная гора",
  },
};

export const EXTRA_SETTINGS = [
  {
    key: "expo",
    localStorageKey: "lbastAuto_expo",
    label: "Автоматически активировать опыт X2",
    type: "boolean",
    default: false,
  },
  {
    key: "yantarBot",
    localStorageKey: "lbastAuto_yantarBot",
    label: "Бот",
    type: "choice",
    options: { gnom: "Призрак янтарного гнома", kirka: "Призрак с киркой" },
    default: "gnom",
    drivers: ["yantar"],
  },
];

export function extraSettingsFor(driverKey) {
  return EXTRA_SETTINGS.filter(
    (def) => !def.drivers || def.drivers.includes(driverKey),
  );
}
