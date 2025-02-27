﻿// ==UserScript==
// @name         lbast_battle
// @namespace    http://tampermonkey.net/
// @version      2025.02.25
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

        if(sessionStorage.lbastAuto_checkAttempted && !~str.indexOf('Для продолжения боя ответьте на вопрос')) {
            utils.sendTGMessage('Проверка на автокач пройдена автоматически! Из ' + location.hostname);
            delete sessionStorage.lbastAuto_checkAttempted;
            location.reload();
            return;
        }

        if(~str.indexOf('Другой IP')) {
            setTimeout(() => {
                location.href = location.origin + '/location.php';
            }, 300000);
            return;
        }

        if(~str.indexOf('Для продолжения боя ответьте на вопрос')) {
            if(sessionStorage.lbastAuto_checkAttempted) {
                utils.playSound('alarm');
                utils.sendTGMessage('Проверка на автокач! Не удалось пройти автоматически. Из ' + location.hostname);
                setTimeout(() => {
                    location.reload();
                }, 180000);
                return;
            }

            utils.playSound('alarm');
            utils.sendTGMessage('Проверка на автокач! Пытаюсь пройти автоматически... Из ' + location.hostname);
            sessionStorage.lbastAuto_checkAttempted = 'true';

            try {
                const html = document.body.innerHTML;
                const questionMatch = html.match(/Для продолжения боя ответьте на вопрос:<br><br>([^<]+)<br>/);
                
                if(!questionMatch || !questionMatch[1]) {
                    throw new Error("Couldn't extract question");
                }

                const question = questionMatch[1].trim().replace(/\s+/g, '');
                let operator, leftOperand, rightOperand, result;

                if(~question.indexOf('+')) {
                    operator = '+';
                    [leftOperand, rightOperand] = question.split('+');
                    result = parseInt(leftOperand) + parseInt(rightOperand);
                } else if(~question.indexOf('-')) {
                    operator = '-';
                    [leftOperand, rightOperand] = question.split('-');
                    result = parseInt(leftOperand) - parseInt(rightOperand);
                } else if(~question.indexOf('*')) {
                    operator = '*';
                    [leftOperand, rightOperand] = question.split('*');
                    result = parseInt(leftOperand) * parseInt(rightOperand);
                } else {
                    throw new Error("Couldn't identify operator");
                }

                if(isNaN(result)) {
                    throw new Error("Calculation error");
                }

                const delay = 7000 + Math.floor(Math.random() * 8000);
                setTimeout(() => {
                    $("input[name='anumb']").val(result);
                    setTimeout(() => {
                        $("input[type='submit'][value='далее']").click();
                    }, 700 + Math.floor(Math.random() * 500));
                }, delay);

            } catch(e) {
                console.error("Auto-check failed:", e);
                setTimeout(() => {
                    location.reload();
                }, 5000);
            }
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
