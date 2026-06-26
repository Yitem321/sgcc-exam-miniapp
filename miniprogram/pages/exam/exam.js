const questionService = require("../../utils/question-service.js");
const learningState = require("../../utils/learning-state.js");

function normalizeAnswer(value) {
  const text = Array.isArray(value) ? value.join("") : String(value || "");
  return text.toUpperCase().replace(/[，、；;\s,]/g, "").split("").sort().join("");
}

function countType(pool, type) {
  return pool.filter((item) => item.question_type === type).length;
}

Page({
  data: {
    singleCount: 10,
    multipleCount: 5,
    judgeCount: 5,
    minutes: 30,
    started: false,
    paper: [],
    currentIndex: 0,
    current: null,
    optionList: [],
    isMultiple: false,
    selected: [],
    answers: {},
    navigatorVisible: false,
    navigatorSections: [],
    remainingSeconds: 0,
    timerText: "00:00",
    pool: [],
    availableSingle: 0,
    availableMultiple: 0,
    availableJudge: 0,
    datasetTitle: "",
    loading: true
  },

  async onLoad() {
    learningState.migrateLegacyRecords();
    await this.loadPool();
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  async loadPool() {
    wx.showLoading({ title: "加载题库" });
    try {
      const pool = await questionService.getCurrentQuestions({ limit: 5000 });
      const selection = questionService.currentSelection();
      this.setData({
        pool,
        availableSingle: countType(pool, "单选题"),
        availableMultiple: countType(pool, "多选题"),
        availableJudge: countType(pool, "判断题"),
        datasetTitle: selection.major && selection.level ? selection.major + " / " + selection.level : "",
        loading: false
      }, () => {
        this.setSettingValue("singleCount", this.data.singleCount);
        this.setSettingValue("multipleCount", this.data.multipleCount);
        this.setSettingValue("judgeCount", this.data.judgeCount);
      });
    } finally {
      wx.hideLoading();
    }
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setSettingValue(key, Number(event.detail.value || 0));
  },

  setSettingValue(key, value) {
    const limits = {
      singleCount: { min: 0, max: this.data.availableSingle },
      multipleCount: { min: 0, max: this.data.availableMultiple },
      judgeCount: { min: 0, max: this.data.availableJudge },
      minutes: { min: 1, max: 180 }
    };
    const limit = limits[key] || { min: 0, max: 999 };
    const next = Math.max(limit.min, Math.min(limit.max, Number(value || 0)));
    this.setData({ [key]: next });
  },

  changeSetting(event) {
    const key = event.currentTarget.dataset.key;
    const delta = Number(event.currentTarget.dataset.delta || 0);
    this.setSettingValue(key, Number(this.data[key] || 0) + delta);
  },

  makePaper() {
    const pool = this.data.pool;
    const singles = questionService.shuffle(pool.filter((item) => item.question_type === "单选题")).slice(0, this.data.singleCount);
    const multiples = questionService.shuffle(pool.filter((item) => item.question_type === "多选题")).slice(0, this.data.multipleCount);
    const judges = questionService.shuffle(pool.filter((item) => item.question_type === "判断题")).slice(0, this.data.judgeCount);
    return singles.concat(multiples, judges);
  },

  startExam() {
    const paper = this.makePaper();
    if (!paper.length) {
      wx.showToast({ title: "抽题数量不能全为 0", icon: "none" });
      return;
    }
    this.setData({
      started: true,
      paper,
      currentIndex: 0,
      answers: {},
      remainingSeconds: Math.max(1, this.data.minutes) * 60
    });
    this.loadQuestion(0);
    this.startTimer();
  },

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.updateTimerText();
    this.timer = setInterval(() => {
      const next = this.data.remainingSeconds - 1;
      this.setData({ remainingSeconds: next });
      this.updateTimerText();
      if (next <= 0) this.finishExam();
    }, 1000);
  },

  updateTimerText() {
    const seconds = Math.max(0, this.data.remainingSeconds);
    const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
    const second = String(seconds % 60).padStart(2, "0");
    this.setData({ timerText: minute + ":" + second });
  },

  loadQuestion(index) {
    const current = this.data.paper[index];
    const selected = this.data.answers[current.id] || [];
    const optionList = Object.keys(current.options || {}).map((key) => ({
      key,
      text: current.options[key],
      checked: selected.indexOf(key) !== -1
    }));
    this.setData({
      currentIndex: index,
      current,
      optionList,
      isMultiple: current.question_type === "多选题",
      selected
    }, () => this.refreshNavigator());
  },

  onOptionChange(event) {
    const value = event.detail.value;
    const selected = Array.isArray(value) ? value : [value];
    const answers = Object.assign({}, this.data.answers, {
      [this.data.current.id]: selected
    });
    this.setData({
      selected,
      answers,
      optionList: this.data.optionList.map((item) => Object.assign({}, item, {
        checked: selected.indexOf(item.key) !== -1
      }))
    }, () => this.refreshNavigator());
  },

  onOptionTap(event) {
    const key = event.currentTarget.dataset.key;
    if (!key || !this.data.current) return;
    let selected = this.data.selected.slice();
    if (this.data.isMultiple) {
      selected = selected.indexOf(key) === -1
        ? selected.concat(key)
        : selected.filter((item) => item !== key);
    } else {
      selected = [key];
    }
    const answers = Object.assign({}, this.data.answers, {
      [this.data.current.id]: selected
    });
    this.setData({
      selected,
      answers,
      optionList: this.data.optionList.map((item) => Object.assign({}, item, {
        checked: selected.indexOf(item.key) !== -1
      }))
    }, () => this.refreshNavigator());
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) this.loadQuestion(this.data.currentIndex - 1);
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.paper.length - 1) this.loadQuestion(this.data.currentIndex + 1);
  },

  buildNavigatorSections() {
    const typeOrder = ["单选题", "多选题", "判断题"];
    const orderedTypes = typeOrder.concat(
      this.data.paper
        .map((question) => question.question_type || "题目")
        .filter((type, index, list) => typeOrder.indexOf(type) === -1 && list.indexOf(type) === index)
    );
    return orderedTypes.map((title) => {
      const items = this.data.paper
        .map((question, index) => ({ question, index }))
        .filter((item) => (item.question.question_type || "题目") === title)
        .map((item, localIndex) => {
          const selected = this.data.answers[item.question.id] || [];
          return {
            id: item.question.id,
            index: item.index,
            no: localIndex + 1,
            done: selected.length > 0,
            isCurrent: item.index === this.data.currentIndex
          };
        });
      return {
        title,
        totalCount: items.length,
        doneCount: items.filter((item) => item.done).length,
        items
      };
    }).filter((section) => section.totalCount > 0);
  },

  refreshNavigator() {
    this.setData({ navigatorSections: this.buildNavigatorSections() });
  },

  openQuestionNavigator() {
    this.refreshNavigator();
    this.setData({ navigatorVisible: true });
  },

  closeQuestionNavigator() {
    this.setData({ navigatorVisible: false });
  },

  noop() {},

  jumpToQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ navigatorVisible: false });
    this.loadQuestion(index);
  },

  submitExam() {
    const unanswered = this.data.paper.filter((question) => {
      const selected = this.data.answers[question.id] || [];
      return selected.length === 0;
    }).length;
    if (unanswered > 0) {
      wx.showModal({
        title: "还有未作答题目",
        content: "还有 " + unanswered + " 题未作答，是否仍然提交试卷？",
        cancelText: "返回作答",
        confirmText: "继续提交",
        success: (res) => {
          if (res.confirm) {
            this.finishExam();
          } else {
            this.openQuestionNavigator();
          }
        }
      });
      return;
    }
    wx.showModal({
      title: "确认提交试卷",
      content: "提交后将生成成绩，不能再修改答案。",
      cancelText: "再检查",
      confirmText: "确认提交",
      success: (res) => {
        if (res.confirm) this.finishExam();
      }
    });
  },

  finishExam() {
    if (this.timer) clearInterval(this.timer);
    const records = wx.getStorageSync("records") || {};
    const details = this.data.paper.map((question) => {
      const selected = this.data.answers[question.id] || [];
      const correct = normalizeAnswer(selected) === normalizeAnswer(question.answer);
      learningState.updateQuestionState(question, selected, correct, "exam");
      records[question.id] = {
        selected,
        correct,
        major: question.major,
        level: question.level,
        type: question.question_type,
        answeredAt: Date.now()
      };
      return {
        id: question.id,
        question: question.question,
        type: question.question_type,
        major: question.major,
        level: question.level,
        answer: question.answer,
        selected: selected.join(""),
        correct
      };
    });
    wx.setStorageSync("records", records);
    const correctCount = details.filter((item) => item.correct).length;
    wx.setStorageSync("lastExamResult", {
      total: details.length,
      correct: correctCount,
      score: Math.round((correctCount / details.length) * 100),
      details
    });
    wx.redirectTo({ url: "/pages/result/result" });
  }
});
