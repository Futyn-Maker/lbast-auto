// ==UserScript==
// @name         lbast_baron
// @namespace    http://tampermonkey.net/
// @version      2026.08.26
// @author       Agent_
// @include      *baron-auto.lbast.ru/loc*
// @include      *baron-auto.lbast.ru/rudnik*
// @include      *baron-auto.lbast.ru/settings*
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
      title: "Автокач (бароны), Последний Бастион",
      targetUrl: location.origin + "/location.php?r=7484&mod=konj&lway=6",
      rudnikRefresh: "update",
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;

    if (d.settingsPage()) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (~str.indexOf("в это место невозможно")) {
      location.href = location.origin + "/location.php?r=7484&mod=konj&lway=6";
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("Старые руины")) {
      d.engageOrHome(ctx, "смотреть");
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("много волков")) {
      utils.click("запад");
    } else if (~str.indexOf("Тропа")) {
      utils.click("запад");
    } else if (~str.indexOf("ведут дороги")) {
      utils.click("север");
    } else if (~str.indexOf("Всадники Тьмы")) {
      utils.click("север");
    } else if (~str.indexOf("плато мертвых")) {
      utils.click("север");
    } else if (~str.indexOf("Камень, камень")) {
      utils.click("север");
    } else if (~str.indexOf("В преддвер")) {
      utils.click("север");
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
