import argparse
import hashlib
import http.client
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "parsed" / "questions.json"
OUTPUT_PATH = ROOT / "data" / "analysis" / "ai_explanations.json"
FAILED_PATH = ROOT / "data" / "analysis" / "failed_explanations.txt"
FRONTEND_MIRROR_PATH = ROOT / "web" / "js" / "ai-explanations-data.js"
SERVER_ENV_PATH = ROOT / "server" / ".env"
MINIPROGRAM_MAJORS = {
    "\u901a\u4fe1\u8fd0\u7ef4\u68c0\u4fee\u5de5",
    "\u7269\u8d44\u4ed3\u50a8\u4f5c\u4e1a\u5458",
    "\u7269\u8d44\u914d\u9001\u4f5c\u4e1a\u5458",
    "\u4fe1\u606f\u901a\u4fe1\u5ba2\u6237\u670d\u52a1\u4ee3\u8868",
}
MINIPROGRAM_TYPES = {"\u5355\u9009\u9898", "\u591a\u9009\u9898", "\u5224\u65ad\u9898"}


def read_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8") or "null") or fallback
    except json.JSONDecodeError:
        return fallback


def normalize_text(value) -> str:
    return str(value or "").replace("\ufeff", "").strip()


def write_outputs(records: list[dict], write_frontend_mirror: bool = True) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_text_with_retry(OUTPUT_PATH, json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    if not write_frontend_mirror:
        return
    FRONTEND_MIRROR_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_text_with_retry(
        FRONTEND_MIRROR_PATH,
        "window.LOCAL_AI_EXPLANATIONS = "
        + json.dumps(records, ensure_ascii=False, indent=2)
        + ";\n"
    )


def write_text_with_retry(path: Path, text: str, attempts: int = 8) -> None:
    last_error: Exception | None = None
    for index in range(attempts):
        try:
            path.write_text(text, encoding="utf-8")
            return
        except PermissionError as error:
            last_error = error
            time.sleep(0.5 + index * 0.25)
    if last_error:
        raise last_error


def options_text(options: dict) -> str:
    if not isinstance(options, dict) or not options:
        return "无选项"
    return "\n".join(f"{key}. {options[key]}" for key in sorted(options))


def question_fingerprint(question: dict) -> str:
    payload = {
        "question_type": normalize_text(question.get("question_type")),
        "question": normalize_text(question.get("question")),
        "options": question.get("options") or {},
        "answer": normalize_text(question.get("answer")),
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


def split_env_list(value: str) -> list[str]:
    normalized = value.replace("\n", ",").replace(";", ",")
    return [item.strip() for item in normalized.split(",") if item.strip()]


def provider_configs(env: dict[str, str]) -> list[dict[str, str]]:
    configs: list[dict[str, str]] = []
    base_url = env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = env.get("DEEPSEEK_MODEL", "deepseek-chat")

    keys = split_env_list(env.get("DEEPSEEK_API_KEYS", ""))
    if not keys and env.get("DEEPSEEK_API_KEY"):
        keys = [env.get("DEEPSEEK_API_KEY", "")]
    for index, api_key in enumerate(keys, start=1):
        configs.append(
            {
                "name": f"deepseek_{index}",
                "api_key": api_key,
                "base_url": base_url,
                "model": model,
            }
        )

    for index in range(2, 10):
        api_key = env.get(f"DEEPSEEK_API_KEY_{index}", "")
        if not api_key:
            continue
        configs.append(
            {
                "name": f"deepseek_{index}",
                "api_key": api_key,
                "base_url": env.get(f"DEEPSEEK_BASE_URL_{index}", base_url).rstrip("/"),
                "model": env.get(f"DEEPSEEK_MODEL_{index}", model),
            }
        )
    return configs


def build_prompt(question: dict) -> str:
    schema = {
        "correct_answer": "标准答案：写出正确答案并简要说明",
        "exam_point": "知识考点：提炼题目考点",
        "why": "选项辨析：解释为什么选择该答案",
        "wrong_options": "选项辨析补充：逐项说明错误选项，判断题可写易错点",
        "field_understanding": "现场应用：结合电力/通信/物资现场理解",
        "memory_tip": "记忆口诀：给出简短记忆口诀",
    }
    return "\n".join(
        [
            "你是国家电网技能等级考试辅导老师，请为固定题库预生成中文解析。",
            "只输出 JSON，不要输出 Markdown，不要输出解释 JSON 之外的文字。",
            "JSON 字段必须完全匹配：",
            json.dumps(schema, ensure_ascii=False),
            "",
            "题目信息：",
            f"专业：{question.get('major', '')}",
            f"等级：{question.get('level', '')}",
            f"题型：{question.get('question_type', '')}",
            f"题干：{question.get('question', '')}",
            "选项：",
            options_text(question.get("options", {})),
            f"正确答案：{question.get('answer', '')}",
            "",
            "要求：通俗、准确、适合考前复习；不要编造法规条文；依据不足时说明按题库答案理解。",
        ]
    )


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    parsed = json.loads(text)
    required = [
        "correct_answer",
        "exam_point",
        "why",
        "wrong_options",
        "field_understanding",
        "memory_tip",
    ]
    return {key: str(parsed.get(key, "")).strip() for key in required}


def call_deepseek(question: dict, config: dict[str, str]) -> dict:
    api_key = config.get("api_key", "")
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY")
    base_url = config.get("base_url", "https://api.deepseek.com").rstrip("/")
    model = config.get("model", "deepseek-chat")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "你只输出可解析 JSON。"},
            {"role": "user", "content": build_prompt(question)},
        ],
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))
    content = result["choices"][0]["message"]["content"]
    return extract_json(content)


def append_failed(question: dict, error: Exception) -> None:
    FAILED_PATH.parent.mkdir(parents=True, exist_ok=True)
    with FAILED_PATH.open("a", encoding="utf-8") as file:
        file.write(
            "\n".join(
                [
                    f"question_id: {question.get('id', '')}",
                    f"major: {question.get('major', '')}",
                    f"level: {question.get('level', '')}",
                    f"error: {repr(error)}",
                    "-" * 60,
                    "",
                ]
            )
        )


def is_fatal_provider_error(error: Exception) -> bool:
    if isinstance(error, RuntimeError):
        return True
    if isinstance(error, urllib.error.HTTPError):
        try:
            body = error.read().decode("utf-8", errors="ignore").lower()
        except Exception:
            body = ""
        text = f"{error.code} {error.reason} {body}".lower()
        return (
            error.code in {401, 402, 403}
            or "insufficient" in text
            or "balance" in text
            or "quota" in text
            or "api key" in text
        )
    return False


def is_retryable_provider_error(error: Exception) -> bool:
    if isinstance(error, urllib.error.HTTPError):
        return error.code == 429 or 500 <= error.code < 600
    return isinstance(error, (urllib.error.URLError, http.client.IncompleteRead, TimeoutError, json.JSONDecodeError, KeyError))


def is_rate_limit_error(error: Exception) -> bool:
    return isinstance(error, urllib.error.HTTPError) and error.code == 429


def call_with_429_fallback(
    question: dict,
    configs: list[dict[str, str]],
    fallback_until: float,
    fallback_cooldown: float,
) -> tuple[dict, dict[str, str], float]:
    now = time.time()
    if len(configs) > 1 and now < fallback_until:
        fallback_config = configs[1]
        remaining = max(0, fallback_until - now)
        print(f"备用接口冷却窗口中({remaining:.0f}s): {question.get('id', '')}")
        return call_deepseek(question, fallback_config), fallback_config, fallback_until

    primary = configs[0]
    try:
        return call_deepseek(question, primary), primary, fallback_until
    except Exception as primary_error:
        if not is_rate_limit_error(primary_error) or len(configs) == 1:
            raise
        fallback_until = time.time() + max(0.0, fallback_cooldown)
        print(f"主接口429，进入备用接口冷却窗口 {fallback_cooldown:.0f}s: {question.get('id', '')}")
        last_error: Exception = primary_error
        for fallback_config in configs[1:]:
            try:
                return call_deepseek(question, fallback_config), fallback_config, fallback_until
            except Exception as fallback_error:
                if is_fatal_provider_error(fallback_error):
                    raise
                last_error = fallback_error
        raise last_error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="批量生成本地 AI 解析库")
    parser.add_argument("--limit", type=int, default=0, help="本次最多生成多少题，0 表示不限制")
    parser.add_argument("--major", default="", help="只生成指定专业")
    parser.add_argument("--level", default="", help="只生成指定等级")
    parser.add_argument("--resume", action="store_true", help="断点续跑：跳过已有解析")
    parser.add_argument("--miniprogram", action="store_true", help="只生成小程序当前导出的4个专业和支持题型")
    parser.add_argument("--sleep", type=float, default=0.2, help="每题生成后的等待秒数，用于控制限流")
    parser.add_argument("--max-retries", type=int, default=8, help="单题遇到限流或临时网络错误时最多重试次数")
    parser.add_argument("--retry-sleep", type=float, default=30.0, help="重试基础等待秒数，遇到429会自动递增")
    parser.add_argument("--fallback-cooldown", type=float, default=300.0, help="主接口429后使用备用接口的冷却窗口秒数")
    parser.add_argument("--flush-every", type=int, default=20, help="每生成多少题写入一次输出文件，降低全量重写开销")
    parser.add_argument("--skip-frontend-mirror", action="store_true", help="生成时不同步 web/js 镜像，避免开发工具或同步盘锁文件")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    questions = load_json(QUESTIONS_PATH, [])
    existing_records = load_json(OUTPUT_PATH, [])
    if isinstance(existing_records, dict):
        existing_records = list(existing_records.values())
    existing_by_id = {item.get("question_id"): item for item in existing_records if item.get("question_id")}
    env = {**os.environ, **read_env(SERVER_ENV_PATH)}
    configs = provider_configs(env)
    if not configs:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY")

    def in_scope(question: dict) -> bool:
        major = normalize_text(question.get("major"))
        level = normalize_text(question.get("level"))
        question_type = normalize_text(question.get("question_type"))
        if args.major and major != args.major:
            return False
        if args.level and level != args.level:
            return False
        if args.miniprogram and (major not in MINIPROGRAM_MAJORS or question_type not in MINIPROGRAM_TYPES):
            return False
        question["major"] = major
        question["level"] = level
        question["question_type"] = question_type
        return True

    scoped_questions = [question for question in questions if in_scope(question)]
    question_by_id = {question.get("id"): question for question in scoped_questions if question.get("id")}
    reusable_by_fingerprint: dict[str, dict] = {}
    for record in existing_records:
        question = question_by_id.get(record.get("question_id"))
        if question:
            reusable_by_fingerprint.setdefault(question_fingerprint(question), record)
    candidates = [question for question in scoped_questions if question.get("id") not in existing_by_id]

    total = len(scoped_questions)
    generated = 0
    reused = 0
    failed = 0
    limit = max(0, args.limit)
    flush_every = max(1, args.flush_every)
    fallback_until = 0.0

    for question in candidates:
      if limit and generated >= limit:
          break
      if question.get("id") in existing_by_id:
          continue
      fingerprint = question_fingerprint(question)
      reusable = reusable_by_fingerprint.get(fingerprint)
      if reusable:
          reused_record = {
              "question_id": question.get("id", ""),
              "answer": question.get("answer", ""),
              "explanation": reusable.get("explanation", {}),
              "provider": f"reuse:{reusable.get('provider', 'unknown')}",
              "source_question_id": reusable.get("question_id", ""),
              "created_at": datetime.now(timezone.utc).isoformat(),
          }
          existing_records.append(reused_record)
          existing_by_id[question.get("id", "")] = reused_record
          reused += 1
          if (generated + reused) % flush_every == 0:
              write_outputs(existing_records, write_frontend_mirror=not args.skip_frontend_mirror)
          print(f"复用成功: {question.get('id', '')} <- {reused_record['source_question_id']}")
          continue
      attempt = 0
      while True:
          try:
              explanation, config, fallback_until = call_with_429_fallback(
                  question,
                  configs,
                  fallback_until=fallback_until,
                  fallback_cooldown=args.fallback_cooldown,
              )
              new_record = {
                  "question_id": question.get("id", ""),
                  "answer": question.get("answer", ""),
                  "explanation": explanation,
                  "provider": config.get("name", "deepseek"),
                  "created_at": datetime.now(timezone.utc).isoformat(),
              }
              existing_records.append(new_record)
              existing_by_id[question.get("id", "")] = new_record
              reusable_by_fingerprint.setdefault(fingerprint, new_record)
              generated += 1
              if (generated + reused) % flush_every == 0:
                  write_outputs(existing_records, write_frontend_mirror=not args.skip_frontend_mirror)
              print(f"生成成功: {question.get('id', '')}")
              time.sleep(max(0, args.sleep))
              break
          except (urllib.error.HTTPError, urllib.error.URLError, http.client.IncompleteRead, TimeoutError, KeyError, json.JSONDecodeError, RuntimeError) as error:
              if is_fatal_provider_error(error):
                  failed += 1
                  append_failed(question, error)
                  print(f"生成失败: {question.get('id', '')} {error}")
                  print("检测到余额、权限或 Key 配置类错误，已停止批量生成。")
                  write_outputs(existing_records, write_frontend_mirror=not args.skip_frontend_mirror)
                  return
              if is_retryable_provider_error(error) and attempt < max(0, args.max_retries):
                  attempt += 1
                  wait = min(max(1.0, args.retry_sleep) * attempt, 300.0)
                  print(f"临时失败，等待 {wait:.0f}s 后重试({attempt}/{args.max_retries}): {question.get('id', '')} {error}")
                  time.sleep(wait)
                  continue
              failed += 1
              append_failed(question, error)
              print(f"生成失败: {question.get('id', '')} {error}")
              break

    remaining = max(0, total - len(existing_by_id))
    print(f"总题数: {total}")
    print(f"已有解析数: {len(existing_by_id) - generated}")
    print(f"本次生成数: {generated}")
    print(f"本次复用数: {reused}")
    print(f"失败数: {failed}")
    print(f"剩余数: {remaining}")
    write_outputs(existing_records, write_frontend_mirror=not args.skip_frontend_mirror)
    if args.skip_frontend_mirror:
        write_outputs(existing_records, write_frontend_mirror=True)


if __name__ == "__main__":
    main()
