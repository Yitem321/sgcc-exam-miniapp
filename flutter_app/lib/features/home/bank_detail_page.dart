import 'package:flutter/material.dart';

import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import '../questions/question_models.dart';

enum BankDetailAction {
  startPractice,
  changeBank,
}

class BankDetailPage extends StatelessWidget {
  const BankDetailPage({
    super.key,
    required this.major,
    required this.level,
  });

  final QuestionMajor major;
  final QuestionLevel? level;

  @override
  Widget build(BuildContext context) {
    final selectedLevel = level;
    return Scaffold(
      appBar: AppBar(title: const Text('当前题库')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.pageHorizontal,
          AppSpacing.md,
          AppSpacing.pageHorizontal,
          AppSpacing.pageBottom,
        ),
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.xl),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF102A43),
                  Color(0xFF0F766E),
                  Color(0xFF10B981)
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.18),
                  blurRadius: 24,
                  offset: const Offset(0, 16),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '题库详情',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  major.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  selectedLevel == null
                      ? '尚未选择等级'
                      : '当前等级：${selectedLevel.name}',
                  style: const TextStyle(color: Color(0xDFFFFFFF), height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  value: '${major.total}',
                  label: '题库总量',
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _MetricCard(
                  value: '${major.levels.length}',
                  label: '支持等级',
                  color: AppColors.info,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('等级列表', style: AppTextStyles.subtitle),
                const SizedBox(height: AppSpacing.sm),
                for (final item in major.levels)
                  _LevelRow(
                    level: item,
                    selected: selectedLevel?.name == item.name,
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: '开始刷当前题库',
            icon: Icons.play_arrow_rounded,
            onPressed: () {
              Navigator.of(context).pop(BankDetailAction.startPractice);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.of(context).pop(BankDetailAction.changeBank);
            },
            icon: const Icon(Icons.swap_horiz_rounded),
            label: const Text('切换专业 / 等级'),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTextStyles.title.copyWith(color: color)),
          const SizedBox(height: AppSpacing.xxs),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _LevelRow extends StatelessWidget {
  const _LevelRow({
    required this.level,
    required this.selected,
  });

  final QuestionLevel level;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: selected ? AppColors.primaryLight : AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: selected ? AppColors.primary : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Icon(
            selected
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked,
            color: selected ? AppColors.primary : AppColors.textTertiary,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(level.name, style: AppTextStyles.subtitle),
          ),
          Text('${level.total} 题', style: AppTextStyles.caption),
        ],
      ),
    );
  }
}
