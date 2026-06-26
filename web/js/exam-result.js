(function () {
  var result = ExamCommon.calculateResult();

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function typeAccuracy(type) {
    var group = result.detail.filter(function (item) {
      return item.question.question_type === type;
    });
    var correct = group.filter(function (item) {
      return item.correct;
    }).length;
    return ExamCommon.percent(group.length, correct);
  }

  function renderSummary() {
    if (!result.config) {
      document.getElementById("resultContent").innerHTML = '<section class="panel section"><div class="empty-state">未找到考试结果。</div></section>';
      return;
    }
    text("majorText", result.config.major);
    text("levelText", result.config.level);
    text("durationText", Number(localStorage.getItem("exam_duration_minutes") || result.config.durationMinutes || 0) + "分钟");
    text("usedTimeText", ExamCommon.formatDuration(result.usedSeconds));
    text("totalText", String(result.total));
    text("correctText", String(result.correctCount));
    text("wrongText", String(result.wrongCount));
    text("unansweredText", String(result.unansweredCount));
    text("accuracyText", ExamCommon.percent(result.total, result.correctCount));
    text("singleAccuracy", typeAccuracy("单选题"));
    text("multiAccuracy", typeAccuracy("多选题"));
    text("judgeAccuracy", typeAccuracy("判断题"));
  }

  function renderDetail() {
    document.getElementById("resultList").innerHTML = result.detail.map(function (item, index) {
      return [
        '<article class="question-item" data-id="' + item.question.id + '">',
        '<div class="question-item-head">',
        "<strong>" + (index + 1) + ". " + item.question.question_type + "</strong>",
        '<span class="' + (item.correct ? "result-good" : "result-bad") + '">' + (item.correct ? "正确" : "错误") + "</span>",
        "</div>",
        '<p class="question-preview">' + (item.question.question || "题干缺失") + "</p>",
        '<div class="question-item-meta">',
        "<span>用户答案：" + ExamCommon.answerText(item.selected) + "</span>",
        "<span>正确答案：" + ExamCommon.answerText(item.question.answer) + "</span>",
        "<span>专业：" + item.question.major + "</span>",
        "<span>等级：" + item.question.level + "</span>",
        "</div>",
        '<div class="toolbar">',
        '<button type="button" data-ai-explain="' + item.question.id + '">AI解析</button>',
        "</div>",
        '<section class="ai-explain-box" data-ai-box="' + item.question.id + '" aria-live="polite"></section>',
        "</article>"
      ].join("");
    }).join("");
    if (window.AIExplain) AIExplain.updateAllButtons();
  }

  document.getElementById("resultList").addEventListener("click", function (event) {
    var questionId = event.target.getAttribute("data-ai-explain");
    if (!questionId) return;
    var detail = result.detail.filter(function (item) {
      return item.question.id === questionId;
    })[0];
    if (!detail) return;
    var box = document.querySelector('[data-ai-box="' + questionId + '"]');
    AIExplain.explain(detail.question, detail.selected || [], box, event.target);
  });

  if (result.config) {
    renderSummary();
    renderDetail();
  } else {
    renderSummary();
  }
})();
