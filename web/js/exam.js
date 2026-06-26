(function () {
  var config = ExamCommon.loadJson("exam_config", null);
  var ids = ExamCommon.loadJson("exam_questions", []);
  var answers = ExamCommon.loadJson("exam_answers", {});
  var map = ExamCommon.questionMap();
  var questions = ids.map(function (id) {
    return map[id];
  }).filter(Boolean);
  questions = ExamCommon.sortByTypeOrder(questions);
  if (questions.length) {
    ExamCommon.saveJson("exam_questions", questions.map(function (question) {
      return question.id;
    }));
  }
  var currentIndex = Number(localStorage.getItem("exam_current_index") || 0);
  var timer = null;

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function selectedAnswers() {
    return Array.prototype.slice.call(document.querySelectorAll("#options input:checked")).map(function (input) {
      return input.value;
    });
  }

  function saveAnswer() {
    if (!questions.length) return;
    answers[questions[currentIndex].id] = selectedAnswers();
    ExamCommon.saveJson("exam_answers", answers);
  }

  function optionHtml(question) {
    var selected = answers[question.id] || [];
    return ExamCommon.getOptionEntries(question).map(function (entry) {
      var key = entry[0];
      var value = entry[1];
      var checked = selected.indexOf(key) !== -1 ? " checked" : "";
      return [
        '<label class="option" data-option="' + key + '">',
        '<input type="' + ExamCommon.answerType(question) + '" name="answer" value="' + key + '"' + checked + ">",
        "<span><strong>" + key + ".</strong> " + value + "</span>",
        "</label>"
      ].join("");
    }).join("");
  }

  function updateOptionState() {
    Array.prototype.forEach.call(document.querySelectorAll(".option"), function (item) {
      item.classList.toggle("selected", Boolean(item.querySelector("input:checked")));
    });
  }

  function renderQuestion() {
    if (!config || !questions.length) {
      text("questionText", "未找到考试，请从首页重新进入模拟考试。");
      document.getElementById("answerForm").style.display = "none";
      return;
    }
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= questions.length) currentIndex = questions.length - 1;
    localStorage.setItem("exam_current_index", String(currentIndex));
    var question = questions[currentIndex];
    text("examScope", config.major + " / " + config.level);
    text("questionNumber", (currentIndex + 1) + " / " + questions.length);
    text("questionType", question.question_type);
    text("questionText", question.question || "题干缺失");
    document.getElementById("options").innerHTML = optionHtml(question);
    document.getElementById("prevButton").disabled = currentIndex === 0;
    document.getElementById("nextButton").disabled = currentIndex === questions.length - 1;
    renderProgress();
    updateOptionState();
  }

  function renderProgress() {
    var answeredCount = Object.keys(answers).filter(function (id) {
      return answers[id] && answers[id].length > 0;
    }).length;
    text("answeredCount", String(answeredCount));
    text("totalCount", String(questions.length));
    document.getElementById("progressBar").style.width = questions.length ? ((currentIndex + 1) / questions.length * 100) + "%" : "0";
  }

  function remainingSeconds() {
    var start = Number(localStorage.getItem("exam_start_time") || 0);
    var duration = Number(localStorage.getItem("exam_duration_minutes") || 0);
    return Math.max(0, Math.floor((start + duration * 60 * 1000 - Date.now()) / 1000));
  }

  function renderTimer() {
    var left = remainingSeconds();
    text("timeLeft", ExamCommon.formatDuration(left));
    if (left <= 0) submitExam(true);
  }

  function finalizeExam() {
    saveAnswer();
    var result = ExamCommon.calculateResult();
    result.detail.forEach(function (item) {
      if (item.answered) {
        ExamStore.recordAnswer(item.question, item.selected);
      }
      if (!item.correct) {
        ExamStore.setWrong(item.question.id, true);
      }
    });
    var byType = {};
    ExamCommon.supportedTypes.forEach(function (type) {
      var group = result.detail.filter(function (item) {
        return item.question.question_type === type;
      });
      var correct = group.filter(function (item) {
        return item.correct;
      }).length;
      byType[type] = {
        total: group.length,
        correct: correct,
        accuracy: ExamCommon.percent(group.length, correct)
      };
    });
    ExamCommon.saveRecord({
      id: result.config.id,
      major: result.config.major,
      level: result.config.level,
      submittedAt: new Date(result.submittedAt).toISOString(),
      durationMinutes: Number(localStorage.getItem("exam_duration_minutes") || result.config.durationMinutes || 0),
      usedSeconds: result.usedSeconds,
      total: result.total,
      correct: result.correctCount,
      wrong: result.wrongCount,
      unanswered: result.unansweredCount,
      accuracy: ExamCommon.percent(result.total, result.correctCount),
      byType: byType
    });
  }

  function submitExam(auto) {
    if (ExamCommon.loadJson("exam_submitted", false)) {
      window.location.href = "exam_result.html";
      return;
    }
    if (!auto && !confirm("确定交卷吗？交卷后不能继续修改答案。")) return;
    clearInterval(timer);
    localStorage.setItem("exam_submitted_at", String(Date.now()));
    ExamCommon.saveJson("exam_submitted", true);
    finalizeExam();
    window.location.href = "exam_result.html";
  }

  if (ExamCommon.loadJson("exam_submitted", false)) {
    window.location.href = "exam_result.html";
    return;
  }

  document.getElementById("options").addEventListener("change", function () {
    saveAnswer();
    updateOptionState();
    renderProgress();
  });
  document.getElementById("prevButton").addEventListener("click", function () {
    saveAnswer();
    currentIndex -= 1;
    renderQuestion();
  });
  document.getElementById("nextButton").addEventListener("click", function () {
    saveAnswer();
    currentIndex += 1;
    renderQuestion();
  });
  document.getElementById("submitExamButton").addEventListener("click", function () {
    submitExam(false);
  });

  renderQuestion();
  renderTimer();
  timer = setInterval(renderTimer, 1000);
})();
