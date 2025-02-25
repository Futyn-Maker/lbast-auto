// ==UserScript==
// @name         lbast_bleyk
// @namespace    http://tampermonkey.net/
// @version      2025.02.25
// @author       Agent_
// @include      *bleyk-auto.lbast.ru/loc*
// @include      *bleyk-auto.lbast.ru/pers*
// @include      *bleyk-auto.lbast.ru/rudnik*
// @include      *bleyk-auto.lbast.ru/settings*
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
        const useDukeEstate = localStorage.lbastAuto_useDukeEstate === 'true';
        const xhr = new XMLHttpRequest();

        const playerInfo = utils.getPlayerInfo();
        if(!playerInfo || !playerInfo.alignment) {
            return;
        }
        const hometown = utils.HOMETOWN[playerInfo.alignment];

        document.getElementsByTagName('title')[0].innerHTML = 'Автокач (Блейки), Последний Бастион';
        document.body.innerHTML += '<footer><a href="' + location.origin + '/settings">Настроить автокач</a></footer>';

        if(~location.href.indexOf('settings')) {
            utils.renderSettings();
            utils.registerCustomSettings('bleyk', {
                html: `
                    <p>
                        <label>Автоматически активировать опыт X2
                            <input name="expo" type="checkbox" tabindex="0" ${localStorage.lbastAuto_expo === 'true' ? 'checked' : ''}/>
                        </label>
                    </p>
                `,
                saveHandler: (form) => {
                    localStorage.lbastAuto_expo = form.elements.expo.checked;
                }
            });
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
        else if((~str.indexOf('Центральная площадь') && hometown === 2) || (~str.indexOf('поднятый в') && hometown === 3) || (~str.indexOf('Северо-западный форпост') && hometown === 6)) {
            if(myHP >= goHP) {
                if(localStorage.lbastAuto_expo === 'true') {
                    xhr.open('GET', location.origin + '/pers.php?r=3503', false);
                    xhr.send();
                    const t = xhr.responseText;
                    if(~t.indexOf('Активирован опыт x2')) {
                        location.href = location.origin + '/location.php?r=8963&mod=konj&lway=14';
                    }
                    else if(~t.indexOf('Опыт x2: доступно')) {
                        location.href = location.origin + '/pers.php?r=3525&mod=activateexp';
                    } else {
                        location.href = location.origin + '/location.php?r=8963&mod=konj&lway=14';
                    }
                } else {
                    location.href = location.origin + '/location.php?r=8963&mod=konj&lway=14';
                }
            }
            else if(myHP <= houseHP) {
                if(useDukeEstate) {
                    location.href = location.origin + '/location.php?r=1450&mod=konj&lway=22';
                } else {
                    location.href = location.origin + '/location.php?r=1460&mod=fastway&lway=4';
                }
            }
            else if(myHP <= 0) {
                utils.update(rand * 1200);
            } else {
                utils.update(rand * 480);
            }
        }
        else if(~str.indexOf('Почему-то здесь очень тихо')) {
            if(myHP >= goHP) {
                utils.click('Зайти');
            } else {
                location.href = location.origin + `/location.php?r=2012&mod=fastway&lway=${hometown}`;
            }
        }
        else if(~str.indexOf('устали')) {
            xhr.open('GET', location.origin + `/location.php?r=9463&mod=fastway&lway=${hometown}`, false);
            xhr.send();
            if(~xhr.responseText.indexOf('бой')) {
                location.href = location.origin + '/location.php';
            } else {
                utils.update(rand * 900);
            }
        }
        else if(~str.indexOf('Девтаун. Портовый район')) {
            utils.click('Пристань');
        }
        else if(~str.indexOf('Выберите направление')) {
            utils.click('до острова Блейка');
        }
        else if(~str.indexOf('Капитан на прощание машет вам рукой')) {
            utils.click('Далее');
        }
        else if(~str.indexOf('зарыл здесь награбленные сокровища')) {
            utils.click('север');
        }
        else if((~str.indexOf('был заложен первый камень форта') && !useDukeEstate) || (~str.indexOf('родовые поместья высшей знати Ардена') && useDukeEstate)) {
            if(myHP >= goHP) {
                location.href = location.origin + '/location.php?r=8963&mod=konj&lway=14';
            }
            else if(myHP <= houseHP) {
                utils.update(rand * 2400);
            }
            else {
                location.href = location.origin + `/location.php?r=3594&mod=fastway&lway=${hometown}`;
            }
        }
        else if(~str.indexOf('Вокруг расстилаются бескрайние поля пшеницы') && useDukeEstate) {
            utils.click('Королевская долина');
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
        else if(~str.indexOf('Подтвердите активацию')) {
            utils.click('Активировать');
        }
        else if(~str.indexOf('активировали')) {
            utils.click('В игру');
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
                location.href = location.origin + `/location.php?r=3594&mod=fastway&lway=${hometown}`;
            } else {
                location.href = location.origin + '/location.php?r=8963&mod=konj&lway=14';
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
