// ==UserScript==
// @name         lbast_battle
// @namespace    http://tampermonkey.net/
// @version      2026.04.27
// @author       Agent_
// @include      *auto.lbast.ru/arena_go*
// @require      https://code.jquery.com/jquery-3.3.1.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ===== Captcha module =====
  const POLLINATIONS_ENDPOINT = "https://text.pollinations.ai/openai";

  const AI_SYSTEM_PROMPT =
    "Ты — автоматический решатель простых проверочных заданий (анти-бот капчи) " +
    "в браузерной онлайн-игре. Тебе передают текст задания на русском языке. " +
    "Если в задании явно не сказано иное, ответом всегда является целое число. " +
    "Ответь ТОЛЬКО самим ответом — без слов, единиц измерения, знаков препинания, " +
    "кавычек, пояснений и рассуждений.";

  function isCaptchaPage(html) {
    return (
      html.indexOf("Для продолжения боя ответьте на вопрос") > -1 ||
      /<input[^>]*name=["']anumb["']/i.test(html)
    );
  }

  function extractCaptchaQuestion(html) {
    const m = html.match(
      /Для продолжения боя ответьте на вопрос:\s*(?:<br\s*\/?>\s*)+([^<]+?)\s*<br/i,
    );
    return m ? m[1].trim() : null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function compute(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b !== 0 ? a / b : null;
    return null;
  }

  function solveCaptchaWithRules(question) {
    if (!question) return null;
    const q = question.toLowerCase();

    const symMatch = question.match(/(-?\d+)\s*([+\-*\/×÷−])\s*(-?\d+)/);
    if (symMatch) {
      let op = symMatch[2];
      if (op === "×") op = "*";
      if (op === "÷") op = "/";
      if (op === "−") op = "-";
      const r = compute(
        parseInt(symMatch[1], 10),
        op,
        parseInt(symMatch[3], 10),
      );
      if (r !== null && Number.isFinite(r)) return r;
    }

    const wordOps = [
      { rx: /(?<!\p{L})(?:плюс|прибав\p{L}*)(?!\p{L})/u, op: "+" },
      {
        rx: /(?<!\p{L})(?:минус|отним\p{L}*|отня\p{L}*|выч[еи]\p{L}*)(?!\p{L})/u,
        op: "-",
      },
      { rx: /(?<!\p{L})(?:умнож\p{L}*|помнож\p{L}*)(?!\p{L})/u, op: "*" },
      { rx: /(?<!\p{L})(?:раздел\p{L}*|подел\p{L}*)(?!\p{L})/u, op: "/" },
    ];
    for (const w of wordOps) {
      if (w.rx.test(q)) {
        const nums = question.match(/-?\d+/g);
        if (nums && nums.length >= 2) {
          const r = compute(parseInt(nums[0], 10), w.op, parseInt(nums[1], 10));
          if (r !== null && Number.isFinite(r)) return r;
        }
      }
    }

    if (/(?<!\p{L})(?:число|цифр\p{L}*)(?!\p{L})/u.test(q)) {
      const m = question.match(/-?\d+/);
      if (m) return parseInt(m[0], 10);
    }

    const allNums = question.match(/-?\d+/g);
    if (
      allNums &&
      allNums.length === 1 &&
      /^[\s\d.,!?;:()-]*$/.test(question)
    ) {
      return parseInt(allNums[0], 10);
    }

    return null;
  }

  function parseAIAnswer(raw) {
    if (!raw) return null;
    const cleaned = String(raw).trim();
    const m = cleaned.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function solveCaptchaWithAI(question, nickname) {
    const userMsg =
      "Игрок: " +
      (nickname || "(неизвестно)") +
      "\nВремя: " +
      new Date().toISOString() +
      "\n\nЗадание: " +
      question;

    const body = JSON.stringify({
      model: "openai",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      reasoning_effort: "low",
    });

    return fetch(POLLINATIONS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    }).then((resp) =>
      resp.text().then((text) => {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status + ": " + text.slice(0, 200));
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error("Non-JSON response: " + text.slice(0, 200));
        }
        const raw =
          (data &&
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content) ||
          "";
        return { raw: raw, answer: parseAIAnswer(raw) };
      }),
    );
  }

  function solveCaptchaWithAIRetry(question, nickname) {
    return new Promise((resolve, reject) => {
      const errors = [];
      function attempt(n) {
        solveCaptchaWithAI(question, nickname)
          .then((res) => {
            if (res.answer !== null && Number.isFinite(res.answer)) {
              resolve(res);
            } else {
              errors.push(
                "попытка " + n + ': нераспознанный ответ "' + res.raw + '"',
              );
              if (n < 3) {
                setTimeout(() => attempt(n + 1), 5000);
              } else {
                reject(new Error(errors.join("; ")));
              }
            }
          })
          .catch((err) => {
            errors.push("попытка " + n + ": " + ((err && err.message) || err));
            if (n < 3) {
              setTimeout(() => attempt(n + 1), 5000);
            } else {
              reject(new Error(errors.join("; ")));
            }
          });
      }
      attempt(1);
    });
  }

  function submitCaptchaAnswer(answer) {
    const delay = 5000 + Math.floor(Math.random() * 3000);
    setTimeout(() => {
      $("input[name='anumb']").val(answer);
      setTimeout(
        () => {
          $("input[type='submit'][value='далее']").click();
        },
        700 + Math.floor(Math.random() * 500),
      );
    }, delay);
  }

  function runAIAttempt(utils, playerInfo, question) {
    solveCaptchaWithAIRetry(question, playerInfo.nickname)
      .then((res) => submitCaptchaAnswer(res.answer))
      .catch((err) => {
        utils.sendTGMessage(
          "ИИ не справился с проверкой: " +
            escapeHtml(String((err && err.message) || err)) +
            ". Не удалось пройти проверку автоматически. Из " +
            location.hostname,
        );
        sessionStorage.lbastAuto_checkAttempted = "failed";
        setTimeout(() => location.reload(), 15000);
      });
  }

  function handleCaptcha(utils, playerInfo) {
    const state = sessionStorage.lbastAuto_checkAttempted;

    if (state === "failed") {
      setTimeout(() => location.reload(), 15000);
      return;
    }

    if (state === "ai") {
      utils.sendTGMessage(
        "Не удалось пройти проверку автоматически: ответ ИИ оказался неверным. Из " +
          location.hostname,
      );
      sessionStorage.lbastAuto_checkAttempted = "failed";
      setTimeout(() => location.reload(), 15000);
      return;
    }

    const html = document.body.innerHTML;
    const question = extractCaptchaQuestion(html);
    const safeQuestion = question
      ? escapeHtml(question)
      : "(не удалось извлечь)";

    if (state === "rules") {
      utils.sendTGMessage(
        "Ответ по правилам оказался неверным. Пробую через ИИ. Из " +
          location.hostname,
      );
      if (!question) {
        utils.sendTGMessage(
          "Не удалось извлечь вопрос для повторной попытки. Из " +
            location.hostname,
        );
        sessionStorage.lbastAuto_checkAttempted = "failed";
        setTimeout(() => location.reload(), 15000);
        return;
      }
      sessionStorage.lbastAuto_checkAttempted = "ai";
      runAIAttempt(utils, playerInfo, question);
      return;
    }

    utils.playSound("alarm");
    utils.sendTGMessage(
      "Проверка на автокач! Пытаюсь пройти автоматически по правилам.\n" +
        "Вопрос: " +
        safeQuestion +
        "\nИз " +
        location.hostname,
    );

    if (!question) {
      utils.sendTGMessage(
        "Не удалось извлечь вопрос проверки. Из " + location.hostname,
      );
      sessionStorage.lbastAuto_checkAttempted = "failed";
      setTimeout(() => location.reload(), 15000);
      return;
    }

    const ruleAnswer = solveCaptchaWithRules(question);
    if (ruleAnswer !== null && Number.isFinite(ruleAnswer)) {
      sessionStorage.lbastAuto_checkAttempted = "rules";
      submitCaptchaAnswer(ruleAnswer);
      return;
    }

    utils.sendTGMessage(
      "Правила не нашли ответ на вопрос. Пробую через ИИ. Из " +
        location.hostname,
    );
    sessionStorage.lbastAuto_checkAttempted = "ai";
    runAIAttempt(utils, playerInfo, question);
  }
  // ===== End captcha module =====

  function findPerPairOpponent(hitForm) {
    if (hitForm.closest("td").length) {
      const lastCell = hitForm.closest("tr").children("td").last();
      const link = lastCell
        .find("a")
        .filter(function () {
          return /^[A-Za-z0-9_]+$/.test($(this).text().trim());
        })
        .first();
      return link.length ? link : null;
    }

    let node = hitForm.get(0).previousSibling;
    let hrCount = 0;
    while (node) {
      if (node.nodeType === 1 && node.tagName === "HR") {
        hrCount++;
        if (hrCount === 2) break;
      } else if (node.nodeType === 1) {
        const $node = $(node);
        const candidates = $node.is("a") ? $node : $node.find("a");
        const link = candidates
          .filter(function () {
            return /^[A-Za-z0-9_]+$/.test($(this).text().trim());
          })
          .first();
        if (link.length) {
          return link;
        }
      }
      node = node.previousSibling;
    }
    return null;
  }

  function isOverviewPvp() {
    const html = document.body.innerHTML;
    const vsIdx = html.indexOf("<br>VS.<br>");
    if (vsIdx === -1) return false;

    const before = html.substring(0, vsIdx);
    let sliceStart = 0;
    for (const marker of ["</div>", "<hr", "<center>"]) {
      const idx = before.lastIndexOf(marker);
      if (idx > sliceStart) sliceStart = idx;
    }
    return /<a[\s>]/.test(html.substring(sliceStart, vsIdx));
  }

  function refreshSoon() {
    setTimeout(
      () => {
        location.reload();
      },
      1000 + Math.floor(Math.random() * 500),
    );
  }

  function scheduleDelayedHit() {
    setTimeout(() => {
      const hitButton = $(
        "input[value='Бить'], input[type='image'][src*='boj_hit.gif']",
      );
      if (hitButton.length) {
        sessionStorage.lbastAuto_pvpAwaitingTurn = "true";
        hitButton.click();
      }
    }, 90000);
  }

  function initScript() {
    if (!window.LbastUtils || !window.LbastUtils.ready) {
      document.body.innerHTML =
        "<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>";
      return;
    }

    const utils = window.LbastUtils;
    const str = $("body").text();
    const xhr = new XMLHttpRequest();

    const playerInfo = utils.getPlayerInfo();
    if (!playerInfo || !playerInfo.nickname) {
      return;
    }

    if (!$("a:contains('ход соперника')").length) {
      delete sessionStorage.lbastAuto_pvpAwaitingTurn;
    }

    const pageHtml = document.body.innerHTML;
    const captchaPresent = isCaptchaPage(pageHtml);

    if (sessionStorage.lbastAuto_checkAttempted && !captchaPresent) {
      const wasFailed = sessionStorage.lbastAuto_checkAttempted === "failed";
      delete sessionStorage.lbastAuto_checkAttempted;
      if (!wasFailed) {
        utils.sendTGMessage(
          "Проверка на автокач пройдена автоматически! Из " + location.hostname,
        );
      }
      location.reload();
      return;
    }

    if (~str.indexOf("Другой IP")) {
      setTimeout(() => {
        location.href = location.origin + "/location.php";
      }, 300000);
      return;
    }

    if (captchaPresent) {
      handleCaptcha(utils, playerInfo);
      return;
    }

    if (~str.indexOf("автобан")) {
      setTimeout(() => {
        location.reload();
      }, 7500);
      return;
    }

    if ($("a:contains('ернуться')").length) {
      utils.click("ернуться");
      return;
    }

    if ($("a:contains('ой завершен')").length) {
      utils.click("ой завершен");
      return;
    }

    const hitForm = $("form")
      .filter(function () {
        return $(this).find('[name="bl"]').length > 0;
      })
      .first();
    const hasOpponent = hitForm.length > 0;

    if (!hasOpponent) {
      if (
        sessionStorage.lbastAuto_pvpAwaitingTurn &&
        $("a:contains('ход соперника')").length
      ) {
        setTimeout(() => {
          utils.click("ход соперника");
        }, 5000);
        return;
      }
      if ($("a:contains('Ударить')").length) {
        utils.click("Ударить");
        return;
      }
      if ($("a:contains('Сбр.пары')").length) {
        if (isOverviewPvp()) {
          refreshSoon();
        } else {
          utils.click("Сбр.пары");
        }
        return;
      }
      refreshSoon();
      return;
    }

    const opponentLink = findPerPairOpponent(hitForm);
    const isPvp = opponentLink !== null;

    if (!isPvp) {
      if ($("a:contains('Умение')").length) {
        utils.click("Умение");
      } else if ($("a:contains('Ударить')").length) {
        utils.click("Ударить");
      }
      return;
    }

    utils.playSound("alarm");
    utils.sendTGMessage("На вас напали! Из " + location.hostname);

    setTimeout(() => {
      xhr.open("GET", opponentLink.attr("href"), false);
      xhr.send();
      const playerStatus = xhr.responseText;

      const needsPoison =
        ~playerStatus.indexOf("раздничный эль") ||
        ~playerStatus.indexOf("рага") ||
        ~playerStatus.indexOf("одка") ||
        ~playerStatus.indexOf("вино преми") ||
        ~playerStatus.indexOf("оньяк") ||
        ~playerStatus.indexOf("имонад");

      if (needsPoison) {
        setTimeout(() => {
          xhr.open(
            "GET",
            location.origin + "/arena_go.php?r=7241&mod=invaction",
            false,
          );
          xhr.send();
          const hasPoison = ~xhr.responseText.indexOf("Эликсир отравления");

          if (hasPoison) {
            setTimeout(() => {
              xhr.open(
                "GET",
                location.origin +
                  "/arena_go.php?r=6074&mod=invaction_el_otravleniya",
                false,
              );
              xhr.send();
              setTimeout(() => {
                utils.click("Обновить");
              }, 5000);
            }, 1500);
          } else {
            scheduleDelayedHit();
          }
        }, 1500);
      } else {
        scheduleDelayedHit();
      }
    }, 0);
  }

  if (window.LbastUtils && window.LbastUtils.ready) {
    initScript();
  } else {
    window.addEventListener("LbastUtilsReady", initScript);
    setTimeout(() => {
      if (!window.LbastUtils || !window.LbastUtils.ready) {
        document.body.innerHTML =
          "<p>Для работы скрипта необходимо установить скрипт Lbast_utils.</p>";
      }
    }, 2000);
  }
})();
