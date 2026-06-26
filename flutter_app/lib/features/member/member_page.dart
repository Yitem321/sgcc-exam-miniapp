import 'package:flutter/material.dart';

import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import 'membership_service.dart';

class MemberPage extends StatefulWidget {
  const MemberPage({super.key});

  @override
  State<MemberPage> createState() => _MemberPageState();
}

class _MemberPageState extends State<MemberPage> {
  final _membershipService = MembershipService();
  int _selected = 1;
  late final Future<MembershipStatus> _status = _membershipService.status();

  final _plans = const [
    VipPlan('7天 VIP', '题目解析 + 错题强化', 7, '3.5', '4', '立省 0.5 元'),
    VipPlan('1个月 VIP', '适合阶段复习和错题巩固', 30, '8', '12', '立省 4 元'),
    VipPlan('3个月 VIP', '长期备考和考前冲刺', 90, '20', '36', '立省 16 元'),
    VipPlan('12个月 VIP', '全年系统巩固', 365, '68', '144', '立省 76 元'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('会员权益')),
      body: FutureBuilder<MembershipStatus>(
        future: _status,
        builder: (context, snapshot) {
          final status = snapshot.data ?? const MembershipStatus(active: false, expireAt: null);
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageHorizontal,
              AppSpacing.md,
              AppSpacing.pageHorizontal,
              AppSpacing.pageBottom,
            ),
            children: [
              _BenefitHero(status: status),
              const SizedBox(height: AppSpacing.md),
              const _BenefitGrid(),
              const SizedBox(height: AppSpacing.md),
              const Text('VIP 套餐', style: AppTextStyles.title),
              const SizedBox(height: AppSpacing.sm),
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Column(
                  children: [
                    for (var i = 0; i < _plans.length; i++)
                      _PlanTile(
                        plan: _plans[i],
                        selected: i == _selected,
                        onTap: () => setState(() => _selected = i),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                label: '立即开通',
                icon: Icons.workspace_premium_outlined,
                onPressed: () => _startPurchase(_plans[_selected]),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'iOS 正式版将通过 Apple In-App Purchase 开通会员；支付成功后由服务端验证，再同步题目解析与错题强化权益。',
                textAlign: TextAlign.center,
                style: AppTextStyles.caption,
              ),
              const SizedBox(height: AppSpacing.md),
              const _SupportCard(),
            ],
          );
        },
      ),
    );
  }

  Future<void> _startPurchase(VipPlan plan) async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${plan.name} 将接入 Apple 内购，当前为权益页 UI 骨架。')),
    );
  }
}

class VipPlan {
  const VipPlan(
    this.name,
    this.subtitle,
    this.days,
    this.price,
    this.original,
    this.saving,
  );

  final String name;
  final String subtitle;
  final int days;
  final String price;
  final String original;
  final String saving;
}

class _BenefitHero extends StatelessWidget {
  const _BenefitHero({required this.status});

  final MembershipStatus status;

  @override
  Widget build(BuildContext context) {
    final expireAt = status.expireAt;
    final statusText = status.active && expireAt != null
        ? '已开通 · ${expireAt.year}-${expireAt.month.toString().padLeft(2, '0')}-${expireAt.day.toString().padLeft(2, '0')} 到期'
        : '未开通';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        gradient: const LinearGradient(
          colors: [Color(0xFF102A43), Color(0xFF047857), Color(0xFF10B981)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  '系统化提分，稳步掌握高频考点',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            '题目解析、错题强化、记忆复习、遗忘提醒、掌握追踪、考前冲刺，帮你把薄弱题型稳稳补上。',
            style: TextStyle(color: Color(0xDFFFFFFF), height: 1.55),
          ),
        ],
      ),
    );
  }
}

class _BenefitGrid extends StatelessWidget {
  const _BenefitGrid();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Wrap(
        spacing: AppSpacing.xs,
        runSpacing: AppSpacing.xs,
        children: [
          _BenefitPill(icon: Icons.lightbulb_outline_rounded, label: '不限解析'),
          _BenefitPill(icon: Icons.psychology_alt_outlined, label: '错题强化'),
          _BenefitPill(icon: Icons.schedule_rounded, label: '记忆复习'),
          _BenefitPill(icon: Icons.notifications_active_outlined, label: '遗忘提醒'),
          _BenefitPill(icon: Icons.trending_up_rounded, label: '掌握追踪'),
          _BenefitPill(icon: Icons.timer_outlined, label: '考前冲刺'),
        ],
      ),
    );
  }
}

class _BenefitPill extends StatelessWidget {
  const _BenefitPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: (MediaQuery.of(context).size.width - 62) / 2,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primaryDark, size: 19),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final VipPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            color: selected ? AppColors.primaryLight : AppColors.surface,
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(plan.name, style: AppTextStyles.subtitle),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(plan.subtitle, style: AppTextStyles.caption),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '￥${plan.price}',
                    style: AppTextStyles.title.copyWith(color: AppColors.primaryDark),
                  ),
                  Text(
                    '原价 ￥${plan.original}',
                    style: AppTextStyles.caption.copyWith(
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                  Text(
                    plan.saving,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SupportCard extends StatelessWidget {
  const _SupportCard();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      color: AppColors.primaryLight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('联系客服 QQ', style: AppTextStyles.subtitle),
          SizedBox(height: AppSpacing.xs),
          Text('1697962351', style: AppTextStyles.subtitle),
          SizedBox(height: AppSpacing.xs),
          Text('如遇会员、解析或错题强化问题，可添加后反馈。', style: AppTextStyles.caption),
        ],
      ),
    );
  }
}
