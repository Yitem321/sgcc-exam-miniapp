import 'package:flutter/material.dart';

import 'app_card.dart';
import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_text_styles.dart';

class ProgressCard extends StatelessWidget {
  const ProgressCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.progress,
    required this.trailing,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final double progress;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: AppTextStyles.subtitle)),
              trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(subtitle, style: AppTextStyles.body),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress.clamp(0, 1),
              minHeight: 8,
              color: AppColors.primary,
              backgroundColor: AppColors.border,
            ),
          ),
        ],
      ),
    );
  }
}
