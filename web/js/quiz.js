(function () {
  var supportedTypes = ["单选题", "多选题", "判断题"];
  var modeNames = {
    sequential: "顺序刷题",
    random: "随机刷题",
    wrong: "错题重练",
    favorites: "收藏练习"
  };
  var params = new URLSearchParams(window.location.search);
  var major = params.get("major");
  var level = params.get("level");
  var mode = params.get("mode") || "sequential";
  var allQuestions = (window.QUESTIONS || []).filter(function (item) {
    return supportedTypes.indexOf(item.question_type) !== -1;
  });
  var stateAtLoad = ExamStore.load();
  var scopeQuestions = allQuestions.filter(function (question) {
    if (!major || !level) return false;
    return question.major === major && question.level === level;
  });
  var questions = buildQuestions();
  var lastIndexKey = "sgccExamLastIndex:" + (major || "all") + ":" + (level || "all") + ":" + mode;
  var currentIndex = mode === "random" ? 0 : Number(localStorage.getItem(lastIndexKey) || 0);
  if (currentIndex < 0 || currentIndex >= questions.length) currentIndex = 0;

  var answerForm = document.getElementById("answerForm");
  var optionsNode = document.getElementById("options");
  var answerBox = document.getElementById("answerBox");

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function buildQuestions() {
    var base = scopeQuestions;
    if (mode === "wrong") {
      base = base.filter(function (question) {
        return stateAtLoad.wrongBook.indexOf(question.id) !== -1;
      });
    }
    if (mode === "favorites") {
      base = base.filter(function (question) {
        return stateAtLoad.favorites.indexOf(question.id) !== -1;
      });
    }
    if (mode === "random") {
      return base.slice().sort(function () {
        return Math.random() - 0.5;
      });
    }
    return base;
  }

  function getOptionEntries(question) {
    if (question.options && Object.keys(question.options).length) {
      return Object.keys(question.options).sort().map(function (key) {
        return [key, question.options[key]];
      });
    }
    if (question.question_type === "判断题") {
      return [["A", "正确"], ["B", "错误"]];
    }
    return [];
  }

  function answerType(question) {
    return question.question_type === "多选题" ? "checkbox" : "radio";
  }

  function selectedAnswers() {
    return Array.prototype.slice.call(optionsNode.querySelectorAll("input:checked")).map(function (input) {
      return input.value;
    });
  }

  function optionHtml(question) {
    return getOptionEntries(question).map(function (entry) {
      var key = entry[0];
      var value = entry[1];
      return [
        '<label class="option" data-option="' + key + '">',
        '<input type="' + answerType(question) + '" name="answer" value="' + key + '">',
        "<span><strong>" + key + ".</strong> " + value + "</span>",
        "</label>"
      ].join("");
    }).join("");
  }

  function answerLetters(answer) {
    return ExamStore.normalizeAnswer(answer).split("");
  }

  function updateOptionSelectedState() {
    Array.prototype.forEach.call(optionsNode.querySelectorAll(".option"), function (item) {
      item.classList.toggle("selected", Boolean(item.querySelector("input:checked")));
    });
  }

  function highlightAnswers(question, selected) {
    var correctLetters = answerLetters(question.answer);
    Array.prototype.forEach.call(optionsNode.querySelectorAll(".option"), function (item) {
      var key = item.getAttribute("data-option");
      var isCorrectAnswer = correctLetters.indexOf(key) !== -1;
      var isSelected = selected.indexOf(key) !== -1;
      item.classList.toggle("correct-answer", isCorrectAnswer);
      item.classList.toggle("wrong-answer", isSelected && !isCorrectAnswer);
    });
  }

  function renderStats() {
    var state = ExamStore.load();
    var ids = scopeQuestions.map(function (question) {
      return question.id;
    });
    var done = ids.filter(function (id) {
      return Boolean(state.records[id]);
    });
    var correct = done.filter(function (id) {
      return state.records[id].correct;
    });
    text("scopeCount", String(questions.length));
    text("doneCount", String(done.length));
    text("accuracy", done.length ? Math.round(correct.length / done.length * 100) + "%" : "0%");
    document.getElementById("progressBar").style.width = questions.length ? ((currentIndex + 1) / questions.length * 100) + "%" : "0";
  }

  function renderQuestion() {
    if (!questions.length) {
      text("quizScope", "没有找到可练习题目");
      text("questionText", "当前模式下没有题目，请回到首页换一种模式，或先积累错题/收藏。");
      answerForm.style.display = "none";
      document.getElementById("loadNotice").textContent = "当前题组为空。";
      renderStats();
      return;
    }

    var question = questions[currentIndex];
    localStorage.setItem(lastIndexKey, String(currentIndex));
    text("quizScope", major + " / " + level + " / " + (modeNames[mode] || modeNames.sequential));
    text("questionNumber", "题号 " + (currentIndex + 1) + " / " + questions.length);
    text("questionType", "题型 " + question.question_type);
    text("questionLevel", "等级 " + question.level);
    text("questionText", question.question || "题干缺失");
    optionsNode.innerHTML = optionHtml(question);
    answerBox.className = "answer-box";
    text("correctAnswer", "");
    text("analysisText", "");
    text("resultText", "");
    document.getElementById("aiExplainBox").className = "ai-explain-box";
    document.getElementById("aiExplainBox").innerHTML = "";
    document.getElementById("prevButton").disabled = currentIndex === 0;
    document.getElementById("nextButton").disabled = currentIndex === questions.length - 1;
    document.getElementById("favoriteButton").textContent = ExamStore.hasFavorite(question.id) ? "取消收藏" : "加入收藏";
    document.getElementById("wrongButton").textContent = ExamStore.hasWrong(question.id) ? "移出错题本" : "加入错题本";
    document.getElementById("aiExplainButton").setAttribute("data-ai-explain", question.id);
    if (window.AIExplain) AIExplain.updateButton(document.getElementById("aiExplainButton"), question.id);
    document.getElementById("loadNotice").textContent = "题目已加载。";
    renderStats();
  }

  optionsNode.addEventListener("change", updateOptionSelectedState);

  answerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var question = questions[currentIndex];
    var selected = selectedAnswers();
    if (!selected.length) {
      alert("请先选择答案。");
      return;
    }
    var correct = ExamStore.recordAnswer(question, selected);
    updateOptionSelectedState();
    highlightAnswers(question, selected);
    answerBox.className = "answer-box visible " + (correct ? "correct" : "wrong");
    text("resultText", correct ? "回答正确" : "回答错误");
    text("correctAnswer", question.answer || "未提供");
    text("analysisText", question.analysis || "暂无解析");
    document.getElementById("wrongButton").textContent = ExamStore.hasWrong(question.id) ? "移出错题本" : "加入错题本";
    renderStats();
  });

  document.getElementById("prevButton").addEventListener("click", function () {
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderQuestion();
    }
  });

  document.getElementById("nextButton").addEventListener("click", function () {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      renderQuestion();
    }
  });

  document.getElementById("homeButton").addEventListener("click", function () {
    window.location.href = "index.html";
  });

  document.getElementById("favoriteButton").addEventListener("click", function () {
    var enabled = ExamStore.toggleFavorite(questions[currentIndex].id);
    this.textContent = enabled ? "取消收藏" : "加入收藏";
    renderStats();
  });

  document.getElementById("wrongButton").addEventListener("click", function () {
    var enabled = ExamStore.toggleWrong(questions[currentIndex].id);
    this.textContent = enabled ? "移出错题本" : "加入错题本";
    renderStats();
  });

  document.getElementById("aiExplainButton").addEventListener("click", function () {
    var question = questions[currentIndex];
    AIExplain.explain(question, selectedAnswers(), document.getElementById("aiExplainBox"), this);
  });

  renderQuestion();
})();
