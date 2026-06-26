import '../../core/api_client.dart';
import 'question_models.dart';

class QuestionRepository {
  QuestionRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<Catalog> fetchCatalog() async {
    final data = await _api.get('/api/catalog');
    return Catalog.fromJson(data['catalog'] as Map<String, dynamic>);
  }

  Future<List<Question>> fetchQuestions({
    String? major,
    String? level,
    String? type,
    bool random = false,
    int limit = 200,
  }) async {
    final data = await _api.get('/api/questions', query: {
      'major': major,
      'level': level,
      'type': type,
      'random': random ? '1' : '',
      'limit': '$limit',
    });
    return (data['questions'] as List? ?? [])
        .map((item) => Question.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<Question>> fetchQuestionsByIds(List<String> ids) async {
    if (ids.isEmpty) return [];
    final data = await _api.post('/api/questions/by-ids', body: {'ids': ids});
    return (data['questions'] as List? ?? [])
        .map((item) => Question.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<String> explain(Question question) async {
    final data = await _api.post('/api/explain', body: {
      'id': question.id,
      'question': question.question,
      'options': question.options,
      'answer': question.answer,
      'questionType': question.type,
      'major': question.major,
      'level': question.level,
    });
    return data['explanation']?.toString() ?? '';
  }
}
