import 'package:flutter/material.dart';

import 'app_card.dart';
import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_text_styles.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.value,
    required this.label,
    this.accent = AppColors.primary,
  });

  final String value;
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.md,
      ),
      child: Column(
        children: [
          Text(
            value,
            style: AppTextStyles.title.copyWith(color: accent),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}
