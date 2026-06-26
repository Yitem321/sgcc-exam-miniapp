(function () {
  var STORAGE_KEY = "sgccExamMiniappWebState";
  var emptyState = {
    records: {},
    favorites: [],
    wrongBook: [],
    doneIds: [],
    correctIds: [],
    incorrectIds: [],
    favoriteIds: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(emptyState);
      var parsed = JSON.parse(raw);
      return ensureState(parsed);
    } catch (error) {
      return clone(emptyState);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureState(state)));
  }

  function normalizeRecords(records) {
    Object.keys(records).forEach(function (id) {
      var record = records[id] || {};
      record.questionId = record.questionId || id;
      record.selected = Array.isArray(record.selected) ? record.selected : [];
      record.answerCount = Number(record.answerCount || 0);
      record.wrongCount = Number(record.wrongCount || (record.correct === false ? 1 : 0));
      records[id] = record;
    });
    return records;
  }

  function unique(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function ensureState(parsed) {
    var records = normalizeRecords(parsed.records || {});
    var doneIds = unique(parsed.doneIds || Object.keys(records));
    var correctIds = unique(parsed.correctIds || Object.keys(records).filter(function (id) {
      return records[id].correct;
    }));
    var incorrectIds = unique(parsed.incorrectIds || Object.keys(records).filter(function (id) {
      return records[id].correct === false;
    }));
    var favorites = unique(Array.isArray(parsed.favorites) ? parsed.favorites : parsed.favoriteIds);
    var wrongBook = unique(Array.isArray(parsed.wrongBook) ? parsed.wrongBook : []);
    return {
      records: records,
      favorites: favorites,
      wrongBook: wrongBook,
      doneIds: doneIds,
      correctIds: correctIds,
      incorrectIds: incorrectIds,
      favoriteIds: favorites.slice()
    };
  }

  function normalizeAnswer(answer) {
    var value = Array.isArray(answer) ? answer.join("") : String(answer || "");
    return value
      .toUpperCase()
      .replace(/[，、；;\s]/g, ",")
      .split(",")
      .join("")
      .split("")
      .filter(function (item) {
        return /[A-Z0-9]/.test(item);
      })
      .sort()
      .join("");
  }

  function isCorrect(question, selected) {
    return normalizeAnswer(question.answer) === normalizeAnswer(selected);
  }

  function setMembership(list, id, enabled) {
    var next = list.filter(function (item) {
      return item !== id;
    });
    if (enabled) next.push(id);
    return next;
  }

  window.ExamStore = {
    load: loadState,
    save: saveState,
    isCorrect: isCorrect,
    normalizeAnswer: normalizeAnswer,
    recordAnswer: function (question, selected) {
      var state = loadState();
      var correct = isCorrect(question, selected);
      var previous = state.records[question.id] || {};
      state.records[question.id] = {
        questionId: question.id,
        selected: Array.isArray(selected) ? selected : [selected],
        correct: correct,
        answeredAt: new Date().toISOString(),
        answerCount: Number(previous.answerCount || 0) + 1,
        wrongCount: Number(previous.wrongCount || 0) + (correct ? 0 : 1)
      };
      state.doneIds = setMembership(state.doneIds, question.id, true);
      state.correctIds = setMembership(state.correctIds, question.id, correct);
      state.incorrectIds = setMembership(state.incorrectIds, question.id, !correct);
      if (!correct) {
        state.wrongBook = setMembership(state.wrongBook, question.id, true);
      }
      saveState(state);
      return correct;
    },
    toggleFavorite: function (questionId) {
      var state = loadState();
      var enabled = state.favorites.indexOf(questionId) === -1;
      state.favorites = setMembership(state.favorites, questionId, enabled);
      state.favoriteIds = state.favorites.slice();
      saveState(state);
      return enabled;
    },
    toggleWrong: function (questionId) {
      var state = loadState();
      var enabled = state.wrongBook.indexOf(questionId) === -1;
      state.wrongBook = setMembership(state.wrongBook, questionId, enabled);
      saveState(state);
      return enabled;
    },
    setWrong: function (questionId, enabled) {
      var state = loadState();
      state.wrongBook = setMembership(state.wrongBook, questionId, enabled);
      saveState(state);
      return enabled;
    },
    hasFavorite: function (questionId) {
      return loadState().favorites.indexOf(questionId) !== -1;
    },
    hasWrong: function (questionId) {
      return loadState().wrongBook.indexOf(questionId) !== -1;
    },
    reset: function () {
      saveState(clone(emptyState));
    }
  };

  window.AnalysisAccess = {
    freeLimit: 5,
    isVip: function () {
      return localStorage.getItem("is_vip") === "true";
    },
    setVip: function (enabled) {
      localStorage.setItem("is_vip", enabled ? "true" : "false");
    },
    viewedIds: function () {
      try {
        return unique(JSON.parse(localStorage.getItem("analysis_viewed_question_ids") || "[]"));
      } catch (error) {
        return [];
      }
    },
    usedCount: function () {
      return Number(localStorage.getItem("analysis_free_used_count") || this.viewedIds().length || 0);
    },
    remaining: function () {
      return this.isVip() ? Infinity : Math.max(0, this.freeLimit - this.usedCount());
    },
    canView: function (questionId) {
      return this.isVip() || this.viewedIds().indexOf(questionId) !== -1 || this.remaining() > 0;
    },
    markViewed: function (questionId) {
      if (!questionId || this.isVip()) return;
      var ids = this.viewedIds();
      if (ids.indexOf(questionId) !== -1) return;
      ids.push(questionId);
      localStorage.setItem("analysis_viewed_question_ids", JSON.stringify(ids));
      localStorage.setItem("analysis_free_used_count", String(ids.length));
    },
    reset: function () {
      localStorage.removeItem("analysis_free_used_count");
      localStorage.removeItem("analysis_viewed_question_ids");
      localStorage.removeItem("is_vip");
    }
  };
})();
