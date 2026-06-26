const questionService = require("../../utils/question-service.js");
const learningState = require("../../utils/learning-state.js");
const membership = require("../../utils/membership.js");

Page({
  data: {
    allList: [],
    list: [],
    activeFilter: "all",
    filters: [
      { key: "all", label: "全部错题" },
      { key: "due", label: "今日待复习" },
      { key: "risk", label: "高风险遗忘" },
      { key: "almost", label: "即将掌握" }
    ],
    summary: {
      dueToday: 0,
      highRisk: 0,
      almostMastered: 0,
      totalWrong: 0
    },
    entitlement: membership.getEntitlement(),
    loading: true
  },

  async onShow() {
    wx.showLoading({ title: "加载错题" });
    try {
      const ids = learningState.getWrongBookIds();
      const states = learningState.getQuestionStates();
      const questions = await questionService.getQuestionsByIds(ids);
      const list = ids.map((id) => {
        const question = questions.find((item) => item.id === id);
        const state = states[id] || {};
        if (!question) return null;
        return Object.assign({}, question, {
          state,
          statusText: this.statusText(state.status),
          statusClass: "status-" + (state.status || "unseen"),
          masteryScore: state.masteryScore || 0,
          wrongCount: state.wrongCount || 0,
          consecutiveCorrect: state.consecutiveCorrect || 0
        });
      }).filter(Boolean);
      this.setData({
        allList: list,
        list,
        summary: learningState.buildSmartSummary(),
        entitlement: membership.getEntitlement(),
        loading: false
      }, () => this.applyFilter());
    } finally {
      wx.hideLoading();
    }
  },

  statusText(status) {
    if (status === "red") return "最近答错";
    if (status === "yellow") return "待巩固";
    if (status === "green") return "已掌握";
    return "未做";
  },

  practice() {
    const ids = this.data.list.map((item) => item.id);
    if (!ids.length) {
      wx.showToast({ title: "暂无可复习题目", icon: "none" });
      return;
    }
    wx.setStorageSync("smartReviewIds", ids);
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=smartReview" });
  },

  practiceOne(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=wrong&startId=" + encodeURIComponent(id) });
  },

  showReviewHelp() {
    wx.showModal({
      title: "复习分类说明",
      content: "系统参考艾宾浩斯遗忘曲线，并结合答错次数、连续答对次数、上次复习时间和掌握度来安排复习。\n\n今日待复习：已到建议复习时间，适合今天巩固。\n高风险遗忘：超过复习时间且掌握度偏低，容易再次答错。\n即将掌握：连续答对、掌握度较高，再巩固一次更容易稳定掌握。",
      showCancel: false,
      confirmText: "知道了"
    });
  },

  selectFilter(event) {
    const filter = event.currentTarget.dataset.filter || "all";
    this.setData({ activeFilter: filter }, () => this.applyFilter());
  },

  applyFilter() {
    const currentTime = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const list = this.data.allList.filter((item) => {
      const state = item.state || {};
      if (this.data.activeFilter === "due") return state.nextReviewTime && state.nextReviewTime <= currentTime + day;
      if (this.data.activeFilter === "risk") return state.nextReviewTime && state.nextReviewTime < currentTime && (state.masteryScore || 0) < 60;
      if (this.data.activeFilter === "almost") return (state.consecutiveCorrect || 0) >= 2 && (state.consecutiveCorrect || 0) < 3 && (state.masteryScore || 0) >= 70;
      return true;
    });
    this.setData({ list });
  }
});
