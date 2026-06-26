const userService = require("../../utils/user-service.js");
const membership = require("../../utils/membership.js");
const learningState = require("../../utils/learning-state.js");

Page({
  data: {
    user: null,
    isLoggedIn: false,
    syncing: false,
    total: 0,
    wrongCount: 0,
    favoriteCount: 0,
    entitlement: membership.getEntitlement()
  },

  onShow() {
    this.refresh();
    if (userService.isLoggedIn()) {
      membership.syncMembershipFromServer().then(() => {
        this.refresh();
      }).catch(() => {});
    }
  },

  refresh() {
    const records = wx.getStorageSync("records") || {};
    this.setData({
      user: userService.getUser(),
      isLoggedIn: userService.isLoggedIn(),
      total: Object.keys(records).length,
      wrongCount: learningState.getWrongBookIds().length,
      favoriteCount: (wx.getStorageSync("favoriteIds") || []).length,
      entitlement: membership.getEntitlement()
    });
  },

  async login() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    try {
      wx.showLoading({ title: "登录中" });
      await userService.loginWithWechat();
      await userService.syncStudyRecords();
      this.refresh();
      wx.showToast({ title: "已保存记录", icon: "success" });
    } catch (error) {
      wx.showModal({
        title: "登录暂不可用",
        content: error && error.message ? error.message : "请稍后重试",
        showCancel: false
      });
    } finally {
      wx.hideLoading();
      this.setData({ syncing: false });
    }
  },

  async sync() {
    if (!userService.isLoggedIn()) {
      this.login();
      return;
    }
    this.setData({ syncing: true });
    try {
      await userService.syncStudyRecords();
      wx.showToast({ title: "同步完成", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "同步失败", icon: "none" });
    } finally {
      this.setData({ syncing: false });
    }
  },

  goInfo(event) {
    const page = event.currentTarget.dataset.page;
    if (page) wx.navigateTo({ url: "/pages/" + page + "/" + page });
  }
});
