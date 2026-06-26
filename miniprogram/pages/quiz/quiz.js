const questionService = require("../../utils/question-service.js");
const membership = require("../../utils/membership.js");
const config = require("../../utils/config.js");
const userService = require("../../utils/user-service.js");
const learningState = require("../../utils/learning-state.js");

function normalizeAnswer(value) {
  const text = Array.isArray(value) ? value.join("") : String(value || "");
  return text.toUpperCase().replace(/[，、；;\s,]/g, "").split("").sort().join("");
}

function normalizeExplanationText(text) {
  return String(text || "")
    .replace(/^\s*\[[^\]]+\]\s*/g, "")
    .replace(/^\s*【[^】]+】\s*/g, "");
}

function getArray(key) {
  return wx.getStorageSync(key) || [];
}

function setCollection(key, id, enabled) {
  const items = getArray(key).filter((item) => item !== id);
  if (enabled) items.push(id);
  wx.setStorageSync(key, items);
  return items;
}

Page({
  data: {
    mode: "normal",
    title: "顺序练习",
    questions: [],
    index: 0,
    question: null,
    optionList: [],
    progressPercent: 0,
    isMultiple: false,
    selected: [],
    submitted: false,
    correct: false,
    answerText: "",
    isFavorite: false,
    isWrong: false,
    resultClass: "result-card",
    resultTitle: "",
    explanation: "",
    explaining: false,
    entitlement: membership.getEntitlement(),
    wrongButtonText: "加入错题本",
    favoriteButtonText: "加入收藏",
    navigatorVisible: false,
    navigatorSections: [],
    reviewMap: {},
    loading: true
  },

  async onLoad(query) {
    learningState.migrateLegacyRecords();
    await this.loadQuestions(query || {});
  },

  onShow() {
    this.refreshEntitlement();
    if (userService.isLoggedIn()) {
      membership.syncMembershipFromServer()
        .then(() => this.refreshEntitlement())
        .catch(() => {});
    }
  },

  refreshEntitlement() {
    this.setData({ entitlement: membership.getEntitlement() });
  },

  async loadQuestions(query) {
    wx.showLoading({ title: "加载中" });
    try {
      const mode = query.mode || "normal";
      const typeName = query.type ? decodeURIComponent(query.type) : "";
      let ids = [];
      let title = "顺序练习";
      if (mode === "random") {
        title = "随机练习";
      } else if (mode === "wrong") {
        ids = learningState.getWrongBookIds();
        title = "错题强化";
      } else if (mode === "favorites") {
        ids = getArray("favoriteIds");
        title = "收藏练习";
      } else if (mode === "smartReview") {
        ids = getArray("smartReviewIds");
        title = "错题强化";
      } else if (mode === "examReview") {
        const examResult = wx.getStorageSync("lastExamResult") || {};
        const details = Array.isArray(examResult.details) ? examResult.details : [];
        ids = details.map((item) => item.id).filter(Boolean);
        title = "考试复盘";
        const reviewMap = details.reduce((result, item) => {
          result[item.id] = item;
          return result;
        }, {});
        this.setData({ reviewMap });
      }
      if (typeName) title = typeName + "练习";

      let questions = [];
      if ((mode === "examReview" || mode === "smartReview" || mode === "wrong") && ids.length) {
        const fetched = await questionService.getQuestionsByIds(ids);
        questions = ids
          .map((id) => fetched.find((item) => item.id === id))
          .filter(Boolean);
      } else if (mode === "examReview") {
        questions = [];
      } else if (ids.length) {
        questions = await questionService.getQuestionsByIds(ids);
      } else if (mode === "wrong" || mode === "favorites" || mode === "smartReview") {
        questions = [];
      } else {
        questions = await questionService.getCurrentQuestions({
          type: typeName,
          random: mode === "random",
          limit: 5000
        });
      }

      const startId = query.startId ? decodeURIComponent(query.startId) : "";
      const foundIndex = questions.findIndex((item) => item.id === startId);
      const startIndex = foundIndex >= 0 ? foundIndex : 0;
      this.setData({ mode, title, questions, loading: false });
      this.loadQuestion(startIndex);
    } finally {
      wx.hideLoading();
    }
  },

  loadQuestion(index) {
    const question = this.data.questions[index];
    if (!question) {
      this.setData({ question: null, loading: false });
      return;
    }
    const review = this.data.reviewMap[question.id] || null;
    const reviewSelected = review ? String(review.selected || "").split("").filter(Boolean) : [];
    const optionList = Object.keys(question.options || {}).map((key) => ({
      key,
      text: question.options[key],
      checked: reviewSelected.indexOf(key) !== -1
    }));
    const isFavorite = getArray("favoriteIds").indexOf(question.id) !== -1;
    const isWrong = learningState.getWrongBookIds().indexOf(question.id) !== -1;
    this.setData({
      index,
      question,
      optionList,
      progressPercent: Math.round((index + 1) * 100 / this.data.questions.length),
      isMultiple: question.question_type === "多选题",
      selected: reviewSelected,
      submitted: Boolean(review),
      correct: review ? Boolean(review.correct) : false,
      answerText: review ? question.answer : "",
      isFavorite,
      isWrong,
      resultClass: review ? (review.correct ? "result-card result-right" : "result-card result-wrong") : "result-card",
      resultTitle: review ? (review.correct ? "回答正确" : "回答错误") : "",
      explanation: "",
      explaining: false,
      wrongButtonText: isWrong ? "错题巩固中" : "加入错题本",
      favoriteButtonText: isFavorite ? "取消收藏" : "加入收藏"
    });
    this.refreshEntitlement();
    this.refreshNavigator();
  },

  onOptionTap(event) {
    const key = event.currentTarget.dataset.key;
    if (!key || this.data.submitted) return;
    const currentSelected = this.data.selected || [];
    let selected = [];
    if (this.data.isMultiple) {
      selected = currentSelected.indexOf(key) === -1
        ? currentSelected.concat(key)
        : currentSelected.filter((item) => item !== key);
    } else {
      selected = [key];
    }
    this.setData({
      selected,
      optionList: this.data.optionList.map((item) => Object.assign({}, item, {
        checked: selected.indexOf(item.key) !== -1
      }))
    });
  },

  submitAnswer() {
    const question = this.data.question;
    if (this.data.submitted) {
      this.nextQuestion();
      return;
    }
    if (!question || !this.data.selected.length) {
      wx.showToast({ title: "请先选择答案", icon: "none" });
      return;
    }
    const correct = normalizeAnswer(this.data.selected) === normalizeAnswer(question.answer);
    const state = learningState.updateQuestionState(question, this.data.selected, correct, this.data.mode === "examReview" ? "exam_review" : "quiz");
    const records = wx.getStorageSync("records") || {};
    records[question.id] = {
      selected: this.data.selected,
      correct,
      major: question.major,
      level: question.level,
      type: question.question_type,
      answeredAt: Date.now()
    };
    wx.setStorageSync("records", records);
    if (userService.isLoggedIn()) {
      userService.syncStudyRecords().catch((error) => {
        console.error("学习记录同步失败", error);
      });
    }
    const isWrong = learningState.getWrongBookIds().indexOf(question.id) !== -1;
    this.setData({
      submitted: true,
      correct,
      resultClass: correct ? "result-card result-right" : "result-card result-wrong",
      resultTitle: correct ? "回答正确" : "回答错误",
      answerText: question.answer,
      isWrong,
      wrongButtonText: isWrong ? "错题巩固中" : "加入错题本",
      masteryScore: state ? state.masteryScore : 0
    });
    this.refreshNavigator();
    this.promptLoginForProgress();
  },

  buildNavigatorSections() {
    learningState.migrateLegacyRecords();
    const sections = [];
    const sectionMap = new Map();
    this.data.questions.forEach((question, index) => {
      const title = question.question_type || "题目";
      if (!sectionMap.has(title)) {
        const section = { title, totalCount: 0, doneCount: 0, items: [] };
        sectionMap.set(title, section);
        sections.push(section);
      }
      const section = sectionMap.get(title);
      const state = learningState.getState(question.id);
      const done = Boolean(state.firstAnswerTime);
      const status = state.status || learningState.STATUS.UNSEEN;
      const wrong = status === learningState.STATUS.RECENT_WRONG;
      const reinforce = status === learningState.STATUS.NEED_REINFORCE;
      const mastered = status === learningState.STATUS.MASTERED;
      section.totalCount += 1;
      if (done) section.doneCount += 1;
      section.items.push({
        id: question.id,
        index,
        no: index + 1,
        done,
        wrong,
        reinforce,
        mastered,
        isCurrent: index === this.data.index
      });
    });
    return sections;
  },

  refreshNavigator() {
    this.setData({
      navigatorSections: this.buildNavigatorSections()
    });
  },

  openQuestionNavigator() {
    this.refreshNavigator();
    this.setData({ navigatorVisible: true });
  },

  closeQuestionNavigator() {
    this.setData({ navigatorVisible: false });
  },

  jumpToQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.closeQuestionNavigator();
    this.loadQuestion(index);
  },

  promptLoginForProgress() {
    if (!userService.shouldPromptLogin()) return;
    wx.showModal({
      title: "保存学习记录",
      content: "已完成一定题量，登录后可保存学习记录，之后换设备也能继续。",
      confirmText: "微信一键登录",
      cancelText: "继续刷题",
      success: async (result) => {
        if (!result.confirm) {
          userService.markLoginPromptDismissed();
          return;
        }
        try {
          wx.showLoading({ title: "登录中" });
          await userService.loginWithWechat();
          await userService.syncStudyRecords();
          wx.showToast({ title: "已保存记录", icon: "success" });
        } catch (error) {
          wx.showModal({
            title: "登录暂不可用",
            content: error && error.message ? error.message : "请稍后重试",
            showCancel: false
          });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  nextQuestion() {
    if (this.data.index >= this.data.questions.length - 1) {
      wx.showToast({ title: "已经是最后一题", icon: "none" });
      return;
    }
    this.loadQuestion(this.data.index + 1);
  },

  backHome() {
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  },

  noop() {},

  contactSupport(topic) {
    const actualTopic = topic && topic.currentTarget ? (topic.currentTarget.dataset.topic || "") : (topic || "");
    const title = actualTopic ? actualTopic + "咨询" : "联系客服";
    wx.setClipboardData({
      data: config.SUPPORT_QQ,
      success: () => {
        wx.showModal({
          title: "已复制客服QQ",
          content: "解析和错题强化" + (actualTopic ? "（" + actualTopic + "）" : "") + "可联系 QQ：" + config.SUPPORT_QQ + "。",
          showCancel: false,
          confirmText: "知道了"
        });
      },
      fail: () => {
        wx.showModal({
          title,
          content: "客服 QQ：" + config.SUPPORT_QQ + "。",
          showCancel: false,
          confirmText: "知道了"
        });
      }
    });
  },

  toggleWrong() {
    const question = this.data.question;
    if (!question) return;
    if (this.data.isWrong && !learningState.canRemoveFromWrongBook(question.id)) {
      wx.showToast({ title: "需连续答对 3 次后移出", icon: "none" });
      return;
    }
    if (this.data.isWrong) {
      const ids = learningState.getWrongBookIds().filter((id) => id !== question.id);
      wx.setStorageSync("wrongIds", ids);
      this.setData({
        isWrong: false,
        wrongButtonText: "加入错题本"
      });
      return;
    }
    learningState.forceAddWrong(question);
    this.setData({
      isWrong: true,
      wrongButtonText: "错题巩固中"
    });
    this.refreshNavigator();
  },

  toggleFavorite() {
    const enabled = !this.data.isFavorite;
    setCollection("favoriteIds", this.data.question.id, enabled);
    this.setData({
      isFavorite: enabled,
      favoriteButtonText: enabled ? "取消收藏" : "加入收藏"
    });
  },

  async showExplanation() {
    const question = this.data.question;
    if (!question || this.data.explaining) return;
    if (this.data.explanation) return;

    if (!userService.isLoggedIn()) {
      const confirmed = await new Promise((resolve) => {
        wx.showModal({
          title: "登录后查看解析",
          content: "题目解析需要登录后使用。登录后每位用户可免费调用 3 次 AI 解析。",
          confirmText: "微信登录",
          cancelText: "先不看",
          success: (result) => resolve(Boolean(result.confirm)),
          fail: () => resolve(false)
        });
      });
      if (!confirmed) return;
      try {
        wx.showLoading({ title: "登录中" });
        await userService.loginWithWechat();
        await userService.syncStudyRecords();
        this.refreshEntitlement();
      } catch (error) {
        wx.showModal({
          title: "登录暂不可用",
          content: error && error.message ? error.message : "请稍后重试",
          showCancel: false
        });
        return;
      } finally {
        wx.hideLoading();
      }
    }

    const currentEntitlement = membership.getEntitlement();
    const viewedIds = currentEntitlement.viewedIds || [];
    if (!currentEntitlement.isMember
      && viewedIds.indexOf(question.id) === -1
      && currentEntitlement.trialRemaining > 0
      && !wx.getStorageSync("aiAnalysisTrialIntroShown:" + (userService.getUser().openid || ""))) {
      const confirmed = await new Promise((resolve) => {
        wx.showModal({
          title: "免费体验题目解析",
          content: "本题将调用 AI 生成解析。每位登录用户可免费体验 3 次，当前剩余 " + currentEntitlement.trialRemaining + " 次。",
          confirmText: "体验一次",
          cancelText: "先不看",
          success: (result) => resolve(Boolean(result.confirm)),
          fail: () => resolve(false)
        });
      });
      if (!confirmed) return;
      wx.setStorageSync("aiAnalysisTrialIntroShown:" + (userService.getUser().openid || ""), true);
    }

    const access = membership.consumeAnalysisAccess(question.id);
    if (access.reason === "login_required") {
      this.refreshEntitlement();
      return;
    }
    if (!access.allowed) {
      this.contactSupport("题目解析");
      return;
    }

    this.setData({ explaining: true });
    try {
      const explanation = await questionService.explainQuestion(question);
      this.refreshEntitlement();
      this.setData({
        explanation: normalizeExplanationText(explanation) || "暂无解析"
      });
      if (access.reason === "trial") {
        wx.showToast({
          title: access.trialRemaining > 0 ? "剩余 " + access.trialRemaining + " 次体验" : "体验已用完",
          icon: "none"
        });
      }
    } catch (error) {
      membership.refundAnalysisAccess(access);
      this.refreshEntitlement();
      wx.showToast({ title: "AI 解析暂不可用，次数未扣除", icon: "none" });
    } finally {
      this.setData({ explaining: false });
    }
  },

  openPayPanel() {
    this.contactSupport("题目解析");
  }
});

