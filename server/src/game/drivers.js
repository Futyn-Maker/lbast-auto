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
};

export const EXTRA_SETTINGS = [
  {
    key: "expo",
    localStorageKey: "lbastAuto_expo",
    label: "Автоматически активировать опыт X2",
    type: "boolean",
    default: false,
  },
];
