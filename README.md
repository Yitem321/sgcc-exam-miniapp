# sgcc-exam-miniapp

第一阶段只做 txt 题库解析，不做前端、小程序或数据库。

## 目录结构

```text
sgcc-exam-miniapp/
  raw_txt/
  data/parsed/
  scripts/
    parse_txt_question_bank.py
  README.md
```

## txt 文件放哪里

把未解析的 txt 题库放到项目内 `raw_txt/` 目录。脚本会递归扫描所有子目录中的 `.txt` 文件。

当前解析器支持 `topicArray.push({...})` 形式的题库 txt，也会兼容字段缺少引号和冒号的变体。

示例：

```text
raw_txt/
  （2026版）技能等级评价通信运维检修工专业知识考试练习/
    （2026版）技能等级评价通信运维检修工专业知识考试练习（初级工）.txt
    （2026版）技能等级评价通信运维检修工专业知识考试练习（中级工）.txt
    （2026版）技能等级评价通信运维检修工专业知识考试练习（高级工）.txt
    （2026版）技能等级评价通信运维检修工专业知识考试练习（技师）.txt
    （2026版）技能等级评价通信运维检修工专业知识考试练习（高级技师）.txt
    （2026版）技能等级评价物资仓储作业员专业知识考试练习（共用试题）.txt
```

## 如何运行解析

使用默认输入和输出目录：

```bash
python scripts/parse_txt_question_bank.py
```

显式指定输入和输出目录：

```bash
python scripts/parse_txt_question_bank.py --input raw_txt --output data/parsed
```

默认输入目录是项目内 `raw_txt/`，默认输出目录是项目内 `data/parsed/`。脚本会自动识别项目根目录，不依赖当前电脑盘符。

## 输出文件在哪里

解析结果会生成在 `data/parsed/`：

- `questions.jsonl`：解析后的题目，每行一个 JSON 对象。
- `questions.json`：解析后的题目 JSON 数组。
- `questions_grouped.json`：按 `专业 -> 等级 -> 题目列表` 分组的 JSON。
- `questions.xlsx`：Excel 版本，列为 `题干`、`答案`、`选项A`、`选项B`、`选项C`、`选项D`。
- `summary.json`：解析统计，包括总题数、失败数、年份、专业、等级和题型分布。
- `failed.txt`：未识别题目、答案缺失或题干缺失的记录。

如果 `questions.xlsx` 正在被 Excel 打开，脚本会改写到 `questions_updated.xlsx`。

输出题目会按题型排序：单选题、多选题、判断题、简答题、论述题、案例分析题、未知。

`questions.jsonl` 单行格式：

```json
{
  "id": "稳定ID",
  "year": "2026",
  "major": "通信运维检修工",
  "level": "初级工",
  "source_file": "原始文件名",
  "question_type": "单选题/多选题/判断题/简答题/论述题/案例分析题/未知",
  "question": "题干",
  "options": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  },
  "answer": "A",
  "analysis": "",
  "raw": "原始题目文本"
}
```

## 如何查看失败题目

运行解析后打开：

```text
data/parsed/failed.txt
```

如果里面有内容，优先查看每条记录的“原因”和“原文”。这些题目通常是 txt 格式不规则、题干缺失或答案缺失，需要根据实际样本继续微调解析规则。

## 第五阶段：AI解析服务

AI解析通过本地 Node.js 后端代理完成，前端只请求 `https://api.synexa.cc/api/explain`，不会把 DeepSeek 或 OpenAI API Key 写进前端 JS。

解析结果会写入本地缓存：

```text
data/ai_explanations.json
```

同一道题再次点击“AI解析”时，会优先命中本地缓存，避免重复调用 API。

### 安装后端依赖

```bash
cd server
npm install
```

### 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

只配置 DeepSeek 也可以：

```text
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
AI_PROVIDER=deepseek
AI_FALLBACK_PROVIDER=openai
```

只配置 OpenAI 也可以：

```text
OPENAI_API_KEY=xxx
OPENAI_MODEL=请填写你要使用的OpenAI模型
AI_PROVIDER=openai
AI_FALLBACK_PROVIDER=deepseek
```

两个都配置时，默认优先 DeepSeek，DeepSeek 失败、超时、余额不足或接口异常时会自动切换 OpenAI：

```text
DEEPSEEK_API_KEY=xxx
OPENAI_API_KEY=xxx
AI_PROVIDER=deepseek
AI_FALLBACK_PROVIDER=openai
```

如果两个 Key 都没有配置，后端会返回 Mock 解析，前端仍可正常显示。

### 启动 AI解析服务

```bash
cd server
node server.js
```

默认服务地址：

```text
https://api.synexa.cc
```

### 打开前端

可以通过本地静态服务打开：

```text
web/index.html 或任意本地静态服务地址
```

也可以直接打开：

```text
web/index.html
```

### 如何测试 AI解析

1. 启动后端：`cd server && node server.js`
2. 打开 `web/index.html`，进入刷题、错题本、收藏或模拟考试结果页。
3. 点击题目旁边的“AI解析”按钮。
4. 页面会先显示“AI解析生成中...”，随后显示解析内容和来源：来自缓存、来自 DeepSeek、来自 OpenAI 或 Mock解析。

### 如何确认是否命中本地缓存

第一次点击某道题的“AI解析”后，查看：

```text
data/ai_explanations.json
```

里面会出现该题 ID 对应的解析记录。再次点击同一道题，页面来源会显示“来自缓存”。

也可以打开统计页查看“AI解析缓存统计”，包括：

- 已缓存解析数
- DeepSeek解析数
- OpenAI解析数
- Mock解析数

统计页提供“清空AI解析缓存”按钮，点击后会二次确认，再调用本地接口清空缓存。

## 第六阶段：本地解析库与会员体验

第六阶段开始，普通用户点击“AI解析”时默认不再实时调用 DeepSeek/OpenAI，而是优先读取本地预生成解析库：

```text
data/analysis/ai_explanations.json
```

为了兼容以 `web/` 作为静态服务根目录的访问方式，批量生成脚本还会同步写入前端镜像文件：

```text
web/js/ai-explanations-data.js
```

前端页面会先尝试读取 `data/analysis/ai_explanations.json`，读取不到时使用 `web/js/ai-explanations-data.js` 中的本地镜像。`server` 的 `/api/explain` 接口仍保留，后续可作为管理员补充单题解析功能，但普通用户点击按钮不会默认调用该接口。

### 批量生成前20题解析

先在 `server/.env` 中配置 DeepSeek：

```text
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

然后运行：

```bash
python scripts/generate_ai_explanations.py --limit 20
```

### 指定专业和等级生成

```bash
python scripts/generate_ai_explanations.py --major 通信运维检修工 --level 初级工 --limit 50
```

脚本会读取：

```text
data/parsed/questions.json
```

输出：

```text
data/analysis/ai_explanations.json
data/analysis/failed_explanations.txt
web/js/ai-explanations-data.js
```

如果某题已经存在解析，会自动跳过，避免重复生成。可使用 `--resume` 表示断点续跑：

```bash
python scripts/generate_ai_explanations.py --resume
```

控制台会显示总题数、已有解析数、本次生成数、失败数和剩余数。

### 测试免费5题限制

前端使用 localStorage 记录体验状态：

```text
analysis_free_used_count
analysis_viewed_question_ids
```

免费用户可查看 5 道不同题目的解析。同一道题重复打开不会重复计数。第 6 道已生成解析会弹出提示：

```text
免费解析体验已用完。开通VIP后可查看全部AI解析、错题解析和模拟考试解析。
```

### 模拟VIP

首页“会员状态”卡片提供“模拟开通VIP”按钮，点击后写入：

```text
is_vip=true
```

之后可无限查看本地解析库中的解析。首页也提供“重置体验状态”按钮，仅用于本地开发测试，会清除免费次数、已查看题目和 VIP 状态。


