# 小程序上线检查清单

检查日期：2026-06-11

## 当前版本定位

- 正式版方向：远程全量题库刷题工具。
- 服务端：`server/server.js` 提供题库 API 和现有 AI 解析代理接口。
- 题库来源：服务端读取 `data/parsed/questions.json`，当前全量题库 `237667` 题，覆盖 `65` 个专业。
- 小程序端：通过 `https://api.synexa.cc` 获取题库目录、统计和题目列表。
- 当前版本不包含用户登录、广告、会员、支付或云端同步答题记录。
- 答题记录、错题、收藏和考试结果保存在微信小程序本地存储。

## 已完成的代码检查

- 服务端题库接口本地验证通过：
  - `GET /health`
  - `GET /api/catalog`
  - `GET /api/stats?major=通信运维检修工&level=初级工`
  - `GET /api/questions?major=通信运维检修工&level=初级工&type=单选题&limit=2`
- 小程序核心 JS 语法检查通过：
  - `pages/index/index.js`
  - `pages/quiz/quiz.js`
  - `pages/exam/exam.js`
  - `pages/wrong/wrong.js`
  - `pages/favorites/favorites.js`
  - `pages/result/result.js`
  - `utils/api.js`
  - `utils/config.js`
  - `utils/question-service.js`
- JSON 配置可解析：
  - `app.json`
  - `project.config.json`
  - 页面 JSON 配置
- 预计上传包约 `396KB`，仍低于 2MB 主包限制。
- `project.config.json` 已排除 `data/ai_explanations.js`。
- 小程序 API 默认地址为 `https://api.synexa.cc`。

## 服务端接口验收

部署到腾讯云后，在服务器或本地终端验证：

```bash
curl https://api.synexa.cc/health
curl "https://api.synexa.cc/api/catalog"
curl "https://api.synexa.cc/api/stats?major=通信运维检修工&level=初级工"
curl "https://api.synexa.cc/api/questions?major=通信运维检修工&level=初级工&type=单选题&limit=2"
```

期望结果：

- `/health` 返回 `success: true`，`questionTotal` 为 `237667`。
- `/api/catalog` 返回专业和等级列表。
- `/api/stats` 返回当前题库统计。
- `/api/questions` 返回题目数组。

## 微信公众平台配置

在微信公众平台配置：

```text
开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名
```

添加：

```text
https://api.synexa.cc
```

注意：

- 必须部署有效 HTTPS 证书。
- 域名不能带路径。
- 配置后重新打开微信开发者工具或刷新项目配置。

## 微信开发者工具最终确认

由于本机 CLI 预览命令超时，最终编译需要在微信开发者工具 GUI 中确认：

- 使用微信开发者工具打开 `miniprogram` 目录。
- 点击“编译”，确认首页能正常加载专业和等级。
- 关闭“本地设置 -> 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。
- 点击“预览”，扫码真机测试。

真机至少走通：

- 首页加载全量专业/等级。
- 切换专业、等级后统计更新。
- 点击单选题、多选题、判断题统计卡进入对应题型练习。
- 顺序刷题提交答案。
- 随机练习提交答案。
- 错题自动加入错题本，并可进入错题重练。
- 收藏题目后可进入收藏练习。
- 模拟考试开始、切题、提交、查看结果。
- 打开使用说明、关于我们、隐私说明、用户协议。

## 审核提交说明建议

```text
本版本为电力职业技能考试题库练习工具。小程序通过 https://api.synexa.cc 获取题库目录、题目列表和题库统计数据，用于提供专业/等级题库选择、题型练习、顺序刷题、随机练习、模拟考试、错题本和收藏功能。当前版本不要求用户登录，不收集姓名、手机号、身份证号等个人身份信息，不接入广告、支付、会员或第三方数据统计服务。答题记录、错题、收藏和考试结果仅保存在用户本机微信小程序本地存储中。
```

## 提交审核前不要开启

- 广告激励或流量主入口。
- 会员、支付、订阅或付费解锁。
- 用户登录、手机号授权、个人身份信息收集。
- 排行榜、分享返利、邀请奖励。
- 未完成备案或未配置合法域名的接口。

这些能力如后续加入，需要同步更新隐私说明、用户协议、审核说明和微信后台能力配置。

## 部署文档

完整服务器部署方案见：

```text
DEPLOY.md
```
