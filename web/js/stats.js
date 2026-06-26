(function () {
  var supportedTypes = ["单选题", "多选题", "判断题"];
  var questions = (window.QUESTIONS || []).filter(function (item) {
    return supportedTypes.indexOf(item.question_type) !== -1;
  });
  var questionMap = questions.reduce(function (map, question) {
    map[question.id] = question;
    return map;
  }, {});
  var state = ExamStore.load();
  var records = Object.keys(state.records).filter(function (id) {
    return Boolean(questionMap[id]);
  });
  var correct = records.filter(function (id) {
    return state.records[id].correct;
  });
  var incorrect = records.filter(function (id) {
    return !state.records[id].correct;
  });
  var wrongIds = state.wrongBook.filter(function (id) {
    return Boolean(questionMap[id]);
  });
  var favoriteIds = state.favorites.filter(function (id) {
    return Boolean(questionMap[id]);
  });
  var examRecords = loadExamRecords();

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function percent(done, ok) {
    return done ? Math.round(ok / done * 100) + "%" : "0%";
  }

  function loadExamRecords() {
    try {
      return JSON.parse(localStorage.getItem("exam_records") || "[]");
    } catch (error) {
      return [];
    }
  }

  function percentNumber(record) {
    return record.total ? Math.round(record.correct / record.total * 100) : 0;
  }

  function formatDuration(totalSeconds) {
    var seconds = Math.max(0, Math.floor(totalSeconds || 0));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return minutes + "分" + String(rest).padStart(2, "0") + "秒";
  }

  function groupBy(field) {
    return questions.reduce(function (groups, question) {
      var key = question[field] || "未分类";
      if (!groups[key]) groups[key] = [];
      groups[key].push(question);
      return groups;
    }, {});
  }

  function renderGroup(containerId, groups) {
    var rows = Object.keys(groups).sort(function (a, b) {
      return a.localeCompare(b, "zh-Hans-CN");
    }).map(function (name) {
      var ids = groups[name].map(function (question) {
        return question.id;
      });
      var done = ids.filter(function (id) {
        return Boolean(state.records[id]);
      });
      var ok = done.filter(function (id) {
        return state.records[id].correct;
      });
      var wrong = ids.filter(function (id) {
        return state.wrongBook.indexOf(id) !== -1;
      });
      var favorites = ids.filter(function (id) {
        return state.favorites.indexOf(id) !== -1;
      });
      return [
        '<div class="stats-row">',
        "<strong>" + name + "</strong>",
        "<span>总题 " + ids.length + "</span>",
        "<span>已做 " + done.length + "</span>",
        "<span>正确 " + ok.length + "</span>",
        "<span>正确率 " + percent(done.length, ok.length) + "</span>",
        "<span>错题 " + wrong.length + "</span>",
        "<span>收藏 " + favorites.length + "</span>",
        "</div>"
      ].join("");
    }).join("");
    document.getElementById(containerId).innerHTML = rows || '<div class="empty-state">暂无统计</div>';
  }

  function renderExamStats() {
    var count = examRecords.length;
    var last = examRecords[0] || null;
    var best = examRecords.reduce(function (max, record) {
      return Math.max(max, percentNumber(record));
    }, 0);
    var avg = count ? Math.round(examRecords.reduce(function (sum, record) {
      return sum + percentNumber(record);
    }, 0) / count) : 0;
    setText("examCount", String(count));
    setText("lastExamAccuracy", last ? last.accuracy : "0%");
    setText("bestExamAccuracy", best + "%");
    setText("avgExamAccuracy", avg + "%");
    setText("lastExamTime", last ? formatDuration(last.usedSeconds) : "0分00秒");
  }

  function renderExamHistory() {
    document.getElementById("examHistory").innerHTML = examRecords.map(function (record) {
      return [
        '<div class="stats-row exam-history-row">',
        "<strong>" + (record.major || "-") + " / " + (record.level || "-") + "</strong>",
        "<span>时间 " + new Date(record.submittedAt).toLocaleString("zh-CN") + "</span>",
        "<span>总题 " + record.total + "</span>",
        "<span>正确 " + record.correct + "</span>",
        "<span>错题 " + record.wrong + "</span>",
        "<span>未答 " + record.unanswered + "</span>",
        "<span>正确率 " + record.accuracy + "</span>",
        "<span>用时 " + formatDuration(record.usedSeconds) + "</span>",
        "</div>"
      ].join("");
    }).join("") || '<div class="empty-state">暂无模拟考试记录</div>';
  }

  function renderAiCacheStats() {
    fetch("https://api.synexa.cc/api/explain/cache/stats")
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        var stats = result.stats || {};
        setText("aiCacheTotal", String(stats.total || 0));
        setText("aiCacheDeepSeek", String(stats.deepseek || 0));
        setText("aiCacheOpenAI", String(stats.openai || 0));
        setText("aiCacheMock", String(stats.mock || 0));
        document.getElementById("aiCacheNotice").textContent = "AI解析缓存统计已更新。";
      })
      .catch(function () {
        document.getElementById("aiCacheNotice").textContent = "AI解析服务未启动，暂时无法读取缓存统计。";
      });
  }

  function renderAnalysisAccessStats() {
    setText("analysisFreeUsed", String(AnalysisAccess.usedCount()));
    setText("analysisViewedCount", String(AnalysisAccess.viewedIds().length));
    setText("analysisVipStatus", AnalysisAccess.isVip() ? "是" : "否");
    AIExplain.loadLocalLibrary().then(function () {
      setText("localAnalysisTotal", String(AIExplain.localCount()));
    });
  }

  function clearAiCache() {
    if (!confirm("确定清空本地 AI 解析缓存吗？清空后同一道题会重新请求 AI。")) return;
    fetch("https://api.synexa.cc/api/explain/cache/clear", {
      method: "POST"
    })
      .then(function (response) {
        return response.json();
      })
      .then(function () {
        renderAiCacheStats();
      })
      .catch(function () {
        document.getElementById("aiCacheNotice").textContent = "清空失败，请确认 AI解析服务已启动。";
      });
  }

  setText("totalQuestions", String(questions.length));
  setText("doneQuestions", String(records.length));
  setText("correctQuestions", String(correct.length));
  setText("incorrectQuestions", String(incorrect.length));
  setText("accuracy", percent(records.length, correct.length));
  setText("wrongQuestions", String(wrongIds.length));
  setText("favoriteQuestions", String(favoriteIds.length));
  renderExamStats();
  renderGroup("majorStats", groupBy("major"));
  renderGroup("levelStats", groupBy("level"));
  renderGroup("typeStats", groupBy("question_type"));
  renderExamHistory();
  renderAiCacheStats();
  renderAnalysisAccessStats();
  document.getElementById("clearAiCacheButton").addEventListener("click", clearAiCache);
  document.getElementById("loadNotice").textContent = "统计已更新。";
})();
