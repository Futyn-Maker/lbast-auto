// ==UserScript==
// @name         lbast_paladin
// @namespace    http://tampermonkey.net/
// @version      2026.08.26
// @author       Agent_
// @include      *paladin-auto.lbast.ru/loc*
// @include      *paladin-auto.lbast.ru/rudnik*
// @include      *paladin-auto.lbast.ru/settings*
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
      title: "Автокач (паладин), Последний Бастион",
      targetUrl: location.origin + "/location.php?r=8281&mod=fastway&lway=8",
      minReserves: 5,
      negRestMult: 1200,
      fatigueRestMult: 1200,
      fatiguePreCheck: (c) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", location.origin + "/location.php", false);
        xhr.send();
        if (~xhr.responseText.indexOf("Продолжить квест")) {
          setTimeout(() => {
            location.reload();
          }, c.rand * 300);
          return true;
        }
        return false;
      },
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;
    const xhr = new XMLHttpRequest();

    if (d.settingsPage()) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (~str.indexOf("в это место невозможно")) {
      location.href =
        location.origin + "/location.php?r=6976&mod=fastway&lway=8";
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("стоит склеп")) {
      if (~str.indexOf("Продолжить квест")) {
        utils.click("Продолжить квест");
      } else {
        d.engageOrHome(ctx, "смотреть");
      }
    } else if (~str.indexOf("Вы не нашли ничего интересного")) {
      location.href =
        location.origin + "/location.php?r=2012&mod=fastway&lway=8";
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("Девтаун. Торговый район")) {
      xhr.open("GET", location.origin + "/pers.php?r=2347", false);
      xhr.send();
      const t = xhr.responseText;
      if (~t.indexOf("склеп")) {
        utils.click("юг");
      } else {
        utils.click("север");
      }
    } else if (~str.indexOf("большой круглый стол")) {
      xhr.open("GET", location.origin + "/pers.php?r=2347", false);
      xhr.send();
      const t = xhr.responseText;
      if (~t.indexOf("склеп")) {
        location.href =
          location.origin + "/location.php?r=2714&mod=fastway&lway=8";
      } else {
        utils.click("паладинов");
      }
    } else if (~str.indexOf("Белоснежная башня")) {
      utils.send(location.origin + "/loc.php?r=1659&obj=5008&mod=1");
      utils.click("В игру");
    } else if (~str.indexOf("Крепостные стены отсутствуют")) {
      utils.click("юг");
    } else if (~str.indexOf("очертания большого города")) {
      utils.click("юг");
    } else if (~str.indexOf("с какими-то рычагами и колесами")) {
      utils.click("запад");
    } else if (~str.indexOf("Идя неспешно, вы размышляете")) {
      utils.click("запад");
    } else if (d.healPlace(ctx)) {
    } else if (d.wheatFields(ctx)) {
    } else if (d.autoban(ctx)) {
    } else if (~str.indexOf("куклой")) {
      utils.click("Уйти");
    } else if (~str.indexOf("темное сырое помещение")) {
      utils.click("дальше");
    } else if (d.enterBattle(ctx)) {
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
