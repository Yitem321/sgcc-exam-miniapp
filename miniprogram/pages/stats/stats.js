const learningState = require("../../utils/learning-state.js");

function getRecords() {
  return wx.getStorageSync("records") || {};
}

function percent(part, total) {
  return total ? Math.round(part / total * 100) : 0;
}

Page({
  data: {
    total: 0,
    correct: 0,
    accuracy: 0,
    wrongCount: 0,
    favoriteCount: 0,
    studyDays: 0,
    typeStats: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const records = getRecords();
    const items = Object.keys(records).map((id) => records[id]);
    const total = items.length;
    const correct = items.filter((item) => item.correct).length;
    const wrongCount = learningState.getWrongBookIds().length;
    const favoriteCount = (wx.getStorageSync("favoriteIds") || []).length;
    const dates = {};
    const byType = {};
    items.forEach((item) => {
      const date = new Date(item.answeredAt || Date.now());
      dates[date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()] = true;
      const type = item.type || "未知题型";
      if (!byType[type]) byType[type] = { type, total: 0, correct: 0, rate: 0 };
      byType[type].total += 1;
      if (item.correct) byType[type].correct += 1;
    });
    const typeStats = Object.keys(byType).map((type) => {
      const item = byType[type];
      item.rate = percent(item.correct, item.total);
      return item;
    });
    this.setData({
      total,
      correct,
      accuracy: percent(correct, total),
      wrongCount,
      favoriteCount,
      studyDays: Object.keys(dates).length,
      typeStats
    });
  },

  goWrong() {
    wx.navigateTo({ url: "/pages/wrong/wrong" });
  },

  goQuiz() {
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=normal" });
  }
});
