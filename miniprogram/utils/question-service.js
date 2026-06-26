const api = require("./api.js");
const fallbackQuestions = require("../data/questions.js");

const TYPE_NAMES = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题"
};

let catalogCache = null;
const poolCache = {};

function unique(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function normalizeExplanationText(text) {
  return String(text || "")
    .replace(/^\s*\[[^\]]+\]\s*/g, "")
    .replace(/^\s*【[^】]+】\s*/g, "");
}

function shuffle(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }
  return list;
}

function currentSelection() {
  return {
    major: wx.getStorageSync("selectedMajor") || "",
    level: wx.getStorageSync("selectedLevel") || ""
  };
}

function saveSelection(major, level) {
  wx.setStorageSync("selectedMajor", major);
  wx.setStorageSync("selectedLevel", level);
}

function fallbackFilter(params) {
  const major = params.major || "";
  const level = params.level || "";
  const type = params.type || "";
  let items = fallbackQuestions.filter((item) => (
    (!major || item.major === major) &&
    (!level || item.level === level) &&
    (!type || item.question_type === type)
  ));
  if (params.random) items = shuffle(items);
  return items;
}

function statsFor(items) {
  const byType = items.reduce((result, item) => {
    result[item.question_type] = (result[item.question_type] || 0) + 1;
    return result;
  }, {});
  return {
    total: items.length,
    single: byType[TYPE_NAMES.single] || 0,
    multiple: byType[TYPE_NAMES.multiple] || 0,
    judge: byType[TYPE_NAMES.judge] || 0,
    byType
  };
}

function poolKey(params) {
  return [params.major || "", params.level || "", params.type || "", params.random ? "random" : "normal"].join("|");
}

function requestRemoteCatalog() {
  return api.get("/api/catalog", null, { timeout: 20000 }).then((data) => {
    if (data.catalog) return data.catalog;
    throw new Error("题库目录数据缺失");
  });
}

async function getCatalog() {
  if (catalogCache) return catalogCache;
  try {
    const catalog = await requestRemoteCatalog();
    if (!Array.isArray(catalog.majors)) {
      throw new Error("题库目录数据格式错误");
    }
    catalogCache = catalog;
  } catch (error) {
    catalogCache = null;
    throw error;
  }
  return catalogCache;
}

async function getStats(major, level) {
  try {
    const data = await api.get("/api/stats", { major, level });
    return data.stats;
  } catch (error) {
    return statsFor(fallbackFilter({ major, level }));
  }
}

async function getQuestions(params) {
  const nextParams = Object.assign({ limit: 5000 }, params || {});
  const key = poolKey(nextParams);
  if (!nextParams.random && poolCache[key]) return poolCache[key];
  try {
    const data = await api.get("/api/questions", nextParams);
    const questions = data.questions || [];
    if (!nextParams.random) poolCache[key] = questions;
    return questions;
  } catch (error) {
    return fallbackFilter(nextParams);
  }
}

async function getCurrentQuestions(extra) {
  const selection = currentSelection();
  return getQuestions(Object.assign({}, selection, extra || {}));
}

async function getQuestionsByIds(ids) {
  const cleanIds = unique(ids || []);
  if (!cleanIds.length) return [];
  try {
    const data = await api.post("/api/questions/by-ids", { ids: cleanIds });
    return data.questions || [];
  } catch (error) {
    return fallbackQuestions.filter((item) => cleanIds.indexOf(item.id) !== -1);
  }
}

async function explainQuestion(question) {
  const data = await api.post("/api/explain", {
    id: question.id,
    question: question.question,
    options: question.options,
    answer: question.answer,
    questionType: question.question_type,
    major: question.major,
    level: question.level
  }, { timeout: 30000 });
  return normalizeExplanationText(data.explanation || "");
}

module.exports = {
  TYPE_NAMES,
  currentSelection,
  saveSelection,
  getCatalog,
  getStats,
  getQuestions,
  getCurrentQuestions,
  getQuestionsByIds,
  explainQuestion,
  shuffle
};
