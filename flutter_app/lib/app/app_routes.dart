import 'package:flutter/material.dart';

import '../features/home/bank_detail_page.dart';
import '../features/practice/practice_page.dart';
import '../features/questions/question_models.dart';
import '../features/wrong/wrong_page.dart';

enum AppTab {
  home,
  practice,
  wrong,
  member,
  mine,
}

class AppRoutes {
  const AppRoutes._();

  static const home = '/';
  static const practice = '/practice';
  static const wrong = '/wrong';
  static const member = '/member';
  static const mine = '/mine';
  static const bankDetail = '/bank-detail';
  static const placeholder = '/placeholder';
}

class AppNavigator {
  const AppNavigator._();

  static Future<void> pushPractice(
    BuildContext context, {
    String title = '顺序练习',
    String? major,
    String? level,
    List<Question>? initialQuestions,
    bool random = false,
    int limit = 100,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: AppRoutes.practice),
        builder: (_) => PracticePage(
          title: title,
          major: major,
          level: level,
          initialQuestions: initialQuestions,
          random: random,
          limit: limit,
        ),
      ),
    );
  }

  static Future<void> pushWrong(
    BuildContext context, {
    VoidCallback? onOpenMember,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: AppRoutes.wrong),
        builder: (_) => WrongPage(onOpenMember: onOpenMember),
      ),
    );
  }

  static Future<BankDetailAction?> pushBankDetail(
    BuildContext context, {
    required QuestionMajor major,
    required QuestionLevel? level,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute<BankDetailAction>(
        settings: const RouteSettings(name: AppRoutes.bankDetail),
        builder: (_) => BankDetailPage(
          major: major,
          level: level,
        ),
      ),
    );
  }

  static Future<void> pushPlaceholder(
    BuildContext context, {
    required String title,
    required String description,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: AppRoutes.placeholder),
        builder: (_) => FeaturePlaceholderPage(
          title: title,
          description: description,
        ),
      ),
    );
  }
}

class FeaturePlaceholderPage extends StatelessWidget {
  const FeaturePlaceholderPage({
    super.key,
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.construction_rounded, size: 56),
              const SizedBox(height: 18),
              Text(
                '功能开发中',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 10),
              Text(
                description,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
