// ==UserScript==
// @name         lbast_utils
// @namespace    http://tampermonkey.net/
// @version      2025.02.23
// @author       Agent_
// @include      *auto.lbast.ru/*
// @require      https://code.jquery.com/jquery-3.3.1.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SOUNDS = {
        letter: 'https://github.com/Futyn-Maker/lbast-auto/raw/refs/heads/main/sounds/letter.mp3',
        alarm: 'https://github.com/Futyn-Maker/lbast-auto/raw/refs/heads/main/sounds/alarm.mp3'
    };

    const HOMETOWN = {
        light: 2,
        dark: 3,
        sarimat: 6,
        neutral: 2
    };

    const TG_TOKEN = '7814020401:AAGYDoBVNV7x8ObBci2wIu3QrSB_J4e1_CM';

    function getPlayerInfo() {
        if(sessionStorage.lbastAuto_playerNickname && sessionStorage.lbastAuto_playerAlignment) {
            return {
                nickname: sessionStorage.lbastAuto_playerNickname,
                alignment: sessionStorage.lbastAuto_playerAlignment
            };
        }

        const xhr = new XMLHttpRequest();
        xhr.open('GET', location.origin + '/pers.php?r=5778', false);
        xhr.send();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = xhr.responseText;
        const profileLink = $(tempDiv).find("a:contains('Анкета'), a:contains('ПЕРСОНАЖ')").attr('href');
    
        if(!profileLink) {
            return null;
        }

        const nickname = profileLink.match(/blogin=([^&]+)/)[1];
        if(nickname) {
            sessionStorage.lbastAuto_playerNickname = nickname;
        }

        xhr.open('GET', location.origin + '/' + profileLink, false);
        xhr.send();

        let alignment = null;
        if(~xhr.responseText.indexOf('Государство: Империя')) {
            alignment = 'light';
        } else if(~xhr.responseText.indexOf('Мировоззрение: темный')) {
            alignment = 'dark';
        } else if(~xhr.responseText.indexOf('Государство: Сариматское братство')) {
            alignment = 'sarimat';
        } else if(~xhr.responseText.indexOf('Мировоззрение: нейтрал')) {
            alignment = 'neutral';
    }

        if(alignment) {
            sessionStorage.lbastAuto_playerAlignment = alignment;
        }

        return {
            nickname: sessionStorage.lbastAuto_playerNickname,
            alignment: sessionStorage.lbastAuto_playerAlignment
        };
    }

    if(isNaN(localStorage.lbastAuto_timeClick)) {
        localStorage.lbastAuto_timeClick = 200;
    }
    if(isNaN(localStorage.lbastAuto_houseHP)) {
        localStorage.lbastAuto_houseHP = -1000;
    }
    if(localStorage.lbastAuto_letterSound === undefined) {
        localStorage.lbastAuto_letterSound = 'true';
    }
    if(localStorage.lbastAuto_alarmSound === undefined) {
        localStorage.lbastAuto_alarmSound = 'true';
    }

    function click(text) {
        const timeClick = parseInt(localStorage.lbastAuto_timeClick);
        const time = Math.floor((timeClick - 100) + Math.random() * ((timeClick + 200) + 1 - (timeClick - 100)));
        setTimeout(() => {
            $("a:contains('" + text + "')")[0].click();
        }, time);
    }

    function send(link) {
        return $.ajax({
            url: link,
            async: false,
            dataType: 'text'
        });
    }

    function update(time) {
        document.getElementsByTagName('footer')[0].innerHTML += 
            '<p>Автоматическое обновление произойдёт примерно через ' + 
            String(Math.floor((time) / 60000)) + ' минут.</p>';
        setTimeout(() => {
            location.href = location.origin + '/location.php';
        }, time);
    }

    function playSound(type, check = true) {
        if(!check || (localStorage.lbastAuto_letterSound === 'true' && type === 'letter') ||
                    (localStorage.lbastAuto_alarmSound === 'true' && type === 'alarm')) {
            const audio = document.createElement('audio');
            audio.src = SOUNDS[type];
            audio.play();
        }
    }

    function sendTGMessage(message) {
        const chat_id = localStorage.lbastAuto_TGID;
        if(!isNaN(chat_id) && chat_id > 0) {
            send(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(message)}&parse_mode=HTML`);
        }
    }

    function renderSettings() {
        if(!location.href.includes('/settings')) return;

        document.body.innerHTML = `
            <h1>Настройки автокача</h1>
            <form name="settings">
                <p>
                    <label>Минимальное количество HP, при котором автокач будет работать:
                        <input name="goHP" type="number" min="0" tabindex="0" value="${localStorage.lbastAuto_goHP || ''}"/>
                    </label>
                </p>
                <p>
                    <label>Отрицательное значение HP, при котором автокач пойдёт лечиться в Кулак Хаоса:
                        <input name="houseHP" type="number" max="-1" tabindex="0" value="${localStorage.lbastAuto_houseHP}"/>
                    </label>
                </p>
                <p>
                    <label>Ваш ID в Telegram для получения оповещений о письмах, нападениях и проверках на автокач:
                        <input name="TGID" type="number" min="0" tabindex="0" value="${localStorage.lbastAuto_TGID || ''}"/>
                    </label>
                </p>
                <p>Чтобы узнать свой Telegram ID, напишите боту <a href="https://t.me/my_id_bot" target="_blank">@my_id_bot</a>. После этого перейдите в бота <a href="https://t.me/lbast_autobot" target="_blank">@lbast_autobot</a> и напишите ему /start, чтобы активировать оповещения.</p>
                <p>
                    <label>Воспроизводить звук при получении нового письма
                        <input type="checkbox" name="letterSound" tabindex="0" ${localStorage.lbastAuto_letterSound === 'true' ? 'checked' : ''}/>
                    </label>
                    <input type="button" value="Прослушать звук" tabindex="0" onclick="LbastUtils.playSound('letter', false)"/>
                </p>
                <p>
                    <label>Воспроизводить звук при нападении на вас или проверке на автокач
                        <input type="checkbox" name="alarmSound" tabindex="0" ${localStorage.lbastAuto_alarmSound === 'true' ? 'checked' : ''}/>
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
        localStorage.lbastAuto_TGID = form.elements.TGID.value;
        localStorage.lbastAuto_letterSound = form.elements.letterSound.checked;
        localStorage.lbastAuto_alarmSound = form.elements.alarmSound.checked;
        localStorage.lbastAuto_timeClick = form.elements.timeClick.value;
        
        for(const handler of customSaveHandlers) {
            handler(form);
        }

        document.body.innerHTML = `
            <p>Настройки сохранены.</p>
            <a href='${location.origin}/location.php'>Вернуться на главную</a>
        `;
    }

    const customSettings = new Map();
    const customSaveHandlers = new Set();

    function registerCustomSettings(scriptId, {html = '', saveHandler = null} = {}) {
        if(html) {
            customSettings.set(scriptId, html);
            const div = document.getElementById('customSettings');
            if(div) div.insertAdjacentHTML('beforeend', html);
        }
        if(saveHandler) {
            customSaveHandlers.add(saveHandler);
        }
    }

    function parseHP(str) {
        const match = str.match(/[(❤ )\(] ?-?\d+\//u);
        if(match) {
            return parseInt(match[0].match(/-?\d+/)[0]);
        }
        return null;
    }

    window.LbastUtils = {
        SOUNDS,
        TG_TOKEN,
        HOMETOWN,
        
        click,
        send,
        update,
        playSound,
        sendTGMessage,
        parseHP,
        getPlayerInfo,
        
        renderSettings,
        saveSettings,
        registerCustomSettings
    };

    renderSettings();

    window.LbastUtils.ready = true;
    const event = new CustomEvent('LbastUtilsReady');
    window.dispatchEvent(event);
})();
