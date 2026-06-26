const userService = require("./user-service.js");

const TRIAL_TOTAL_COUNT = 3;

function userSuffix() {
  const user = userService.getUser();
  return user && user.openid ? user.openid : "guest";
}

function scopedKey(key) {
  return key + ":" + userSuffix();
}

function getArray(key) {
  return wx.getStorageSync(scopedKey(key)) || [];
}

function setArray(key, value) {
  wx.setStorageSync(scopedKey(key), Array.from(new Set((value || []).filter(Boolean))));
}

function getMembership() {
  return null;
}

function isMember() {
  return false;
}

function getEntitlement() {
  const loggedIn = userService.isLoggedIn();
  const viewedIds = loggedIn ? getArray("aiAnalysisViewedIds") : [];
  const trialUsedIds = loggedIn ? getArray("aiAnalysisTrialUsedIds") : [];
  const trialRemaining = loggedIn ? Math.max(TRIAL_TOTAL_COUNT - trialUsedIds.length, 0) : 0;
  return {
    membership: null,
    isMember: false,
    loggedIn,
    viewedIds,
    viewedCount: viewedIds.length,
    trialTotal: TRIAL_TOTAL_COUNT,
    trialUsedCount: trialUsedIds.length,
    trialRemaining,
    trialBadge: loggedIn ? ("免费体验 " + trialRemaining + " 次") : "登录后体验 3 次",
    adRewardRemaining: 0,
    memberLabel: "题目解析",
    memberSubtitle: loggedIn
      ? (trialRemaining > 0
        ? "可免费体验 " + trialRemaining + " 次题目解析"
        : "免费体验已用完，如需继续查看解析请联系客服。")
      : "登录后可免费体验 3 次题目解析",
    expiresText: ""
  };
}

function consumeAnalysisAccess(questionId) {
  if (!userService.isLoggedIn()) return { allowed: false, reason: "login_required" };
  if (!questionId) return { allowed: false, reason: "missing_question" };

  const viewedIds = getArray("aiAnalysisViewedIds");
  if (viewedIds.indexOf(questionId) !== -1) {
    return { allowed: true, reason: "already_viewed" };
  }

  const trialUsedIds = getArray("aiAnalysisTrialUsedIds");
  if (trialUsedIds.length < TRIAL_TOTAL_COUNT) {
    viewedIds.push(questionId);
    trialUsedIds.push(questionId);
    setArray("aiAnalysisViewedIds", viewedIds);
    setArray("aiAnalysisTrialUsedIds", trialUsedIds);
    return {
      allowed: true,
      reason: "trial",
      questionId,
      trialRemaining: Math.max(TRIAL_TOTAL_COUNT - trialUsedIds.length, 0)
    };
  }

  return { allowed: false, reason: "locked" };
}

function refundAnalysisAccess(access) {
  if (!access || !access.questionId || access.reason !== "trial") return;
  setArray("aiAnalysisViewedIds", getArray("aiAnalysisViewedIds").filter((id) => id !== access.questionId));
  setArray("aiAnalysisTrialUsedIds", getArray("aiAnalysisTrialUsedIds").filter((id) => id !== access.questionId));
}

function clearMembership() {
  wx.removeStorageSync("aiAnalysisMembership");
  wx.removeStorageSync("membership");
}

function noopMembership() {
  return null;
}

module.exports = {
  AD_REWARD_COUNT: 0,
  AI_ANALYSIS_PLAN: null,
  AI_ANALYSIS_PLANS: [],
  TRIAL_TOTAL_COUNT,
  activatePlan: noopMembership,
  applyServerMembership: noopMembership,
  addAdReward: () => 0,
  consumeAnalysisAccess,
  clearMembership,
  refundAnalysisAccess,
  getEntitlement,
  getMembership,
  isMember,
  saveMembership: noopMembership,
  syncMembershipFromServer: async () => null
};
