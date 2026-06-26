class Catalog {
  const Catalog({required this.total, required this.majors});

  final int total;
  final List<QuestionMajor> majors;

  factory Catalog.fromJson(Map<String, dynamic> json) {
    final majors = (json['majors'] as List? ?? [])
        .map((item) => QuestionMajor.fromJson(item as Map<String, dynamic>))
        .toList();
    return Catalog(total: json['total'] as int? ?? 0, majors: majors);
  }
}

class QuestionMajor {
  const QuestionMajor({
    required this.name,
    required this.total,
    required this.levels,
  });

  final String name;
  final int total;
  final List<QuestionLevel> levels;

  factory QuestionMajor.fromJson(Map<String, dynamic> json) {
    final levels = (json['levels'] as List? ?? [])
        .map((item) => QuestionLevel.fromJson(item as Map<String, dynamic>))
        .toList();
    return QuestionMajor(
      name: json['name']?.toString() ?? '',
      total: json['total'] as int? ?? 0,
      levels: levels,
    );
  }
}

class QuestionLevel {
  const QuestionLevel({required this.name, required this.total});

  final String name;
  final int total;

  factory QuestionLevel.fromJson(Map<String, dynamic> json) {
    return QuestionLevel(
      name: json['name']?.toString() ?? '',
      total: json['total'] as int? ?? 0,
    );
  }
}

class Question {
  const Question({
    required this.id,
    required this.major,
    required this.level,
    required this.type,
    required this.question,
    required this.options,
    required this.answer,
  });

  final String id;
  final String major;
  final String level;
  final String type;
  final String question;
  final Map<String, String> options;
  final String answer;

  factory Question.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'] as Map? ?? {};
    return Question(
      id: json['id']?.toString() ?? '',
      major: json['major']?.toString() ?? '',
      level: json['level']?.toString() ?? '',
      type: json['question_type']?.toString() ?? '',
      question: json['question']?.toString() ?? '',
      options: rawOptions.map(
        (key, value) => MapEntry(key.toString(), value.toString()),
      ),
      answer: json['answer']?.toString() ?? '',
    );
  }

  bool get isMultiple => type.contains('多');
  bool get isJudge => type.contains('判');
}
