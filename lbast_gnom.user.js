// ==UserScript==
// @name         lbast_gnom
// @namespace    http://tampermonkey.net/
// @version      2026.07.12
// @author       Agent_
// @include      *gnom-auto.lbast.ru/loc*
// @include      *gnom-auto.lbast.ru/rudnik*
// @include      *gnom-auto.lbast.ru/settings*
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
      title: "Автокач (дух гнома), Последний Бастион",
      targetUrl: location.origin + "/location.php?r=7484&mod=konj&lway=5",
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
      location.href = location.origin + "/location.php?r=7484&mod=konj&lway=5";
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("Гладкая каменистая поверхность утеса")) {
      d.engageOrHome(ctx, "Пройтись");
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("большие валуны")) {
      utils.click("запад");
    } else if (~str.indexOf("отнюдь не кровавого цвета")) {
      utils.click("юг");
    } else if (~str.indexOf("призраки с каменного утеса")) {
      utils.click("запад");
    } else if (~str.indexOf("Гнетущая атмосфера голого камня")) {
      utils.click("запад");
    } else if (~str.indexOf("круто изгибается с севера на восток")) {
      utils.click("север");
    } else if (~str.indexOf("немного расширяется к северу и сужается к югу")) {
      utils.click("север");
    } else if (~str.indexOf("это даже сложно назвать ущельем")) {
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
