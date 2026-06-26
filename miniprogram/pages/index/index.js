const questionService = require("../../utils/question-service.js");
const checkinService = require("../../utils/checkin-service.js");
const learningState = require("../../utils/learning-state.js");
const membership = require("../../utils/membership.js");

const QUESTION_TYPES = questionService.TYPE_NAMES;

function getState() {
  return {
    wrongIds: learningState.getWrongBookIds(),
    favoriteIds: wx.getStorageSync("favoriteIds") || [],
    records: wx.getStorageSync("records") || {}
  };
}

function sortByPinyin(items) {
  return items.slice().sort((a, b) => a.localeCompare(b, "zh-Hans-CN-u-co-pinyin"));
}

Page({
  data: {
    title: "电力考试刷题",
    catalog: null,
    majors: [],
    levels: [],
    major: "",
    level: "",
    majorIndex: 0,
    levelIndex: 0,
    stats: {},
    progressRate: 0,
    datasetTitle: "",
    catalogError: "",
    catalogErrorDetail: "",
    majorSearchVisible: false,
    majorKeyword: "",
    filteredMajors: [],
    streakDays: 0,
    accuracyRate: 0,
    checkin: checkinService.summary(),
    entitlement: membership.getEntitlement(),
    loading: true
  },

  async onLoad() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"]
    });
    await this.loadCatalog();
  },

  async onShow() {
    this.setData({ entitlement: membership.getEntitlement() });
    membership.syncMembershipFromServer().then(() => {
      this.setData({ entitlement: membership.getEntitlement() });
    }).catch(() => {});
    if (this.data.catalog && !this.data.catalogError) {
      await this.syncSelectionFromStorage();
      return;
    }
    if (!this.data.catalogError && this.data.major && this.data.level) await this.refreshStats();
  },

  async loadCatalog() {
    this.setData({ loading: true, catalogError: "", catalogErrorDetail: "" });
    wx.showLoading({ title: "加载中" });
    try {
      const catalog = await questionService.getCatalog();
      const majorItems = catalog.majors || [];
      const majors = sortByPinyin(majorItems.map((item) => item.name));
      const savedMajor = wx.getStorageSync("selectedMajor");
      const majorIndex = Math.max(majors.indexOf(savedMajor), 0);
      const major = majors[majorIndex] || "";
      const levels = this.levelsForMajor(catalog, major);
      const savedLevel = wx.getStorageSync("selectedLevel");
      const levelIndex = Math.max(levels.indexOf(savedLevel), 0);
      const level = levels[levelIndex] || "";
      this.setData({ catalog, majors, filteredMajors: majors, levels, major, level, majorIndex, levelIndex, loading: false });
      questionService.saveSelection(major, level);
      await this.refreshStats();
    } catch (error) {
      console.error("题库目录加载失败", error);
      const detail = error && (error.errMsg || error.message || error.statusCode)
        ? [error.errMsg || error.message, error.statusCode ? ("statusCode=" + error.statusCode) : ""].filter(Boolean).join("，")
        : "";
      this.setData({
        catalog: null,
        majors: [],
        levels: [],
        major: "",
        level: "",
        majorIndex: 0,
        levelIndex: 0,
        stats: {},
        progressRate: 0,
        datasetTitle: "",
        catalogError: "题库目录加载失败，请检查网络后重试",
        catalogErrorDetail: detail,
        majorSearchVisible: false,
        majorKeyword: "",
        filteredMajors: [],
        loading: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  retryCatalog() {
    this.loadCatalog();
  },

  levelsForMajor(catalog, major) {
    const majorItem = (catalog.majors || []).find((item) => item.name === major);
    const levels = majorItem ? majorItem.levels.map((item) => item.name) : [];
    return sortByPinyin(levels);
  },

  async syncSelectionFromStorage() {
    const savedMajor = wx.getStorageSync("selectedMajor") || this.data.major;
    const savedLevel = wx.getStorageSync("selectedLevel") || this.data.level;
    const majorChanged = savedMajor && savedMajor !== this.data.major;
    const levelChanged = savedLevel && savedLevel !== this.data.level;
    if (majorChanged || levelChanged) {
      const major = savedMajor;
      const levels = this.levelsForMajor(this.data.catalog, major);
      const level = levels.indexOf(savedLevel) >= 0 ? savedLevel : (levels[0] || "");
      const majorIndex = Math.max(this.data.majors.indexOf(major), 0);
      const levelIndex = Math.max(levels.indexOf(level), 0);
      this.setData({
        major,
        levels,
        level,
        majorIndex,
        levelIndex,
        filteredMajors: this.data.majors
      });
      if (level !== savedLevel) questionService.saveSelection(major, level);
    }
    if (this.data.major && this.data.level) await this.refreshStats();
  },

  async onMajorChange(event) {
    const majorIndex = Number(event.detail.value);
    const major = this.data.majors[majorIndex];
    await this.applyMajor(major, majorIndex);
  },

  async applyMajor(major, majorIndex) {
    const levels = this.levelsForMajor(this.data.catalog, major);
    const levelIndex = 0;
    const level = levels[levelIndex] || "";
    this.setData({ major, levels, level, majorIndex, levelIndex, majorSearchVisible: false, majorKeyword: "", filteredMajors: this.data.majors });
    questionService.saveSelection(major, level);
    await this.refreshStats();
  },

  openMajorSearch() {
    this.setData({ majorSearchVisible: true, majorKeyword: "", filteredMajors: this.data.majors });
  },

  closeMajorSearch() {
    this.setData({ majorSearchVisible: false, majorKeyword: "", filteredMajors: this.data.majors });
  },

  noop() {},

  onMajorKeywordInput(event) {
    const keyword = String(event.detail.value || "").trim();
    const filteredMajors = keyword
      ? this.data.majors.filter((item) => item.indexOf(keyword) !== -1)
      : this.data.majors;
    this.setData({ majorKeyword: keyword, filteredMajors });
  },

  async selectMajorFromSearch(event) {
    const major = event.currentTarget.dataset.major;
    const majorIndex = this.data.majors.indexOf(major);
    if (majorIndex < 0) return;
    await this.applyMajor(major, majorIndex);
  },

  async onLevelChange(event) {
    const levelIndex = Number(event.detail.value);
    const level = this.data.levels[levelIndex];
    this.setData({ level, levelIndex });
    questionService.saveSelection(this.data.major, level);
    await this.refreshStats();
  },

  async refreshStats() {
    const remoteStats = await questionService.getStats(this.data.major, this.data.level);
    const state = getState();
    const records = state.records || {};
    const doneCount = Object.keys(records).filter((id) => records[id].major === this.data.major && records[id].level === this.data.level).length;
    const wrongQuestions = await questionService.getQuestionsByIds(state.wrongIds);
    const favoriteQuestions = await questionService.getQuestionsByIds(state.favoriteIds);
    const wrongCount = wrongQuestions.filter((item) => item.major === this.data.major && item.level === this.data.level).length;
    const favoriteCount = favoriteQuestions.filter((item) => item.major === this.data.major && item.level === this.data.level).length;
    const total = remoteStats.total || 0;
    const progressRate = total ? Math.round(doneCount / total * 100) : 0;
    const recordItems = Object.keys(records).map((id) => records[id]).filter((item) => item.major === this.data.major && item.level === this.data.level);
    const correctCount = recordItems.filter((item) => item.correct).length;
    const accuracyRate = recordItems.length ? Math.round(correctCount / recordItems.length * 100) : 0;
    const dateSet = recordItems.reduce((result, item) => {
      const date = new Date(item.answeredAt || Date.now());
      result[date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()] = true;
      return result;
    }, {});
    this.setData({
      stats: {
        total,
        single: remoteStats.single || 0,
        multiple: remoteStats.multiple || 0,
        judge: remoteStats.judge || 0,
        done: doneCount,
        wrong: wrongCount,
        favorite: favoriteCount
      },
      progressRate,
      accuracyRate,
      streakDays: Object.keys(dateSet).length,
      checkin: checkinService.summary(),
      entitlement: membership.getEntitlement(),
      datasetTitle: this.data.major + " / " + this.data.level
    });
  },

  goCheckin() {
    wx.navigateTo({ url: "/pages/checkin/checkin" });
  },

  goMajor() {
    wx.navigateTo({ url: "/pages/major/major" });
  },

  goStats() {
    wx.navigateTo({ url: "/pages/stats/stats" });
  },

  goMember() {
    wx.navigateTo({ url: "/pages/member/member" });
  },

  goMine() {
    wx.navigateTo({ url: "/pages/mine/mine" });
  },

  goQuiz() {
    if (!this.data.major || !this.data.level) {
      wx.showToast({ title: "请先加载题库目录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=normal" });
  },

  goTypeQuiz(event) {
    const type = event.currentTarget.dataset.type;
    const typeName = QUESTION_TYPES[type];
    const count = typeName ? this.data.stats[type] : 0;
    if (!typeName || !count) {
      wx.showToast({ title: "当前题库暂无该题型", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=normal&type=" + encodeURIComponent(typeName) });
  },

  goRandom() {
    if (!this.data.major || !this.data.level) {
      wx.showToast({ title: "请先加载题库目录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=random" });
  },

  goExam() {
    if (!this.data.major || !this.data.level) {
      wx.showToast({ title: "请先加载题库目录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/exam/exam" });
  },

  goWrong() {
    wx.navigateTo({ url: "/pages/wrong/wrong" });
  },

  goFavorites() {
    wx.navigateTo({ url: "/pages/favorites/favorites" });
  },

  goInfo(event) {
    const page = event.currentTarget.dataset.page;
    if (page) wx.navigateTo({ url: "/pages/" + page + "/" + page });
  },

  onShareAppMessage() {
    return {
      title: "电力考试刷题，免费练习巩固薄弱题型",
      path: "/pages/index/index"
    };
  },

  onShareTimeline() {
    return {
      title: "电力考试刷题，免费练习巩固薄弱题型",
      query: ""
    };
  }
});
