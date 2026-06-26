(function () {
  var supportedTypes = ["单选题", "多选题", "判断题"];
  var progressKeys = [
    "exam_config",
    "exam_questions",
    "exam_answers",
    "exam_start_time",
    "exam_duration_minutes",
    "exam_submitted",
    "exam_current_index",
    "exam_submitted_at"
  ];
  var recordsKey = "exam_records";

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function questions() {
    return (window.QUESTIONS || []).filter(function (item) {
      return supportedTypes.indexOf(item.question_type) !== -1;
    });
  }

  function questionMap() {
    return questions().reduce(function (map, question) {
      map[question.id] = question;
      return map;
    }, {});
  }

  function scopedQuestions(major, level) {
    return questions().filter(function (question) {
      return question.major === major && question.level === level;
    });
  }

  function countByType(items) {
    return supportedTypes.reduce(function (counts, type) {
      counts[type] = items.filter(function (question) {
        return question.question_type === type;
      }).length;
      return counts;
    }, {});
  }

  function shuffle(items) {
    var next = items.slice();
    for (var index = next.length - 1; index > 0; index -= 1) {
      var randomIndex = Math.floor(Math.random() * (index + 1));
      var temp = next[index];
      next[index] = next[randomIndex];
      next[randomIndex] = temp;
    }
    return next;
  }

  function takeRandom(items, count) {
    return shuffle(items).slice(0, count);
  }

  function typeOrder(question) {
    var index = supportedTypes.indexOf(question.question_type);
    return index === -1 ? 999 : index;
  }

  function sortByTypeOrder(items) {
    return items.slice().sort(function (a, b) {
      return typeOrder(a) - typeOrder(b);
    });
  }

  function buildPaper(major, level, plan) {
    var scope = scopedQuestions(major, level);
    var selected = [];
    supportedTypes.forEach(function (type) {
      selected = selected.concat(takeRandom(scope.filter(function (question) {
        return question.question_type === type;
      }), Number(plan[type] || 0)));
    });
    return sortByTypeOrder(selected);
  }

  function clearProgress() {
    progressKeys.forEach(function (key) {
      localStorage.removeItem(key);
    });
  }

  function hasActiveExam() {
    var submitted = loadJson("exam_submitted", false);
    return !submitted && Boolean(localStorage.getItem("exam_config")) && Boolean(localStorage.getItem("exam_questions")) && Boolean(localStorage.getItem("exam_start_time"));
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

  function answerText(answer) {
    var normalized = ExamStore.normalizeAnswer(answer);
    return normalized ? normalized.split("").join("、") : "未作答";
  }

  function percent(total, count) {
    return total ? Math.round(count / total * 100) + "%" : "0%";
  }

  function formatDuration(totalSeconds) {
    var seconds = Math.max(0, Math.floor(totalSeconds || 0));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return minutes + "分" + String(rest).padStart(2, "0") + "秒";
  }

  function loadRecords() {
    return loadJson(recordsKey, []);
  }

  function saveRecord(record) {
    var records = loadRecords();
    var exists = records.some(function (item) {
      return item.id === record.id;
    });
    if (!exists) {
      records.unshift(record);
      saveJson(recordsKey, records);
    }
  }

  function calculateResult() {
    var config = loadJson("exam_config", null);
    var ids = loadJson("exam_questions", []);
    var answers = loadJson("exam_answers", {});
    var map = questionMap();
    var items = ids.map(function (id) {
      return map[id];
    }).filter(Boolean);
    var startTime = Number(localStorage.getItem("exam_start_time") || 0);
    var submittedAt = Number(localStorage.getItem("exam_submitted_at") || Date.now());
    var usedSeconds = startTime ? Math.max(0, Math.floor((submittedAt - startTime) / 1000)) : 0;
    var detail = items.map(function (question) {
      var selected = answers[question.id] || [];
      var answered = selected.length > 0;
      var correct = answered && ExamStore.isCorrect(question, selected);
      return {
        question: question,
        selected: selected,
        answered: answered,
        correct: correct
      };
    });
    var correctCount = detail.filter(function (item) {
      return item.correct;
    }).length;
    var unansweredCount = detail.filter(function (item) {
      return !item.answered;
    }).length;
    var wrongCount = detail.length - correctCount - unansweredCount;
    return {
      config: config,
      detail: detail,
      startTime: startTime,
      submittedAt: submittedAt,
      usedSeconds: usedSeconds,
      total: detail.length,
      correctCount: correctCount,
      wrongCount: wrongCount,
      unansweredCount: unansweredCount
    };
  }

  window.ExamCommon = {
    supportedTypes: supportedTypes,
    progressKeys: progressKeys,
    loadJson: loadJson,
    saveJson: saveJson,
    questions: questions,
    questionMap: questionMap,
    scopedQuestions: scopedQuestions,
    countByType: countByType,
    buildPaper: buildPaper,
    sortByTypeOrder: sortByTypeOrder,
    clearProgress: clearProgress,
    hasActiveExam: hasActiveExam,
    getOptionEntries: getOptionEntries,
    answerType: answerType,
    answerText: answerText,
    percent: percent,
    formatDuration: formatDuration,
    loadRecords: loadRecords,
    saveRecord: saveRecord,
    calculateResult: calculateResult
  };
})();
