const questionService = require("../../utils/question-service.js");

Page({
  data: {
    list: [],
    loading: true
  },

  async onShow() {
    wx.showLoading({ title: "加载收藏" });
    try {
      const ids = wx.getStorageSync("favoriteIds") || [];
      const list = await questionService.getQuestionsByIds(ids);
      this.setData({ list, loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  practice() {
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=favorites" });
  },

  practiceOne(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/quiz/quiz?mode=favorites&startId=" + encodeURIComponent(id) });
  }
});
