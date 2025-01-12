// ==UserScript==
// @name         lbast_battle
// @namespace    http://tampermonkey.net/
// @version      2025.01.13
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

        if(~str.indexOf('Другой IP')) {
            setTimeout(() => {
                location.href = location.origin + '/location.php';
            }, 300000);
        }
        else if($("a:contains('Умение')").length) {
            utils.click('Умение');
        }
        else if($("a:contains('Ударить')").length) {
            utils.click('Ударить');
        }
        else if(~str.indexOf('автобан')) {
            setTimeout(() => {
                location.reload();
            }, 7500);
        }
        else if($("a:contains('ход соперника')").length) {
            setTimeout(() => {
                utils.click('ход соперника');
            }, 5000);
        }
        else if($("a:contains('ернуться')").length) {
            utils.click('ернуться');
        }
        else if(~str.indexOf('Левиафан') || ~str.indexOf('Призрак ворот') || ~str.indexOf('Дух заставы')) {
            setTimeout(() => {
                location.href = location.origin + '/arena_go.php';
            }, 60000);
        } else {
            utils.playSound('alarm');
            utils.sendTGMessage('На вас напали! Из ' + location.hostname);

            const nickLink = $('a').filter(function() {
                return /^[a-zA-Z_]+$/.test($(this).text());
            }).first();

            xhr.open('GET', nickLink.attr('href'), false);
            xhr.send();
            const t = xhr.responseText;

            if(~t.indexOf('раздничный эль') || ~t.indexOf('рага') || ~t.indexOf('одка') || 
               ~t.indexOf('вино преми') || ~t.indexOf('оньяк') || ~t.indexOf('имонад')) {
                xhr.open('GET', location.origin + '/arena_go.php?r=7241&mod=invaction', false);
                xhr.send();
                
                if(~xhr.responseText.indexOf('Эликсир отравления')) {
                    xhr.open('GET', location.origin + '/arena_go.php?r=6074&mod=invaction_el_otravleniya', false);
                    xhr.send();
                    setTimeout(() => {
                        utils.click('Обновить');
                    }, 3000);
                } else {
                    setTimeout(() => {
                        const hitButton = $("input[value='Бить'], input[type='image'][src*='boj_hit.gif']");
                        if(hitButton.length) {
                            hitButton.click();
                        }
                    }, 90000);
                }
            } else {
                setTimeout(() => {
                    const hitButton = $("input[value='Бить'], input[type='image'][src*='boj_hit.gif']");
                    if(hitButton.length) {
                        hitButton.click();
                    }
                }, 90000);
            }
        }

        utils.click('ой завершен');
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
