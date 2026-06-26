const DEFAULT_API_BASE_URL = "https://api.synexa.cc";
const REWARDED_VIDEO_AD_UNIT_ID = "";
const LOGIN_PROMPT_ANSWER_COUNT = 20;
const SUPPORT_QQ = "1697962351";
const SUPPORT_QQ_LABEL = "客服QQ";

function apiBaseUrl() {
  return (wx.getStorageSync("apiBaseUrl") || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

module.exports = {
  DEFAULT_API_BASE_URL,
  LOGIN_PROMPT_ANSWER_COUNT,
  SUPPORT_QQ,
  SUPPORT_QQ_LABEL,
  REWARDED_VIDEO_AD_UNIT_ID,
  apiBaseUrl
};
