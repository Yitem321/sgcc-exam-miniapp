(function () {
  var apiBase = "https://api.synexa.cc";
  var localExplanations = {};
  var loaded = false;
  var loadingPromise = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRecords(records) {
    var map = {};
    if (Array.isArray(records)) {
      records.forEach(function (item) {
        if (item && item.question_id) map[item.question_id] = item;
      });
    } else if (records && typeof records === "object") {
      Object.keys(records).forEach(function (key) {
        var item = records[key];
        if (item && item.question_id) map[item.question_id] = item;
        else if (item) map[key] = item;
      });
    }
    return map;
  }

  function loadLocalLibrary() {
    if (loaded) return Promise.resolve(localExplanations);
    if (loadingPromise) return loadingPromise;
    var fallback = normalizeRecords(window.LOCAL_AI_EXPLANATIONS || []);
    var urls = [
      "data/analysis/ai_explanations.json",
      "../data/analysis/ai_explanations.json",
      "/data/analysis/ai_explanations.json"
    ];
    loadingPromise = urls.reduce(function (promise, url) {
      return promise.catch(function () {
        return fetch(url).then(function (response) {
          if (!response.ok) throw new Error("not found");
          return response.json();
        });
      });
    }, Promise.reject()).then(function (records) {
      localExplanations = normalizeRecords(records);
      loaded = true;
      updateAllButtons();
      return localExplanations;
    }).catch(function () {
      localExplanations = fallback;
      loaded = true;
      updateAllButtons();
      return localExplanations;
    });
    return loadingPromise;
  }

  function formatExplanation(record) {
    var item = record.explanation || {};
    if (typeof item === "string") return item;
    var optionAnalysis = [item.why, item.wrong_options].filter(function (value) {
      return String(value || "").trim();
    }).join("\n\n");
    return [
      "【标准答案】",
      item.correct_answer || ("题库答案为：" + (record.answer || "未提供")),
      "",
      "【知识考点】",
      item.exam_point || "暂无。",
      "",
      "【选项辨析】",
      optionAnalysis || "暂无。",
      "",
      "【现场应用】",
      item.field_understanding || "暂无。",
      "",
      "【记忆口诀】",
      item.memory_tip || "暂无。"
    ].join("\n");
  }

  function renderBox(box, record) {
    box.classList.add("visible");
    box.innerHTML = [
      '<div class="ai-explain-head">',
      '<strong>AI解析</strong>',
      '<span class="tag">本地解析库</span>',
      "</div>",
      '<pre class="ai-explain-content">' + escapeHtml(formatExplanation(record)) + "</pre>"
    ].join("");
  }

  function renderLoading(box) {
    box.classList.add("visible");
    box.innerHTML = [
      '<div class="ai-explain-head">',
      "<strong>AI解析</strong>",
      '<span class="tag">读取中</span>',
      "</div>",
      '<pre class="ai-explain-content">正在读取本地解析库...</pre>'
    ].join("");
  }

  function renderMessage(box, title, message) {
    box.classList.add("visible");
    box.innerHTML = [
      '<div class="ai-explain-head">',
      "<strong>AI解析</strong>",
      '<span class="tag">' + escapeHtml(title) + "</span>",
      "</div>",
      '<pre class="ai-explain-content">' + escapeHtml(message) + "</pre>"
    ].join("");
  }

  function showVipPrompt(onVip) {
    var old = document.getElementById("vipPromptMask");
    if (old) old.remove();
    var mask = document.createElement("div");
    mask.id = "vipPromptMask";
    mask.className = "modal-mask";
    mask.innerHTML = [
      '<div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="vipPromptTitle">',
      '<h2 id="vipPromptTitle">开通VIP查看解析</h2>',
      "<p>免费解析体验已用完。开通VIP后可查看全部AI解析、错题解析和模拟考试解析。</p>",
      '<div class="toolbar">',
      '<button type="button" data-vip-cancel>暂不开通</button>',
      '<button type="button" class="primary" data-vip-open>模拟开通VIP</button>',
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(mask);
    mask.querySelector("[data-vip-cancel]").addEventListener("click", function () {
      mask.remove();
    });
    mask.querySelector("[data-vip-open]").addEventListener("click", function () {
      AnalysisAccess.setVip(true);
      mask.remove();
      updateAllButtons();
      if (onVip) onVip();
    });
  }

  function buttonText(questionId) {
    if (AnalysisAccess.isVip()) return "AI解析";
    if (AnalysisAccess.viewedIds().indexOf(questionId) !== -1) return "AI解析";
    var remaining = AnalysisAccess.remaining();
    return remaining > 0 ? "AI解析（剩余 " + remaining + " 次）" : "开通VIP查看解析";
  }

  function updateButton(button, questionId) {
    if (!button || !questionId || !window.AnalysisAccess) return;
    button.textContent = buttonText(questionId);
  }

  function updateAllButtons() {
    if (!window.AnalysisAccess) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-ai-explain]"), function (button) {
      updateButton(button, button.getAttribute("data-ai-explain"));
    });
  }

  async function explain(question, userAnswer, box, button) {
    if (!question || !box) return;
    renderLoading(box);
    if (button) button.disabled = true;
    try {
      var records = await loadLocalLibrary();
      var record = records[question.id];
      if (!record) {
        renderMessage(box, "暂无解析", "本题暂未生成解析，请等待题库更新。");
        return;
      }
      if (!AnalysisAccess.canView(question.id)) {
        box.classList.remove("visible");
        showVipPrompt(function () {
          explain(question, userAnswer, box, button);
        });
        updateButton(button, question.id);
        return;
      }
      AnalysisAccess.markViewed(question.id);
      renderBox(box, record);
      updateAllButtons();
    } catch (error) {
      renderMessage(box, "读取失败", "本地解析库读取失败，请检查 data/analysis/ai_explanations.json。");
    } finally {
      if (button) button.disabled = false;
      updateButton(button, question.id);
    }
  }

  async function explainRealtime(question, userAnswer, box, button) {
    if (!question || !box) return;
    renderLoading(box);
    if (button) button.disabled = true;
    try {
      var response = await fetch(apiBase + "/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id || "",
          question: question.question || "",
          options: question.options || {},
          answer: question.answer || "",
          userAnswer: Array.isArray(userAnswer) ? userAnswer.join("") : String(userAnswer || ""),
          questionType: question.question_type || "",
          major: question.major || "",
          level: question.level || ""
        })
      });
      var result = await response.json();
      if (!response.ok || !result.success) {
        renderMessage(box, "请求失败", result.message || "AI解析服务返回异常");
        return;
      }
      renderMessage(box, result.provider || "实时解析", result.explanation || "暂无解析");
    } catch (error) {
      renderMessage(box, "请求失败", "AI解析服务不可用，请确认本地后端已启动：node server.js");
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.AIExplain = {
    explain: explain,
    explainRealtime: explainRealtime,
    escapeHtml: escapeHtml,
    apiBase: apiBase,
    loadLocalLibrary: loadLocalLibrary,
    updateButton: updateButton,
    updateAllButtons: updateAllButtons,
    localCount: function () {
      return Object.keys(localExplanations).length || normalizeRecords(window.LOCAL_AI_EXPLANATIONS || []).length;
    }
  };

  loadLocalLibrary();
})();
