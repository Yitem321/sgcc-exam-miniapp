const config = require("./config.js");

function buildQuery(params) {
  return Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
    .join("&");
}

function request(options) {
  const method = options.method || "GET";
  const query = buildQuery(options.data);
  const url = config.apiBaseUrl() + options.path + (method === "GET" && query ? "?" + query : "");
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: method === "GET" ? undefined : (options.data || {}),
      timeout: options.timeout || 12000,
      success(response) {
        const data = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && data.success !== false) {
          resolve(data);
          return;
        }
        const message = data.message || ("接口请求失败：" + response.statusCode);
        const error = new Error(message);
        error.statusCode = response.statusCode;
        error.url = url;
        error.response = data;
        reject(error);
      },
      fail(error) {
        error.url = url;
        reject(error);
      }
    });
  });
}

module.exports = {
  get(path, data, options) {
    return request(Object.assign({}, options || {}, { path, data, method: "GET" }));
  },
  post(path, data, options) {
    return request(Object.assign({}, options || {}, { path, data, method: "POST" }));
  }
};
