(function () {
  var supportedTypes = ["单选题", "多选题", "判断题"];
  var listType = document.body.getAttribute("data-list-type");
  var isWrongPage = listType === "wrong";
  var mode = isWrongPage ? "wrong" : "favorites";
  var title = isWrongPage ? "错题" : "收藏";
  var questions = (window.QUESTIONS || []).filter(function (item) {
    return supportedTypes.indexOf(item.question_type) !== -1;
  });
  var questionMap = questions.reduce(function (map, question) {
    map[question.id] = question;
    return map;
  }, {});

  function stateIds(state) {
    return (isWrongPage ? state.wrongBook : state.favorites).filter(function (id) {
      return Boolean(questionMap[id]);
    });
  }

  function groupKey(question) {
    return question.major + "||" + question.level;
  }

  function practiceUrl(question) {
    return "quiz.html?major=" + encodeURIComponent(question.major) + "&level=" + encodeURIComponent(question.level) + "&mode=" + encodeURIComponent(mode);
  }

  function removeItem(questionId) {
    if (isWrongPage) {
      ExamStore.setWrong(questionId, false);
    } else {
      ExamStore.toggleFavorite(questionId);
    }
    render();
  }

  function renderGroupActions(items) {
    var groups = items.reduce(function (result, question) {
      var key = groupKey(question);
      if (!result[key]) result[key] = question;
      return result;
    }, {});
    document.getElementById("groupActions").innerHTML = Object.keys(groups).sort().map(function (key) {
      var question = groups[key];
      return '<a class="button primary" href="' + practiceUrl(question) + '">' + question.major + " / " + question.level + " 练习</a>";
    }).join("");
  }

  function renderList(items) {
    document.getElementById("questionList").innerHTML = items.map(function (question, index) {
      var record = ExamStore.load().records[question.id] || {};
      return [
        '<article class="question-item" data-id="' + question.id + '">',
        '<div class="question-item-head">',
        "<strong>" + (index + 1) + ". " + question.question_type + "</strong>",
        "<span>" + question.major + " / " + question.level + "</span>",
        "</div>",
        '<p class="question-preview">' + (question.question || "题干缺失") + "</p>",
        '<div class="question-item-meta">',
        "<span>正确答案：" + (question.answer || "未提供") + "</span>",
        "<span>答题次数：" + Number(record.answerCount || 0) + "</span>",
        "<span>答错次数：" + Number(record.wrongCount || 0) + "</span>",
        "</div>",
        '<div class="toolbar">',
        '<a class="button" href="' + practiceUrl(question) + '">重新练习</a>',
        '<button type="button" data-ai-explain="' + question.id + '">AI解析</button>',
        '<button type="button" data-remove="' + question.id + '">' + (isWrongPage ? "移出错题本" : "取消收藏") + "</button>",
        "</div>",
        '<section class="ai-explain-box" data-ai-box="' + question.id + '" aria-live="polite"></section>',
        "</article>"
      ].join("");
    }).join("");
  }

  function render() {
    var state = ExamStore.load();
    var items = stateIds(state).map(function (id) {
      return questionMap[id];
    });
    document.getElementById("itemCount").textContent = String(items.length);
    renderGroupActions(items);
    if (!items.length) {
      document.getElementById("questionList").innerHTML = '<div class="empty-state">暂无' + title + '题目。</div>';
      document.getElementById("loadNotice").textContent = title + "列表为空。";
      return;
    }
    renderList(items);
    if (window.AIExplain) AIExplain.updateAllButtons();
    document.getElementById("loadNotice").textContent = title + "列表已更新。";
  }

  document.getElementById("questionList").addEventListener("click", function (event) {
    var aiQuestionId = event.target.getAttribute("data-ai-explain");
    if (aiQuestionId) {
      var state = ExamStore.load();
      var question = questionMap[aiQuestionId];
      var record = state.records[aiQuestionId] || {};
      var box = document.querySelector('[data-ai-box="' + aiQuestionId + '"]');
      AIExplain.explain(question, record.selected || [], box, event.target);
      return;
    }
    var questionId = event.target.getAttribute("data-remove");
    if (!questionId) return;
    removeItem(questionId);
  });

  render();
})();
