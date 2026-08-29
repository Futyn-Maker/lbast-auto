// ==UserScript==
// @name         lbast_glad
// @namespace    http://tampermonkey.net/
// @version      2026.08.29
// @author       Agent_
// @include      *glad-auto.lbast.ru/loc*
// @include      *glad-auto.lbast.ru/pers*
// @include      *glad-auto.lbast.ru/rudnik*
// @include      *glad-auto.lbast.ru/settings*
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
      title: "Автокач (гладиатор), Последний Бастион",
      targetUrl: location.origin + "/location.php?r=8281&mod=fastway&lway=8",
      minReserves: 5,
      negRestMult: 1200,
      fatigueRestMult: 1200,
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;
    const xhr = new XMLHttpRequest();

    function hasTask() {
      xhr.open("GET", location.origin + "/pers.php?r=2347", false);
      xhr.send();
      return !!~xhr.responseText.indexOf("колизей");
    }

    if (d.settingsPage()) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (~str.indexOf("в это место невозможно")) {
      location.href =
        location.origin + "/location.php?r=6976&mod=fastway&lway=8";
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("звон мечей на арене")) {
      if (~str.indexOf("Продолжить квест")) {
        utils.click("Продолжить квест");
      } else {
        d.engageOrHome(ctx, "звон мечей");
      }
    } else if (~str.indexOf("призраков гладиаторов")) {
      utils.click("К бою");
    } else if (~str.indexOf("бой дался тяжело")) {
      utils.click("Уйти");
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("Девтаун. Торговый район")) {
      if (hasTask()) {
        utils.click("север");
      } else {
        utils.click("запад");
      }
    } else if (~str.indexOf("старейший колизей на материке")) {
      if (hasTask()) {
        utils.click("восток");
      } else {
        utils.click("Колизей");
      }
    } else if (~str.indexOf("возьмите задание")) {
      utils.send(location.origin + "/loc.php?r=1659&obj=5007&mod=1");
      utils.click("В игру");
    } else if (~str.indexOf("Распорядитель:")) {
      utils.click("Уйти");
    } else if (~str.indexOf("большой круглый стол")) {
      if (hasTask()) {
        utils.click("север");
      } else {
        location.href =
          location.origin + "/location.php?r=2714&mod=fastway&lway=8";
      }
    } else if (~str.indexOf("Эта северная часть города - новострой")) {
      utils.click("север");
    } else if (~str.indexOf("На юге крупный город")) {
      utils.click("север");
    } else if (~str.indexOf("напоминающие издали колизей")) {
      utils.click("север");
    } else if (d.healPlace(ctx)) {
    } else if (d.wheatFields(ctx)) {
    } else if (d.autoban(ctx)) {
    } else if (d.enterBattle(ctx)) {
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
