import 'package:flutter/material.dart';

import '../../app/app_routes.dart';
import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../auth/auth_service.dart';
import '../learning/learning_state.dart';
import '../member/membership_service.dart';

class MinePage extends StatefulWidget {
  const MinePage({super.key});

  @override
  State<MinePage> createState() => _MinePageState();
}

class _MinePageState extends State<MinePage> {
  final _authService = AuthService();
  final _learningStore = LearningStateStore();
  final _membershipService = MembershipService();

  late Future<AppUser?> _user = _authService.currentUser();
  late Future<LearningSummary> _summary = _learningStore.summary();
  late Future<MembershipStatus> _membership = _membershipService.status();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: FutureBuilder<AppUser?>(
        future: _user,
        builder: (context, userSnapshot) {
          final user = userSnapshot.data;
          return FutureBuilder<LearningSummary>(
            future: _summary,
            builder: (context, summarySnapshot) {
              final summary = summarySnapshot.data ??
                  const LearningSummary(
                    attemptedCount: 0,
                    wrongCount: 0,
                    masteredCount: 0,
                    dueReviewCount: 0,
                  );
              return FutureBuilder<MembershipStatus>(
                future: _membership,
                builder: (context, membershipSnapshot) {
                  final membership = membershipSnapshot.data ??
                      const MembershipStatus(active: false, expireAt: null);
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.pageHorizontal,
                      AppSpacing.md,
                      AppSpacing.pageHorizontal,
                      AppSpacing.pageBottom,
                    ),
                    children: [
                      _LoginCard(
                        user: user,
                        membership: membership,
                        onLogin: _login,
                        onLogout: _logout,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _StatsGrid(summary: summary),
                      const SizedBox(height: AppSpacing.md),
                      _InfoSection(
                        onOpenDoc: _openDoc,
                        onContact: _contactSupport,
                      ),
                    ],
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _login() async {
    await _authService.continueAsLocalUser();
    if (!mounted) return;
    setState(() {
      _user = _authService.currentUser();
      _summary = _learningStore.summary();
      _membership = _membershipService.status();
    });
  }

  Future<void> _logout() async {
    await _authService.logout();
    if (!mounted) return;
    setState(() => _user = _authService.currentUser());
  }

  void _openDoc(String title, String description) {
    AppNavigator.pushPlaceholder(
      context,
      title: title,
      description: description,
    );
  }

  void _contactSupport() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('客服 QQ：1697962351')),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.user,
    required this.membership,
    required this.onLogin,
    required this.onLogout,
  });

  final AppUser? user;
  final MembershipStatus membership;
  final VoidCallback onLogin;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final loggedIn = user != null;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        children: [
          CircleAvatar(
            radius: 29,
            backgroundColor: AppColors.primaryLight,
            child: Icon(
              loggedIn ? Icons.verified_user_rounded : Icons.person_rounded,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(loggedIn ? user!.name : '未登录', style: AppTextStyles.title),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  loggedIn
                      ? '当前为本机学习账号，后续可绑定 Apple 登录。'
                      : '登录后保存学习记录和会员权益。',
                  style: AppTextStyles.caption,
                ),
                const SizedBox(height: AppSpacing.xs),
                _MembershipPill(active: membership.active),
              ],
            ),
          ),
          FilledButton.tonal(
            onPressed: loggedIn ? onLogout : onLogin,
            child: Text(loggedIn ? '退出' : '登录'),
          ),
        ],
      ),
    );
  }
}

class _MembershipPill extends StatelessWidget {
  const _MembershipPill({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: active
            ? const Color(0xFFFFF4D6)
            : AppColors.primaryLight,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        active ? 'VIP 已开通' : 'VIP 未开通',
        style: TextStyle(
          color: active ? const Color(0xFFB7791F) : AppColors.primaryDark,
          fontWeight: FontWeight.w900,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.summary});

  final LearningSummary summary;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: AppSpacing.sm,
      mainAxisSpacing: AppSpacing.sm,
      childAspectRatio: 1.72,
      children: [
        _StatTile(label: '已做题', value: '${summary.attemptedCount}', color: AppColors.primary),
        _StatTile(label: '错题本', value: '${summary.wrongCount}', color: AppColors.danger),
        _StatTile(label: '待复习', value: '${summary.dueReviewCount}', color: AppColors.warning),
        _StatTile(label: '已掌握', value: '${summary.masteredCount}', color: AppColors.success),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: AppTextStyles.title.copyWith(color: color)),
          const SizedBox(height: AppSpacing.xxs),
          Text(label, style: AppTextStyles.body),
        ],
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({
    required this.onOpenDoc,
    required this.onContact,
  });

  final void Function(String title, String description) onOpenDoc;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _InfoTile(
            title: '使用说明',
            subtitle: '了解刷题、错题强化和会员权益',
            icon: Icons.menu_book_outlined,
            onTap: () => onOpenDoc('使用说明', '这里将展示 App 的刷题流程、错题强化规则、会员权益和常见问题。'),
          ),
          const Divider(height: 1),
          _InfoTile(
            title: '隐私政策',
            subtitle: '了解数据使用与隐私保护',
            icon: Icons.privacy_tip_outlined,
            onTap: () => onOpenDoc('隐私政策', '正式上线前将在这里展示完整隐私政策内容。当前版本仅用于功能承接。'),
          ),
          const Divider(height: 1),
          _InfoTile(
            title: '用户协议',
            subtitle: '服务条款与使用规则',
            icon: Icons.description_outlined,
            onTap: () => onOpenDoc('用户协议', '正式上线前将在这里展示完整用户协议内容。当前版本仅用于功能承接。'),
          ),
          const Divider(height: 1),
          _InfoTile(
            title: '关于我们',
            subtitle: '电力考试刷题工具',
            icon: Icons.info_outline_rounded,
            onTap: () => onOpenDoc('关于我们', '专注电力考试刷题、解析和错题强化，帮助用户更高效复习。'),
          ),
          const Divider(height: 1),
          _InfoTile(
            title: '联系客服 QQ',
            subtitle: '1697962351',
            icon: Icons.support_agent_rounded,
            onTap: onContact,
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: ListTile(
        leading: Icon(icon, color: AppColors.primaryDark),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
        minVerticalPadding: 14,
      ),
    );
  }
}
