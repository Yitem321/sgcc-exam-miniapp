import 'dart:math';

import '../../core/local_store.dart';

class AppUser {
  const AppUser({required this.id, required this.name, required this.source});

  final String id;
  final String name;
  final String source;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '本机用户',
      source: json['source']?.toString() ?? 'local',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'source': source,
      };
}

class AuthService {
  AuthService({LocalStore? store}) : _store = store ?? LocalStore();

  static const _userKey = 'app_user_v1';
  final LocalStore _store;

  Future<AppUser?> currentUser() async {
    final json = await _store.getJson<Map<String, dynamic>>(_userKey);
    return json == null ? null : AppUser.fromJson(json);
  }

  Future<AppUser> continueAsLocalUser() async {
    final existing = await currentUser();
    if (existing != null) return existing;
    final random = Random().nextInt(999999).toString().padLeft(6, '0');
    final user = AppUser(
      id: 'local_${DateTime.now().millisecondsSinceEpoch}_$random',
      name: '本机学习用户',
      source: 'local',
    );
    await _store.setJson(_userKey, user.toJson());
    return user;
  }

  Future<void> logout() => _store.remove(_userKey);
}
