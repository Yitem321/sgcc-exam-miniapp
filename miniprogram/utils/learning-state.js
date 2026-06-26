const DAY = 24 * 60 * 60 * 1000;
const REVIEW_INTERVALS = [
  10 * 60 * 1000,
  DAY,
  2 * DAY,
  4 * DAY,
  7 * DAY,
  15 * DAY,
  30 * DAY
];

const STATUS = {
  UNSEEN: "unseen",
  RECENT_WRONG: "red",
  NEED_REINFORCE: "yellow",
  MASTERED: "green"
};

function now() {
  return Date.now();
}

function getQuestionStates() {
  return wx.getStorageSync("questionStates") || {};
}

function saveQuestionStates(states) {
  wx.setStorageSync("questionStates", states || {});
}

function getAnswerEvents() {
  return wx.getStorageSync("answerEvents") || [];
}

function saveAnswerEvents(events) {
  wx.setStorageSync("answerEvents", (events || []).slice(-1000));
}

function getDefaultState(questionId) {
  return {
    questionId,
    wrongCount: 0,
    rightCount: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    lastCorrect: null,
    lastSelected: "",
    lastReviewTime: 0,
    nextReviewTime: 0,
    masteryScore: 0,
    status: STATUS.UNSEEN,
    firstWrongTime: 0,
    lastWrongTime: 0,
    firstAnswerTime: 0,
    updatedAt: 0
  };
}

function normalizeSelected(selected) {
  return Array.isArray(selected) ? selected.join("") : String(selected || "");
}

function calculateMasteryScore(state, currentTime) {
  let score = 50;
  score += Math.min((state.rightCount || 0) * 6, 24);
  score += Math.min((state.consecutiveCorrect || 0) * 14, 42);
  score -= Math.min((state.wrongCount || 0) * 10, 40);
  score -= Math.min((state.consecutiveWrong || 0) * 18, 36);

  const daysSinceReview = state.lastReviewTime
    ? (currentTime - state.lastReviewTime) / DAY
    : 999;
  score -= Math.min(daysSinceReview * 2, 20);

  if ((state.consecutiveCorrect || 0) >= 3) score += 10;
  if (state.lastCorrect === false) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateStatus(state) {
  if (!state || !state.firstAnswerTime) return STATUS.UNSEEN;
  if (state.lastCorrect === false || (state.consecutiveWrong || 0) > 0) return STATUS.RECENT_WRONG;
  if ((state.consecutiveCorrect || 0) >= 2) return STATUS.MASTERED;
  if ((state.wrongCount || 0) > 0 && state.lastCorrect === true) return STATUS.NEED_REINFORCE;
  return STATUS.NEED_REINFORCE;
}

function calculateNextReviewTime(state, currentTime) {
  if (state.lastCorrect === false) return currentTime + REVIEW_INTERVALS[0];
  const stage = Math.max(0, Math.min(state.consecutiveCorrect || 0, REVIEW_INTERVALS.length - 1));
  let interval = REVIEW_INTERVALS[stage];
  if ((state.masteryScore || 0) < 40) interval *= 0.6;
  if ((state.masteryScore || 0) >= 80) interval *= 1.3;
  return currentTime + Math.round(interval);
}

function shouldStayInWrongBook(state, currentTime) {
  if (!state || (state.wrongCount || 0) <= 0) return false;
  const enoughCorrect = (state.consecutiveCorrect || 0) >= 3;
  const enoughInterval = state.lastReviewTime && currentTime - state.lastReviewTime >= 7 * DAY;
  return !(enoughCorrect && enoughInterval);
}

function updateWrongIds(states, currentTime) {
  const ids = Object.keys(states || {}).filter((id) => shouldStayInWrongBook(states[id], currentTime));
  wx.setStorageSync("wrongIds", ids);
  return ids;
}

function updateQuestionState(question, selected, correct, source) {
  const currentTime = now();
  const id = question && question.id;
  if (!id) return null;

  const states = getQuestionStates();
  const previous = Object.assign(getDefaultState(id), states[id] || {});
  const selectedText = normalizeSelected(selected);

  if (!previous.firstAnswerTime) previous.firstAnswerTime = currentTime;
  previous.lastSelected = selectedText;
  previous.lastCorrect = Boolean(correct);
  previous.lastReviewTime = currentTime;
  previous.updatedAt = currentTime;

  if (correct) {
    previous.rightCount += 1;
    previous.consecutiveCorrect += 1;
    previous.consecutiveWrong = 0;
  } else {
    previous.wrongCount += 1;
    previous.consecutiveWrong += 1;
    previous.consecutiveCorrect = 0;
    previous.lastWrongTime = currentTime;
    if (!previous.firstWrongTime) previous.firstWrongTime = currentTime;
  }

  previous.masteryScore = calculateMasteryScore(previous, currentTime);
  previous.status = calculateStatus(previous);
  previous.nextReviewTime = calculateNextReviewTime(previous, currentTime);

  states[id] = previous;
  saveQuestionStates(states);

  const events = getAnswerEvents();
  events.push({
    questionId: id,
    selectedAnswer: selectedText,
    correctAnswer: normalizeSelected(question.answer),
    isCorrect: Boolean(correct),
    source: source || "quiz",
    major: question.major,
    level: question.level,
    questionType: question.question_type,
    answeredAt: currentTime
  });
  saveAnswerEvents(events);
  updateWrongIds(states, currentTime);
  return previous;
}

function migrateLegacyRecords() {
  const states = getQuestionStates();
  const records = wx.getStorageSync("records") || {};
  const wrongIds = wx.getStorageSync("wrongIds") || [];
  let changed = false;

  Object.keys(records).concat(wrongIds).forEach((id) => {
    if (!id || states[id]) return;
    const record = records[id] || {};
    const answeredAt = Number(record.answeredAt || now());
    const wasWrong = wrongIds.indexOf(id) !== -1 || record.correct === false;
    const state = getDefaultState(id);
    state.wrongCount = wasWrong ? 1 : 0;
    state.rightCount = record.correct ? 1 : 0;
    state.consecutiveCorrect = record.correct ? 1 : 0;
    state.consecutiveWrong = record.correct === false ? 1 : 0;
    state.lastCorrect = typeof record.correct === "boolean" ? record.correct : false;
    state.lastSelected = normalizeSelected(record.selected);
    state.lastReviewTime = answeredAt;
    state.firstAnswerTime = answeredAt;
    state.firstWrongTime = wasWrong ? answeredAt : 0;
    state.lastWrongTime = wasWrong ? answeredAt : 0;
    state.updatedAt = answeredAt;
    state.masteryScore = calculateMasteryScore(state, now());
    state.status = calculateStatus(state);
    state.nextReviewTime = calculateNextReviewTime(state, answeredAt);
    states[id] = state;
    changed = true;
  });

  if (changed) {
    saveQuestionStates(states);
    updateWrongIds(states, now());
  }
  return states;
}

function getState(questionId) {
  const states = migrateLegacyRecords();
  return states[questionId] || getDefaultState(questionId);
}

function getWrongBookIds() {
  const states = migrateLegacyRecords();
  return updateWrongIds(states, now());
}

function canRemoveFromWrongBook(questionId) {
  return !shouldStayInWrongBook(getState(questionId), now());
}

function forceAddWrong(question) {
  const currentTime = now();
  const id = question && question.id;
  if (!id) return null;
  const states = getQuestionStates();
  const state = Object.assign(getDefaultState(id), states[id] || {});
  state.wrongCount = Math.max(1, state.wrongCount || 0);
  state.consecutiveWrong = Math.max(1, state.consecutiveWrong || 0);
  state.consecutiveCorrect = 0;
  state.lastCorrect = false;
  state.lastReviewTime = currentTime;
  state.lastWrongTime = currentTime;
  state.firstWrongTime = state.firstWrongTime || currentTime;
  state.firstAnswerTime = state.firstAnswerTime || currentTime;
  state.updatedAt = currentTime;
  state.masteryScore = calculateMasteryScore(state, currentTime);
  state.status = calculateStatus(state);
  state.nextReviewTime = calculateNextReviewTime(state, currentTime);
  states[id] = state;
  saveQuestionStates(states);
  updateWrongIds(states, currentTime);
  return state;
}

function buildSmartSummary() {
  const currentTime = now();
  const states = migrateLegacyRecords();
  const items = Object.keys(states).map((id) => states[id]).filter((state) => (state.wrongCount || 0) > 0);
  return {
    dueToday: items.filter((state) => state.nextReviewTime && state.nextReviewTime <= currentTime + DAY).length,
    highRisk: items.filter((state) => state.nextReviewTime && state.nextReviewTime < currentTime && (state.masteryScore || 0) < 60).length,
    almostMastered: items.filter((state) => (state.consecutiveCorrect || 0) >= 2 && (state.consecutiveCorrect || 0) < 3 && (state.masteryScore || 0) >= 70).length,
    totalWrong: getWrongBookIds().length
  };
}

module.exports = {
  STATUS,
  migrateLegacyRecords,
  updateQuestionState,
  getQuestionStates,
  getAnswerEvents,
  getState,
  getWrongBookIds,
  canRemoveFromWrongBook,
  forceAddWrong,
  shouldStayInWrongBook,
  buildSmartSummary
};
