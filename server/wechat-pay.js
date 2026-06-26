const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const API_BASE_URL = "https://api.mch.weixin.qq.com";
const CERT_CACHE_PATH = path.join(__dirname, "..", "data", "wechatpay_platform_certs.json");

function normalizeText(value) {
  return String(value || "").trim();
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

function loadPrivateKeyFromEnv() {
  const inlinePrivateKey = normalizeText(process.env.WECHAT_PAY_PRIVATE_KEY);
  if (inlinePrivateKey) {
    return crypto.createPrivateKey(inlinePrivateKey);
  }

  const keyPath = normalizeText(process.env.WECHAT_PAY_PRIVATE_KEY_PATH);
  if (!keyPath) return null;
  const resolvedKeyPath = path.isAbsolute(keyPath) ? keyPath : path.join(__dirname, keyPath);
  if (!fs.existsSync(resolvedKeyPath)) return null;
  return crypto.createPrivateKey(fs.readFileSync(resolvedKeyPath, "utf8"));
}

function loadPublicKeyFromEnv() {
  const inlinePublicKey = normalizeText(process.env.WECHAT_PAY_PUBLIC_KEY);
  if (inlinePublicKey) {
    return crypto.createPublicKey(inlinePublicKey);
  }

  const keyPath = normalizeText(process.env.WECHAT_PAY_PUBLIC_KEY_PATH);
  if (!keyPath) return null;
  const resolvedKeyPath = path.isAbsolute(keyPath) ? keyPath : path.join(__dirname, keyPath);
  if (!fs.existsSync(resolvedKeyPath)) return null;
  return crypto.createPublicKey(fs.readFileSync(resolvedKeyPath, "utf8"));
}

function getConfig() {
  return {
    mchid: normalizeText(process.env.WECHAT_PAY_MCHID),
    appid: normalizeText(process.env.WECHAT_PAY_APPID),
    serialNo: normalizeText(process.env.WECHAT_PAY_SERIAL_NO),
    apiV3Key: normalizeText(process.env.WECHAT_PAY_API_V3_KEY),
    notifyUrl: normalizeText(process.env.WECHAT_PAY_NOTIFY_URL),
    privateKey: loadPrivateKeyFromEnv(),
    publicKey: loadPublicKeyFromEnv(),
    publicKeyId: normalizeText(process.env.WECHAT_PAY_PUBLIC_KEY_ID)
  };
}

function isConfigured() {
  const config = getConfig();
  return Boolean(
    config.mchid &&
    config.appid &&
    config.serialNo &&
    config.apiV3Key &&
    config.notifyUrl &&
    config.privateKey
  );
}

function requireConfigured() {
  const config = getConfig();
  const missing = [];
  if (!config.mchid) missing.push("WECHAT_PAY_MCHID");
  if (!config.appid) missing.push("WECHAT_PAY_APPID");
  if (!config.serialNo) missing.push("WECHAT_PAY_SERIAL_NO");
  if (!config.apiV3Key) missing.push("WECHAT_PAY_API_V3_KEY");
  if (!config.notifyUrl) missing.push("WECHAT_PAY_NOTIFY_URL");
  if (!config.privateKey) missing.push("WECHAT_PAY_PRIVATE_KEY_PATH/WECHAT_PAY_PRIVATE_KEY");
  if (missing.length) {
    const error = new Error("微信支付未配置：" + missing.join(", "));
    error.code = "WECHAT_PAY_NOT_CONFIGURED";
    throw error;
  }
  return config;
}

function randomString(length = 32) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function formatWechatTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetAbs = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(offsetAbs / 60));
  const offsetRemain = pad(offsetAbs % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemain}`;
}

function jsonBody(body) {
  return body ? JSON.stringify(body) : "";
}

function signMessage(message, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, "base64");
}

function buildAuthorizationHeader(config, method, requestPath, bodyString) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = randomString(32);
  const canonical = `${method}\n${requestPath}\n${timestamp}\n${nonceStr}\n${bodyString}\n`;
  const signature = signMessage(canonical, config.privateKey);
  return {
    header: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`,
    timestamp,
    nonceStr,
    signature
  };
}

async function wechatPayRequest(method, requestPath, body, extraHeaders) {
  const config = requireConfigured();
  const bodyString = method === "GET" ? "" : jsonBody(body);
  const auth = buildAuthorizationHeader(config, method, requestPath, bodyString);
  const url = requestPath.startsWith("http") ? requestPath : API_BASE_URL + requestPath;
  const headers = Object.assign({
    Authorization: auth.header,
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8"
  }, extraHeaders || {});
  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : bodyString
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const error = new Error(data.message || data.raw || `微信支付接口请求失败 ${response.status}`);
    error.statusCode = response.status;
    error.response = data;
    throw error;
  }
  return data;
}

function decryptResource(resource, apiV3Key) {
  const ciphertext = Buffer.from(resource.ciphertext || "", "base64");
  if (ciphertext.length < 17) {
    throw new Error("微信支付回调密文格式错误");
  }
  const authTag = ciphertext.slice(ciphertext.length - 16);
  const encrypted = ciphertext.slice(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiV3Key, "utf8"),
    Buffer.from(resource.nonce || "", "utf8")
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

function loadCachedCertificates() {
  return readJsonFile(CERT_CACHE_PATH, []);
}

function saveCachedCertificates(certificates) {
  writeJsonFile(CERT_CACHE_PATH, certificates);
}

async function downloadPlatformCertificates() {
  const config = requireConfigured();
  const data = await wechatPayRequest("GET", "/v3/certificates");
  const list = Array.isArray(data.data) ? data.data : [];
  const certificates = list.map((item) => {
    const plain = decryptResource(item.encrypt_certificate, config.apiV3Key);
    return {
      serialNo: normalizeText(item.serial_no),
      effectiveTime: normalizeText(item.effective_time),
      expireTime: normalizeText(item.expire_time),
      certificateBase64: plain.toString("base64")
    };
  }).filter((item) => item.serialNo && item.certificateBase64);
  saveCachedCertificates(certificates);
  return certificates;
}

async function getPlatformCertificates() {
  const cached = loadCachedCertificates();
  const fresh = cached.filter((item) => !item.expireTime || new Date(item.expireTime).getTime() > Date.now() + 60 * 60 * 1000);
  if (fresh.length) return fresh;
  return downloadPlatformCertificates();
}

async function getCertificateBySerial(serialNo) {
  const targetSerial = normalizeText(serialNo);
  if (!targetSerial) return null;
  const certificates = await getPlatformCertificates();
  const match = certificates.find((item) => item.serialNo === targetSerial);
  if (match) return match;
  const refreshed = await downloadPlatformCertificates();
  return refreshed.find((item) => item.serialNo === targetSerial) || null;
}

function verifySignatureWithCertificate(certificateRecord, message, signatureBase64) {
  if (!certificateRecord || !certificateRecord.certificateBase64) return false;
  const certificate = new crypto.X509Certificate(Buffer.from(certificateRecord.certificateBase64, "base64"));
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();
  return verifier.verify(certificate.publicKey, signatureBase64, "base64");
}

function verifySignatureWithPublicKey(publicKey, message, signatureBase64) {
  if (!publicKey) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();
  return verifier.verify(publicKey, signatureBase64, "base64");
}

async function verifyNotifyRequest(req) {
  const headers = req.headers || {};
  const timestamp = normalizeText(headers["wechatpay-timestamp"]);
  const nonce = normalizeText(headers["wechatpay-nonce"]);
  const signature = normalizeText(headers["wechatpay-signature"]);
  const serialNo = normalizeText(headers["wechatpay-serial"]);
  const bodyText = normalizeText(req.rawBody) || (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  if (!timestamp || !nonce || !signature || !serialNo) {
    const error = new Error("微信支付回调头部不完整");
    error.code = "WECHAT_PAY_NOTIFY_HEADERS_MISSING";
    throw error;
  }

  const message = `${timestamp}\n${nonce}\n${bodyText}\n`;
  const config = getConfig();
  if (config.publicKey && (!config.publicKeyId || serialNo === config.publicKeyId)) {
    if (verifySignatureWithPublicKey(config.publicKey, message, signature)) {
      const notifyBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const resource = notifyBody.resource;
      let transaction = notifyBody;
      if (resource && resource.ciphertext) {
        if (!config.apiV3Key) {
          const error = new Error("微信支付回调解密缺少 WECHAT_PAY_API_V3_KEY");
          error.code = "WECHAT_PAY_API_V3_KEY_MISSING";
          throw error;
        }
        const decrypted = decryptResource(resource, config.apiV3Key);
        transaction = JSON.parse(decrypted.toString("utf8"));
      }
      return {
        notifyBody,
        transaction
      };
    }
    if (config.publicKeyId && serialNo === config.publicKeyId) {
      const error = new Error("微信支付公钥回调验签失败");
      error.code = "WECHAT_PAY_PUBLIC_KEY_SIGNATURE_INVALID";
      throw error;
    }
  }

  const candidates = [];
  const target = await getCertificateBySerial(serialNo);
  if (target) candidates.push(target);
  for (const item of loadCachedCertificates()) {
    if (item.serialNo !== serialNo) candidates.push(item);
  }

  let verified = false;
  for (const certificate of candidates) {
    if (verifySignatureWithCertificate(certificate, message, signature)) {
      verified = true;
      break;
    }
  }
  if (!verified) {
    const refreshed = await downloadPlatformCertificates();
    for (const certificate of refreshed) {
      if (verifySignatureWithCertificate(certificate, message, signature)) {
        verified = true;
        break;
      }
    }
  }
  if (!verified) {
    const error = new Error("微信支付回调验签失败");
    error.code = "WECHAT_PAY_NOTIFY_SIGNATURE_INVALID";
    throw error;
  }

  const notifyBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const resource = notifyBody.resource;
  let transaction = notifyBody;
  if (resource && resource.ciphertext) {
    const decryptConfig = requireConfigured();
    const decrypted = decryptResource(resource, decryptConfig.apiV3Key);
    transaction = JSON.parse(decrypted.toString("utf8"));
  }
  return {
    notifyBody,
    transaction
  };
}

function getPublicConfigStatus() {
  const config = getConfig();
  return {
    mchid: Boolean(config.mchid),
    appid: Boolean(config.appid),
    serialNo: Boolean(config.serialNo),
    apiV3Key: Boolean(config.apiV3Key),
    notifyUrl: Boolean(config.notifyUrl),
    privateKey: Boolean(config.privateKey),
    publicKey: Boolean(config.publicKey),
    publicKeyId: Boolean(config.publicKeyId),
    missing: [
      ["WECHAT_PAY_MCHID", config.mchid],
      ["WECHAT_PAY_APPID", config.appid],
      ["WECHAT_PAY_SERIAL_NO", config.serialNo],
      ["WECHAT_PAY_API_V3_KEY", config.apiV3Key],
      ["WECHAT_PAY_NOTIFY_URL", config.notifyUrl],
      ["WECHAT_PAY_PRIVATE_KEY_PATH/WECHAT_PAY_PRIVATE_KEY", config.privateKey],
      ["WECHAT_PAY_PUBLIC_KEY_ID", config.publicKey ? config.publicKeyId : true]
    ].filter((item) => !item[1]).map((item) => item[0])
  };
}

function buildRequestPaymentParams(appId, prepayId, privateKey) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = randomString(32);
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = signMessage(message, privateKey);
  return {
    appId,
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA",
    paySign
  };
}

async function createJsapiOrder(order) {
  const config = requireConfigured();
  const response = await wechatPayRequest("POST", "/v3/pay/transactions/jsapi", {
    appid: config.appid,
    mchid: config.mchid,
    description: order.description,
    out_trade_no: order.outTradeNo,
    notify_url: config.notifyUrl,
    attach: order.attach,
    amount: {
      total: order.totalFen,
      currency: "CNY"
    },
    payer: {
      openid: order.openid
    }
  });
  const prepayId = normalizeText(response.prepay_id);
  if (!prepayId) {
    const error = new Error("微信支付下单失败，未返回 prepay_id");
    error.response = response;
    throw error;
  }
  return {
    prepayId,
    raw: response,
    payment: buildRequestPaymentParams(config.appid, prepayId, config.privateKey)
  };
}

async function queryOrderByOutTradeNo(outTradeNo) {
  const config = requireConfigured();
  const requestPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchid)}`;
  return wechatPayRequest("GET", requestPath);
}

module.exports = {
  createJsapiOrder,
  downloadPlatformCertificates,
  getCertificateBySerial,
  getConfig,
  getPublicConfigStatus,
  isConfigured,
  queryOrderByOutTradeNo,
  verifyNotifyRequest
};
