// ==UserScript==
// @name         国网学堂题库导出TXT-本专业全部等级
// @match        *://*/www/command/*
// @match        *://*/lms/user/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  "use strict";

  const STORE_KEY = "__sgcc_topic_export_all_levels__";
  const LEVELS = ["初级工", "中级工", "高级工", "技师", "高级技师", "共用试题"];
  const LEVEL_DETECT_ORDER = [...LEVELS].sort((a, b) => b.length - a.length);
  const TOPIC_PAGE_RE = /\/lms\/user\/topic\.htm/i;
  const DETAIL_PAGE_RE = /\/www\/command\/.*(?:YqzcControl|exam_detail|SkillLevelControlZ)/i;
  const STATUS_DELAY = 900;
  let detailContinueBusy = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getState() {
    try {
      if (typeof GM_getValue === "function") {
        return JSON.parse(GM_getValue(STORE_KEY, "null") || "null");
      }
      return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (error) {
      console.warn("[题库导出] 读取状态失败", error);
      return null;
    }
  }

  function setState(state) {
    const text = JSON.stringify({ ...state, updatedAt: Date.now() });
    if (typeof GM_setValue === "function") {
      GM_setValue(STORE_KEY, text);
      return;
    }
    localStorage.setItem(STORE_KEY, text);
  }

  function clearState() {
    if (typeof GM_deleteValue === "function") {
      GM_deleteValue(STORE_KEY);
      return;
    }
    localStorage.removeItem(STORE_KEY);
  }

  function getPageWindow() {
    return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  }

  function makeAbsoluteUrl(url) {
    if (!url || /^javascript:/i.test(url)) return "";
    try {
      return new URL(url, location.href).href;
    } catch {
      return "";
    }
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/^\s+|\s+$/g, "");
  }

  function stripLevelName(text) {
    let value = cleanText(text);
    for (const level of LEVELS) {
      value = value.replace(new RegExp("[（(]?\\s*(专业知识题[-－—_ ]*)?" + level + "\\s*[）)]?", "g"), "");
    }
    return value
      .replace(/[-_—|]+$/, "")
      .replace(/^\s*[-_—|]+\s*/, "")
      .trim();
  }

  function normalizeMajorName(text) {
    return cleanText(text)
      .replace(/（国网2026版）/g, "（2026版）")
      .replace(/\(国网2026版\)/g, "（2026版）")
      .replace(/国网2026版/g, "（2026版）")
      .replace(/（\s*/g, "（")
      .replace(/\s*）/g, "）")
      .replace(/\(\s*/g, "（")
      .replace(/\s*\)/g, "）")
      .replace(/\s+/g, "");
  }

  function makeDownloadFilename(majorName, level) {
    return `${normalizeMajorName(majorName)}（${level}）.txt`;
  }

  function extractMajorNameFromText(text) {
    const normalized = String(text || "")
      .replace(/\s+/g, "")
      .replace(/\(国网2026版\)/g, "（2026版）")
      .replace(/（国网2026版）/g, "（2026版）")
      .replace(/国网2026版/g, "（2026版）")
      .replace(/\(/g, "（")
      .replace(/\)/g, "）");

    const match = normalized.match(/（2026版）技能等级评价[^，,。；;|/\\]+?专业知识考试练习/);
    return match ? normalizeMajorName(match[0]) : "";
  }

  function getVisibleText(el) {
    if (!el) return "";
    if (el.tagName === "INPUT") return el.value || el.title || el.getAttribute("aria-label") || "";
    return el.innerText || el.textContent || el.title || el.getAttribute("aria-label") || "";
  }

  function detectLevelName(fallbackLevel) {
    if (fallbackLevel) return fallbackLevel;

    const candidates = [
      document.title,
      document.querySelector("h1,h2,h3,.title,.caption,.breadcrumb")?.innerText,
      document.body?.innerText?.slice(0, 2000),
      location.href
    ];

    for (const text of candidates) {
      const found = LEVEL_DETECT_ORDER.find((level) => String(text || "").includes(level));
      if (found) return found;
    }
    return "未知等级";
  }

  function detectMajorName(fallbackName) {
    if (fallbackName && !/国网学堂首页|未知专业/.test(fallbackName)) return fallbackName;

    const candidates = [
      document.querySelector(".details,.detail,.content,.main,.container")?.innerText,
      document.querySelector("h1,h2,h3,.title,.caption,.breadcrumb")?.innerText,
      document.body?.innerText?.slice(0, 5000),
      document.title
    ];

    for (const text of candidates) {
      const extracted = extractMajorNameFromText(text);
      if (extracted) return extracted;

      const cleaned = stripLevelName(text)
        .replace(/国网学堂|国家电网|题库|在线考试|详情|首页|员工自测|自测活动/g, "")
        .replace(/（国网2026版）/g, "（2026版）")
        .replace(/\(国网2026版\)/g, "（2026版）")
        .replace(/国网2026版/g, "（2026版）")
        .replace(/\s+/g, " ")
        .trim();
      const match = cleaned.match(/（?2026版）?技能等级评价[^，,。；;|\n]+?专业知识考试练习/);
      if (match) return normalizeMajorName(match[0]);
    }

    const title = stripLevelName(document.title).replace(/[-_|].*$/, "").trim();
    return normalizeMajorName(title || "未知专业");
  }

  function isMaybeVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function getClickableElements(includeHidden) {
    return Array.from(document.querySelectorAll("a,button,input[type='button'],input[type='submit'],[role='button'],[onclick],li,div,span,p"))
      .filter((el) => {
        if (includeHidden) return true;
        return isMaybeVisible(el) && el.offsetParent !== null;
      });
  }

  function findTopicUrlInText(text) {
    const raw = String(text || "").replace(/&amp;/g, "&");
    const absolute = raw.match(/https?:\/\/[^'")\s]+\/lms\/user\/topic\.htm[^'")\s]*/i);
    if (absolute) return absolute[0];

    const relative = raw.match(/\/lms\/user\/topic\.htm[^'")\s]*/i);
    if (relative) return makeAbsoluteUrl(relative[0]);

    const loose = raw.match(/lms\/user\/topic\.htm[^'")\s]*/i);
    if (loose) return makeAbsoluteUrl(`/${loose[0]}`);

    return "";
  }

  function getEntrypointUrl(el) {
    const attrs = [
      el.href,
      el.getAttribute("href"),
      el.getAttribute("onclick"),
      el.getAttribute("data-url"),
      el.getAttribute("url")
    ];

    for (const value of attrs) {
      const found = findTopicUrlInText(value);
      if (found) return found;
      const absolute = makeAbsoluteUrl(value);
      if (/\/lms\/user\/topic\.htm/i.test(absolute)) return absolute;
    }
    return "";
  }

  function dispatchMouse(el, type) {
    const eventInit = {
      bubbles: true,
      cancelable: true
    };

    try {
      eventInit.view = el.ownerDocument?.defaultView || getPageWindow();
      el.dispatchEvent(new MouseEvent(type, eventInit));
    } catch {
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true
      }));
    }
  }

  async function openSinglePracticeMenu() {
    const trigger = getClickableElements(true).find((el) => cleanText(getVisibleText(el)).includes("单题练习"));
    if (!trigger) return false;

    ["mouseover", "mouseenter", "mousemove"].forEach((type) => dispatchMouse(trigger, type));
    let node = trigger;
    for (let i = 0; node && i < 4; i += 1, node = node.parentElement) {
      Array.from(node.querySelectorAll("ul,ol,li,div,a,span")).forEach((el) => {
        const text = cleanText(getVisibleText(el));
        if (text.includes("专业知识题") || LEVELS.some((level) => text.includes(level))) {
          el.style.display = "";
          el.style.visibility = "visible";
          el.style.opacity = "1";
          el.style.height = "auto";
          el.style.overflow = "visible";
        }
      });
    }
    if (window.jQuery) {
      try {
        window.jQuery(trigger).trigger("mouseover").trigger("mouseenter").show();
      } catch (error) {
        console.warn("[题库导出] jQuery 悬停触发失败", error);
      }
    }
    await sleep(500);
    return true;
  }

  function findLevelEntrypoint(level) {
    const elements = getClickableElements(true)
      .map((el) => {
        const text = cleanText(getVisibleText(el));
        const href = el.href || el.getAttribute("href") || "";
        const onclick = el.getAttribute("onclick") || "";
        const topicUrl = getEntrypointUrl(el);
        const compactText = text.replace(/\s+/g, "");
        const exactText =
          compactText === level ||
          compactText === `专业知识题-${level}` ||
          compactText === `专业知识题－${level}` ||
          compactText === `专业知识题_${level}` ||
          new RegExp(`^[·•]?专业知识题[-－—_ ]*${level}$`).test(compactText);
        const score =
          (exactText ? 20 : 0) +
          (topicUrl ? 8 : 0) +
          (/topic\.htm/i.test(href) ? 5 : 0) +
          (/topic\.htm/i.test(onclick) ? 4 : 0) +
          (/练习|考试|试题|题库|专业知识题/.test(text) ? 2 : 0) +
          (isMaybeVisible(el) ? 1 : 0);
        return { el, text, href, topicUrl, exactText, score };
      })
      .filter((item) => item.exactText)
      .filter((item) => {
        const childWithSameLevel = Array.from(item.el.children || [])
          .some((child) => cleanText(getVisibleText(child)).includes(level));
        return !childWithSameLevel || item.topicUrl || item.el.getAttribute("onclick") || item.el.tagName === "A";
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.text.length - b.text.length;
      });

    return elements[0] || null;
  }

  async function collectAvailableLevels(tip) {
    await openSinglePracticeMenu();
    const levels = LEVELS.filter((level) => Boolean(findLevelEntrypoint(level)));
    setTip(tip, levels.length ? `识别到等级：${levels.join("、")}` : "没有识别到任何等级入口");
    console.log("[题库导出] 当前专业等级", levels);
    return levels;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function notifyOpener() {
    const pageWindow = getPageWindow();
    try {
      pageWindow.opener?.postMessage({ type: "sgcc-topic-export-done" }, "*");
    } catch (error) {
      console.warn("[题库导出] 通知详情页失败", error);
    }
  }

  function closeOrReturn(detailUrl) {
    notifyOpener();
    setTimeout(() => {
      try {
        window.close();
      } catch {
        // Some browsers block scripted close for tabs not opened by script.
      }
      setTimeout(() => {
        if (detailUrl) location.href = detailUrl;
      }, 500);
    }, STATUS_DELAY);
  }

  async function waitForTopicArray() {
    const pageWindow = getPageWindow();
    let lastLength = -1;
    let stableTimes = 0;

    for (let i = 0; i < 100; i += 1) {
      const data = Array.isArray(pageWindow.topicArray) ? pageWindow.topicArray : window.topicArray;
      const bodyText = document.body?.innerText || "";
      const loaded = /题库练习加载完毕|可以开始答题|共计试题/.test(bodyText);

      if (Array.isArray(data)) {
        if (data.length === lastLength) {
          stableTimes += 1;
        } else {
          stableTimes = 0;
          lastLength = data.length;
        }

        if (data.length > 0 && (loaded || stableTimes >= 4)) return data;
      }

      await sleep(250);
    }
    return pageWindow.topicArray || window.topicArray || [];
  }

  function makePanel() {
    if (document.getElementById("sgcc-topic-export-panel")) return null;

    const panel = document.createElement("div");
    panel.id = "sgcc-topic-export-panel";
    panel.style.cssText = [
      "position:fixed",
      "right:20px",
      "top:80px",
      "z-index:999999",
      "display:flex",
      "flex-direction:column",
      "gap:8px",
      "font-size:14px",
      "font-family:Arial,'Microsoft YaHei',sans-serif"
    ].join(";");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = "导出本专业全部等级";
    btn.style.cssText = [
      "padding:10px 14px",
      "border:0",
      "border-radius:4px",
      "background:#0aa",
      "color:white",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,.2)"
    ].join(";");

    const tip = document.createElement("div");
    tip.style.cssText = [
      "max-width:220px",
      "padding:6px 8px",
      "border-radius:4px",
      "background:rgba(0,0,0,.68)",
      "color:#fff",
      "line-height:1.5",
      "display:none"
    ].join(";");

    panel.append(btn, tip);
    document.body.appendChild(panel);
    return { btn, tip };
  }

  function setTip(tip, text) {
    if (!tip) return;
    tip.innerText = text;
    tip.style.display = text ? "block" : "none";
  }

  async function goToLevel(level, state, tip) {
    await openSinglePracticeMenu();
    const entry = findLevelEntrypoint(level);
    if (!entry) {
      state.results.push({ level, status: "未找到入口" });
      state.index += 1;
      setState(state);
      setTip(tip, `未找到 ${level}，跳过`);
      await sleep(600);
      detailContinueBusy = false;
      return continueFromDetail(tip);
    }

    const majorName = normalizeMajorName(state.majorName || detectMajorName());
    const currentFilename = makeDownloadFilename(majorName, level);

    setTip(tip, `进入 ${level}：${currentFilename}`);
    setState({ ...state, majorName, currentLevel: level, currentFilename });
    await sleep(300);

    if (entry.topicUrl) {
      window.open(entry.topicUrl, "_blank");
      return;
    }

    entry.el.setAttribute("target", "_blank");
    entry.el.click();
  }

  function waitForTopicPageAndContinue(tip) {
    setTimeout(() => {
      const state = getState();
      if (!state?.active || state.currentLevel || TOPIC_PAGE_RE.test(location.pathname)) return;
      continueFromDetail(tip);
    }, 2500);
  }

  async function continueFromDetail(tip) {
    if (!TOPIC_PAGE_RE.test(location.pathname)) {
      if (detailContinueBusy) return;
      detailContinueBusy = true;
    }

    const state = getState();
    if (!state?.active) {
      detailContinueBusy = false;
      return;
    }

    const levels = state.levels?.length ? state.levels : LEVELS;

    if (state.index >= levels.length) {
      const failed = state.results.filter((item) => item.status !== "已下载");
      clearState();
      setTip(tip, failed.length ? `完成，${failed.length} 个等级未导出` : "全部等级导出完成");
      alert(failed.length ? `导出完成，但有 ${failed.length} 个等级未导出，请看控制台。` : "本专业全部等级导出完成。");
      if (failed.length) console.warn("[题库导出] 未完成等级", failed);
      detailContinueBusy = false;
      return;
    }

    await sleep(800);
    await goToLevel(levels[state.index], state, tip);
    waitForTopicPageAndContinue(tip);
    setTimeout(() => {
      detailContinueBusy = false;
    }, 1200);
  }

  async function exportTopicPage(tip) {
    const state = getState();
    if (!state?.active) return;

    const levels = state.levels?.length ? state.levels : LEVELS;
    const level = detectLevelName(state.currentLevel || levels[state.index]);
    const major = detectMajorName(state.majorName);
    const filename = state.currentFilename || makeDownloadFilename(major, level);
    setTip(tip, `正在导出 ${filename} ...`);

    const data = await waitForTopicArray();
    downloadText(filename, JSON.stringify(data || [], null, 2));

    const nextState = {
      ...state,
      majorName: major,
      index: state.index + 1,
      currentLevel: "",
      currentFilename: "",
      results: [...state.results, { level, filename, status: "已下载", count: Array.isArray(data) ? data.length : 0 }]
    };
    setState(nextState);

    setTip(tip, `${level} 已下载，关闭题目页 ...`);
    closeOrReturn(state.detailUrl);
  }

  async function startExportAll(tip) {
    setTip(tip, "已点击，正在识别单题练习菜单...");
    console.log("[题库导出] 开始导出", location.href);

    if (TOPIC_PAGE_RE.test(location.pathname)) {
      alert("请先回到自测活动详情页，再点击“导出本专业全部等级”。");
      return;
    }

    const hasPracticeMenu = await openSinglePracticeMenu();
    setTip(tip, hasPracticeMenu ? "已找到单题练习，准备识别等级..." : "未找到单题练习，尝试直接扫描等级...");

    if (!hasPracticeMenu && !LEVELS.some((level) => document.body?.innerText?.includes(level))) {
      alert("请先从主目录进入某个专业的自测活动详情页，再点击“导出本专业全部等级”。");
      return;
    }

    const majorName = detectMajorName();
    const levels = await collectAvailableLevels(tip);
    if (!levels.length) {
      alert("没有识别到本专业的等级入口，请先把鼠标停在“单题练习”上确认菜单能展开。");
      return;
    }

    const state = {
      active: true,
      detailUrl: location.href,
      majorName,
      levels,
      index: 0,
      currentLevel: "",
      currentFilename: "",
      results: []
    };
    setState(state);
    continueFromDetail(tip);
  }

  const panel = makePanel();
  const tip = panel?.tip;
  if (panel) {
    panel.btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startExportAll(tip).catch((error) => {
        console.error("[题库导出] 启动失败", error);
        setTip(tip, `启动失败：${error.message || error}`);
        alert(`启动失败：${error.message || error}`);
      });
    });
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type === "sgcc-topic-export-done") {
      continueFromDetail(tip);
    }
  });

  if (!TOPIC_PAGE_RE.test(location.pathname)) {
    setInterval(() => {
      const state = getState();
      if (!state?.active || state.currentLevel) return;
      continueFromDetail(tip);
    }, 3000);
  }

  if (TOPIC_PAGE_RE.test(location.pathname)) {
    exportTopicPage(tip);
  } else if (DETAIL_PAGE_RE.test(location.href) || getState()?.active) {
    continueFromDetail(tip);
  }
})();
