import 'package:flutter/material.dart';

import 'app_colors.dart';

class AppTextStyles {
  const AppTextStyles._();

  static const display = TextStyle(
    fontSize: 28,
    height: 1.18,
    fontWeight: FontWeight.w900,
    color: AppColors.textPrimary,
  );

  static const title = TextStyle(
    fontSize: 22,
    height: 1.25,
    fontWeight: FontWeight.w900,
    color: AppColors.textPrimary,
  );

  static const subtitle = TextStyle(
    fontSize: 17,
    height: 1.35,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
  );

  static const body = TextStyle(
    fontSize: 15,
    height: 1.55,
    color: AppColors.textSecondary,
  );

  static const caption = TextStyle(
    fontSize: 12,
    height: 1.35,
    color: AppColors.textTertiary,
  );
}
