const questionService = require("../../utils/question-service.js");

function sortByPinyin(items) {
  return items.slice().sort((a, b) => a.localeCompare(b, "zh-Hans-CN-u-co-pinyin"));
}

Page({
  data: {
    catalog: null,
    majors: [],
    filteredMajors: [],
    keyword: "",
    currentMajor: "",
    currentLevel: "",
    levels: [],
    levelIndex: 0,
    loading: true
  },

  async onLoad() {
    await this.loadCatalog();
  },

  async loadCatalog() {
    wx.showLoading({ title: "加载专业" });
    try {
      const catalog = await questionService.getCatalog();
      const majors = sortByPinyin((catalog.majors || []).map((item) => item.name));
      const selection = questionService.currentSelection();
      const currentMajor = selection.major || majors[0] || "";
      const levels = this.levelsForMajor(catalog, currentMajor);
      const currentLevel = selection.level || levels[0] || "";
      this.setData({
        catalog,
        majors,
        filteredMajors: majors,
        currentMajor,
        currentLevel,
        levels,
        levelIndex: Math.max(levels.indexOf(currentLevel), 0),
        loading: false
      });
    } catch (error) {
      wx.showToast({ title: "专业加载失败", icon: "none" });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  levelsForMajor(catalog, major) {
    const majorItem = (catalog.majors || []).find((item) => item.name === major);
    return sortByPinyin(majorItem ? majorItem.levels.map((item) => item.name) : []);
  },

  onKeywordInput(event) {
    const keyword = String(event.detail.value || "").trim();
    const filteredMajors = keyword ? this.data.majors.filter((item) => item.indexOf(keyword) !== -1) : this.data.majors;
    this.setData({ keyword, filteredMajors });
  },

  selectMajor(event) {
    const major = event.currentTarget.dataset.major;
    const levels = this.levelsForMajor(this.data.catalog, major);
    this.setData({
      currentMajor: major,
      levels,
      currentLevel: levels[0] || "",
      levelIndex: 0
    });
  },

  onLevelChange(event) {
    const levelIndex = Number(event.detail.value);
    this.setData({
      levelIndex,
      currentLevel: this.data.levels[levelIndex] || ""
    });
  },

  confirmSelection() {
    if (!this.data.currentMajor || !this.data.currentLevel) {
      wx.showToast({ title: "请选择专业和等级", icon: "none" });
      return;
    }
    questionService.saveSelection(this.data.currentMajor, this.data.currentLevel);
    wx.showToast({ title: "已切换题库", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
