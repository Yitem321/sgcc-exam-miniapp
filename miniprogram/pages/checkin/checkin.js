const checkinService = require("../../utils/checkin-service.js");

Page({
  data: {
    summary: checkinService.summary(),
    goalInput: 20,
    goalPresets: [10, 20, 30, 50],
    goalProgress: 0,
    goalRemaining: 20,
    goalLockText: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    days: [],
    weekdays: ["日", "一", "二", "三", "四", "五", "六"]
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const now = new Date();
    const summary = checkinService.summary();
    const target = Number(summary.goal.target || 20);
    const todayDone = Number(summary.todayDone || 0);
    this.setData({
      summary,
      goalInput: target,
      goalProgress: target ? Math.min(100, Math.round(todayDone * 100 / target)) : 0,
      goalRemaining: Math.max(target - todayDone, 0),
      goalLockText: summary.goal.canEdit ? "今天保存后，明天可以再次调整" : "今日目标已锁定，明天可修改",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      days: checkinService.monthCalendar(now.getFullYear(), now.getMonth() + 1)
    });
  },

  onGoalInput(event) {
    this.setData({ goalInput: Number(event.detail.value || 0) });
  },

  selectGoalPreset(event) {
    if (!this.data.summary.goal.canEdit) {
      wx.showToast({ title: "明天可修改目标", icon: "none" });
      return;
    }
    this.setData({ goalInput: Number(event.currentTarget.dataset.value || 20) });
  },

  saveGoal() {
    const result = checkinService.setGoal(this.data.goalInput);
    if (!result.success) {
      wx.showToast({ title: result.message, icon: "none" });
      return;
    }
    wx.showToast({ title: "目标已设置", icon: "success" });
    this.refresh();
  },

  checkIn() {
    const result = checkinService.checkInToday();
    wx.showToast({ title: result.message, icon: result.success ? "success" : "none" });
    this.refresh();
  }
});
