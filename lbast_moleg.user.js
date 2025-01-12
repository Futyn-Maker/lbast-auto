﻿// ==UserScript==
// @name         lbast_moleg
// @namespace    http://tampermonkey.net/
// @version      2025.01.13
// @author       Agent_
// @include      *moleg-auto.lbast.ru/loc*
// @include      *moleg-auto.lbast.ru/rudnik*
// @include      *moleg-auto.lbast.ru/settings
// @require      https://code.jquery.com/jquery-3.3.1.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initScript() {
        if(!window.LbastUtils || !window.LbastUtils.ready) {
            document.body.innerHTML = '<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>';
            return;
        }

        const utils = window.LbastUtils;
        const rand = Math.floor(500 + Math.random() * (1000 + 1 - 500));
        const str = $("body").text();
        const goHP = localStorage.lbastAuto_goHP;
        const myHP = utils.parseHP(str);
        const houseHP = localStorage.lbastAuto_houseHP;
        const xhr = new XMLHttpRequest();

        document.getElementsByTagName('title')[0].innerHTML = 'Автокач (Молег), Последний Бастион';
        document.body.innerHTML += '<footer><a href="' + location.origin + '/settings">Настроить автокач</a></footer>';

        if(~location.href.indexOf('settings')) {
            utils.renderSettings();
        }
        else if(isNaN(goHP)) {
            document.body.innerHTML = '<p>Автокач не настроен. Перейдите в <a href="' + location.origin + '/settings">настройки</a> и задайте параметры.</p>';
        }
        else if(~str.indexOf('Почта [') || ~str.indexOf('Письма (') || ~str.indexOf('ПОЧТА [')) {
            utils.playSound('letter');
            setTimeout(() => {
                utils.sendTGMessage('У вас новое письмо! Из ' + location.hostname);
            }, 1500);
            setTimeout(() => {
                utils.send(location.origin + '/letters.php?r=7253&mod=readall&room=&newl=&poryad=&start=0');
            }, 2500);
            utils.update(3000);
        }
        else if(~str.indexOf('в это место невозможно')) {
            location.href = location.origin + '/location.php?r=7484&mod=konj&lway=20';
        }
        else if(~str.indexOf('поднятый в')) {
            if(myHP >= goHP) {
                location.href = location.origin + '/location.php?r=2148&mod=fastway&lway=1';
            }
            else if(myHP <= houseHP) {
                location.href = location.origin + '/location.php?r=1460&mod=fastway&lway=4';
            }
            else if(myHP <= 0) {
                utils.update(rand * 1200);
            } else {
                utils.update(rand * 480);
            }
        }
        else if(~str.indexOf('Мощное извержение вулкана')) {
            if(myHP >= goHP) {
                utils.click('Зайти');
            } else {
                location.href = location.origin + '/location.php?r=2012&mod=fastway&lway=3';
            }
        }
        else if(~str.indexOf('какой то утробный гул')) {
            utils.click('Встретить');
        }
        else if(~str.indexOf('устали')) {
            xhr.open('GET', location.origin + '/location.php?r=9463&mod=fastway&lway=3', false);
            xhr.send();
            if(~xhr.responseText.indexOf('бой')) {
                location.href = location.origin + '/location.php';
            } else {
                utils.update(rand * 900);
            }
        }
        else if(~str.indexOf('был заложен первый камень форта')) {
            if(myHP >= goHP) {
                location.href = location.origin + '/location.php?r=7484&mod=konj&lway=20';
            }
            else if(myHP <= houseHP) {
                utils.update(rand * 2400);
            }
            else {
                location.href = location.origin + '/location.php?r=3594&mod=fastway&lway=3';
            }
        }
        else if(~str.indexOf('автобан')) {
            setTimeout(() => {
                location.reload();
            }, 7500);
        }
        else if(~str.indexOf('В бой')) {
            utils.click('бой');
        }
        else if(~str.indexOf('путь лежит')) {
            utils.update(6100);
        }
        else if(~str.indexOf('работаете работу') || ~str.indexOf('абота завершена')) {
            utils.click('абот');
        }
        else if(~str.indexOf('выплачено за работу')) {
            utils.click('Вернуться');
        }
        else if(~str.indexOf('Получить') && ~location.href.indexOf('rudnik')) {
            utils.click('Получить');
        }
        else if(~location.href.indexOf('rudnik')) {
            const rtime = parseInt(str.substring(str.indexOf('еще') + 4, str.indexOf('мин') - 1));
            document.body.innerHTML += '<p>Автоматическое обновление произойдёт примерно через ' + String(rtime) + ' минут.</p></footer>';
            setTimeout(() => {
                location.href = location.origin + '/location.php';
            }, (rtime * 60000) + 60000);
        } else {
            if(myHP < goHP) {
                location.href = location.origin + '/location.php?r=3594&mod=fastway&lway=3';
            } else {
                location.href = location.origin + '/location.php?r=7484&mod=konj&lway=20';
            }
        }
    }

    if(window.LbastUtils && window.LbastUtils.ready) {
        initScript();
    } else {
        window.addEventListener('LbastUtilsReady', initScript);
        setTimeout(() => {
            if(!window.LbastUtils || !window.LbastUtils.ready) {
                document.body.innerHTML = '<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>';
            }
        }, 2000);
    }
})();
