import 'package:flutter/material.dart';

import '../../core/local_store.dart';
import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import '../favorites/favorite_service.dart';
import '../learning/learning_state.dart';
import '../questions/question_models.dart';
import '../questions/question_repository.dart';

class PracticePage extends StatefulWidget {
  const PracticePage({
    super.key,
    this.major,
    this.level,
    this.initialQuestions,
    this.title = '顺序练习',
    this.random = false,
    this.limit = 100,
  });

  final String? major;
  final String? level;
  final List<Question>? initialQuestions;
  final String title;
  final bool random;
  final int limit;

  @override
  State<PracticePage> createState() => _PracticePageState();
}

class _PracticePageState extends State<PracticePage> {
  final _repository = QuestionRepository();
  final _learningStore = LearningStateStore();
  final _localStore = LocalStore();
  final _favoriteService = FavoriteService();

  late final Future<List<Question>> _questions = _loadQuestions();
  final Set<String> _selected = {};
  final Set<String> _favorites = {};

  int _index = 0;
  bool _answered = false;
  bool _correct = false;
  String? _explanation;
  bool _loadingExplanation = false;
  QuestionLearningState? _currentState;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    final ids = await _favoriteService.loadIds();
    if (!mounted) return;
    setState(() {
      _favorites
        ..clear()
        ..addAll(ids);
    });
  }

  Future<List<Question>> _loadQuestions() async {
    if (widget.initialQuestions != null) return widget.initialQuestions!;
    var major = widget.major;
    var level = widget.level;
    major ??= await _localStore.getString('selected_major');
    level ??= await _localStore.getString('selected_level');
    if (major == null || level == null) {
      final catalog = await _repository.fetchCatalog();
      final firstMajor = catalog.majors.isNotEmpty ? catalog.majors.first : null;
      major ??= firstMajor?.name;
      level ??= firstMajor?.levels.isNotEmpty == true ? firstMajor!.levels.first.name : null;
    }
    return _repository.fetchQuestions(
      major: major,
      level: level,
      limit: widget.limit,
      random: widget.random,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: FutureBuilder<List<Question>>(
        future: _questions,
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
          final questions = snapshot.data ?? [];
          if (questions.isEmpty) {
            return const _StateMessage(
              icon: Icons.inventory_2_outlined,
              title: '当前题库暂无题目',
              message: '请切换其他专业或等级后再试。',
            );
          }
          final safeIndex = _index.clamp(0, questions.length - 1);
          final question = questions[safeIndex];
          final progress = questions.isEmpty ? 0.0 : (safeIndex + 1) / questions.length;
          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.pageHorizontal,
                    AppSpacing.md,
                    AppSpacing.pageHorizontal,
                    AppSpacing.lg,
                  ),
                  children: [
                    _PracticeHeader(
                      question: question,
                      index: safeIndex,
                      total: questions.length,
                      progress: progress,
                      onNavigatorTap: () => _showNavigator(questions),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _QuestionCard(question: question),
                    const SizedBox(height: AppSpacing.md),
                    question.isJudge
                        ? _JudgeOptionPanel(
                            question: question,
                            selected: _selected,
                            answered: _answered,
                            onSelect: (key) => _selectOption(question, key),
                          )
                        : _OptionPanel(
                            question: question,
                            selected: _selected,
                            answered: _answered,
                            onToggle: (key) => _selectOption(question, key),
                          ),
                    if (question.isMultiple && !_answered) ...[
                      const SizedBox(height: AppSpacing.md),
                      PrimaryButton(
                        label: '提交答案',
                        icon: Icons.check_circle_outline_rounded,
                        onPressed: _selected.isEmpty ? null : () => _submit(question),
                      ),
                    ],
                    if (_answered) ...[
                      const SizedBox(height: AppSpacing.md),
                      _AnswerResultCard(
                        correct: _correct,
                        answer: question.answer,
                        state: _currentState,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _AnalysisAccessCard(
                        loading: _loadingExplanation,
                        hasExplanation: _explanation != null,
                        onTap: () => _loadExplanation(question),
                      ),
                    ],
                    if (_explanation != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      _ExplanationCard(text: _explanation!),
                    ],
                  ],
                ),
              ),
              _BottomActionBar(
                canPrevious: safeIndex > 0,
                canNext: safeIndex < questions.length - 1,
                isFavorite: _favorites.contains(question.id),
                onPrevious: () => _jump(-1),
                onFavorite: () => _toggleFavorite(question.id),
                onAnalysis: () => _handleAnalysisTap(question),
                onNext: () => _jump(1),
              ),
            ],
          );
        },
      ),
    );
  }

  void _selectOption(Question question, String key) {
    if (_answered) return;
    setState(() {
      if (!question.isMultiple) _selected.clear();
      if (_selected.contains(key)) {
        _selected.remove(key);
      } else {
        _selected.add(key);
      }
    });
    if (!question.isMultiple && _selected.isNotEmpty) {
      _submit(question);
    }
  }

  Future<void> _submit(Question question) async {
    if (_selected.isEmpty || _answered) return;
    final correct = _isCorrect(question);
    final state = await _learningStore.recordAnswer(
      questionId: question.id,
      correct: correct,
    );
    if (!mounted) return;
    setState(() {
      _answered = true;
      _correct = correct;
      _currentState = state;
    });
  }

  bool _isCorrect(Question question) {
    final selected = _selected.map((item) => item.toUpperCase()).toList()..sort();
    final answer = RegExp('[A-Z]')
        .allMatches(question.answer.toUpperCase())
        .map((match) => match.group(0)!)
        .toList()
      ..sort();
    return selected.join() == answer.join();
  }

  Future<void> _handleAnalysisTap(Question question) async {
    if (!_answered) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('先完成当前题目，再查看解析。')),
      );
      return;
    }
    await _loadExplanation(question);
  }

  Future<void> _loadExplanation(Question question) async {
    if (_loadingExplanation) return;
    setState(() {
      _loadingExplanation = true;
      _explanation = null;
    });
    try {
      final text = await _repository.explain(question);
      if (!mounted) return;
      setState(() => _explanation = text);
    } catch (error) {
      if (!mounted) return;
      setState(() => _explanation = '解析加载失败：$error');
    } finally {
      if (mounted) setState(() => _loadingExplanation = false);
    }
  }

  Future<void> _toggleFavorite(String questionId) async {
    final ids = await _favoriteService.toggle(questionId);
    if (!mounted) return;
    setState(() {
      _favorites
        ..clear()
        ..addAll(ids);
    });
  }

  void _jump(int delta) {
    setState(() {
      _index += delta;
      _resetAnswerState();
    });
  }

  void _jumpTo(int index) {
    Navigator.of(context).pop();
    setState(() {
      _index = index;
      _resetAnswerState();
    });
  }

  void _resetAnswerState() {
    _selected.clear();
    _answered = false;
    _correct = false;
    _explanation = null;
    _loadingExplanation = false;
    _currentState = null;
  }

  Future<void> _showNavigator(List<Question> questions) async {
    final states = await _learningStore.loadStates();
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          maxChildSize: 0.92,
          minChildSize: 0.42,
          builder: (context, controller) {
            return Container(
              decoration: const BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.vertical(
                  top: Radius.circular(AppSpacing.radiusXl),
                ),
              ),
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
                children: [
                  Row(
                    children: [
                      const Text('题目导航', style: AppTextStyles.title),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const _LegendRow(),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (var i = 0; i < questions.length; i++)
                        _NavDot(
                          index: i,
                          active: i == _index,
                          state: states[questions[i].id],
                          onTap: () => _jumpTo(i),
                        ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _PracticeHeader extends StatelessWidget {
  const _PracticeHeader({
    required this.question,
    required this.index,
    required this.total,
    required this.progress,
    required this.onNavigatorTap,
  });

  final Question question;
  final int index;
  final int total;
  final double progress;
  final VoidCallback onNavigatorTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${question.major} / ${question.level}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: onNavigatorTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.grid_view_rounded, size: 16, color: AppColors.primaryDark),
                      SizedBox(width: 4),
                      Text(
                        '题目导航',
                        style: TextStyle(
                          color: AppColors.primaryDark,
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Chip(label: Text(question.type)),
              const Spacer(),
              Text(
                '第 ${index + 1} / $total 题',
                style: AppTextStyles.subtitle.copyWith(color: AppColors.primaryDark),
              ),
            ],
          ),
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

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Text(
        question.question,
        style: AppTextStyles.title.copyWith(height: 1.55),
      ),
    );
  }
}

class _OptionPanel extends StatelessWidget {
  const _OptionPanel({
    required this.question,
    required this.selected,
    required this.answered,
    required this.onToggle,
  });

  final Question question;
  final Set<String> selected;
  final bool answered;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: question.options.entries.map((entry) {
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: _OptionTile(
            optionKey: entry.key,
            text: entry.value,
            selected: selected.contains(entry.key),
            correct: _isRightOption(question, entry.key),
            answered: answered,
            multiple: question.isMultiple,
            onTap: () => onToggle(entry.key),
          ),
        );
      }).toList(),
    );
  }
}

class _JudgeOptionPanel extends StatelessWidget {
  const _JudgeOptionPanel({
    required this.question,
    required this.selected,
    required this.answered,
    required this.onSelect,
  });

  final Question question;
  final Set<String> selected;
  final bool answered;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final entries = question.options.entries.toList();
    return Row(
      children: [
        for (var i = 0; i < entries.length; i++) ...[
          Expanded(
            child: _JudgeButton(
              optionKey: entries[i].key,
              text: entries[i].value,
              selected: selected.contains(entries[i].key),
              correct: _isRightOption(question, entries[i].key),
              answered: answered,
              onTap: () => onSelect(entries[i].key),
            ),
          ),
          if (i != entries.length - 1) const SizedBox(width: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.optionKey,
    required this.text,
    required this.selected,
    required this.correct,
    required this.answered,
    required this.multiple,
    required this.onTap,
  });

  final String optionKey;
  final String text;
  final bool selected;
  final bool correct;
  final bool answered;
  final bool multiple;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final statusColor = _optionStatusColor(
      selected: selected,
      answered: answered,
      correct: correct,
    );
    final fillColor = selected || (answered && correct)
        ? statusColor.withValues(alpha: 0.08)
        : AppColors.surface;
    return AppCard(
      color: fillColor,
      padding: const EdgeInsets.all(AppSpacing.md),
      onTap: answered ? null : onTap,
      child: Row(
        children: [
          _OptionMark(
            label: optionKey,
            selected: selected,
            answered: answered,
            correct: correct,
            multiple: multiple,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              text,
              style: AppTextStyles.subtitle.copyWith(
                fontWeight: FontWeight.w800,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _JudgeButton extends StatelessWidget {
  const _JudgeButton({
    required this.optionKey,
    required this.text,
    required this.selected,
    required this.correct,
    required this.answered,
    required this.onTap,
  });

  final String optionKey;
  final String text;
  final bool selected;
  final bool correct;
  final bool answered;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = _optionStatusColor(
      selected: selected,
      answered: answered,
      correct: correct,
    );
    final highlighted = selected || (answered && correct);
    return AppCard(
      onTap: answered ? null : onTap,
      color: highlighted ? color.withValues(alpha: 0.1) : AppColors.surface,
      padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 12),
      child: Column(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: highlighted ? color : AppColors.primaryLight,
            child: Icon(
              text.contains('错') || text.toLowerCase().contains('false')
                  ? Icons.close_rounded
                  : Icons.check_rounded,
              color: highlighted ? Colors.white : AppColors.primaryDark,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            text,
            textAlign: TextAlign.center,
            style: AppTextStyles.subtitle.copyWith(color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _OptionMark extends StatelessWidget {
  const _OptionMark({
    required this.label,
    required this.selected,
    required this.answered,
    required this.correct,
    required this.multiple,
  });

  final String label;
  final bool selected;
  final bool answered;
  final bool correct;
  final bool multiple;

  @override
  Widget build(BuildContext context) {
    final color = _optionStatusColor(
      selected: selected,
      answered: answered,
      correct: correct,
    );
    final showCheck = selected || (answered && correct);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 38,
      height: 38,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: showCheck ? color : AppColors.surface,
        shape: multiple ? BoxShape.rectangle : BoxShape.circle,
        borderRadius: multiple ? BorderRadius.circular(12) : null,
        border: Border.all(
          color: showCheck ? color : AppColors.border,
          width: 1.5,
        ),
      ),
      child: showCheck
          ? const Icon(Icons.check_rounded, color: Colors.white, size: 22)
          : Text(
              label,
              style: const TextStyle(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w900,
              ),
            ),
    );
  }
}

class _AnswerResultCard extends StatelessWidget {
  const _AnswerResultCard({
    required this.correct,
    required this.answer,
    required this.state,
  });

  final bool correct;
  final String answer;
  final QuestionLearningState? state;

  @override
  Widget build(BuildContext context) {
    final color = correct ? AppColors.success : AppColors.danger;
    return AppCard(
      color: color.withValues(alpha: 0.08),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                correct ? Icons.check_circle_rounded : Icons.cancel_rounded,
                color: color,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                correct ? '回答正确' : '回答错误',
                style: AppTextStyles.subtitle.copyWith(color: color),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text('正确答案：$answer', style: AppTextStyles.body),
          if (state != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              '错 ${state!.wrongCount} 次  连续正确 ${state!.consecutiveCorrect} 次  掌握度 ${state!.masteryScore}',
              style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _AnalysisAccessCard extends StatelessWidget {
  const _AnalysisAccessCard({
    required this.loading,
    required this.hasExplanation,
    required this.onTap,
  });

  final bool loading;
  final bool hasExplanation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: AppColors.primaryLight,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: AppColors.primaryDark),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('题目解析', style: AppTextStyles.subtitle),
                SizedBox(height: 2),
                Text('开通会员后可不限次数查看解析与错题强化。', style: AppTextStyles.caption),
              ],
            ),
          ),
          TextButton(
            onPressed: loading ? null : onTap,
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(hasExplanation ? '刷新' : '查看'),
          ),
        ],
      ),
    );
  }
}

class _ExplanationCard extends StatelessWidget {
  const _ExplanationCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('解析', style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.sm),
          Text(text, style: AppTextStyles.body.copyWith(height: 1.7)),
        ],
      ),
    );
  }
}

class _BottomActionBar extends StatelessWidget {
  const _BottomActionBar({
    required this.canPrevious,
    required this.canNext,
    required this.isFavorite,
    required this.onPrevious,
    required this.onFavorite,
    required this.onAnalysis,
    required this.onNext,
  });

  final bool canPrevious;
  final bool canNext;
  final bool isFavorite;
  final VoidCallback onPrevious;
  final VoidCallback onFavorite;
  final VoidCallback onAnalysis;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
        decoration: BoxDecoration(
          color: AppColors.surface.withValues(alpha: 0.98),
          border: Border(top: BorderSide(color: AppColors.border.withValues(alpha: 0.8))),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: Row(
          children: [
            _BottomAction(
              icon: Icons.chevron_left_rounded,
              label: '上一题',
              onTap: canPrevious ? onPrevious : null,
            ),
            _BottomAction(
              icon: isFavorite ? Icons.star_rounded : Icons.star_border_rounded,
              label: isFavorite ? '已收藏' : '收藏',
              onTap: onFavorite,
            ),
            _BottomAction(
              icon: Icons.lightbulb_outline_rounded,
              label: '解析',
              onTap: onAnalysis,
            ),
            _BottomAction(
              icon: Icons.chevron_right_rounded,
              label: '下一题',
              onTap: canNext ? onNext : null,
              emphasized: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomAction extends StatelessWidget {
  const _BottomAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.emphasized = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final color = !enabled
        ? AppColors.textTertiary
        : emphasized
            ? AppColors.primaryDark
            : AppColors.textPrimary;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: emphasized && enabled
              ? BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                )
              : null,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow();

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      spacing: 12,
      runSpacing: 8,
      children: [
        _LegendItem(color: Colors.white, label: '未做', outlined: true),
        _LegendItem(color: AppColors.danger, label: '最近答错'),
        _LegendItem(color: AppColors.warning, label: '待巩固'),
        _LegendItem(color: AppColors.success, label: '已掌握'),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({
    required this.color,
    required this.label,
    this.outlined = false,
  });

  final Color color;
  final String label;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: outlined ? Border.all(color: AppColors.border) : null,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: AppTextStyles.caption),
      ],
    );
  }
}

class _NavDot extends StatelessWidget {
  const _NavDot({
    required this.index,
    required this.active,
    required this.state,
    required this.onTap,
  });

  final int index;
  final bool active;
  final QuestionLearningState? state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = state?.status ?? QuestionMasteryStatus.unattempted;
    final color = switch (status) {
      QuestionMasteryStatus.recentWrong => AppColors.danger,
      QuestionMasteryStatus.needReinforce => AppColors.warning,
      QuestionMasteryStatus.mastered => AppColors.success,
      QuestionMasteryStatus.unattempted => Colors.white,
    };
    final textColor = status == QuestionMasteryStatus.unattempted
        ? AppColors.textPrimary
        : Colors.white;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 48,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: active ? AppColors.textPrimary : AppColors.border,
            width: active ? 2 : 1,
          ),
        ),
        child: Text(
          '${index + 1}',
          style: TextStyle(fontWeight: FontWeight.w900, color: textColor),
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
            Text(message, textAlign: TextAlign.center, style: AppTextStyles.body),
          ],
        ),
      ),
    );
  }
}

bool _isRightOption(Question question, String key) {
  return RegExp('[A-Z]')
      .allMatches(question.answer.toUpperCase())
      .map((match) => match.group(0)!)
      .contains(key.toUpperCase());
}

Color _optionStatusColor({
  required bool selected,
  required bool answered,
  required bool correct,
}) {
  if (answered && correct) return AppColors.success;
  if (answered && selected && !correct) return AppColors.danger;
  if (selected) return AppColors.primary;
  return AppColors.border;
}
