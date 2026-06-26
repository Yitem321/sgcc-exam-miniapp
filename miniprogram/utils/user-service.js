const api = require("./api.js");
const config = require("./config.js");

function getUser() {
  return wx.getStorageSync("userProfile") || null;
}

function isLoggedIn() {
  const user = getUser();
  return Boolean(user && user.openid);
}

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (!result.code) {
          reject(new Error("微信登录失败，未获取到 code"));
          return;
        }
        api.post("/api/auth/wechat-login", { code: result.code }).then((data) => {
          const user = {
            openid: data.openid,
            sessionKeyReady: Boolean(data.sessionKeyReady),
            loggedInAt: Date.now()
          };
          wx.setStorageSync("userProfile", user);
          resolve(user);
        }).catch(reject);
      },
      fail: reject
    });
  });
}

function localStudyPayload() {
  const user = getUser();
  return {
    openid: user && user.openid ? user.openid : "",
    records: wx.getStorageSync("records") || {},
    wrongIds: wx.getStorageSync("wrongIds") || [],
    questionStates: wx.getStorageSync("questionStates") || {},
    answerEvents: wx.getStorageSync("answerEvents") || [],
    favoriteIds: wx.getStorageSync("favoriteIds") || [],
    selectedMajor: wx.getStorageSync("selectedMajor") || "",
    selectedLevel: wx.getStorageSync("selectedLevel") || "",
    updatedAt: Date.now()
  };
}

async function syncStudyRecords() {
  if (!isLoggedIn()) return { skipped: true };
  return api.post("/api/users/me/study-records", localStudyPayload(), { timeout: 12000 });
}

function answeredCount() {
  return Object.keys(wx.getStorageSync("records") || {}).length;
}

function shouldPromptLogin() {
  if (isLoggedIn()) return false;
  if (wx.getStorageSync("loginPromptDismissed")) return false;
  return answeredCount() >= config.LOGIN_PROMPT_ANSWER_COUNT;
}

function markLoginPromptDismissed() {
  wx.setStorageSync("loginPromptDismissed", true);
}

module.exports = {
  answeredCount,
  getUser,
  isLoggedIn,
  localStudyPayload,
  loginWithWechat,
  markLoginPromptDismissed,
  shouldPromptLogin,
  syncStudyRecords
};
