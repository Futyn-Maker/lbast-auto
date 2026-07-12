// ==UserScript==
// @name         lbast_moleg
// @namespace    http://tampermonkey.net/
// @version      2026.07.12
// @author       Agent_
// @include      *moleg-auto.lbast.ru/loc*
// @include      *moleg-auto.lbast.ru/rudnik*
// @include      *moleg-auto.lbast.ru/settings
// @require      https://code.jquery.com/jquery-3.3.1.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  function initScript() {
    if (!window.LbastUtils || !window.LbastUtils.ready) {
      document.body.innerHTML =
        "<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>";
      return;
    }

    const utils = window.LbastUtils;
    const d = utils.driver;
    const ctx = d.makeCtx({
      title: "Автокач (Молег), Последний Бастион",
      targetUrl: location.origin + "/location.php?r=7484&mod=konj&lway=20",
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;

    if (d.settingsPage()) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (~str.indexOf("в это место невозможно")) {
      location.href = location.origin + "/location.php?r=7484&mod=konj&lway=20";
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("Мощное извержение вулкана")) {
      d.engageOrHome(ctx, "Зайти");
    } else if (~str.indexOf("утробный рев")) {
      utils.click("Встретить");
    } else if (d.fatigue(ctx)) {
    } else if (d.healPlace(ctx)) {
    } else if (d.wheatFields(ctx)) {
    } else if (d.autoban(ctx)) {
    } else if (d.enterBattle(ctx)) {
    } else if (d.pathPending(ctx)) {
    } else if (d.work(ctx)) {
    } else {
      d.goHomeOrTarget(ctx);
    }
  }

  if (window.LbastUtils && window.LbastUtils.ready) {
    initScript();
  } else {
    window.addEventListener("LbastUtilsReady", initScript);
    setTimeout(() => {
      if (!window.LbastUtils || !window.LbastUtils.ready) {
        document.body.innerHTML =
          "<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>";
      }
    }, 2000);
  }
})();
