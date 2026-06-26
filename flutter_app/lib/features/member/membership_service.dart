import '../../core/local_store.dart';

class MembershipStatus {
  const MembershipStatus({
    required this.active,
    required this.expireAt,
  });

  final bool active;
  final DateTime? expireAt;
}

class MembershipService {
  MembershipService({LocalStore? store}) : _store = store ?? LocalStore();

  static const _expireKey = 'membership_expire_at_ms';
  final LocalStore _store;

  Future<MembershipStatus> status() async {
    final raw = await _store.getString(_expireKey);
    final expireMs = int.tryParse(raw ?? '');
    if (expireMs == null || expireMs <= 0) {
      return const MembershipStatus(active: false, expireAt: null);
    }
    final expireAt = DateTime.fromMillisecondsSinceEpoch(expireMs);
    return MembershipStatus(
      active: expireAt.isAfter(DateTime.now()),
      expireAt: expireAt,
    );
  }

  Future<void> updateEntitlement(DateTime expireAt) {
    return _store.setString(_expireKey, '${expireAt.millisecondsSinceEpoch}');
  }
}
