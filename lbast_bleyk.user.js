// ==UserScript==
// @name         lbast_bleyk
// @namespace    http://tampermonkey.net/
// @version      2026.08.26
// @author       Agent_
// @include      *bleyk-auto.lbast.ru/loc*
// @include      *bleyk-auto.lbast.ru/pers*
// @include      *bleyk-auto.lbast.ru/rudnik*
// @include      *bleyk-auto.lbast.ru/settings*
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
    const targetUrl = location.origin + "/location.php?r=8963&mod=konj&lway=14";
    const ctx = d.makeCtx({
      title: "Автокач (Блейки), Последний Бастион",
      targetUrl: targetUrl,
      fastTargetUrl: targetUrl,
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;

    if (d.settingsPage()) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("Почему-то здесь очень тихо")) {
      d.engageOrHome(ctx, "Зайти");
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("Девтаун. Портовый район")) {
      utils.click("Пристань");
    } else if (~str.indexOf("Выберите направление")) {
      utils.click("до острова Блейка");
    } else if (~str.indexOf("Капитан на прощание машет вам рукой")) {
      utils.click("Далее");
    } else if (~str.indexOf("зарыл здесь награбленные сокровища")) {
      utils.click("север");
    } else if (d.healPlace(ctx)) {
    } else if (d.wheatFields(ctx)) {
    } else if (d.autoban(ctx)) {
    } else if (d.enterBattle(ctx)) {
    } else if (d.pathPending(ctx)) {
    } else if (d.expActivation(ctx)) {
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
