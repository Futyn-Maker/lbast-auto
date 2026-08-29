// ==UserScript==
// @name         lbast_yantar
// @namespace    http://tampermonkey.net/
// @version      2026.08.29
// @author       Agent_
// @include      *yantar-auto.lbast.ru/loc*
// @include      *yantar-auto.lbast.ru/pers*
// @include      *yantar-auto.lbast.ru/rudnik*
// @include      *yantar-auto.lbast.ru/settings*
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
      title: "Автокач (янтарная гора), Последний Бастион",
      targetUrl: targetUrl,
      fastTargetUrl: targetUrl,
      minReserves: 8,
    });
    if (!ctx) {
      return;
    }
    const str = ctx.str;
    const kirka = localStorage.lbastAuto_yantarBot === "kirka";

    if (
      d.settingsPage(() => {
        utils.registerCustomSettings("yantar", {
          html: `
                    <p>
                        <label>Кого бить на Янтарной горе:
                            <select name="yantarBot" tabindex="0">
                                <option value="gnom"${kirka ? "" : " selected"}>Призрак янтарного гнома</option>
                                <option value="kirka"${kirka ? " selected" : ""}>Призрак с киркой</option>
                            </select>
                        </label>
                    </p>
                `,
          saveHandler: (form) => {
            localStorage.lbastAuto_yantarBot = form.elements.yantarBot.value;
          },
        });
      })
    ) {
    } else if (d.notConfigured(ctx)) {
    } else if (d.mail(ctx)) {
    } else if (d.hometown(ctx)) {
    } else if (~str.indexOf("венчает северную оконечность острова")) {
      if (~str.indexOf("Продолжить квест")) {
        utils.click("Продолжить квест");
      } else {
        d.engageOrHome(ctx, "Идти к горе");
      }
    } else if (~str.indexOf("внушительным залежам янтаря")) {
      const zaval = str.match(/Завал пещеры:\s*(\d+)\s*из\s*(\d+)/);
      if (
        (zaval && parseInt(zaval[1]) >= parseInt(zaval[2])) ||
        !~str.indexOf("Идти к горе")
      ) {
        utils.sendTGMessage(
          "Вход в шахты Янтарной горы завален, персонаж ждёт в городе. Из " +
            location.hostname,
        );
        utils.send(
          location.origin +
            `/location.php?r=9463&mod=fastway&lway=${ctx.hometown}`,
        );
        utils.update(900000 + Math.floor(Math.random() * 300000));
      } else {
        utils.click("Идти к горе");
      }
    } else if (~str.indexOf("ничего не нашли") || ~str.indexOf("ы нашли")) {
      utils.click("Уйти");
    } else if (d.fatigue(ctx)) {
    } else if (~str.indexOf("Девтаун. Портовый район")) {
      utils.click("Пристань");
    } else if (~str.indexOf("Выберите направление")) {
      utils.click("до острова Старого башмака");
    } else if (~str.indexOf("Капитан на прощание машет вам рукой")) {
      utils.click("Далее");
    } else if (~str.indexOf("окружен опасными подводными рифами")) {
      if (~str.indexOf("Идти на север")) {
        utils.click("север");
      } else {
        utils.click("восток");
      }
    } else if (~str.indexOf("у входа в шахты")) {
      utils.click("Спуститься");
    } else if (~str.indexOf("увидели развилку")) {
      utils.click("дальше");
    } else if (~str.indexOf("остановились на развилке")) {
      utils.click(kirka ? "направо" : "налево");
    } else if (~str.indexOf("Монотонный спуск")) {
      utils.click("дальше");
    } else if (~str.indexOf("углубились в пещеру")) {
      utils.click("дальше");
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
