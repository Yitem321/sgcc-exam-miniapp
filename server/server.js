const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const OpenAI = require("openai");
const wechatPay = require("./wechat-pay.js");

require("dotenv").config();
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.SERVER_PORT || 3001);
const cachePath = path.join(__dirname, "..", "data", "ai_explanations.json");
const questionsPath = path.join(__dirname, "..", "data", "parsed", "questions.json");
const userProfilesPath = path.join(__dirname, "..", "data", "user_profiles.json");
const userRecordsPath = path.join(__dirname, "..", "data", "user_study_records.json");
const paymentOrdersPath = path.join(__dirname, "..", "data", "wechatpay_orders.json");
const aiAnalysisMembershipsPath = path.join(__dirname, "..", "data", "ai_analysis_memberships.json");
const runtimeStats = {
  cacheHits: 0,
  deepseekCalls: 0,
  openaiCalls: 0,
  mockCalls: 0
};
const aiAnalysisPlans = {
  ai_analysis_7d: {
    id: "ai_analysis_7d",
    name: "7天 VIP",
    days: 7,
    price: "3.5",
    originalPrice: "4",
    saving: "立省 0.5 元",
    amountFen: 350
  },
  ai_analysis_30d: {
    id: "ai_analysis_30d",
    name: "1个月 VIP",
    days: 30,
    price: "8",
    originalPrice: "12",
    saving: "立省 4 元",
    amountFen: 800
  },
  ai_analysis_90d: {
    id: "ai_analysis_90d",
    name: "3个月 VIP",
    days: 90,
    price: "20",
    originalPrice: "36",
    saving: "立省 16 元",
    amountFen: 2000
  },
  ai_analysis_365d: {
    id: "ai_analysis_365d",
    name: "12个月 VIP",
    days: 365,
    price: "68",
    originalPrice: "144",
    saving: "立省 76 元",
    amountFen: 6800
  }
};

app.use(cors());
app.use(express.json({
  limit: "1mb",
  verify(req, res, buffer) {
    req.rawBody = buffer ? buffer.toString("utf8") : "";
  }
}));

console.log("DeepSeek Key loaded:", !!process.env.DEEPSEEK_API_KEY);

let questionBankCache = null;
let questionIndexCache = null;
let catalogCache = null;

function normalizeQuestion(item) {
  return {
    id: normalizeText(item.id),
    major: normalizeText(item.major),
    level: normalizeText(item.level),
    question_type: normalizeText(item.question_type),
    question: normalizeText(item.question),
    options: item.options && typeof item.options === "object" ? item.options : {},
    answer: normalizeText(item.answer)
  };
}

function readQuestionBank() {
  if (questionBankCache) return questionBankCache;
  const raw = fs.readFileSync(questionsPath, "utf8");
  questionBankCache = JSON.parse(raw).map(normalizeQuestion).filter((item) => (
    item.id && item.major && item.level && item.question_type && item.question
  ));
  questionIndexCache = new Map(questionBankCache.map((item) => [item.id, item]));
  return questionBankCache;
}

function questionIndex() {
  if (!questionIndexCache) readQuestionBank();
  return questionIndexCache;
}

function sortZh(items) {
  return items.slice().sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function buildCatalog() {
  if (catalogCache) return catalogCache;
  const majorMap = new Map();
  for (const item of readQuestionBank()) {
    if (!majorMap.has(item.major)) majorMap.set(item.major, new Map());
    const levelMap = majorMap.get(item.major);
    levelMap.set(item.level, (levelMap.get(item.level) || 0) + 1);
  }
  const majors = sortZh(Array.from(majorMap.keys())).map((major) => {
    const levelMap = majorMap.get(major);
    return {
      name: major,
      total: Array.from(levelMap.values()).reduce((sum, count) => sum + count, 0),
      levels: sortZh(Array.from(levelMap.keys())).map((level) => ({
        name: level,
        total: levelMap.get(level)
      }))
    };
  });
  catalogCache = {
    total: readQuestionBank().length,
    majors
  };
  return catalogCache;
}

function filterQuestions(query) {
  const major = normalizeText(query.major);
  const level = normalizeText(query.level);
  const type = normalizeText(query.type);
  return readQuestionBank().filter((item) => (
    (!major || item.major === major) &&
    (!level || item.level === level) &&
    (!type || item.question_type === type)
  ));
}

function statsFor(items) {
  const byType = items.reduce((result, item) => {
    result[item.question_type] = (result[item.question_type] || 0) + 1;
    return result;
  }, {});
  return {
    total: items.length,
    single: byType["单选题"] || 0,
    multiple: byType["多选题"] || 0,
    judge: byType["判断题"] || 0,
    byType
  };
}

function shuffleItems(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }
  return list;
}

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "sgcc-exam-server",
    questionTotal: readQuestionBank().length
  });
});

app.get("/api/catalog", (req, res) => {
  res.json({
    success: true,
    catalog: buildCatalog()
  });
});

app.get("/api/stats", (req, res) => {
  const items = filterQuestions(req.query || {});
  res.json({
    success: true,
    stats: statsFor(items)
  });
});

app.get("/api/questions", (req, res) => {
  const query = req.query || {};
  const limit = Math.max(1, Math.min(5000, Number(query.limit || 100)));
  const offset = Math.max(0, Number(query.offset || 0));
  const random = query.random === "1" || query.random === "true";
  const items = random ? shuffleItems(filterQuestions(query)) : filterQuestions(query);
  res.json({
    success: true,
    total: items.length,
    offset,
    limit,
    questions: items.slice(offset, offset + limit)
  });
});

app.post("/api/questions/by-ids", (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(normalizeText).filter(Boolean) : [];
  const index = questionIndex();
  res.json({
    success: true,
    questions: ids.map((id) => index.get(id)).filter(Boolean)
  });
});

app.get("/api/questions/:id", (req, res) => {
  const question = questionIndex().get(normalizeText(req.params.id));
  if (!question) {
    res.status(404).json({ success: false, message: "Question not found" });
    return;
  }
  res.json({ success: true, question });
});

app.post("/api/auth/wechat-login", async (req, res) => {
  const code = normalizeText(req.body && req.body.code);
  if (!code) {
    res.status(400).json({ success: false, message: "缺少微信登录 code" });
    return;
  }
  try {
    const session = await fetchWechatSession(code);
    const openid = normalizeText(session.openid);
    const profiles = readJsonFile(userProfilesPath, {});
    profiles[openid] = {
      openid,
      unionid: normalizeText(session.unionid),
      updated_at: new Date().toISOString()
    };
    writeJsonFile(userProfilesPath, profiles);
    res.json({
      success: true,
      openid,
      sessionKeyReady: Boolean(session.session_key)
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "微信登录失败"
    });
  }
});

app.post("/api/users/me/study-records", (req, res) => {
  const openid = normalizeText(req.headers["x-openid"] || (req.body && req.body.openid));
  if (!openid) {
    res.status(401).json({ success: false, message: "请先登录后再同步学习记录" });
    return;
  }
  const records = req.body && req.body.records && typeof req.body.records === "object" ? req.body.records : {};
  const wrongIds = Array.isArray(req.body && req.body.wrongIds) ? req.body.wrongIds.map(normalizeText).filter(Boolean) : [];
  const favoriteIds = Array.isArray(req.body && req.body.favoriteIds) ? req.body.favoriteIds.map(normalizeText).filter(Boolean) : [];
  const questionStates = req.body && req.body.questionStates && typeof req.body.questionStates === "object" ? req.body.questionStates : {};
  const answerEvents = Array.isArray(req.body && req.body.answerEvents) ? req.body.answerEvents.slice(-1000) : [];
  const allRecords = readJsonFile(userRecordsPath, {});
  allRecords[openid] = {
    openid,
    records,
    wrongIds,
    questionStates,
    answerEvents,
    favoriteIds,
    selectedMajor: normalizeText(req.body && req.body.selectedMajor),
    selectedLevel: normalizeText(req.body && req.body.selectedLevel),
    updated_at: new Date().toISOString()
  };
  writeJsonFile(userRecordsPath, allRecords);
  res.json({
    success: true,
    saved: {
      recordCount: Object.keys(records).length,
      wrongCount: wrongIds.length,
      questionStateCount: Object.keys(questionStates).length,
      answerEventCount: answerEvents.length,
      favoriteCount: favoriteIds.length
    }
  });
});


function ensureCacheFile() {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  if (!fs.existsSync(cachePath)) {
    fs.writeFileSync(cachePath, "{}\n", "utf8");
  }
}

function readCache() {
  ensureCacheFile();
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8") || "{}");
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  ensureCacheFile();
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

function readJsonFile(filePath, fallback) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8") || "null") || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function readPaymentOrders() {
  return readJsonFile(paymentOrdersPath, {});
}

function writePaymentOrders(orders) {
  writeJsonFile(paymentOrdersPath, orders);
}

function readAiAnalysisMemberships() {
  return readJsonFile(aiAnalysisMembershipsPath, {});
}

function writeAiAnalysisMemberships(memberships) {
  writeJsonFile(aiAnalysisMembershipsPath, memberships);
}

function getPlanById(planId) {
  return aiAnalysisPlans[normalizeText(planId)] || null;
}

function createOutTradeNo(planId) {
  return `AI${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
}

function getMembershipRecord(openid) {
  const memberships = readAiAnalysisMemberships();
  return memberships[normalizeText(openid)] || null;
}

function grantAiAnalysisMembership(openid, planId, source, orderInfo) {
  const targetOpenid = normalizeText(openid);
  const plan = getPlanById(planId);
  if (!targetOpenid || !plan) return null;
  const memberships = readAiAnalysisMemberships();
  const current = memberships[targetOpenid] || null;
  const baseTime = current && current.expiresAt && current.expiresAt > Date.now() ? current.expiresAt : Date.now();
  const activatedAt = Date.now();
  const expiresAt = baseTime + plan.days * 24 * 60 * 60 * 1000;
  const membership = {
    openid: targetOpenid,
    planId: plan.id,
    planName: plan.name,
    source: source || "wechat_pay",
    orderId: normalizeText(orderInfo && orderInfo.orderId) || normalizeText(orderInfo && orderInfo.outTradeNo) || "",
    outTradeNo: normalizeText(orderInfo && orderInfo.outTradeNo) || "",
    transactionId: normalizeText(orderInfo && orderInfo.transactionId) || "",
    amountFen: plan.amountFen,
    activatedAt,
    expiresAt,
    updatedAt: new Date().toISOString()
  };
  memberships[targetOpenid] = membership;
  writeAiAnalysisMemberships(memberships);
  return membership;
}

function persistPaymentOrder(order) {
  const orders = readPaymentOrders();
  orders[order.outTradeNo] = order;
  writePaymentOrders(orders);
  return order;
}

function updatePaymentOrder(outTradeNo, patch) {
  const orders = readPaymentOrders();
  const current = orders[outTradeNo];
  if (!current) return null;
  const next = Object.assign({}, current, patch || {}, { updatedAt: new Date().toISOString() });
  orders[outTradeNo] = next;
  writePaymentOrders(orders);
  return next;
}

function findPaymentOrder(outTradeNo) {
  const orders = readPaymentOrders();
  return orders[normalizeText(outTradeNo)] || null;
}

function requireAdmin(req, res) {
  const adminToken = normalizeText(process.env.ADMIN_TOKEN);
  if (!adminToken) {
    res.status(503).json({
      success: false,
      message: "后台查询未配置 ADMIN_TOKEN"
    });
    return false;
  }
  const token = normalizeText(req.headers["x-admin-token"] || req.query.token);
  if (token !== adminToken) {
    res.status(401).json({
      success: false,
      message: "后台查询 token 不正确"
    });
    return false;
  }
  return true;
}

function listMapValues(value) {
  return Object.keys(value || {}).map((key) => value[key]);
}

async function settleAiAnalysisOrder(order, transaction) {
  if (!order) return null;
  if (order.status === "SUCCESS" && order.membership) {
    return order.membership;
  }
  const targetOpenid = normalizeText(order.openid || (transaction && transaction.payer && transaction.payer.openid));
  const plan = getPlanById(order.planId);
  if (!targetOpenid || !plan) return null;
  if (normalizeText(transaction && transaction.trade_state) && normalizeText(transaction.trade_state) !== "SUCCESS") {
    const error = new Error("微信支付订单未支付成功");
    error.code = "WECHAT_PAY_NOT_SUCCESS";
    throw error;
  }
  const payerOpenid = normalizeText(transaction && transaction.payer && transaction.payer.openid);
  if (payerOpenid && payerOpenid !== targetOpenid) {
    const error = new Error("微信支付回调 openid 与订单不一致");
    error.code = "WECHAT_PAY_OPENID_MISMATCH";
    throw error;
  }
  const paidFen = Number(transaction && transaction.amount && transaction.amount.total);
  if (Number.isFinite(paidFen) && paidFen !== Number(order.totalFen)) {
    const error = new Error("微信支付回调金额与订单金额不一致");
    error.code = "WECHAT_PAY_AMOUNT_MISMATCH";
    throw error;
  }
  const currentMembership = getMembershipRecord(targetOpenid);
  if (currentMembership && currentMembership.outTradeNo === order.outTradeNo) {
    updatePaymentOrder(order.outTradeNo, {
      status: "SUCCESS",
      transactionId: normalizeText(transaction && transaction.transaction_id),
      paidAt: order.paidAt || new Date().toISOString(),
      membership: currentMembership
    });
    return currentMembership;
  }
  const membership = grantAiAnalysisMembership(targetOpenid, plan.id, "wechat_pay", {
    orderId: order.orderId || order.outTradeNo,
    outTradeNo: order.outTradeNo,
    transactionId: normalizeText(transaction && transaction.transaction_id)
  });
  updatePaymentOrder(order.outTradeNo, {
    status: "SUCCESS",
    transactionId: normalizeText(transaction && transaction.transaction_id),
    paidAt: new Date().toISOString(),
    membership
  });
  return membership;
}

async function fetchWechatSession(code) {
  const appid = normalizeText(process.env.WECHAT_APPID);
  const secret = normalizeText(process.env.WECHAT_APP_SECRET);
  if (!appid || !secret) {
    const error = new Error("微信登录未配置 WECHAT_APPID 或 WECHAT_APP_SECRET");
    error.statusCode = 501;
    throw error;
  }
  const url = "https://api.weixin.qq.com/sns/jscode2session"
    + "?appid=" + encodeURIComponent(appid)
    + "&secret=" + encodeURIComponent(secret)
    + "&js_code=" + encodeURIComponent(code)
    + "&grant_type=authorization_code";
  const response = await fetch(url);
  const data = await response.json();
  if (!data.openid) {
    throw new Error(data.errmsg || "微信登录未返回 OpenID");
  }
  return data;
}

function cacheKey(payload) {
  if (normalizeText(payload.id)) return normalizeText(payload.id);
  const seed = normalizeText(payload.question) + "::" + normalizeText(payload.answer);
  return "hash_" + crypto.createHash("sha256").update(seed).digest("hex");
}

function optionsText(options) {
  if (!options || typeof options !== "object") return "无选项";
  return Object.keys(options).sort().map((key) => `${key}. ${options[key]}`).join("\n");
}

function normalizeExplanationText(text) {
  return String(text || "").replace(/【调度(?:\s*\/\s*电力现场理解)?】/g, "【电力现场理解】");
}

function buildPrompt(payload) {
  const userAnswer = Array.isArray(payload.userAnswer) ? payload.userAnswer.join("") : normalizeText(payload.userAnswer);
  return [
    "你是电力考试题库解析老师，请用简体中文输出结构化题目解析。",
    "",
    "请严格按以下格式输出，不要输出 JSON：",
    "【正确答案】",
    "说明正确答案，并给出题库答案。",
    "",
    "【题目考点】",
    "概括本题考查的知识点。",
    "",
    "【为什么选这个】",
    "解释正确选项成立的原因。",
    "",
    "【错误选项排除】",
    "逐项说明错误选项为什么不选。",
    "",
    "【电力现场理解】",
    "结合电力现场、运维或考试场景帮助理解。",
    "",
    "【记忆口诀】",
    "给出一句简短记忆方法。",
    "",
    "要求：不要编造题库外事实；不确定时说明按题干和选项推理；语言简洁，适合考前复习。",
    "",
    "题目信息：",
    "专业：" + (normalizeText(payload.major) || "未提供"),
    "等级：" + (normalizeText(payload.level) || "未提供"),
    "题型：" + (normalizeText(payload.questionType) || "未提供"),
    "题干：" + (normalizeText(payload.question) || "未提供"),
    "选项：",
    optionsText(payload.options),
    "正确答案：" + (normalizeText(payload.answer) || "未提供"),
    "用户答案：" + (userAnswer || "未提供")
  ].join("\n");
}

function mockExplanation(payload) {
  return [
    "【正确答案】",
    "题库答案为：" + (normalizeText(payload.answer) || "未提供"),
    "",
    "【题目考点】",
    "当前 AI 解析暂不可用，以下为临时说明。",
    "",
    "【为什么选这个】",
    "请检查 DeepSeek 或 OpenAI API Key 配置后生成正式解析。",
    "",
    "【错误选项排除】",
    "暂无。",
    "",
    "【电力现场理解】",
    "暂无。",
    "",
    "【记忆口诀】",
    "配置 API 后可生成口诀。"
  ].join("\n");
}

function envValue(name) {
  return normalizeText(process.env[name]);
}

function providerConfigs(provider) {
  if (provider === "deepseek") {
    const configs = [];
    const primary = {
      provider: "deepseek",
      name: "deepseek",
      apiKey: envValue("DEEPSEEK_API_KEY"),
      baseURL: envValue("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
      model: envValue("DEEPSEEK_MODEL") || "deepseek-chat"
    };
    configs.push(primary);
    for (let index = 2; index <= 5; index += 1) {
      const apiKey = envValue(`DEEPSEEK_API_KEY_${index}`);
      if (!apiKey) continue;
      configs.push({
        provider: "deepseek",
        name: `deepseek_${index}`,
        apiKey,
        baseURL: envValue(`DEEPSEEK_BASE_URL_${index}`) || primary.baseURL || "https://api.deepseek.com",
        model: envValue(`DEEPSEEK_MODEL_${index}`) || primary.model || "deepseek-chat"
      });
    }
    return configs;
  }
  if (provider === "openai") {
    return [{
      provider: "openai",
      name: "openai",
      apiKey: envValue("OPENAI_API_KEY"),
      baseURL: undefined,
      model: envValue("OPENAI_MODEL")
    }];
  }
  return [];
}

function isProviderConfigured(provider) {
  return providerConfigs(provider).some((config) => config.apiKey && config.model);
}

function currentProvider() {
  const configured = providerOrder().find(isProviderConfigured);
  return configured || providerOrder()[0] || "mock";
}

function hasConfiguredAiProvider() {
  return providerOrder().some(isProviderConfigured);
}

function publicStatus() {
  const stats = cacheStats(readCache());
  return {
    service: "running",
    cacheTotal: stats.total,
    currentProvider: currentProvider(),
    deepseekConfigured: isProviderConfigured("deepseek"),
    openaiConfigured: isProviderConfigured("openai"),
    cacheHits: runtimeStats.cacheHits,
    deepseekCalls: runtimeStats.deepseekCalls,
    openaiCalls: runtimeStats.openaiCalls,
    mockCalls: runtimeStats.mockCalls
  };
}

function classifyProviderError(error) {
  const message = normalizeText(error && error.message).toLowerCase();
  if (message.includes("api key") || message.includes("unauthorized") || message.includes("401")) {
    return "API Key 无效";
  }
  if (message.includes("insufficient") || message.includes("quota") || message.includes("billing") || message.includes("payment") || message.includes("402")) {
    return "余额或额度不足";
  }
  return "AI 解析暂不可用";
}

function classifyProviderErrors(errors) {
  const text = errors.join(" ").toLowerCase();
  if (text.includes("api key") || text.includes("unauthorized") || text.includes("401")) {
    return "API Key 无效";
  }
  if (text.includes("insufficient") || text.includes("quota") || text.includes("billing") || text.includes("payment") || text.includes("402")) {
    return "余额或额度不足";
  }
  return "AI 解析暂不可用";
}

async function callProviderConfig(config, payload) {
  if (!config || !config.apiKey || !config.model) {
    throw new Error(`${config && config.name ? config.name : "AI"} 未配置 API Key 或模型名`);
  }

  if (config.provider === "deepseek") runtimeStats.deepseekCalls += 1;
  if (config.provider === "openai") runtimeStats.openaiCalls += 1;
  if (config.provider === "deepseek") console.log(`Using ${config.name}`);

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 30000
  });

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: "You must output Chinese explanations in the required format."
      },
      {
        role: "user",
        content: buildPrompt(payload)
      }
    ]
  });

  const content = completion.choices && completion.choices[0] && completion.choices[0].message
    ? completion.choices[0].message.content
    : "";
  if (!normalizeText(content)) {
    throw new Error(`${config.name} 返回内容为空`);
  }
  return content.trim();
}

async function callProvider(provider, payload) {
  const configs = providerConfigs(provider);
  const errors = [];
  for (const config of configs) {
    try {
      return {
        provider: config.provider,
        name: config.name,
        content: await callProviderConfig(config, payload)
      };
    } catch (error) {
      errors.push(`${config.name}: ${error.message}`);
    }
  }
  throw new Error(errors.join("; ") || `${provider} 未配置 API Key 或模型名`);
}

function providerOrder() {
  const primary = normalizeText(process.env.AI_PROVIDER) || "deepseek";
  const fallback = normalizeText(process.env.AI_FALLBACK_PROVIDER) || "openai";
  return Array.from(new Set([primary, fallback].filter((item) => ["deepseek", "openai"].includes(item))));
}

function cacheStats(cache) {
  return Object.keys(cache).reduce((stats, key) => {
    const provider = cache[key] && cache[key].provider;
    stats.total += 1;
    if (provider === "deepseek") stats.deepseek += 1;
    if (provider === "openai") stats.openai += 1;
    if (provider === "mock") stats.mock += 1;
    return stats;
  }, { total: 0, deepseek: 0, openai: 0, mock: 0 });
}

function testPayload() {
  return {
    id: "ai_status_test",
    major: "AI连通测试",
    level: "测试",
    questionType: "单选题",
    question: "电力系统中用于测试 AI 解析接口是否可用的选项是哪个？",
    options: {
      A: "接口可正常返回中文内容",
      B: "接口不可用"
    },
    answer: "A",
    userAnswer: ["A"]
  };
}

async function testProvider(provider, res) {
  try {
    const result = await callProvider(provider, testPayload());
    res.json({
      success: true,
      message: provider === "deepseek" ? "DeepSeek连接成功" : "OpenAI连接成功",
      provider: result.name,
      status: publicStatus()
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: classifyProviderError(error),
      detail: error.message,
      status: publicStatus()
    });
  }
}

app.post("/api/explain", async (req, res) => {
  const payload = req.body || {};
  const key = cacheKey(payload);
  const cache = readCache();
  if (cache[key] && cache[key].explanation) {
    const cachedProvider = cache[key].provider || "cache";
    if (cachedProvider !== "mock" || !hasConfiguredAiProvider()) {
      runtimeStats.cacheHits += 1;
      return res.json({
        success: true,
        provider: cachedProvider,
        cached: true,
        explanation: normalizeExplanationText(cache[key].explanation)
      });
    }
    console.log("Skipping Mock cache because AI provider is configured");
  }

  let provider = "mock";
  let explanation = "";
  const errors = [];

  for (const candidate of providerOrder()) {
    try {
      const result = await callProvider(candidate, payload);
      explanation = result.content;
      provider = result.provider;
      break;
    } catch (error) {
      if (candidate === "deepseek") console.error(error);
      errors.push(`${candidate}: ${error.message}`);
    }
  }

  if (!explanation && hasConfiguredAiProvider()) {
    return res.status(200).json({
      success: false,
      provider: "error",
      cached: false,
      message: classifyProviderErrors(errors),
      error: errors.join("; ")
    });
  }

  if (!explanation) {
    explanation = mockExplanation(payload);
    provider = "mock";
    runtimeStats.mockCalls += 1;
  }

  cache[key] = {
    provider,
    created_at: new Date().toISOString(),
    question: normalizeText(payload.question),
    answer: normalizeText(payload.answer),
    explanation: normalizeExplanationText(explanation)
  };
  writeCache(cache);

  res.json({
    success: true,
    provider,
    cached: false,
    explanation: normalizeExplanationText(explanation),
    error: provider === "mock" && errors.length ? errors.join("; ") : undefined
  });
});

app.get("/api/explain/cache/stats", (req, res) => {
  res.json({
    success: true,
    stats: cacheStats(readCache())
  });
});

app.get("/api/ai/status", (req, res) => {
  res.json({
    success: true,
    status: publicStatus()
  });
});

app.get("/api/users/me/ai-analysis-membership", (req, res) => {
  const openid = normalizeText(req.headers["x-openid"] || req.query.openid);
  if (!openid) {
    res.status(401).json({ success: false, message: "请先登录后再查询权益" });
    return;
  }
  res.json({
    success: true,
    membership: getMembershipRecord(openid)
  });
});

app.post("/api/pay/wechat/notify", async (req, res) => {
  try {
    const { transaction } = await wechatPay.verifyNotifyRequest(req);
    const outTradeNo = normalizeText(transaction && transaction.out_trade_no);
    const order = findPaymentOrder(outTradeNo);
    if (order) {
      await settleAiAnalysisOrder(order, transaction);
    }
    res.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    console.error("WeChat Pay notify failed:", error);
    res.status(400).json({
      code: "FAIL",
      message: error.message || "notify error"
    });
  }
});

app.get("/api/pay/wechat/status", (req, res) => {
  const config = wechatPay.getPublicConfigStatus();
  res.json({
    success: true,
    configured: wechatPay.isConfigured(),
    config
  });
});

app.get("/api/admin/business/overview", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = readJsonFile(userProfilesPath, {});
  const orders = readPaymentOrders();
  const memberships = readAiAnalysisMemberships();
  const orderList = listMapValues(orders).sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
  const memberList = listMapValues(memberships).sort((a, b) => {
    return Number(b.updatedAt ? new Date(b.updatedAt).getTime() : b.activatedAt || 0) - Number(a.updatedAt ? new Date(a.updatedAt).getTime() : a.activatedAt || 0);
  });
  res.json({
    success: true,
    summary: {
      users: Object.keys(users).length,
      orders: orderList.length,
      paidOrders: orderList.filter((item) => item.status === "SUCCESS").length,
      memberships: memberList.length,
      activeMemberships: memberList.filter((item) => Number(item.expiresAt || 0) > Date.now()).length
    },
    latestUsers: listMapValues(users).slice(-20).reverse(),
    latestOrders: orderList.slice(0, 30),
    latestMemberships: memberList.slice(0, 30)
  });
});

app.post("/api/pay/ai-analysis/order/confirm", (req, res) => {
  const openid = normalizeText(req.body && req.body.openid);
  const outTradeNo = normalizeText(req.body && req.body.outTradeNo);
  if (!openid || !outTradeNo) {
    res.status(400).json({ success: false, message: "缺少 openid 或 outTradeNo" });
    return;
  }

  const order = findPaymentOrder(outTradeNo);
  if (!order) {
    res.status(404).json({ success: false, message: "订单不存在" });
    return;
  }

  const currentMembership = getMembershipRecord(openid);
  if (currentMembership && currentMembership.outTradeNo === outTradeNo) {
    res.json({ success: true, paid: true, membership: currentMembership, order });
    return;
  }

  wechatPay.queryOrderByOutTradeNo(outTradeNo).then((data) => {
    if (normalizeText(data.trade_state) === "SUCCESS") {
      const membership = grantAiAnalysisMembership(openid, order.planId, "wechat_pay", {
        orderId: order.orderId,
        outTradeNo,
        transactionId: normalizeText(data.transaction_id)
      });
      updatePaymentOrder(outTradeNo, {
        status: "SUCCESS",
        transactionId: normalizeText(data.transaction_id),
        paidAt: new Date().toISOString(),
        membership
      });
      res.json({
        success: true,
        paid: true,
        membership,
        order: findPaymentOrder(outTradeNo)
      });
      return;
    }
    res.json({
      success: true,
      paid: false,
      state: normalizeText(data.trade_state) || "NOTPAY",
      order
    });
  }).catch((error) => {
    console.error("Query WeChat order failed:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "查询微信订单失败"
    });
  });
});

app.post("/api/pay/ai-analysis/order", (req, res) => {
  const planId = normalizeText(req.body && req.body.planId) || "ai_analysis_7d";
  const plan = getPlanById(planId);
  const openid = normalizeText(req.body && req.body.openid);
  if (!plan) {
    res.status(400).json({ success: false, message: "AI 解析套餐不存在" });
    return;
  }
  if (!openid) {
    res.status(401).json({ success: false, message: "请先登录后再下单" });
    return;
  }
  if (!wechatPay.isConfigured()) {
    res.status(501).json({
      success: false,
      message: "微信支付未配置完整，请检查商户号、证书和 API v3 key",
      plan
    });
    return;
  }

  (async () => {
    const outTradeNo = createOutTradeNo(plan.id);
    const order = persistPaymentOrder({
      orderId: outTradeNo,
      outTradeNo,
      openid,
      planId: plan.id,
      planName: plan.name,
      totalFen: plan.amountFen,
      description: plan.name,
      attach: JSON.stringify({
        bizType: "ai_analysis",
        planId: plan.id,
        openid
      }),
      status: "CREATED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const paymentResult = await wechatPay.createJsapiOrder(order);
    const stored = updatePaymentOrder(outTradeNo, {
      status: "PENDING",
      prepayId: paymentResult.prepayId,
      payment: paymentResult.payment,
      wechatRaw: paymentResult.raw
    });
    res.json({
      success: true,
      plan,
      orderId: stored.orderId,
      outTradeNo: stored.outTradeNo,
      payment: paymentResult.payment
    });
  })().catch((error) => {
    console.error("Create WeChat Pay order failed:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "创建微信支付订单失败",
      detail: error.response || undefined
    });
  });
});

app.post("/api/pay/ai-analysis-7d/order", (req, res) => {
  req.body = Object.assign({}, req.body || {}, { planId: "ai_analysis_7d" });
  return app._router.handle(req, res, () => {}, "post", "/api/pay/ai-analysis/order");
});

app.get("/api/debug/env", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    deepseek_key_loaded: Boolean(process.env.DEEPSEEK_API_KEY),
    deepseek_model: normalizeText(process.env.DEEPSEEK_MODEL),
    provider: normalizeText(process.env.AI_PROVIDER),
    fallback_provider: normalizeText(process.env.AI_FALLBACK_PROVIDER)
  });
});

app.post("/api/ai/test/deepseek", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await testProvider("deepseek", res);
});

app.post("/api/ai/test/openai", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await testProvider("openai", res);
});

app.post("/api/ai/test/cache", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cache = readCache();
    const stats = cacheStats(cache);
    res.json({
      success: true,
      message: "缓存可用",
      stats,
      status: publicStatus()
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: "接口异常",
      detail: error.message,
      status: publicStatus()
    });
  }
});

app.post("/api/explain/cache/clear", (req, res) => {
  if (!requireAdmin(req, res)) return;
  writeCache({});
  res.json({
    success: true,
    stats: cacheStats({})
  });
});

app.listen(port, () => {
  console.log(`SGCC exam API server listening on port ${port}`);
});
