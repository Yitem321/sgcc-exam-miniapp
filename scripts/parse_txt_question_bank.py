from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "raw_txt"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "parsed"

LEVELS = ("高级技师", "初级工", "中级工", "高级工", "技师", "共用试题")
QUESTION_TYPES = ("单选题", "多选题", "判断题")
JUDGE_ANSWER_MAP = {
    "对": "正确",
    "错": "错误",
    "是": "正确",
    "否": "错误",
    "正确": "正确",
    "错误": "错误",
    "√": "正确",
    "×": "错误",
    "✓": "正确",
    "x": "错误",
    "X": "错误",
}
BASETYPE_MAP = {
    "1": "单选题",
    "2": "多选题",
    "3": "判断题",
    "4": "判断题",
    "6": "简答题",
    "7": "论述题",
    "9": "案例分析题",
}
OPTION_KEYS = tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
QUESTION_TYPE_ORDER = {
    "单选题": 0,
    "多选题": 1,
    "判断题": 2,
    "简答题": 3,
    "论述题": 4,
    "案例分析题": 5,
    "未知": 99,
}
EXCEL_COLUMNS = ("题干", "答案", "选项A", "选项B", "选项C", "选项D")
TOPIC_FIELD_NAMES = (
    "keywordsContent",
    "topicBaseType",
    "topicOption",
    "topicRemark",
    "basetypeId",
    "topicCount",
    "topicGrade",
    "topicLevel",
    "parentId",
    "basetype",
    "topicId",
    "topicKey",
    "topicX",
    "topicM",
    "score",
    "topic",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Parse SGCC txt question banks.")
    parser.add_argument("--input", default=None, help="Input directory, defaults to raw_txt/")
    parser.add_argument("--output", default=None, help="Output directory, defaults to data/parsed/")
    return parser.parse_args()


def resolve_path(value: str | None, default: Path) -> Path:
    if not value:
        return default
    path = Path(value)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def read_text_file(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def clean_text(value: str) -> str:
    value = value.replace("\u3000", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def unescape_js_string(value: str) -> str:
    result: list[str] = []
    index = 0
    while index < len(value):
        char = value[index]
        if char != "\\" or index + 1 >= len(value):
            result.append(char)
            index += 1
            continue

        escaped = value[index + 1]
        if escaped == "n":
            result.append("\n")
            index += 2
        elif escaped == "r":
            result.append("\r")
            index += 2
        elif escaped == "t":
            result.append("\t")
            index += 2
        elif escaped in {'"', "'", "\\"}:
            result.append(escaped)
            index += 2
        elif escaped == "u" and index + 5 < len(value):
            hex_value = value[index + 2 : index + 6]
            try:
                result.append(chr(int(hex_value, 16)))
                index += 6
            except ValueError:
                result.append(escaped)
                index += 2
        else:
            result.append(escaped)
            index += 2
    return "".join(result)


def detect_year(path: Path) -> str:
    match = re.search(r"(20\d{2})", str(path))
    return match.group(1) if match else ""


def detect_level(path: Path) -> str:
    text = str(path)
    for level in LEVELS:
        if level in text:
            return level
    return ""


def detect_major(path: Path) -> str:
    candidates = [part for part in path.parts[::-1] if part != path.name]
    candidates.append(path.stem)
    for text in candidates:
        text = re.sub(r"[（(]20\d{2}版[）)]", "", text)
        patterns = (
            r"技能等级评价(.+?)专业知识",
            r"等级评价(.+?)专业知识",
            r"评价(.+?)专业知识",
            r"(.+?)专业知识",
        )
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                major = match.group(1)
                major = re.sub(r"[（(](?:初级工|中级工|高级工|技师|高级技师|共用试题)[）)]", "", major)
                major = major.replace("考试练习", "").strip(" -_")
                if major:
                    return major
    return ""


def detect_type_from_context(raw: str, answer: str, options: dict[str, str], section_type: str) -> str:
    if section_type:
        return section_type
    for question_type in QUESTION_TYPES:
        if question_type in raw[:80]:
            return question_type
    normalized_answer = answer.replace(",", "").replace("，", "").replace("、", "")
    if options:
        if len(re.findall(r"[A-H]", normalized_answer)) > 1:
            return "多选题"
        if re.fullmatch(r"[A-H]", normalized_answer):
            return "单选题"
    if answer in set(JUDGE_ANSWER_MAP.values()) or answer in JUDGE_ANSWER_MAP:
        return "判断题"
    return "未知"


def detect_type_from_basetype(fields: dict[str, str], answer: str, options: dict[str, str]) -> str:
    for key in ("basetype", "basetypeId", "topicBaseType"):
        question_type = BASETYPE_MAP.get(fields.get(key, ""))
        if question_type:
            return question_type
    return detect_type_from_context("", answer, options, "")


def split_js_objects(text: str) -> list[str]:
    objects: list[str] = []
    marker = "topicArray.push({"
    search_from = 0

    while True:
        start = text.find(marker, search_from)
        if start == -1:
            break

        object_start = start + len("topicArray.push(")
        index = object_start
        in_string = False
        escaped = False
        depth = 0

        while index < len(text):
            char = text[index]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
            else:
                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        objects.append(text[object_start : index + 1])
                        search_from = index + 1
                        break
            index += 1
        else:
            break

    return objects


def parse_js_object_fields(raw_object: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    pattern = re.compile(r"([A-Za-z_]\w*)\s*:\s*\"((?:\\.|[^\"\\])*)\"", re.S)
    for key, value in pattern.findall(raw_object):
        fields[key] = clean_text(unescape_js_string(value))
    if not fields.get("topic") or not fields.get("topicKey"):
        fields.update(parse_loose_topic_fields(raw_object))
    return fields


def normalize_json_topic_fields(item: dict[str, Any]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for key, value in item.items():
        if not isinstance(key, str):
            continue
        if value is None:
            fields[key] = ""
        elif isinstance(value, (str, int, float, bool)):
            fields[key] = clean_text(str(value))
        else:
            fields[key] = clean_text(json.dumps(value, ensure_ascii=False))
    return fields


def parse_json_topic_array(text: str) -> list[tuple[dict[str, str], str]]:
    stripped = text.strip().lstrip("\ufeff")
    if not stripped.startswith("["):
        return []
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []

    items: list[tuple[dict[str, str], str]] = []
    for value in parsed:
        if not isinstance(value, dict):
            continue
        fields = normalize_json_topic_fields(value)
        if fields.get("topic") or fields.get("topicId") or fields.get("topicKey"):
            raw = clean_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
            items.append((fields, raw))
    return items


def parse_loose_topic_fields(raw_object: str) -> dict[str, str]:
    content = raw_object.strip()
    if content.startswith("{") and content.endswith("}"):
        content = content[1:-1]

    regular_names = [name for name in TOPIC_FIELD_NAMES if name not in {"topicX", "topicM"}]
    alternation = "|".join(
        ["topicX(?=getTopicX)", "topicM(?=getTopicM)", *[re.escape(name) for name in regular_names]]
    )
    pattern = re.compile(rf"(^|,)({alternation})")
    matches = list(pattern.finditer(content))
    fields: dict[str, str] = {}

    for index, match in enumerate(matches):
        key = match.group(2)
        value_start = match.end(2)
        value_end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        value = content[value_start:value_end]
        value = value.strip().strip(",")
        value = value.lstrip(":").strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
            value = unescape_js_string(value)
        fields[key] = clean_text(value)

    return fields


def parse_topic_options(value: str) -> dict[str, str]:
    if not value:
        return {}
    parts = [clean_text(part) for part in value.split("$;$")]
    parts = [part for part in parts if part]
    return {OPTION_KEYS[index]: part for index, part in enumerate(parts) if index < len(OPTION_KEYS)}


def build_topic_question(
    fields: dict[str, str],
    raw: str,
    path: Path,
    index: int,
    year: str,
    major: str,
    level: str,
) -> tuple[dict[str, Any], str | None]:
    question = fields.get("topic", "")
    options = parse_topic_options(fields.get("topicOption", ""))
    raw_answer = fields.get("topicKey", "")
    question_type = detect_type_from_basetype(fields, raw_answer, options)
    answer = normalize_answer(raw_answer) if question_type in {"单选题", "多选题", "判断题"} or options else clean_text(raw_answer)
    analysis = fields.get("topicRemark", "")
    topic_id = fields.get("topicId", "")
    question_id = f"q_{topic_id}" if topic_id else build_id(year, major, level, path.name, raw)

    item = {
        "id": question_id,
        "year": year,
        "major": major,
        "level": level,
        "source_file": path.name,
        "question_type": question_type,
        "question": question,
        "options": options,
        "answer": answer,
        "analysis": analysis,
        "raw": raw,
    }
    failed = None
    if not question or not answer:
        failed = f"文件: {path}\n题号序号: {index}\n原因: 题干或答案缺失\n原文:\n{raw}\n"
    return item, failed


def parse_js_question_bank(text: str, path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    topic_items = parse_json_topic_array(text)
    if not topic_items:
        topic_items = [
            (parse_js_object_fields(raw_object), clean_text(f"topicArray.push({raw_object});"))
            for raw_object in split_js_objects(text)
        ]
    if not topic_items:
        return [], []

    year = detect_year(path)
    major = detect_major(path)
    level = detect_level(path)
    questions: list[dict[str, Any]] = []
    failed: list[str] = []

    for index, (fields, raw) in enumerate(topic_items, start=1):
        item, failed_text = build_topic_question(fields, raw, path, index, year, major, level)
        if failed_text:
            failed.append(failed_text)
        questions.append(item)

    return questions, failed


def split_question_blocks(text: str) -> list[tuple[str, str]]:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[tuple[str, str]] = []
    current: list[str] = []
    current_type = ""
    section_type = ""
    question_start = re.compile(r"^\s*(?:第\s*)?\d{1,6}\s*[\.、．\)]\s*")
    section_start = re.compile(r"^\s*(?:[一二三四五六七八九十]+[、.．]\s*)?(单选题|多选题|判断题)\s*$")

    for line in lines:
        stripped = line.strip()
        section_match = section_start.match(stripped)
        if section_match:
            section_type = section_match.group(1)
            continue

        if question_start.match(stripped):
            if current:
                blocks.append((current_type, "\n".join(current).strip()))
            current = [line]
            current_type = section_type
        elif current:
            current.append(line)

    if current:
        blocks.append((current_type, "\n".join(current).strip()))
    return [(question_type, block) for question_type, block in blocks if block]


def normalize_answer(answer: str) -> str:
    answer = clean_text(answer)
    answer = answer.strip("：: ;；,，。.【】[]()（）")
    answer = answer.replace(" ", "").replace("、", "").replace(",", "").replace("，", "")
    if answer in JUDGE_ANSWER_MAP:
        return JUDGE_ANSWER_MAP[answer]
    letters = "".join(re.findall(r"[A-H]", answer.upper()))
    if letters:
        return letters
    return answer


def parse_options(lines: list[str]) -> tuple[dict[str, str], list[str]]:
    options: dict[str, list[str]] = {}
    question_lines: list[str] = []
    current_key = ""
    option_pattern = re.compile(r"^\s*([A-H])\s*[\.\、．:：\)]\s*(.*)$", re.IGNORECASE)

    for line in lines:
        match = option_pattern.match(line)
        if match:
            current_key = match.group(1).upper()
            options[current_key] = [match.group(2).strip()]
            continue
        if current_key:
            options[current_key].append(line.strip())
        else:
            question_lines.append(line)

    cleaned_options = {key: clean_text("\n".join(value)) for key, value in options.items()}
    return cleaned_options, question_lines


def parse_question_block(block: str, section_type: str) -> dict[str, Any]:
    raw = clean_text(block)
    body = re.sub(r"^\s*(?:第\s*)?\d{1,6}\s*[\.、．\)]\s*", "", raw, count=1)

    answer = ""
    answer_match = re.search(
        r"(?:参考答案|正确答案|答案)\s*[:：]\s*([A-Ha-h,，、\s]+|正确|错误|对|错|是|否|√|×|✓|X|x)",
        body,
    )
    if answer_match:
        answer = normalize_answer(answer_match.group(1))

    analysis = ""
    analysis_match = re.search(r"(?:答案解析|试题解析|解析)\s*[:：]\s*(.*)$", body, re.S)
    if analysis_match:
        analysis = clean_text(analysis_match.group(1))

    content = re.split(r"(?:参考答案|正确答案|答案)\s*[:：]", body, maxsplit=1)[0]
    content = re.split(r"(?:答案解析|试题解析|解析)\s*[:：]", content, maxsplit=1)[0]
    content_lines = [line for line in content.split("\n") if line.strip()]
    options, question_lines = parse_options(content_lines)
    question = clean_text("\n".join(question_lines))
    question_type = detect_type_from_context(raw, answer, options, section_type)

    return {
        "question_type": question_type,
        "question": question,
        "options": options,
        "answer": answer,
        "analysis": analysis,
        "raw": raw,
    }


def build_id(year: str, major: str, level: str, source_file: str, raw: str) -> str:
    payload = "\n".join([year, major, level, source_file, raw])
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]
    return f"q_{digest}"


def question_sort_key(index_and_question: tuple[int, dict[str, Any]]) -> tuple[int, int]:
    index, question = index_and_question
    question_type = question.get("question_type", "")
    return (QUESTION_TYPE_ORDER.get(question_type, 99), index)


def sort_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [question for _, question in sorted(enumerate(questions), key=question_sort_key)]


def normalize_output_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for question in questions:
        item = dict(question)
        options = dict(item.get("options", {}))
        if item.get("question_type") == "判断题" and not options and item.get("answer") in {"A", "B"}:
            options = {"A": "正确", "B": "错误"}
        item["options"] = options
        normalized.append(item)
    return normalized


def group_questions(questions: list[dict[str, Any]]) -> dict[str, dict[str, list[dict[str, Any]]]]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for question in questions:
        major = question.get("major") or "未知"
        level = question.get("level") or "未知"
        grouped.setdefault(major, {}).setdefault(level, []).append(question)
    return grouped


def excel_col_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def excel_inline_cell(row: int, column: int, value: Any, style: int = 1) -> str:
    cell_ref = f"{excel_col_name(column)}{row}"
    text = "" if value is None else str(value)
    escaped_text = escape(text)
    return f'<c r="{cell_ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{escaped_text}</t></is></c>'


def write_text_with_retry(path: Path, text: str, attempts: int = 8) -> Path:
    last_error: Exception | None = None
    for index in range(attempts):
        try:
            path.write_text(text, encoding="utf-8")
            return path
        except PermissionError as error:
            last_error = error
            import time

            time.sleep(0.5 + index * 0.25)
    if last_error:
        fallback = path.with_name(f"{path.stem}_updated{path.suffix}")
        fallback.write_text(text, encoding="utf-8")
        return fallback
    return path


def write_lines_with_retry(path: Path, lines: list[str], attempts: int = 8) -> Path:
    return write_text_with_retry(path, "".join(lines), attempts=attempts)


def make_sheet_xml(rows: list[list[Any]]) -> str:
    sheet_rows: list[str] = []
    for row_index, row_values in enumerate(rows, start=1):
        style = 2 if row_index == 1 else 1
        height = 24 if row_index == 1 else 54
        cells = [excel_inline_cell(row_index, col_index, value, style) for col_index, value in enumerate(row_values, start=1)]
        sheet_rows.append(f'<row r="{row_index}" ht="{height}" customHeight="1">{"".join(cells)}</row>')

    last_row = max(len(rows), 1)
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:F{last_row}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="82" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="6" width="24" customWidth="1"/>
  </cols>
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
  <autoFilter ref="A1:F{last_row}"/>
</worksheet>'''


def write_xlsx(path: Path, questions: list[dict[str, Any]]) -> None:
    rows = [list(EXCEL_COLUMNS)]
    for question in questions:
        options = question.get("options", {})
        rows.append(
            [
                question.get("question", ""),
                question.get("answer", ""),
                options.get("A", ""),
                options.get("B", ""),
                options.get("C", ""),
                options.get("D", ""),
            ]
        )

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''
    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="题库" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>'''
    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="12"/><name val="宋体"/></font>
    <font><b/><sz val="12"/><name val="宋体"/></font>
  </fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>SGCC Question Bank</dc:title>
</cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Python</Application>
</Properties>'''

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/styles.xml", styles)
        archive.writestr("xl/worksheets/sheet1.xml", make_sheet_xml(rows))
        archive.writestr("docProps/core.xml", core)
        archive.writestr("docProps/app.xml", app)


def parse_file(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    text = read_text_file(path)
    js_questions, js_failed = parse_js_question_bank(text, path)
    if js_questions:
        return js_questions, js_failed

    blocks = split_question_blocks(text)
    year = detect_year(path)
    major = detect_major(path)
    level = detect_level(path)
    questions: list[dict[str, Any]] = []
    failed: list[str] = []

    if not blocks:
        failed.append(f"文件未识别到题目: {path}")
        return questions, failed

    for index, (section_type, block) in enumerate(blocks, start=1):
        item = parse_question_block(block, section_type)
        item.update(
            {
                "id": build_id(year, major, level, path.name, item["raw"]),
                "year": year,
                "major": major,
                "level": level,
                "source_file": path.name,
            }
        )
        ordered_item = {
            "id": item["id"],
            "year": item["year"],
            "major": item["major"],
            "level": item["level"],
            "source_file": item["source_file"],
            "question_type": item["question_type"],
            "question": item["question"],
            "options": item["options"],
            "answer": item["answer"],
            "analysis": item["analysis"],
            "raw": item["raw"],
        }
        if not item["answer"] or not item["question"]:
            failed.append(f"文件: {path}\n题号序号: {index}\n原因: 题干或答案缺失\n原文:\n{item['raw']}\n")
        questions.append(ordered_item)
    return questions, failed


def write_outputs(output_dir: Path, questions: list[dict[str, Any]], failed: list[str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    questions = normalize_output_questions(sort_questions(questions))
    jsonl_path = output_dir / "questions.jsonl"
    json_path = output_dir / "questions.json"
    grouped_json_path = output_dir / "questions_grouped.json"
    xlsx_path = output_dir / "questions.xlsx"
    summary_path = output_dir / "summary.json"
    failed_path = output_dir / "failed.txt"

    write_lines_with_retry(jsonl_path, [json.dumps(question, ensure_ascii=False) + "\n" for question in questions])
    write_text_with_retry(json_path, json.dumps(questions, ensure_ascii=False, indent=2))
    write_text_with_retry(grouped_json_path, json.dumps(group_questions(questions), ensure_ascii=False, indent=2))
    try:
        write_xlsx(xlsx_path, questions)
    except PermissionError:
        write_xlsx(output_dir / "questions_updated.xlsx", questions)

    summary = {
        "total_questions": len(questions),
        "failed_count": len(failed),
        "by_year": dict(Counter(question["year"] or "未知" for question in questions)),
        "by_major": dict(Counter(question["major"] or "未知" for question in questions)),
        "by_level": dict(Counter(question["level"] or "未知" for question in questions)),
        "by_question_type": dict(Counter(question["question_type"] or "未知" for question in questions)),
    }
    write_text_with_retry(summary_path, json.dumps(summary, ensure_ascii=False, indent=2))
    write_text_with_retry(failed_path, "\n".join(failed))


def main() -> None:
    args = parse_args()
    input_dir = resolve_path(args.input, DEFAULT_INPUT)
    output_dir = resolve_path(args.output, DEFAULT_OUTPUT)

    txt_files = sorted(input_dir.rglob("*.txt")) if input_dir.exists() else []
    all_questions: list[dict[str, Any]] = []
    all_failed: list[str] = []

    for txt_file in txt_files:
        questions, failed = parse_file(txt_file)
        all_questions.extend(questions)
        all_failed.extend(failed)

    if not input_dir.exists():
        all_failed.append(f"输入目录不存在: {input_dir}")
    elif not txt_files:
        all_failed.append(f"输入目录下没有 txt 文件: {input_dir}")

    write_outputs(output_dir, all_questions, all_failed)
    print(f"Input: {input_dir}")
    print(f"Output: {output_dir}")
    print(f"Parsed questions: {len(all_questions)}")
    print(f"Failed items: {len(all_failed)}")


if __name__ == "__main__":
    main()
