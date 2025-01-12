// ==UserScript==
// @name         lbast_paladin
// @namespace    http://tampermonkey.net/
// @version      2025.01.13
// @author       Agent_
// @include      *paladin-auto.lbast.ru/loc*
// @include      *paladin-auto.lbast.ru/rudnik*
// @include      *paladin-auto.lbast.ru/settings*
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

        document.getElementsByTagName('title')[0].innerHTML = 'Автокач (паладин), Последний Бастион';
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
            location.href = location.origin + '/location.php?r=6976&mod=fastway&lway=8';
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
        else if(~str.indexOf('Продолжить квест')) {
            utils.click('Продолжить квест');
        }
        else if(~str.indexOf('стоит склеп')) {
            if(myHP >= goHP) {
                utils.click('смотреть');
            } else {
                location.href = location.origin + '/location.php?r=2012&mod=fastway&lway=3';
            }
        }
        else if(~str.indexOf('устали')) {
            xhr.open('GET', location.origin + '/location.php', false);
            xhr.send();
            const t = xhr.responseText;
            if(~t.indexOf('Продолжить квест')) {
                setTimeout(() => {
                    location.reload();
                }, rand * 300);
            } else {
                xhr.open('GET', location.origin + '/location.php?r=9463&mod=fastway&lway=3', false);
                xhr.send();
                if(~xhr.responseText.indexOf('бой')) {
                    location.href = location.origin + '/location.php';
                } else {
                    utils.update(rand * 1200);
                }
            }
        }
        else if(~str.indexOf('Девтаун. Торговый район')) {
            xhr.open('GET', location.origin + '/pers.php?r=2347', false);
            xhr.send();
            const t = xhr.responseText;
            if(~t.indexOf('склеп')) {
                utils.click('юг');
            } else {
                utils.click('север');
            }
        }
        else if(~str.indexOf('большой круглый стол')) {
            xhr.open('GET', location.origin + '/pers.php?r=2347', false);
            xhr.send();
            const t = xhr.responseText;
            if(~t.indexOf('склеп')) {
                location.href = location.origin + '/location.php?r=2714&mod=fastway&lway=8';
            } else {
                utils.click('паладинов');
            }
        }
        else if(~str.indexOf('Белоснежная башня')) {
            utils.send(location.origin + '/loc.php?r=1659&obj=5008&mod=1');
            utils.click('В игру');
        }
        else if(~str.indexOf('Крепостные стены отсутствуют')) {
            utils.click('юг');
        }
        else if(~str.indexOf('очертания большого города')) {
            utils.click('юг');
        }
        else if(~str.indexOf('с какими-то рычагами и колесами')) {
            utils.click('запад');
        }
        else if(~str.indexOf('Идя неспешно, вы размышляете')) {
            utils.click('запад');
        }
        else if(~str.indexOf('был заложен первый камень форта')) {
            if(myHP >= goHP) {
                location.href = location.origin + '/location.php?r=8281&mod=fastway&lway=8';
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
        else if(~str.indexOf('куклой')) {
            utils.click('Уйти');
        }
        else if(~str.indexOf('темное сырое помещение')) {
            utils.click('дальше');
        }
        else if(~str.indexOf('В бой')) {
            utils.click('бой');
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
                location.href = location.origin + '/location.php?r=8281&mod=fastway&lway=8';
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
