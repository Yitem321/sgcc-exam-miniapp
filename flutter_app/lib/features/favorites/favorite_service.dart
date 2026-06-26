import '../../core/local_store.dart';

class FavoriteService {
  FavoriteService({LocalStore? store}) : _store = store ?? LocalStore();

  static const _key = 'favorite_question_ids_v1';
  final LocalStore _store;

  Future<Set<String>> loadIds() async {
    final raw = await _store.getJson<List<dynamic>>(_key) ?? [];
    return raw.map((item) => item.toString()).where((item) => item.isNotEmpty).toSet();
  }

  Future<Set<String>> toggle(String questionId) async {
    final ids = await loadIds();
    if (ids.contains(questionId)) {
      ids.remove(questionId);
    } else {
      ids.add(questionId);
    }
    await _store.setJson(_key, ids.toList()..sort());
    return ids;
  }
}
