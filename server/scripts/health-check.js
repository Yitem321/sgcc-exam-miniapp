const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const baseUrl = (process.env.API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

function buildUrl(path) {
  return `${baseUrl}${path}`;
}

async function requestJson(path, options) {
  const response = await fetch(buildUrl(path), options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 120)}`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(`${path} failed with ${response.status}: ${data.message || text}`);
  }
  return data;
}

async function main() {
  console.log(`Checking API: ${baseUrl}`);

  const health = await requestJson("/health");
  console.log(`OK /health questionTotal=${health.questionTotal}`);

  const catalog = await requestJson("/api/catalog");
  const majors = catalog.catalog && Array.isArray(catalog.catalog.majors)
    ? catalog.catalog.majors.length
    : 0;
  console.log(`OK /api/catalog majors=${majors}`);

  const explain = await requestJson("/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: `health-check-${Date.now()}`,
      question: "变更接地线位置应经（ ）同意。",
      options: {
        A: "工作班成员",
        B: "工作票签发人或许可人",
        C: "安全员",
        D: "工作负责人"
      },
      answer: "B",
      questionType: "单选题",
      major: "health-check",
      level: "health-check"
    })
  });
  const provider = explain.provider || "unknown";
  const explanationLength = String(explain.explanation || "").length;
  console.log(`OK /api/explain provider=${provider} explanationLength=${explanationLength}`);
}

main().catch((error) => {
  console.error(`Health check failed: ${error.message}`);
  process.exit(1);
});
