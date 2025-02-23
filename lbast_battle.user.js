// ==UserScript==
// @name         lbast_battle
// @namespace    http://tampermonkey.net/
// @version      2025.02.23
// @author       Agent_
// @include      *auto.lbast.ru/arena_go*
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
        const str = $("body").text();
        const xhr = new XMLHttpRequest();

        const playerInfo = utils.getPlayerInfo();
        if(!playerInfo || !playerInfo.nickname) {
            return;
        }
        const playerNickname = playerInfo.nickname;

        if(~str.indexOf('Другой IP')) {
            setTimeout(() => {
                location.href = location.origin + '/location.php';
            }, 300000);
            return;
        }

        if(~str.indexOf('Для продолжения боя ответьте на вопрос')) {
            utils.playSound('alarm');
            utils.sendTGMessage('Проверка на автокач! Из ' + location.hostname);
            setTimeout(() => {
                location.reload();
            }, 180000);
            return;
        }

        if(~str.indexOf('автобан')) {
            setTimeout(() => {
                location.reload();
            }, 7500);
            return;
        }

        if($("a:contains('ернуться')").length) {
            utils.click('ернуться');
            return;
        }

        if($("a:contains('ой завершен')").length) {
            utils.click('ой завершен');
            return;
        }

        const isGroupPveBattle = ~str.indexOf('Левиафан') || ~str.indexOf('Призрак ворот') || ~str.indexOf('Дух заставы');
        const playerNickLink = $('a').filter(function() {
            return /^[a-zA-Z0-9_]+$/.test($(this).text()) && $(this).text() !== playerNickname;
        }).first();
        const isPvpBattle = !isGroupPveBattle && playerNickLink.length > 0;

        if(isGroupPveBattle) {
            setTimeout(() => {
                location.href = location.origin + '/arena_go.php';
            }, 60000);
            return;
        }

        if(!isPvpBattle) {
            if($("a:contains('Умение')").length) {
                utils.click('Умение');
            } else if($("a:contains('Ударить')").length) {
                utils.click('Ударить');
            }
            return;
        }

        if($("a:contains('ход соперника')").length) {
            setTimeout(() => {
                utils.click('ход соперника');
            }, 5000);
            return;
        }

        utils.playSound('alarm');
        utils.sendTGMessage('На вас напали! Из ' + location.hostname);

        setTimeout(() => {
            xhr.open('GET', playerNickLink.attr('href'), false);
            xhr.send();
            const playerStatus = xhr.responseText;

            const needsPoison = ~playerStatus.indexOf('раздничный эль') || ~playerStatus.indexOf('рага') || 
                               ~playerStatus.indexOf('одка') || ~playerStatus.indexOf('вино преми') || 
                               ~playerStatus.indexOf('оньяк') || ~playerStatus.indexOf('имонад');

            if(needsPoison) {
                setTimeout(() => {
                    xhr.open('GET', location.origin + '/arena_go.php?r=7241&mod=invaction', false);
                    xhr.send();
                    const hasPoison = ~xhr.responseText.indexOf('Эликсир отравления');

                    if(hasPoison) {
                        setTimeout(() => {
                            xhr.open('GET', location.origin + '/arena_go.php?r=6074&mod=invaction_el_otravleniya', false);
                            xhr.send();
                            setTimeout(() => {
                                utils.click('Обновить');
                            }, 5000);
                        }, 1500);
                    } else {
                        setTimeout(() => {
                            const hitButton = $("input[value='Бить'], input[type='image'][src*='boj_hit.gif']");
                            if(hitButton.length) {
                                hitButton.click();
                            }
                        }, 90000);
                    }
                }, 1500);
            } else {
                setTimeout(() => {
                    const hitButton = $("input[value='Бить'], input[type='image'][src*='boj_hit.gif']");
                    if(hitButton.length) {
                        hitButton.click();
                    }
                }, 90000);
            }
        }, 0);
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
