(function () {
  var supportedTypes = ["单选题", "多选题", "判断题"];
  var preferredMajors = ["通信运维检修工", "物资仓储作业员", "物资配送作业员", "信息通信客户服务代表"];
  var preferredLevels = ["初级工", "中级工", "高级工", "技师", "高级技师", "共用试题"];
  var questions = (window.QUESTIONS || []).filter(function (item) {
    return supportedTypes.indexOf(item.question_type) !== -1;
  });

  var majorList = document.getElementById("majorList");
  var levelList = document.getElementById("levelList");
  var totalCount = document.getElementById("totalCount");
  var typeCounts = document.getElementById("typeCounts");
  var notice = document.getElementById("loadNotice");

  function unique(field) {
    return questions.reduce(function (items, question) {
      if (items.indexOf(question[field]) === -1) items.push(question[field]);
      return items;
    }, []);
  }

  function sortByPreferred(items, preferred) {
    return items.slice().sort(function (a, b) {
      var ai = preferred.indexOf(a);
      var bi = preferred.indexOf(b);
      if (ai === -1) ai = 999;
      if (bi === -1) bi = 999;
      return ai - bi || a.localeCompare(b, "zh-Hans-CN");
    });
  }

  function mergePreferred(items, preferred) {
    return preferred.concat(items.filter(function (item) {
      return preferred.indexOf(item) === -1;
    }));
  }

  function renderRadios(container, name, items) {
    container.innerHTML = items.map(function (item, index) {
      return [
        '<label class="choice">',
        '<input type="radio" name="' + name + '" value="' + encodeURIComponent(item) + '"' + (index === 0 ? " checked" : "") + ">",
        "<span>" + item + "</span>",
        "</label>"
      ].join("");
    }).join("");
  }

  function getSelected(name) {
    var input = document.querySelector('input[name="' + name + '"]:checked');
    return input ? decodeURIComponent(input.value) : "";
  }

  function countSelectedQuestions() {
    var major = getSelected("major");
    var level = getSelected("level");
    return questions.filter(function (question) {
      return question.major === major && question.level === level;
    });
  }

  function updateSelectedCount() {
    var selectedQuestions = countSelectedQuestions();
    var selectedIds = selectedQuestions.map(function (question) {
      return question.id;
    });
    var state = ExamStore.load();
    var done = selectedIds.filter(function (id) {
      return Boolean(state.records[id]);
    });
    var correct = done.filter(function (id) {
      return state.records[id].correct;
    });
    var wrong = selectedIds.filter(function (id) {
      return state.wrongBook.indexOf(id) !== -1;
    });
    var favorites = selectedIds.filter(function (id) {
      return state.favorites.indexOf(id) !== -1;
    });
    var counts = supportedTypes.reduce(function (result, type) {
      result[type] = 0;
      return result;
    }, {});

    selectedQuestions.forEach(function (question) {
      counts[question.question_type] = (counts[question.question_type] || 0) + 1;
    });

    totalCount.textContent = String(selectedQuestions.length);
    document.getElementById("doneCount").textContent = String(done.length);
    document.getElementById("accuracy").textContent = done.length ? Math.round(correct.length / done.length * 100) + "%" : "0%";
    document.getElementById("wrongCount").textContent = String(wrong.length);
    document.getElementById("favoriteCount").textContent = String(favorites.length);
    typeCounts.innerHTML = supportedTypes.map(function (type) {
      return [
        '<div class="summary-row compact">',
        "<span>" + type + "</span>",
        "<strong>" + (counts[type] || 0) + "</strong>",
        "</div>"
      ].join("");
    }).join("");

    document.getElementById("startButton").disabled = selectedQuestions.length === 0;
    document.getElementById("examButton").disabled = selectedQuestions.length === 0;
  }

  function renderVipStatus() {
    var isVip = AnalysisAccess.isVip();
    document.getElementById("vipStatus").textContent = isVip ? "VIP用户" : "免费用户";
    document.getElementById("freeAnalysisRemaining").textContent = isVip ? "无限" : String(AnalysisAccess.remaining());
    document.getElementById("viewedAnalysisCount").textContent = String(AnalysisAccess.viewedIds().length);
  }

  renderRadios(majorList, "major", sortByPreferred(mergePreferred(unique("major"), preferredMajors), preferredMajors));
  renderRadios(levelList, "level", sortByPreferred(mergePreferred(unique("level"), preferredLevels), preferredLevels));
  updateSelectedCount();

  majorList.addEventListener("change", updateSelectedCount);
  levelList.addEventListener("change", updateSelectedCount);

  document.getElementById("startForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var major = getSelected("major");
    var level = getSelected("level");
    var mode = getSelected("mode") || "sequential";
    window.location.href = "quiz.html?major=" + encodeURIComponent(major) + "&level=" + encodeURIComponent(level) + "&mode=" + encodeURIComponent(mode);
  });

  document.getElementById("examButton").addEventListener("click", function () {
    var major = getSelected("major");
    var level = getSelected("level");
    window.location.href = "exam_config.html?major=" + encodeURIComponent(major) + "&level=" + encodeURIComponent(level);
  });

  document.getElementById("mockVipButton").addEventListener("click", function () {
    AnalysisAccess.setVip(true);
    renderVipStatus();
  });

  document.getElementById("resetAnalysisAccessButton").addEventListener("click", function () {
    AnalysisAccess.reset();
    renderVipStatus();
  });

  renderVipStatus();
  notice.textContent = "题库已加载，可选择专业和等级开始刷题。";
})();
