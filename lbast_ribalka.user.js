// ==UserScript==
// @name         lbast_ribalka
// @namespace    http://tampermonkey.net/
// @version      2025.01.13
// @author       Agent_
// @include        *lbast.ru*obj=5074*
// @require      https://code.jquery.com/jquery-3.3.1.js
// ==/UserScript==

let str = $("body").text();

function click(text) {
    setTimeout(function(){
        $("a:contains('" + text + "')")[0].click();
    }, 200);
}

if(~str.indexOf('Что-то не клюет, но вы же терпеливый рыбак, подождем…')) {
    setTimeout(function() {
        location.href = location.origin + '/loc.php?r=8610&obj=5074';
    }, 120000);
}
else if(~str.indexOf('Вы с легким усилием вытаскиваете из воды карася')) {
    click('Далее');
}
else if(~str.indexOf('всю рыбу')) {
    location.href = location.origin + '/location.php?r=3691&mod=fastway&lway=3';
}
click('Забросить');
