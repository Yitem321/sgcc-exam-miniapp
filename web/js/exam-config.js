(function () {
  var params = new URLSearchParams(window.location.search);
  var major = params.get("major") || "";
  var level = params.get("level") || "";
  var scope = ExamCommon.scopedQuestions(major, level);
  var counts = ExamCommon.countByType(scope);
  var typeToInput = {
    "单选题": "singleCount",
    "多选题": "multiCount",
    "判断题": "judgeCount"
  };
  var typeToDefault = {
    "单选题": 30,
    "多选题": 20,
    "判断题": 20
  };

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function numberValue(id) {
    return Number(document.getElementById(id).value || 0);
  }

  function plannedCounts() {
    return {
      "单选题": numberValue("singleCount"),
      "多选题": numberValue("multiCount"),
      "判断题": numberValue("judgeCount")
    };
  }

  function validate() {
    var plan = plannedCounts();
    var messages = [];
    var total = 0;
    ExamCommon.supportedTypes.forEach(function (type) {
      var value = Number(plan[type] || 0);
      total += value;
      if (value < 0) messages.push(type + "抽取数量不能小于0。");
      if (value > counts[type]) messages.push(type + "计划抽取 " + value + "，超过可用题数 " + counts[type] + "。");
      document.getElementById(typeToInput[type] + "Hint").textContent = "计划抽取 " + value + " / 可用 " + counts[type];
    });
    if (total <= 0) messages.push("三种题型总抽题数量必须大于0。");
    if (numberValue("durationMinutes") <= 0) messages.push("考试时间必须大于0。");
    document.getElementById("startExamButton").disabled = messages.length > 0;
    document.getElementById("validationBox").innerHTML = messages.map(function (message) {
      return "<div>" + message + "</div>";
    }).join("");
    document.getElementById("validationBox").classList.toggle("visible", messages.length > 0);
    return messages.length === 0;
  }

  function renderSummary() {
    text("majorText", major || "未选择");
    text("levelText", level || "未选择");
    text("totalCount", String(scope.length));
    text("singleAvailable", String(counts["单选题"] || 0));
    text("multiAvailable", String(counts["多选题"] || 0));
    text("judgeAvailable", String(counts["判断题"] || 0));
    ExamCommon.supportedTypes.forEach(function (type) {
      document.getElementById(typeToInput[type]).value = String(typeToDefault[type]);
    });
    document.getElementById("durationMinutes").value = "60";
    if (!major || !level || !scope.length) {
      document.getElementById("startExamButton").disabled = true;
      document.getElementById("validationBox").innerHTML = "<div>请先从首页选择有题目的专业和等级。</div>";
      document.getElementById("validationBox").classList.add("visible");
    } else {
      validate();
    }
  }

  function startExam() {
    if (!validate()) return;
    var plan = plannedCounts();
    var questions = ExamCommon.buildPaper(major, level, plan);
    var duration = numberValue("durationMinutes");
    var config = {
      id: "exam_" + Date.now(),
      major: major,
      level: level,
      plan: plan,
      durationMinutes: duration,
      createdAt: new Date().toISOString()
    };
    ExamCommon.saveJson("exam_config", config);
    ExamCommon.saveJson("exam_questions", questions.map(function (question) {
      return question.id;
    }));
    ExamCommon.saveJson("exam_answers", {});
    localStorage.setItem("exam_start_time", String(Date.now()));
    localStorage.setItem("exam_duration_minutes", String(duration));
    ExamCommon.saveJson("exam_submitted", false);
    localStorage.removeItem("exam_submitted_at");
    localStorage.setItem("exam_current_index", "0");
    window.location.href = "exam.html";
  }

  function showActivePrompt() {
    if (!ExamCommon.hasActiveExam()) return;
    document.getElementById("activeExamBox").classList.add("visible");
    if (confirm("已有未完成考试。点击“确定”继续上次考试，点击“取消”重新开始考试。")) {
      window.location.href = "exam.html";
    } else {
      ExamCommon.clearProgress();
      document.getElementById("activeExamBox").classList.remove("visible");
    }
  }

  document.getElementById("configForm").addEventListener("input", validate);
  document.getElementById("configForm").addEventListener("submit", function (event) {
    event.preventDefault();
    startExam();
  });
  document.getElementById("continueExamButton").addEventListener("click", function () {
    window.location.href = "exam.html";
  });
  document.getElementById("restartExamButton").addEventListener("click", function () {
    ExamCommon.clearProgress();
    document.getElementById("activeExamBox").classList.remove("visible");
  });
  document.getElementById("clearProgressButton").addEventListener("click", function () {
    if (confirm("确定清空未完成考试进度吗？")) {
      ExamCommon.clearProgress();
      document.getElementById("activeExamBox").classList.remove("visible");
      alert("未完成考试进度已清空。");
    }
  });

  renderSummary();
  showActivePrompt();
})();
