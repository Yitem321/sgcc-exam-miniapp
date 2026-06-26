import 'package:flutter/material.dart';

import '../../app/app_routes.dart';
import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import '../learning/learning_state.dart';
import '../member/membership_service.dart';
import '../questions/question_models.dart';
import '../questions/question_repository.dart';

class WrongPage extends StatefulWidget {
  const WrongPage({super.key, this.onOpenMember});

  final VoidCallback? onOpenMember;

  @override
  State<WrongPage> createState() => _WrongPageState();
}

class _WrongPageState extends State<WrongPage> {
  final _learningStore = LearningStateStore();
  final _repository = QuestionRepository();
  final _membershipService = MembershipService();
  late Future<_WrongData> _data = _load();

  Future<_WrongData> _load() async {
    final ids = await _learningStore.wrongBookIds();
    final states = await _learningStore.loadStates();
    final membership = await _membershipService.status();
    final questions = await _repository.fetchQuestionsByIds(ids);
    return _WrongData(
      questions: questions,
      states: states,
      membership: membership,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('错题强化')),
      body: FutureBuilder<_WrongData>(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _StateMessage(
              icon: Icons.cloud_off_rounded,
              title: '加载失败',
              message: snapshot.error.toString(),
            );
          }
          final data = snapshot.data!;
          final plan = _ReviewPlan.from(data);
          final visibleQuestions = data.membership.active
              ? data.questions
              : data.questions.take(3).toList();
          final hiddenCount = data.membership.active
              ? 0
              : (data.questions.length - visibleQuestions.length)
                  .clamp(0, data.questions.length);
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pageHorizontal,
                AppSpacing.md,
                AppSpacing.pageHorizontal,
                AppSpacing.pageBottom,
              ),
              children: [
                _HeroCard(
                  count: data.questions.length,
                  dueCount: plan.today.length,
                  riskCount: plan.highRisk.length,
                  isMember: data.membership.active,
                  onReview: data.questions.isEmpty
                      ? null
                      : () => _startReview(data.membership.active
                          ? data.questions
                          : visibleQuestions),
                  onOpenMember: widget.onOpenMember,
                ),
                const SizedBox(height: AppSpacing.md),
                _CurveSummary(plan: plan),
                const SizedBox(height: AppSpacing.md),
                _CurveTabs(plan: plan),
                const SizedBox(height: AppSpacing.md),
                if (data.questions.isEmpty)
                  const _EmptyWrongCard()
                else ...[
                  _SectionTitle(
                    title: data.membership.active ? '智能复习题单' : '免费预览题单',
                    subtitle: data.membership.active
                        ? '按遗忘风险排序，优先复习最容易丢分的题。'
                        : '免费用户可预览前 3 题，开通后解锁完整强化计划。',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final question in visibleQuestions)
                    _WrongQuestionCard(
                      question: question,
                      state: data.states[question.id],
                      onTap: () => _startReview([question]),
                    ),
                  if (hiddenCount > 0) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _LockedPreviewCard(
                      hiddenCount: hiddenCount,
                      onOpenMember: widget.onOpenMember,
                    ),
                  ],
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _refresh() async {
    setState(() => _data = _load());
    await _data;
  }

  Future<void> _startReview(List<Question> questions) async {
    await AppNavigator.pushPractice(
      context,
      title: '错题强化',
      initialQuestions: questions,
    );
    if (mounted) await _refresh();
  }
}

class _WrongData {
  const _WrongData({
    required this.questions,
    required this.states,
    required this.membership,
  });

  final List<Question> questions;
  final Map<String, QuestionLearningState> states;
  final MembershipStatus membership;
}

class _ReviewPlan {
  const _ReviewPlan({
    required this.today,
    required this.oneDay,
    required this.threeDays,
    required this.sevenDays,
    required this.mastered,
    required this.highRisk,
    required this.nearlyMastered,
  });

  final List<Question> today;
  final List<Question> oneDay;
  final List<Question> threeDays;
  final List<Question> sevenDays;
  final List<Question> mastered;
  final List<Question> highRisk;
  final List<Question> nearlyMastered;

  factory _ReviewPlan.from(_WrongData data) {
    final now = DateTime.now().millisecondsSinceEpoch;
    const day = 24 * 60 * 60 * 1000;
    final today = <Question>[];
    final oneDay = <Question>[];
    final threeDays = <Question>[];
    final sevenDays = <Question>[];
    final mastered = <Question>[];
    final highRisk = <Question>[];
    final nearlyMastered = <Question>[];

    for (final question in data.questions) {
      final state = data.states[question.id];
      if (state == null) continue;
      final status = state.status;
      if (status == QuestionMasteryStatus.mastered) {
        mastered.add(question);
      }
      if (state.status == QuestionMasteryStatus.recentWrong ||
          state.masteryScore < 40 ||
          state.consecutiveWrong > 0) {
        highRisk.add(question);
      }
      if (state.masteryScore >= 55 &&
          state.masteryScore < 80 &&
          state.consecutiveCorrect >= 1) {
        nearlyMastered.add(question);
      }

      final next = state.nextReviewTime;
      if (next <= now) {
        today.add(question);
      } else if (next <= now + day) {
        oneDay.add(question);
      } else if (next <= now + 3 * day) {
        threeDays.add(question);
      } else {
        sevenDays.add(question);
      }
    }

    return _ReviewPlan(
      today: today,
      oneDay: oneDay,
      threeDays: threeDays,
      sevenDays: sevenDays,
      mastered: mastered,
      highRisk: highRisk,
      nearlyMastered: nearlyMastered,
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.count,
    required this.dueCount,
    required this.riskCount,
    required this.isMember,
    required this.onReview,
    required this.onOpenMember,
  });

  final int count;
  final int dueCount;
  final int riskCount;
  final bool isMember;
  final VoidCallback? onReview;
  final VoidCallback? onOpenMember;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('错题强化', style: AppTextStyles.display),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      '共 $count 题，今日待复习 $dueCount，高风险遗忘 $riskCount',
                      style: AppTextStyles.body,
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 150,
                child: PrimaryButton(
                  label: '开始复习',
                  icon: Icons.play_arrow_rounded,
                  onPressed: onReview,
                ),
              ),
            ],
          ),
          if (!isMember) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: onOpenMember,
              icon: const Icon(Icons.workspace_premium_outlined),
              label: const Text('开通后解锁完整复习计划'),
            ),
          ],
        ],
      ),
    );
  }
}

class _CurveSummary extends StatelessWidget {
  const _CurveSummary({required this.plan});

  final _ReviewPlan plan;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: const Color(0xFFFFFCF5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('错题强化', style: AppTextStyles.subtitle)),
              IconButton(
                onPressed: () => _showCurveHelp(context),
                icon: const Icon(Icons.help_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _CurveMetric(
                  label: '今日待复习',
                  value: '${plan.today.length}',
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: _CurveMetric(
                  label: '高风险遗忘',
                  value: '${plan.highRisk.length}',
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: _CurveMetric(
                  label: '即将掌握',
                  value: '${plan.nearlyMastered.length}',
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            '错题强化已免费开放，可直接筛选并开始复习。',
            style: AppTextStyles.caption,
          ),
        ],
      ),
    );
  }

  void _showCurveHelp(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('记忆曲线说明'),
          content: const Text(
            '系统根据答错次数、连续正确次数、掌握度和下次复习时间，把错题分为今日待复习、高风险遗忘和即将掌握。'
            '复习节奏参考遗忘曲线：刚答错的题优先复习，连续答对后逐步拉长间隔。',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('知道了'),
            ),
          ],
        );
      },
    );
  }
}

class _CurveMetric extends StatelessWidget {
  const _CurveMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: AppTextStyles.title.copyWith(color: color),
          ),
          const SizedBox(height: 4),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _CurveTabs extends StatelessWidget {
  const _CurveTabs({required this.plan});

  final _ReviewPlan plan;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('复习分类说明', style: AppTextStyles.subtitle)),
              IconButton(
                onPressed: () => _showCurveHelp(context),
                icon: const Icon(Icons.help_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Row(
            children: [
              Expanded(
                  child: _ColorRule(color: AppColors.danger, label: '最近答错')),
              SizedBox(width: AppSpacing.xs),
              Expanded(
                  child: _ColorRule(color: AppColors.warning, label: '待巩固')),
              SizedBox(width: AppSpacing.xs),
              Expanded(
                  child: _ColorRule(color: AppColors.success, label: '已掌握')),
              SizedBox(width: AppSpacing.xs),
              Expanded(child: _ColorRule(color: AppColors.border, label: '未做')),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _IntervalChip(
                  label: '今日待复习',
                  count: plan.today.length,
                  color: AppColors.primary),
              _IntervalChip(
                  label: '1天后',
                  count: plan.oneDay.length,
                  color: AppColors.info),
              _IntervalChip(
                  label: '3天后',
                  count: plan.threeDays.length,
                  color: AppColors.warning),
              _IntervalChip(
                  label: '7天后',
                  count: plan.sevenDays.length,
                  color: AppColors.teal),
              _IntervalChip(
                  label: '已掌握',
                  count: plan.mastered.length,
                  color: AppColors.success),
            ],
          ),
        ],
      ),
    );
  }

  void _showCurveHelp(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('复习分类说明'),
          content: const Text(
            '系统根据最近一次答题、连续正确次数、掌握度和下次复习时间归类：红色代表最近答错，黄色代表曾答错但仍需巩固，绿色代表连续正确达到掌握标准。',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('知道了'),
            ),
          ],
        );
      },
    );
  }
}

class _ColorRule extends StatelessWidget {
  const _ColorRule({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 4,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(height: 6),
        Text(label, style: AppTextStyles.caption),
      ],
    );
  }
}

class _IntervalChip extends StatelessWidget {
  const _IntervalChip({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label $count',
        style: TextStyle(color: color, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.title),
        const SizedBox(height: AppSpacing.xs),
        Text(subtitle, style: AppTextStyles.body),
      ],
    );
  }
}

class _WrongQuestionCard extends StatelessWidget {
  const _WrongQuestionCard({
    required this.question,
    required this.state,
    required this.onTap,
  });

  final Question question;
  final QuestionLearningState? state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = state?.status ?? QuestionMasteryStatus.unattempted;
    final color = _statusColor(status);
    final label = _statusLabel(status);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Chip(label: Text(question.type)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(color: color, fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              question.question,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.subtitle.copyWith(height: 1.45),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '错 ${state?.wrongCount ?? 0} 次  连续正确 ${state?.consecutiveCorrect ?? 0} 次  掌握度 ${state?.masteryScore ?? 0}',
              style: AppTextStyles.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xs),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: ((state?.masteryScore ?? 0) / 100).clamp(0, 1),
                color: color,
                backgroundColor: AppColors.border,
                minHeight: 7,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LockedPreviewCard extends StatelessWidget {
  const _LockedPreviewCard({
    required this.hiddenCount,
    required this.onOpenMember,
  });

  final int hiddenCount;
  final VoidCallback? onOpenMember;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: const Color(0xFFFFFAEB),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_outline_rounded, color: AppColors.warning),
              SizedBox(width: AppSpacing.xs),
              Expanded(
                  child: Text('完整错题强化需开通会员', style: AppTextStyles.subtitle)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '还有 $hiddenCount 道错题、记忆曲线计划和高风险遗忘分析等待解锁。',
            style: AppTextStyles.body,
          ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: '查看会员权益',
            icon: Icons.workspace_premium_outlined,
            onPressed: onOpenMember,
          ),
        ],
      ),
    );
  }
}

class _EmptyWrongCard extends StatelessWidget {
  const _EmptyWrongCard();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Column(
          children: [
            Icon(Icons.verified_rounded, size: 52, color: AppColors.success),
            SizedBox(height: AppSpacing.sm),
            Text('暂无错题', style: AppTextStyles.title),
            SizedBox(height: AppSpacing.xs),
            Text('刷题后答错的题会自动进入这里。', style: AppTextStyles.body),
          ],
        ),
      ),
    );
  }
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 54, color: AppColors.textTertiary),
            const SizedBox(height: AppSpacing.md),
            Text(title, style: AppTextStyles.title),
            const SizedBox(height: AppSpacing.xs),
            Text(message,
                textAlign: TextAlign.center, style: AppTextStyles.body),
          ],
        ),
      ),
    );
  }
}

Color _statusColor(QuestionMasteryStatus status) {
  return switch (status) {
    QuestionMasteryStatus.recentWrong => AppColors.danger,
    QuestionMasteryStatus.needReinforce => AppColors.warning,
    QuestionMasteryStatus.mastered => AppColors.success,
    QuestionMasteryStatus.unattempted => AppColors.textTertiary,
  };
}

String _statusLabel(QuestionMasteryStatus status) {
  return switch (status) {
    QuestionMasteryStatus.recentWrong => '最近答错',
    QuestionMasteryStatus.needReinforce => '待巩固',
    QuestionMasteryStatus.mastered => '已掌握',
    QuestionMasteryStatus.unattempted => '未做',
  };
}
