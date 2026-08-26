// ==UserScript==
// @name         lbast_utils
// @namespace    http://tampermonkey.net/
// @version      2026.08.26
// @author       Agent_
// @include      *auto.lbast.ru/*
// @require      https://code.jquery.com/jquery-3.3.1.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const SOUNDS = {
    letter:
      "https://github.com/Futyn-Maker/lbast-auto/raw/refs/heads/main/sounds/letter.mp3",
    alarm:
      "https://github.com/Futyn-Maker/lbast-auto/raw/refs/heads/main/sounds/alarm.mp3",
  };

  const HOMETOWN = {
    light: 2,
    dark: 3,
    sarimat: 6,
    neutral: 2,
  };

  function getPlayerInfo() {
    if (
      sessionStorage.lbastAuto_playerNickname &&
      sessionStorage.lbastAuto_playerAlignment &&
      sessionStorage.lbastAuto_playerHasSkill
    ) {
      return {
        nickname: sessionStorage.lbastAuto_playerNickname,
        alignment: sessionStorage.lbastAuto_playerAlignment,
        hasSkill: sessionStorage.lbastAuto_playerHasSkill === "true",
      };
    }

    const xhr = new XMLHttpRequest();
    xhr.open("GET", location.origin + "/pers.php?r=5778", false);
    xhr.send();

    sessionStorage.lbastAuto_playerHasSkill = ~xhr.responseText.indexOf(
      "Боевое умение",
    )
      ? "true"
      : "false";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = xhr.responseText;
    const profileLink = $(tempDiv)
      .find("a:contains('Анкета'), a:contains('ПЕРСОНАЖ')")
      .attr("href");

    if (!profileLink) {
      return null;
    }

    const nickname = profileLink.match(/blogin=([^&]+)/)[1];
    if (nickname) {
      sessionStorage.lbastAuto_playerNickname = nickname;
    }

    xhr.open("GET", location.origin + "/" + profileLink, false);
    xhr.send();

    let alignment = null;
    if (~xhr.responseText.indexOf("Государство: Империя")) {
      alignment = "light";
    } else if (~xhr.responseText.indexOf("Мировоззрение: темный")) {
      alignment = "dark";
    } else if (~xhr.responseText.indexOf("Государство: Сариматское братство")) {
      alignment = "sarimat";
    } else if (~xhr.responseText.indexOf("Мировоззрение: нейтрал")) {
      alignment = "neutral";
    }

    if (alignment) {
      sessionStorage.lbastAuto_playerAlignment = alignment;
    }

    return {
      nickname: sessionStorage.lbastAuto_playerNickname,
      alignment: sessionStorage.lbastAuto_playerAlignment,
      hasSkill: sessionStorage.lbastAuto_playerHasSkill === "true",
    };
  }

  if (isNaN(localStorage.lbastAuto_timeClick)) {
    localStorage.lbastAuto_timeClick = 200;
  }
  if (isNaN(localStorage.lbastAuto_houseHP)) {
    localStorage.lbastAuto_houseHP = -1000;
  }
  if (localStorage.lbastAuto_letterSound === undefined) {
    localStorage.lbastAuto_letterSound = "true";
  }
  if (localStorage.lbastAuto_alarmSound === undefined) {
    localStorage.lbastAuto_alarmSound = "true";
  }
  if (localStorage.lbastAuto_useDukeEstate === undefined) {
    localStorage.lbastAuto_useDukeEstate = "false";
  }

  function serverReport(payload) {
    if (window.__lbastServer && typeof window.__lbastReport === "function") {
      try {
        window.__lbastReport(payload);
      } catch (e) {}
      return true;
    }
    return false;
  }

  function click(text) {
    serverReport({ type: "action", text: "Клик: " + text });
    const timeClick = parseInt(localStorage.lbastAuto_timeClick);
    const time = Math.floor(
      timeClick -
        100 +
        Math.random() * (timeClick + 200 + 1 - (timeClick - 100)),
    );
    setTimeout(() => {
      $("a:contains('" + text + "')")[0].click();
    }, time);
  }

  function send(link) {
    return $.ajax({
      url: link,
      async: false,
      dataType: "text",
    });
  }

  function update(time) {
    serverReport({
      type: "sleep",
      text: "Ожидание обновления",
      wakeAt: Date.now() + time,
    });
    document.getElementsByTagName("footer")[0].innerHTML +=
      "<p>Автоматическое обновление произойдёт примерно через " +
      String(Math.floor(time / 60000)) +
      " минут.</p>";
    setTimeout(() => {
      location.href = location.origin + "/location.php";
    }, time);
  }

  function playSound(type, check = true) {
    if (window.__lbastServer) {
      return;
    }
    if (
      !check ||
      (localStorage.lbastAuto_letterSound === "true" && type === "letter") ||
      (localStorage.lbastAuto_alarmSound === "true" && type === "alarm")
    ) {
      const audio = document.createElement("audio");
      audio.src = SOUNDS[type];
      audio.play();
    }
  }

  function sendTGMessage(message) {
    if (serverReport({ type: "notify", text: String(message) })) {
      return;
    }
    const chat_id = localStorage.lbastAuto_TGID;
    const token = localStorage.lbastAuto_TGToken;
    if (!isNaN(chat_id) && chat_id > 0 && token) {
      send(
        `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(message)}&parse_mode=HTML`,
      );
    }
  }

  function renderSettings() {
    if (!location.href.includes("/settings")) return;

    document.body.innerHTML = `
            <h1>Настройки автокача</h1>
            <form name="settings">
                <p>
                    <label>Минимальное количество HP, при котором автокач будет работать:
                        <input name="goHP" type="number" min="0" tabindex="0" value="${localStorage.lbastAuto_goHP || ""}"/>
                    </label>
                </p>
                <p>
                    <label>Отрицательное значение HP, при котором автокач пойдёт лечиться в Кулак Хаоса или поместье:
                        <input name="houseHP" type="number" max="-1" tabindex="0" value="${localStorage.lbastAuto_houseHP}"/>
                    </label>
                </p>
                <p>
                    <label>
                        <input type="checkbox" name="useDukeEstate" tabindex="0" ${localStorage.lbastAuto_useDukeEstate === "true" ? "checked" : ""}/>
                        Лечиться в поместье герцога вместо Кулака Хаоса
                    </label>
                </p>
                <p>Отметьте эту опцию только если ваш титул не ниже герцога и вы приобрели поместье.</p>
                <p><strong>Настройка Telegram-оповещений</strong></p>
                <p>Для получения оповещений о письмах, нападениях и проверках на автокач создайте собственного Telegram-бота:</p>
                <ol>
                    <li>Откройте <a href="https://t.me/BotFather" target="_blank">@BotFather</a> в Telegram, создайте нового бота командой /newbot и скопируйте полученный токен.</li>
                    <li>Узнайте свой Telegram ID, написав боту <a href="https://t.me/my_id_bot" target="_blank">@my_id_bot</a>.</li>
                    <li>Напишите своему новому боту /start, чтобы он мог отправлять вам сообщения.</li>
                </ol>
                <p>Если вы используете несколько автокачей, токен и ID необходимо указать для каждого из них отдельно в настройках каждого автокача, но вы можете использовать одного бота для всех автокачей и указать одинаковый токен.</p>
                <p>
                    <label>Токен вашего Telegram-бота:
                        <input id="TGTokenInput" name="TGToken" type="password" autocomplete="off" tabindex="0" value="${localStorage.lbastAuto_TGToken || ""}"/>
                    </label>
                    <input type="button" id="TGTokenToggle" value="Показать" tabindex="0" onclick="var i=document.getElementById('TGTokenInput');i.type=i.type==='password'?'text':'password';this.value=i.type==='password'?'Показать':'Скрыть';"/>
                </p>
                <p>
                    <label>Ваш ID в Telegram:
                        <input name="TGID" type="number" min="0" tabindex="0" value="${localStorage.lbastAuto_TGID || ""}"/>
                    </label>
                </p>
                <p>
                    <label>Воспроизводить звук при получении нового письма
                        <input type="checkbox" name="letterSound" tabindex="0" ${localStorage.lbastAuto_letterSound === "true" ? "checked" : ""}/>
                    </label>
                    <input type="button" value="Прослушать звук" tabindex="0" onclick="LbastUtils.playSound('letter', false)"/>
                </p>
                <p>
                    <label>Воспроизводить звук при нападении на вас или проверке на автокач
                        <input type="checkbox" name="alarmSound" tabindex="0" ${localStorage.lbastAuto_alarmSound === "true" ? "checked" : ""}/>
                    </label>
                    <input type="button" value="Прослушать звук" tabindex="0" onclick="LbastUtils.playSound('alarm', false)"/>
                </p>
                <p>
                    <label>Задержка между кликами (в миллисекундах):
                        <input name="timeClick" type="number" min="0" tabindex="0" value="${localStorage.lbastAuto_timeClick}"/>
                    </label>
                </p>
                <div id="customSettings"></div>
                <input type="button" value="Сохранить настройки" tabindex="0" onclick="LbastUtils.saveSettings()"/>
            </form>
            <a href="${location.origin}/location.php">Вернуться на главную</a>
        `;
  }

  function saveSettings() {
    const form = document.forms.settings;
    localStorage.lbastAuto_goHP = form.elements.goHP.value;
    localStorage.lbastAuto_houseHP = form.elements.houseHP.value;
    localStorage.lbastAuto_useDukeEstate = form.elements.useDukeEstate.checked;
    localStorage.lbastAuto_TGToken = form.elements.TGToken.value;
    localStorage.lbastAuto_TGID = form.elements.TGID.value;
    localStorage.lbastAuto_letterSound = form.elements.letterSound.checked;
    localStorage.lbastAuto_alarmSound = form.elements.alarmSound.checked;
    localStorage.lbastAuto_timeClick = form.elements.timeClick.value;

    for (const handler of customSaveHandlers) {
      handler(form);
    }

    document.body.innerHTML = `
            <p>Настройки сохранены.</p>
            <a href='${location.origin}/location.php'>Вернуться на главную</a>
        `;
  }

  const customSettings = new Map();
  const customSaveHandlers = new Set();

  function registerCustomSettings(
    scriptId,
    { html = "", saveHandler = null } = {},
  ) {
    if (html) {
      customSettings.set(scriptId, html);
      const div = document.getElementById("customSettings");
      if (div) div.insertAdjacentHTML("beforeend", html);
    }
    if (saveHandler) {
      customSaveHandlers.add(saveHandler);
    }
  }

  function parseHP(str) {
    const match = str.match(/[❤(]\s*-?\d+\s*\//u);
    if (match) {
      return parseInt(match[0].match(/-?\d+/)[0]);
    }
    return null;
  }

  function parseReserves(str) {
    const hp = str.match(/[❤(]\s*-?\d+\s*\/\s*-?\d+/u);
    if (!hp) {
      return null;
    }
    const start = hp.index + hp[0].length;
    const after = str.slice(start, start + 30);
    const match = after.match(/⌚\s*(-?\d+)|\(\s*(-?\d+)\s*\)/u);
    if (!match) {
      return null;
    }
    const value = parseInt(match[1] !== undefined ? match[1] : match[2]);
    return Number.isNaN(value) ? null : value;
  }

  function getReserves(str) {
    if (str === undefined) {
      str = $("body").text();
    }
    const fromPage = parseReserves(str);
    if (fromPage !== null) {
      return fromPage;
    }
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", location.origin + "/chat.php?r=4831", false);
      xhr.send();
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = xhr.responseText;
      return parseReserves($(tempDiv).text());
    } catch (e) {
      return null;
    }
  }

  function makeDriverCtx(opts) {
    const rand = Math.floor(500 + Math.random() * (1000 + 1 - 500));
    const str = $("body").text();
    const goHP = localStorage.lbastAuto_goHP;
    const myHP = parseHP(str);
    const houseHP = localStorage.lbastAuto_houseHP;
    const useDukeEstate = localStorage.lbastAuto_useDukeEstate === "true";

    const playerInfo = getPlayerInfo();
    if (!playerInfo || !playerInfo.alignment) {
      return null;
    }
    const hometown = HOMETOWN[playerInfo.alignment];

    const ctx = Object.assign(
      {
        minReserves: 0,
        negRestMult: 900,
        fatigueRestMult: 900,
        rudnikRefresh: "home",
        fastTargetUrl:
          location.origin + "/location.php?r=2148&mod=fastway&lway=1",
        hometownGo: null,
        fatiguePreCheck: null,
      },
      opts,
    );

    ctx.rand = rand;
    ctx.str = str;
    ctx.goHP = goHP;
    ctx.myHP = myHP;
    ctx.houseHP = houseHP;
    ctx.useDukeEstate = useDukeEstate;
    ctx.hometown = hometown;
    ctx.homeUrl =
      location.origin + `/location.php?r=3594&mod=fastway&lway=${hometown}`;
    ctx.engageHomeUrl =
      location.origin + `/location.php?r=2012&mod=fastway&lway=${hometown}`;

    document.getElementsByTagName("title")[0].innerHTML = ctx.title;
    document.body.innerHTML +=
      '<footer><a href="' +
      location.origin +
      '/settings">Настроить автокач</a></footer>';

    return ctx;
  }

  function driverSettingsPage(extra) {
    if (!~location.href.indexOf("settings")) {
      return false;
    }
    renderSettings();
    if (extra) {
      extra();
    }
    return true;
  }

  function driverNotConfigured(ctx) {
    if (!isNaN(ctx.goHP)) {
      return false;
    }
    document.body.innerHTML =
      '<p>Автокач не настроен. Перейдите в <a href="' +
      location.origin +
      '/settings">настройки</a> и задайте параметры.</p>';
    return true;
  }

  function driverMail(ctx) {
    const str = ctx.str;
    if (!(
      ~str.indexOf("Почта [") ||
      ~str.indexOf("Письма (") ||
      ~str.indexOf("ПОЧТА [")
    )) {
      return false;
    }
    playSound("letter");
    setTimeout(() => {
      sendTGMessage("У вас новое письмо! Из " + location.hostname);
    }, 1500);
    setTimeout(() => {
      send(
        location.origin +
          "/letters.php?r=7253&mod=readall&room=&newl=&poryad=&start=0",
      );
    }, 2500);
    update(3000);
    return true;
  }

  function driverHometown(ctx) {
    const str = ctx.str;
    if (!(
      (~str.indexOf("Центральная площадь") && ctx.hometown === 2) ||
      (~str.indexOf("поднятый в") && ctx.hometown === 3) ||
      (~str.indexOf("Северо-западный форпост") && ctx.hometown === 6)
    )) {
      return false;
    }
    const res = getReserves(str);
    if (ctx.myHP <= ctx.houseHP) {
      if (ctx.useDukeEstate) {
        location.href =
          location.origin + "/location.php?r=1450&mod=konj&lway=22";
      } else {
        location.href =
          location.origin + "/location.php?r=1460&mod=fastway&lway=4";
      }
    } else if (res !== null && res < 0) {
      update(ctx.rand * ctx.negRestMult);
    } else if (ctx.minReserves > 0 && res !== null && res < ctx.minReserves) {
      update(ctx.rand * 480);
    } else if (ctx.myHP >= ctx.goHP) {
      if (ctx.hometownGo) {
        ctx.hometownGo(ctx);
      } else {
        location.href = ctx.fastTargetUrl;
      }
    } else if (ctx.myHP <= 0) {
      update(ctx.rand * 1200);
    } else {
      update(ctx.rand * 480);
    }
    return true;
  }

  function driverEngageOrHome(ctx, engageText) {
    const res = getReserves(ctx.str);
    if (ctx.myHP >= ctx.goHP && (res === null || res >= ctx.minReserves)) {
      click(engageText);
    } else {
      location.href = ctx.engageHomeUrl;
    }
  }

  function driverFatigue(ctx) {
    if (!~ctx.str.indexOf("устали")) {
      return false;
    }
    if (ctx.fatiguePreCheck && ctx.fatiguePreCheck(ctx)) {
      return true;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(
      "GET",
      location.origin + `/location.php?r=9463&mod=fastway&lway=${ctx.hometown}`,
      false,
    );
    xhr.send();
    if (~xhr.responseText.indexOf("бой")) {
      location.href = location.origin + "/location.php";
    } else {
      update(ctx.rand * ctx.fatigueRestMult);
    }
    return true;
  }

  function driverHealPlace(ctx) {
    const str = ctx.str;
    if (!(
      (~str.indexOf("был заложен первый камень форта") && !ctx.useDukeEstate) ||
      (~str.indexOf("родовые поместья высшей знати Ардена") &&
        ctx.useDukeEstate)
    )) {
      return false;
    }
    const res = getReserves(str);
    if (ctx.myHP <= ctx.houseHP) {
      update(ctx.rand * 2400);
    } else if (res !== null && res < ctx.minReserves) {
      location.href = ctx.homeUrl;
    } else if (ctx.myHP >= ctx.goHP) {
      location.href = ctx.targetUrl;
    } else {
      location.href = ctx.homeUrl;
    }
    return true;
  }

  function driverWheatFields(ctx) {
    if (!(
      ~ctx.str.indexOf("Вокруг расстилаются бескрайние поля пшеницы") &&
      ctx.useDukeEstate
    )) {
      return false;
    }
    click("Королевская долина");
    return true;
  }

  function driverAutoban(ctx) {
    if (!~ctx.str.indexOf("автобан")) {
      return false;
    }
    setTimeout(() => {
      location.reload();
    }, 7500);
    return true;
  }

  function driverEnterBattle(ctx) {
    if (!~ctx.str.indexOf("В бой")) {
      return false;
    }
    click("бой");
    return true;
  }

  function driverPathPending(ctx) {
    if (!~ctx.str.indexOf("путь лежит")) {
      return false;
    }
    update(6100);
    return true;
  }

  function driverWork(ctx) {
    const str = ctx.str;
    if (~str.indexOf("работаете работу") || ~str.indexOf("абота завершена")) {
      click("абот");
      return true;
    }
    if (~str.indexOf("выплачено за работу")) {
      click("Вернуться");
      return true;
    }
    if (~str.indexOf("Получить") && ~location.href.indexOf("rudnik")) {
      click("Получить");
      return true;
    }
    if (~location.href.indexOf("rudnik")) {
      const rtime = parseInt(
        str.substring(str.indexOf("еще") + 4, str.indexOf("мин") - 1),
      );
      document.body.innerHTML +=
        "<p>Автоматическое обновление произойдёт примерно через " +
        String(rtime) +
        " минут.</p></footer>";
      setTimeout(
        () => {
          if (ctx.rudnikRefresh === "update") {
            click("Обновить");
          } else {
            location.href = location.origin + "/location.php";
          }
        },
        rtime * 60000 + 60000,
      );
      return true;
    }
    return false;
  }

  function driverGoHomeOrTarget(ctx) {
    const res = getReserves(ctx.str);
    if (ctx.myHP < ctx.goHP || (res !== null && res < ctx.minReserves)) {
      location.href = ctx.homeUrl;
    } else {
      location.href = ctx.targetUrl;
    }
  }

  window.LbastUtils = {
    SOUNDS,
    HOMETOWN,

    click,
    send,
    update,
    playSound,
    sendTGMessage,
    parseHP,
    parseReserves,
    getReserves,
    getPlayerInfo,

    renderSettings,
    saveSettings,
    registerCustomSettings,

    driver: {
      makeCtx: makeDriverCtx,
      settingsPage: driverSettingsPage,
      notConfigured: driverNotConfigured,
      mail: driverMail,
      hometown: driverHometown,
      engageOrHome: driverEngageOrHome,
      fatigue: driverFatigue,
      healPlace: driverHealPlace,
      wheatFields: driverWheatFields,
      autoban: driverAutoban,
      enterBattle: driverEnterBattle,
      pathPending: driverPathPending,
      work: driverWork,
      goHomeOrTarget: driverGoHomeOrTarget,
    },
  };

  renderSettings();

  window.LbastUtils.ready = true;
  const event = new CustomEvent("LbastUtilsReady");
  window.dispatchEvent(event);
})();
