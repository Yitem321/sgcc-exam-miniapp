import json
import time
import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "parsed" / "questions.json"
EXPLANATIONS_PATH = ROOT / "data" / "analysis" / "ai_explanations.json"
OUTPUT_DIR = ROOT / "miniprogram" / "data"

TARGET_MAJORS = {
    "\u901a\u4fe1\u8fd0\u7ef4\u68c0\u4fee\u5de5",
    "\u7269\u8d44\u4ed3\u50a8\u4f5c\u4e1a\u5458",
    "\u7269\u8d44\u914d\u9001\u4f5c\u4e1a\u5458",
    "\u4fe1\u606f\u901a\u4fe1\u5ba2\u6237\u670d\u52a1\u4ee3\u8868",
}
PREVIEW_MAJOR = "\u901a\u4fe1\u8fd0\u7ef4\u68c0\u4fee\u5de5"
PREVIEW_LEVEL = "\u521d\u7ea7\u5de5"
SUPPORTED_TYPES = {"\u5355\u9009\u9898", "\u591a\u9009\u9898", "\u5224\u65ad\u9898"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_text(value):
    return str(value or "").replace("\ufeff", "").strip()


def parse_args():
    parser = argparse.ArgumentParser(description="Export local question data for the WeChat mini program.")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="export a small phone-preview package: 通信运维检修工 / 初级工",
    )
    return parser.parse_args()


def write_module(path, value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    write_text_with_retry(path, "module.exports = " + payload + ";\n")


def write_text_with_retry(path, text, attempts=12):
    last_error = None
    for index in range(attempts):
        try:
            path.write_text(text, encoding="utf-8")
            return
        except PermissionError as error:
            last_error = error
            time.sleep(0.5 + index * 0.25)
    if last_error:
        raise last_error


def slim_question(question):
    return {
        "id": question.get("id", ""),
        "major": normalize_text(question.get("major")),
        "level": normalize_text(question.get("level")),
        "question_type": normalize_text(question.get("question_type")),
        "question": question.get("question", ""),
        "options": question.get("options") or {},
        "answer": question.get("answer", ""),
    }


def main():
    args = parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    questions = read_json(QUESTIONS_PATH)
    explanations = read_json(EXPLANATIONS_PATH)

    selected_questions = []
    for question in questions:
        major = normalize_text(question.get("major"))
        level = normalize_text(question.get("level"))
        question_type = normalize_text(question.get("question_type"))
        if question_type not in SUPPORTED_TYPES:
            continue
        if args.preview and not (major == PREVIEW_MAJOR and level == PREVIEW_LEVEL):
            continue
        if args.preview or major in TARGET_MAJORS:
            selected_questions.append(slim_question(question))

    selected_ids = {q["id"] for q in selected_questions}

    explanation_map = {}
    for item in explanations:
        question_id = item.get("question_id")
        if question_id in selected_ids:
            explanation_map[question_id] = {
                "question_id": question_id,
                "answer": item.get("answer", ""),
                "explanation": item.get("explanation", ""),
            }

    write_module(OUTPUT_DIR / "questions.js", selected_questions)
    write_module(OUTPUT_DIR / "ai_explanations.js", explanation_map)

    print(f"mode: {'preview' if args.preview else 'full'}")
    print(f"exported questions: {len(selected_questions)}")
    print(f"exported explanations: {len(explanation_map)}")
    if args.preview:
        print(f"preview dataset: {PREVIEW_MAJOR} / {PREVIEW_LEVEL}")
    else:
        print("majors:")
        for major in sorted(TARGET_MAJORS):
            print(f"- {major}")


if __name__ == "__main__":
    main()
