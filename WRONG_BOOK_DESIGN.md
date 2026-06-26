# 错题强化模块设计方案

## 1. 目标

重构当前错题本与题目导航状态体系，将“错题本”从简单的错题 ID 列表升级为可追踪、可复习、可评估掌握度的学习系统。

核心目标：

- 题目状态从“未做/正确/错误”升级为“未做/最近错/待巩固/已掌握”。
- 错题本不再因为做对一次就移出，而是基于连续正确次数和复习间隔判断。
- 会员用户获得“智能错题强化”能力，包括今日待复习、高风险遗忘、即将掌握、高频错题、考前冲刺。
- 保持免费用户仍可使用基础错题本，不影响当前刷题体验。

## 2. 当前现状

### 2.1 小程序本地数据

当前主要依赖微信本地缓存：

```js
records = {
  [questionId]: {
    selected: ["A"],
    correct: false,
    major: "...",
    level: "...",
    type: "单选题",
    answeredAt: 1710000000000
  }
}

wrongIds = ["questionId1", "questionId2"]
```

### 2.2 服务端数据

当前服务端通过 `/api/users/me/study-records` 同步：

```js
{
  openid,
  records,
  wrongIds,
  updatedAt
}
```

服务端现阶段使用 JSON 文件保存：

- `data/user_study_records.json`
- `data/ai_analysis_memberships.json`

### 2.3 当前问题

- `records[questionId]` 只保留最后一次答题结果，缺少历史过程。
- `wrongIds` 是简单列表，无法判断“最近错”“曾经错但最近对”“连续正确”。
- 做对一次后容易被移出错题本，复习强度不够。
- 题目导航状态过于简单，不能表达“待巩固”和“已掌握”的区别。
- 会员功能还没有形成差异化的智能学习价值。

## 3. 新题目状态系统

### 3.1 状态定义

题目状态不再直接等同于最后一次答题对错，而是由历史记录和掌握度共同决定。

| 状态 | 颜色 | 含义 | 判断条件 |
| --- | --- | --- | --- |
| 未做 | 白色 | 从未答过 | 无学习记录 |
| 最近错误 | 红色 | 最近一次答错或连续答错 | `lastCorrect === false` 或 `consecutiveWrong > 0` |
| 待巩固 | 黄色 | 曾经答错，最近答对，但尚未掌握 | `wrongCount > 0` 且 `lastCorrect === true` 且 `consecutiveCorrect < 2` |
| 已掌握 | 绿色 | 连续正确 2 次以上 | `consecutiveCorrect >= 2` |

### 3.2 导航图例

题目导航弹层顶部增加图例：

```text
● 红色：最近答错
● 黄色：待巩固
● 绿色：已掌握
○ 白色：未做
```

### 3.3 UI 行为

题目导航中的题号颜色按状态显示：

- 白色卡片：未做。
- 红色卡片：最近一次答错或连续答错。
- 黄色卡片：曾经错过，但最近答对，还需要巩固。
- 绿色卡片：连续正确 2 次以上，已达到掌握标准。

当前题目可以继续用黑色描边或加粗阴影表示，避免与状态颜色冲突。

## 4. 错题本系统

### 4.1 进入错题本条件

只要题目出现过错误记录，即进入错题本。

```js
shouldEnterWrongBook = wrongCount > 0
```

注意：

- 不要求最近一次仍然错误。
- 只要曾经错过，就应当进入错题本进行巩固。
- 后续是否展示在“待复习”列表中，由智能复习计划决定。

### 4.2 移出错题本条件

不要因为做对一次就移出。

题目必须同时满足：

```js
consecutiveCorrect >= 3
&& now - lastReviewTime >= 7 * 24 * 60 * 60 * 1000
```

含义：

- 连续正确 3 次，说明短期内已经较稳定。
- 距离上次复习超过 7 天仍然保持正确，说明不是短期记忆。

### 4.3 错题本分类

错题本列表建议分为：

| 分类 | 条件 | 展示目的 |
| --- | --- | --- |
| 今日待复习 | `nextReviewTime <= now` | 用户当天应该优先处理 |
| 最近答错 | `lastCorrect === false` | 最危险、最需要马上复盘 |
| 待巩固 | `wrongCount > 0 && lastCorrect === true && consecutiveCorrect < 3` | 做对过但还没稳定 |
| 即将移出 | `consecutiveCorrect >= 3 && lastReviewTime < 7天` | 告诉用户还差时间验证 |
| 已掌握归档 | 达到移出条件 | 默认不展示，可在历史中查看 |

## 5. 智能错题强化字段

每道题增加以下学习状态字段。

### 5.1 字段定义

```js
questionLearningState = {
  questionId: "string",
  openid: "string",

  wrongCount: 0,
  rightCount: 0,
  consecutiveCorrect: 0,
  consecutiveWrong: 0,

  lastCorrect: null,
  lastSelected: "",
  lastReviewTime: 0,
  nextReviewTime: 0,

  masteryScore: 0,
  status: "unseen",

  firstWrongTime: 0,
  lastWrongTime: 0,
  firstAnswerTime: 0,
  updatedAt: 0
}
```

### 5.2 字段解释

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `wrongCount` | number | 累计答错次数 |
| `rightCount` | number | 累计答对次数 |
| `consecutiveCorrect` | number | 连续答对次数 |
| `consecutiveWrong` | number | 连续答错次数 |
| `lastCorrect` | boolean/null | 最近一次是否正确 |
| `lastSelected` | string | 最近一次选择的答案 |
| `lastReviewTime` | timestamp | 最近一次复习时间 |
| `nextReviewTime` | timestamp | 下次建议复习时间 |
| `masteryScore` | number | 掌握度，范围 0-100 |
| `status` | string | `unseen/red/yellow/green/mastered` |
| `firstWrongTime` | timestamp | 第一次答错时间 |
| `lastWrongTime` | timestamp | 最近一次答错时间 |
| `firstAnswerTime` | timestamp | 第一次答题时间 |
| `updatedAt` | timestamp | 状态更新时间 |

## 6. 数据库结构

项目当前可以继续用 JSON 文件落地，但设计上建议按数据库表抽象，方便之后迁移 MySQL、SQLite、PostgreSQL 或云数据库。

### 6.1 用户答题事件表

表名：`question_answer_events`

用于保存每一次答题事件，不覆盖历史。

```sql
CREATE TABLE question_answer_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  selected_answer VARCHAR(32) NOT NULL,
  correct_answer VARCHAR(32) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  source VARCHAR(32) NOT NULL,
  major VARCHAR(128),
  level VARCHAR(64),
  question_type VARCHAR(32),
  answered_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
```

字段说明：

- `source` 可取值：`quiz`、`exam`、`wrong_book`、`smart_review`、`sprint`。
- 该表用于复盘历史、统计高频错题和计算掌握度。

### 6.2 用户题目学习状态表

表名：`user_question_states`

用于保存每个用户每道题的最新学习状态。

```sql
CREATE TABLE user_question_states (
  openid VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,

  wrong_count INT NOT NULL DEFAULT 0,
  right_count INT NOT NULL DEFAULT 0,
  consecutive_correct INT NOT NULL DEFAULT 0,
  consecutive_wrong INT NOT NULL DEFAULT 0,

  last_correct BOOLEAN,
  last_selected VARCHAR(32),
  last_review_time BIGINT,
  next_review_time BIGINT,

  mastery_score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'unseen',

  first_wrong_time BIGINT,
  last_wrong_time BIGINT,
  first_answer_time BIGINT,
  updated_at BIGINT NOT NULL,

  PRIMARY KEY (openid, question_id)
);
```

索引建议：

```sql
CREATE INDEX idx_user_question_next_review
ON user_question_states(openid, next_review_time);

CREATE INDEX idx_user_question_status
ON user_question_states(openid, status);

CREATE INDEX idx_user_question_wrong_count
ON user_question_states(openid, wrong_count);
```

### 6.3 错题本视图

错题本不建议继续作为独立 ID 列表维护，而应由学习状态动态计算。

```sql
CREATE VIEW wrong_book_items AS
SELECT *
FROM user_question_states
WHERE wrong_count > 0
AND NOT (
  consecutive_correct >= 3
  AND last_review_time <= UNIX_TIMESTAMP_MILLIS() - 7 * 24 * 60 * 60 * 1000
);
```

如果继续使用 JSON 文件，可以保存为：

```js
userStudyRecords = {
  [openid]: {
    records: {},
    wrongIds: [],
    questionStates: {
      [questionId]: questionLearningState
    },
    answerEvents: []
  }
}
```

## 7. 算法设计

### 7.1 答题后状态更新

每次提交答案时执行：

```js
function updateQuestionState(state, answerEvent) {
  const now = answerEvent.answeredAt || Date.now();
  const correct = answerEvent.isCorrect;

  if (!state.firstAnswerTime) state.firstAnswerTime = now;

  state.lastSelected = answerEvent.selectedAnswer;
  state.lastCorrect = correct;
  state.lastReviewTime = now;
  state.updatedAt = now;

  if (correct) {
    state.rightCount += 1;
    state.consecutiveCorrect += 1;
    state.consecutiveWrong = 0;
  } else {
    state.wrongCount += 1;
    state.consecutiveWrong += 1;
    state.consecutiveCorrect = 0;
    state.lastWrongTime = now;
    if (!state.firstWrongTime) state.firstWrongTime = now;
  }

  state.masteryScore = calculateMasteryScore(state, now);
  state.status = calculateQuestionStatus(state, now);
  state.nextReviewTime = calculateNextReviewTime(state, now);

  return state;
}
```

### 7.2 状态计算

```js
function calculateQuestionStatus(state) {
  if (!state.firstAnswerTime) return "unseen";
  if (state.lastCorrect === false || state.consecutiveWrong > 0) return "red";
  if (state.wrongCount > 0 && state.consecutiveCorrect < 2) return "yellow";
  if (state.consecutiveCorrect >= 2) return "green";
  return "yellow";
}
```

### 7.3 错题本保留判断

```js
function shouldStayInWrongBook(state, now) {
  if (state.wrongCount <= 0) return false;

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const enoughCorrect = state.consecutiveCorrect >= 3;
  const enoughInterval = state.lastReviewTime && now - state.lastReviewTime >= sevenDays;

  return !(enoughCorrect && enoughInterval);
}
```

### 7.4 掌握度 masteryScore

`masteryScore` 范围为 0-100。

建议公式：

```js
function calculateMasteryScore(state, now) {
  let score = 50;

  score += Math.min(state.rightCount * 6, 24);
  score += Math.min(state.consecutiveCorrect * 14, 42);
  score -= Math.min(state.wrongCount * 10, 40);
  score -= Math.min(state.consecutiveWrong * 18, 36);

  const daysSinceReview = state.lastReviewTime
    ? (now - state.lastReviewTime) / (24 * 60 * 60 * 1000)
    : 999;

  score -= Math.min(daysSinceReview * 2, 20);

  if (state.consecutiveCorrect >= 3) score += 10;
  if (state.lastCorrect === false) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

解释：

- 答对和连续答对增加掌握度。
- 答错、连续答错、长期未复习降低掌握度。
- 最近一次答错权重较高。
- 连续正确 3 次给额外稳定性加分。

### 7.5 艾宾浩斯复习间隔

智能错题强化使用复习间隔队列。

基础间隔：

```js
const REVIEW_INTERVALS = [
  10 * 60 * 1000,
  1 * 24 * 60 * 60 * 1000,
  2 * 24 * 60 * 60 * 1000,
  4 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  15 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
];
```

### 7.6 下次复习时间

```js
function calculateNextReviewTime(state, now) {
  if (state.lastCorrect === false) {
    return now + 10 * 60 * 1000;
  }

  const stage = Math.max(0, Math.min(state.consecutiveCorrect, REVIEW_INTERVALS.length - 1));
  let interval = REVIEW_INTERVALS[stage];

  if (state.masteryScore < 40) interval *= 0.6;
  if (state.masteryScore >= 80) interval *= 1.3;

  return now + Math.round(interval);
}
```

规则：

- 答错后 10 分钟内建议再次复习。
- 连续正确次数越多，复习间隔越长。
- 掌握度低时缩短间隔。
- 掌握度高时延长间隔。

### 7.7 高风险遗忘

高风险题目条件：

```js
nextReviewTime < now
&& masteryScore < 60
&& wrongCount > 0
```

排序：

```text
逾期时间越长越靠前
masteryScore 越低越靠前
wrongCount 越高越靠前
```

### 7.8 即将掌握

即将掌握题目条件：

```js
wrongCount > 0
&& consecutiveCorrect >= 2
&& consecutiveCorrect < 3
&& masteryScore >= 70
```

这类题目适合鼓励用户再巩固一次。

### 7.9 高频错题统计

统计维度：

- 按题目：`wrongCount DESC`
- 按题型：单选、多选、判断错误率
- 按专业：不同专业错题分布
- 按知识点：如果未来题库有 `knowledgePoint` 字段，可按知识点聚合

## 8. 会员功能设计

### 8.1 免费版

免费用户保留基础错题本能力：

- 查看错题列表。
- 手动进入错题练习。
- 题目导航显示白/红/黄/绿状态。
- 错题本移出规则仍按“连续正确 3 次且间隔超过 7 天”执行。
- 可查看基础统计：错题数量、今日答题数、正确率。

限制：

- 不提供智能复习排序。
- 不展示高风险遗忘。
- 不展示即将掌握。
- 不展示高频错题深度统计。
- 不提供考前冲刺模式。

### 8.2 会员版：智能错题强化

会员专属能力：

1. 智能复习计划
2. 今日待复习
3. 高风险遗忘
4. 即将掌握
5. 高频错题统计
6. 考前冲刺模式

### 8.3 智能复习计划

入口：错题本首页顶部卡片。

展示：

```text
今日待复习 18 题
高风险遗忘 6 题
即将掌握 4 题
预计用时 12 分钟
```

按钮：

```text
开始智能复习
```

排序规则：

```text
高风险遗忘 > 今日到期 > 最近答错 > 即将掌握
```

### 8.4 今日待复习

筛选：

```js
nextReviewTime <= endOfToday
&& wrongCount > 0
&& !mastered
```

UI：

- 题目卡片左侧显示状态色。
- 右侧显示“建议今天复习”。
- 展示 `masteryScore` 和上次复习时间。

### 8.5 高风险遗忘

筛选：

```js
nextReviewTime < now
&& masteryScore < 60
&& wrongCount >= 1
```

UI：

- 使用红橙渐变卡片。
- 显示“已逾期 X 天”。
- 显示“错过 N 次”。

### 8.6 即将掌握

筛选：

```js
consecutiveCorrect >= 2
&& consecutiveCorrect < 3
&& masteryScore >= 70
```

UI：

- 使用绿色浅底。
- 显示“再连续答对 1 次可移出错题本”。

### 8.7 高频错题统计

展示维度：

- 错最多的 10 道题。
- 最容易错的题型。
- 最近 7 天错题趋势。
- 高频错误选项统计。

UI 建议：

- 卡片式榜单。
- 条形进度条显示错误次数。
- 点击题目进入复盘。

### 8.8 考前冲刺模式

目标：在考试前优先处理高价值错题。

选题规则：

```text
1. 高风险遗忘题
2. wrongCount 高的题
3. 最近 7 天答错题
4. 即将掌握题
5. 高频题型错题
```

默认生成：

```text
20 题冲刺
40 题冲刺
自定义数量
```

答题后：

- 正常更新学习状态。
- 更新 `nextReviewTime`。
- 更新 `masteryScore`。
- 达到移出条件时给出正反馈。

## 9. UI 设计

### 9.1 错题本首页

页面结构：

```text
错题强化
├─ 智能复习计划卡片（会员）
├─ 今日待复习 / 高风险遗忘 / 即将掌握
├─ 错题分类 Tabs
│  ├─ 全部错题
│  ├─ 最近答错
│  ├─ 待巩固
│  └─ 已掌握归档
└─ 错题列表
```

免费用户看到：

```text
基础错题本
├─ 错题总数
├─ 最近答错
├─ 待巩固
└─ 升级智能错题强化卡片
```

### 9.2 题目卡片

题目卡片信息：

```text
题型标签       状态标签
题干摘要
错过 3 次 | 连续正确 1 次 | 掌握度 42
下次复习：今天 20:30
```

状态标签：

- 红色：最近答错
- 黄色：待巩固
- 绿色：已掌握

### 9.3 题目导航

导航弹层：

```text
题目导航
● 最近答错  ● 待巩固  ● 已掌握  ○ 未做

单选题  6 / 10
[1][2][3][4][5]

多选题  2 / 5
[1][2][3][4][5]

判断题  4 / 5
[1][2][3][4][5]
```

注意：

- 题号按当前练习列表内顺序展示。
- 如果按题型分组，每个题型内部从 1 开始编号。
- 当前题目增加外描边或阴影。

### 9.4 掌握度展示

建议使用细进度条：

```text
掌握度 72
[███████---]
```

颜色：

- 0-39：红色
- 40-69：黄色
- 70-100：绿色

## 10. API 设计

### 10.1 提交答题记录

```http
POST /api/users/me/answer-event
```

请求：

```json
{
  "openid": "xxx",
  "questionId": "q1",
  "selectedAnswer": "A",
  "correctAnswer": "B",
  "isCorrect": false,
  "source": "quiz",
  "major": "电力...",
  "level": "初级工",
  "questionType": "单选题",
  "answeredAt": 1710000000000
}
```

响应：

```json
{
  "success": true,
  "state": {
    "questionId": "q1",
    "wrongCount": 2,
    "rightCount": 1,
    "consecutiveCorrect": 0,
    "lastReviewTime": 1710000000000,
    "nextReviewTime": 1710000600000,
    "masteryScore": 18,
    "status": "red"
  }
}
```

### 10.2 获取错题本

```http
GET /api/users/me/wrong-book?filter=all
```

可选 filter：

- `all`
- `recent_wrong`
- `due_today`
- `high_risk`
- `almost_mastered`
- `archived`

### 10.3 获取智能复习计划

```http
GET /api/users/me/smart-review-plan
```

响应：

```json
{
  "dueTodayCount": 18,
  "highRiskCount": 6,
  "almostMasteredCount": 4,
  "estimatedMinutes": 12,
  "questionIds": ["q1", "q2"]
}
```

### 10.4 获取高频错题统计

```http
GET /api/users/me/wrong-stats
```

响应：

```json
{
  "topWrongQuestions": [],
  "byType": {},
  "trend7Days": [],
  "commonWrongOptions": []
}
```

## 11. 迁移方案

### 11.1 本地数据迁移

从当前 `records` 和 `wrongIds` 生成新结构。

旧数据：

```js
records[id] = {
  selected,
  correct,
  answeredAt
}
wrongIds = [id]
```

迁移规则：

```js
for each questionId in union(Object.keys(records), wrongIds):
  const record = records[questionId]
  const wasWrong = wrongIds.includes(questionId) || record.correct === false

  state.wrongCount = wasWrong ? 1 : 0
  state.rightCount = record && record.correct ? 1 : 0
  state.consecutiveCorrect = record && record.correct ? 1 : 0
  state.consecutiveWrong = record && record.correct === false ? 1 : 0
  state.lastCorrect = record ? record.correct : false
  state.lastSelected = record ? record.selected.join("") : ""
  state.lastReviewTime = record ? record.answeredAt : Date.now()
  state.nextReviewTime = calculateNextReviewTime(state, Date.now())
  state.masteryScore = calculateMasteryScore(state, Date.now())
  state.status = calculateQuestionStatus(state)
```

迁移后保留旧字段一段时间：

```js
wx.setStorageSync("records_v1_backup", records)
wx.setStorageSync("wrongIds_v1_backup", wrongIds)
```

### 11.2 服务端数据迁移

服务端 JSON 文件迁移：

```js
data/user_study_records.json
```

从：

```js
{
  [openid]: {
    records,
    wrongIds,
    updatedAt
  }
}
```

迁移到：

```js
{
  [openid]: {
    records,
    wrongIds,
    questionStates,
    answerEvents,
    migratedAt,
    updatedAt
  }
}
```

### 11.3 灰度策略

第一阶段：

- 新增 `questionStates`。
- 保留 `records` 和 `wrongIds`。
- UI 仍从旧字段读取，后台同时写新字段。

第二阶段：

- 题目导航改用 `questionStates`。
- 错题本入口改用 `wrongCount > 0`。
- `wrongIds` 仅作为兼容字段同步。

第三阶段：

- 错题本完全使用 `questionStates`。
- `wrongIds` 改为派生字段。
- 后端接口返回智能错题强化数据。

## 12. 兼容策略

### 12.1 离线可用

本地必须保存：

- `questionStates`
- `answerEvents` 最近 N 条
- `lastSmartReviewPlan`

联网后再同步到服务端。

### 12.2 登录前后

未登录：

- 所有状态先保存在本地。
- 可使用基础错题本。

登录后：

- 上传本地 `questionStates` 和 `answerEvents`。
- 服务端按 `updatedAt` 或事件时间合并。
- 合并后回写本地。

### 12.3 多端合并

推荐以答题事件为准：

```text
合并 answerEvents -> 重放计算 questionStates
```

如果只合并状态，可能丢失连续正确和复习间隔细节。

## 13. 实施顺序建议

### 阶段 1：基础状态重构

- 增加 `questionStates` 本地结构。
- 答题后同时更新 `records` 和 `questionStates`。
- 题目导航支持白/红/黄/绿。
- 错题本进入/移出规则更新。

### 阶段 2：错题本页面改造

- 错题本按状态分类。
- 增加掌握度展示。
- 增加“即将移出”提示。

### 阶段 3：会员智能错题强化

- 增加智能复习计划。
- 增加今日待复习。
- 增加高风险遗忘。
- 增加即将掌握。

### 阶段 4：统计与考前冲刺

- 高频错题统计。
- 考前冲刺模式。
- 复习计划完成反馈。

### 阶段 5：服务端持久化

- 新增答题事件接口。
- 新增题目状态接口。
- 支持登录后多端同步。

## 14. 验收标准

### 14.1 状态颜色

- 未做题显示白色。
- 最近答错显示红色。
- 曾经答错但最近答对、尚未掌握显示黄色。
- 连续正确 2 次以上显示绿色。

### 14.2 错题本

- 题目一旦答错，进入错题本。
- 做对一次不会移出。
- 连续正确 3 次但未超过 7 天，不移出。
- 连续正确 3 次且超过 7 天，移出或归档。

### 14.3 会员能力

- 会员可看到智能复习计划。
- 会员可进入今日待复习。
- 会员可查看高风险遗忘。
- 会员可查看即将掌握。
- 会员可查看高频错题统计。
- 会员可使用考前冲刺模式。

### 14.4 数据安全

- 旧 `records` 和 `wrongIds` 可迁移。
- 迁移后旧数据有备份。
- 未登录用户也能正常使用本地错题本。
- 登录后可同步学习记录。

## 15. 命名建议

模块命名：

- 页面名称：`错题强化`
- 会员功能名：`智能错题强化`
- 复习入口：`今日智能复习`
- 高风险模块：`高风险遗忘`
- 激励文案：`再答对 1 次，接近掌握`

状态枚举：

```js
const QUESTION_STATUS = {
  UNSEEN: "unseen",
  RECENT_WRONG: "red",
  NEED_REINFORCE: "yellow",
  MASTERED: "green"
};
```

## 16. 关键取舍

### 16.1 为什么不做对一次就移出

做对一次可能只是短期记忆或猜对。错题强化的目标不是“清空错题”，而是确认题目真正稳定掌握。

### 16.2 为什么绿色标准是连续正确 2 次

绿色用于导航里的“初步掌握”提示，不等同于移出错题本。移出错题本需要更严格的连续正确 3 次和 7 天间隔。

### 16.3 为什么需要黄色状态

黄色承接“错过但最近做对”的中间状态，可以避免用户误以为做对一次就完全掌握。

### 16.4 为什么会员功能要围绕复习计划

AI 解析解决“看懂”，智能错题强化解决“记住”。两者可以形成会员价值闭环。

