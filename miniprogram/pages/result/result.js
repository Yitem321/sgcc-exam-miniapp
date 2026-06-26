Page({
  data: {
    result: null
  },

  onLoad() {
    const result = wx.getStorageSync("lastExamResult") || null;
    if (result && Array.isArray(result.details)) {
      result.details = result.details.map((item) => Object.assign({}, item, {
        statusText: item.correct ? "正确" : "错误",
        statusClass: item.correct ? "right" : "wrong"
      }));
    }
    this.setData({ result });
  },

  backHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  goReviewQuestion(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: "/pages/quiz/quiz?mode=examReview&startId=" + encodeURIComponent(id)
    });
  }
});
