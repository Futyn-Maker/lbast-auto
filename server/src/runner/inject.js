import { scripts } from "../game/scripts.js";
import { DRIVER_EXTRA_SETTINGS } from "../game/drivers.js";

export function buildInitScript(leveler) {
  const settings = {
    lbastAuto_goHP: String(leveler.goHP),
    lbastAuto_houseHP: String(leveler.houseHP),
    lbastAuto_useDukeEstate: String(leveler.useDukeEstate),
    lbastAuto_timeClick: String(leveler.timeClick),
    lbastAuto_letterSound: "false",
    lbastAuto_alarmSound: "false",
  };

  const extraDefs = DRIVER_EXTRA_SETTINGS[leveler.driverKey] || [];
  const extraValues = leveler.extraSettings
    ? JSON.parse(leveler.extraSettings)
    : {};
  for (const def of extraDefs) {
    const value =
      extraValues[def.key] !== undefined ? extraValues[def.key] : def.default;
    settings[def.localStorageKey] = String(value);
  }

  const driverPaths = ["/loc", "/rudnik"];
  if (leveler.driverKey === "bleyk") {
    driverPaths.push("/pers");
  }

  return `
(function () {
  if (window !== window.top) return;
  window.__lbastServer = true;
  var SETTINGS = ${JSON.stringify(settings)};
  var DRIVER_PATHS = ${JSON.stringify(driverPaths)};
  try {
    for (var key in SETTINGS) localStorage[key] = SETTINGS[key];
  } catch (e) {}

  function run() {
    var path = location.pathname;
    var isBattle = path.indexOf("/arena_go") === 0;
    var isDriver = DRIVER_PATHS.some(function (p) {
      return path.indexOf(p) === 0;
    });
    if (!isBattle && !isDriver) return;
    try {
      (0, eval)(${JSON.stringify(scripts.jquery)});
      (0, eval)(${JSON.stringify(scripts.utils)});
      if (isBattle) {
        (0, eval)(${JSON.stringify(scripts.battle)});
      } else {
        (0, eval)(${JSON.stringify(scripts.drivers[leveler.driverKey])});
      }
    } catch (e) {
      try {
        window.__lbastReport({ type: "error", text: "Ошибка скрипта: " + ((e && e.message) || e) });
      } catch (e2) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
`;
}
