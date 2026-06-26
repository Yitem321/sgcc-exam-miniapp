(function () {
  var API_BASE = "https://api.synexa.cc";

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function yesNo(value) {
    return value ? "已配置" : "未配置";
  }

  function renderStatus(status) {
    setText("serviceStatus", status.service === "running" ? "运行中" : "未启动");
    setText("cacheTotal", String(status.cacheTotal || 0));
    setText("currentProvider", status.currentProvider || "-");
    setText("deepseekConfigured", yesNo(status.deepseekConfigured));
    setText("openaiConfigured", yesNo(status.openaiConfigured));
    setText("cacheHits", String(status.cacheHits || 0));
    setText("deepseekCalls", String(status.deepseekCalls || 0));
    setText("openaiCalls", String(status.openaiCalls || 0));
    setText("mockCalls", String(status.mockCalls || 0));
  }

  function setResult(message, ok) {
    var node = document.getElementById("testResult");
    node.textContent = message;
    node.className = "ai-status-result " + (ok ? "result-good" : "result-bad");
  }

  function setButtonsDisabled(disabled) {
    ["testDeepSeekButton", "testOpenAIButton", "testCacheButton", "refreshStatusButton"].forEach(function (id) {
      document.getElementById(id).disabled = disabled;
    });
  }

  function loadStatus() {
    return fetch(API_BASE + "/api/ai/status")
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        renderStatus(result.status || {});
        document.getElementById("loadNotice").textContent = "AI 服务状态已更新。";
      })
      .catch(function () {
        renderStatus({});
        document.getElementById("loadNotice").textContent = "AI 解析服务未启动，请先启动本地 Node.js 服务。";
      });
  }

  function testEndpoint(path, loadingText) {
    setButtonsDisabled(true);
    setResult(loadingText, true);
    fetch(API_BASE + path, { method: "POST" })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.status) renderStatus(result.status);
        setResult(result.message || "接口异常", Boolean(result.success));
      })
      .catch(function () {
        setResult("接口异常", false);
      })
      .finally(function () {
        setButtonsDisabled(false);
        loadStatus();
      });
  }

  document.getElementById("refreshStatusButton").addEventListener("click", loadStatus);
  document.getElementById("testDeepSeekButton").addEventListener("click", function () {
    testEndpoint("/api/ai/test/deepseek", "正在测试 DeepSeek...");
  });
  document.getElementById("testOpenAIButton").addEventListener("click", function () {
    testEndpoint("/api/ai/test/openai", "正在测试 OpenAI...");
  });
  document.getElementById("testCacheButton").addEventListener("click", function () {
    testEndpoint("/api/ai/test/cache", "正在测试缓存...");
  });

  loadStatus();
})();
