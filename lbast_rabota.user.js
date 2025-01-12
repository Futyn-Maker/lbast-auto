// ==UserScript==
// @name         lbast_rabota
// @namespace    http://tampermonkey.net/
// @version      2025.01.13
// @author       Agent_
// @include        *lbast.ru/rudnik*
// @exclude        *auto.lbast.ru*
// @require      https://code.jquery.com/jquery-3.3.1.js
// ==/UserScript==

let str = $("body").text();

function click(text) {
    setTimeout(function(){
        $("a:contains('" + text + "')")[0].click();
    }, 200);
}

if(~str.indexOf('Введите')) {
    let code = str.substring(str.indexOf('Введите') + 8, str.indexOf(': '));
    $("input[name='kod']").val(code);
    
    const hoursSelect = $("select[name='hours']");
    const lastOption = hoursSelect.find('option').last().val();
    hoursSelect.val(lastOption);
    
    $("input[type='submit']").click();
}
else if(~str.indexOf('устроены')) {
    location.href = location.origin + '/rudnik.php';
}
else if(~str.indexOf('выплачено за работу')) {
    click('Приходите');
}
else if(~str.indexOf('Получить')) {
    click('Получить');
}
else if(~str.indexOf('осталось работать')) {
    let rtime = parseInt(str.substring(str.indexOf('еще') + 4, str.indexOf('мин') - 1));
    setTimeout(function() {
        click('Обновить');
    }, (rtime * 60000) + 60000);
}
