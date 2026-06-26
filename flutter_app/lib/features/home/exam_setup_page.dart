import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app/app_routes.dart';
import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import '../questions/question_models.dart';
import '../questions/question_repository.dart';

class ExamSetupPage extends StatefulWidget {
  const ExamSetupPage({
    super.key,
    required this.major,
    required this.level,
  });

  final String? major;
  final String? level;

  @override
  State<ExamSetupPage> createState() => _ExamSetupPageState();
}

class _ExamSetupPageState extends State<ExamSetupPage> {
  final _repository = QuestionRepository();
  late final Future<List<Question>> _questions = _repository.fetchQuestions(
    major: widget.major,
    level: widget.level,
    limit: 1200,
  );

  int _singleCount = 10;
  int _multipleCount = 5;
  int _judgeCount = 5;
  int _minutes = 30;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('模拟考试')),
      body: FutureBuilder<List<Question>>(
        future: _questions,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _StateMessage(
              title: '组卷失败',
              message: snapshot.error.toString(),
            );
          }
          final questions = snapshot.data ?? [];
          final buckets = _QuestionBuckets.from(questions);
          _normalizeDefaults(buckets);
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageHorizontal,
              AppSpacing.md,
              AppSpacing.pageHorizontal,
              AppSpacing.pageBottom,
            ),
            children: [
              _ExamIntroCard(
                major: widget.major ?? '当前题库',
                level: widget.level ?? '默认等级',
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('组卷设置', style: AppTextStyles.title),
                    const SizedBox(height: AppSpacing.sm),
                    _CountRow(
                      title: '单选题数量',
                      subtitle: '共 ${buckets.single.length} 题可抽',
                      value: _singleCount,
                      max: buckets.single.length,
                      onChanged: (value) => setState(() {
                        _singleCount = value;
                      }),
                    ),
                    _CountRow(
                      title: '多选题数量',
                      subtitle: '共 ${buckets.multiple.length} 题可抽',
                      value: _multipleCount,
                      max: buckets.multiple.length,
                      onChanged: (value) => setState(() {
                        _multipleCount = value;
                      }),
                    ),
                    _CountRow(
                      title: '判断题数量',
                      subtitle: '共 ${buckets.judge.length} 题可抽',
                      value: _judgeCount,
                      max: buckets.judge.length,
                      onChanged: (value) => setState(() {
                        _judgeCount = value;
                      }),
                    ),
                    _CountRow(
                      title: '考试时间',
                      subtitle: '单位：分钟',
                      value: _minutes,
                      min: 5,
                      max: 180,
                      step: 5,
                      onChanged: (value) => setState(() {
                        _minutes = value;
                      }),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(
                label: '开始考试',
                icon: Icons.play_arrow_rounded,
                onPressed: _totalCount == 0
                    ? null
                    : () => _startExam(context, buckets),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '本次将随机抽取 $_totalCount 题，提交后显示成绩。',
                textAlign: TextAlign.center,
                style: AppTextStyles.caption,
              ),
            ],
          );
        },
      ),
    );
  }

  int get _totalCount => _singleCount + _multipleCount + _judgeCount;

  void _normalizeDefaults(_QuestionBuckets buckets) {
    final normalizedSingle = math.min(_singleCount, buckets.single.length);
    final normalizedMultiple =
        math.min(_multipleCount, buckets.multiple.length);
    final normalizedJudge = math.min(_judgeCount, buckets.judge.length);
    if (normalizedSingle != _singleCount ||
        normalizedMultiple != _multipleCount ||
        normalizedJudge != _judgeCount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _singleCount = normalizedSingle;
          _multipleCount = normalizedMultiple;
          _judgeCount = normalizedJudge;
        });
      });
    }
  }

  void _startExam(BuildContext context, _QuestionBuckets buckets) {
    final selected = <Question>[
      ..._pickRandom(buckets.single, _singleCount),
      ..._pickRandom(buckets.multiple, _multipleCount),
      ..._pickRandom(buckets.judge, _judgeCount),
    ]..shuffle(math.Random());

    AppNavigator.pushPractice(
      context,
      title: '模拟考试',
      initialQuestions: selected,
    );
  }

  List<Question> _pickRandom(List<Question> questions, int count) {
    final pool = [...questions]..shuffle(math.Random());
    return pool.take(count).toList();
  }
}

class _QuestionBuckets {
  const _QuestionBuckets({
    required this.single,
    required this.multiple,
    required this.judge,
  });

  final List<Question> single;
  final List<Question> multiple;
  final List<Question> judge;

  factory _QuestionBuckets.from(List<Question> questions) {
    final single = <Question>[];
    final multiple = <Question>[];
    final judge = <Question>[];
    for (final question in questions) {
      if (question.isJudge) {
        judge.add(question);
      } else if (question.isMultiple) {
        multiple.add(question);
      } else {
        single.add(question);
      }
    }
    return _QuestionBuckets(
      single: single,
      multiple: multiple,
      judge: judge,
    );
  }
}

class _ExamIntroCard extends StatelessWidget {
  const _ExamIntroCard({
    required this.major,
    required this.level,
  });

  final String major;
  final String level;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('模拟考试', style: AppTextStyles.display),
          const SizedBox(height: AppSpacing.xs),
          const Text('按题型随机抽题，提交后立即显示成绩。', style: AppTextStyles.body),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '$major / $level',
            style:
                AppTextStyles.subtitle.copyWith(color: AppColors.primaryDark),
          ),
        ],
      ),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.max,
    required this.onChanged,
    this.min = 0,
    this.step = 1,
  });

  final String title;
  final String subtitle;
  final int value;
  final int min;
  final int max;
  final int step;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.subtitle),
                const SizedBox(height: 2),
                Text(subtitle, style: AppTextStyles.caption),
              ],
            ),
          ),
          _StepButton(
            icon: Icons.remove_rounded,
            enabled: value > min,
            onTap: () => onChanged(math.max(min, value - step)),
          ),
          Container(
            width: 54,
            height: 42,
            alignment: Alignment.center,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceSoft,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Text(
              '$value',
              style: AppTextStyles.subtitle.copyWith(
                color: AppColors.primaryDark,
              ),
            ),
          ),
          _StepButton(
            icon: Icons.add_rounded,
            enabled: value < max,
            onTap: () => onChanged(math.min(max, value + step)),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      child: Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primaryLight : AppColors.surfaceSoft,
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        ),
        child: Icon(
          icon,
          color: enabled ? AppColors.primaryDark : AppColors.textTertiary,
        ),
      ),
    );
  }
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.title,
    required this.message,
  });

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
            const Icon(
              Icons.inventory_2_outlined,
              size: 54,
              color: AppColors.textTertiary,
            ),
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
