import 'package:flutter/material.dart';

import '../../app/app_routes.dart';
import '../../core/local_store.dart';
import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/feature_grid_item.dart';
import '../../design_system/primary_button.dart';
import '../../design_system/progress_card.dart';
import '../../design_system/stat_card.dart';
import '../learning/learning_state.dart';
import '../questions/question_models.dart';
import '../questions/question_repository.dart';
import 'bank_detail_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    super.key,
    this.onOpenMember,
    this.onOpenMine,
    this.onBankChanged,
  });

  final VoidCallback? onOpenMember;
  final VoidCallback? onOpenMine;
  final VoidCallback? onBankChanged;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _repository = QuestionRepository();
  final _learningStore = LearningStateStore();
  final _localStore = LocalStore();

  late final Future<Catalog> _catalog = _repository.fetchCatalog();
  late Future<LearningSummary> _summary = _learningStore.summary();
  late Future<DailyProgress> _dailyProgress = _learningStore.todayProgress();
  String? _selectedMajorName;
  String? _selectedLevelName;

  @override
  void initState() {
    super.initState();
    _loadSelectedBank();
  }

  Future<void> _loadSelectedBank() async {
    final major = await _localStore.getString('selected_major');
    final level = await _localStore.getString('selected_level');
    if (!mounted) return;
    setState(() {
      _selectedMajorName = major;
      _selectedLevelName = level;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('电力考试刷题'),
        actions: [
          IconButton(
            tooltip: '我的',
            onPressed: widget.onOpenMine,
            icon: const Icon(Icons.person_outline_rounded),
          ),
        ],
      ),
      body: FutureBuilder<Catalog>(
        future: _catalog,
        builder: (context, snapshot) {
          final catalog = snapshot.data;
          final currentMajor = _currentMajor(catalog);
          final currentLevel = _currentLevel(currentMajor);
          return RefreshIndicator(
            onRefresh: () async {
              _refreshLearningData();
              await Future.wait([_summary, _dailyProgress]);
            },
            child: FutureBuilder<LearningSummary>(
              future: _summary,
              builder: (context, summarySnapshot) {
                final summary = summarySnapshot.data ??
                    const LearningSummary(
                      attemptedCount: 0,
                      wrongCount: 0,
                      masteredCount: 0,
                      dueReviewCount: 0,
                    );
                return ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.pageHorizontal,
                    AppSpacing.md,
                    AppSpacing.pageHorizontal,
                    AppSpacing.pageBottom,
                  ),
                  children: [
                    _WelcomeHeader(
                      majorName: currentMajor?.name ?? '变电二次安装工',
                      levelName: currentLevel?.name ?? '初级工',
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _StudyHeroCard(
                      onStart: () => _openPractice(catalog),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _StatsStrip(
                        summary: summary, catalogTotal: catalog?.total ?? 0),
                    const SizedBox(height: AppSpacing.md),
                    FutureBuilder<DailyProgress>(
                      future: _dailyProgress,
                      builder: (context, progressSnapshot) {
                        final progress = progressSnapshot.data ??
                            const DailyProgress(
                              completedCount: 0,
                              goalCount: 20,
                            );
                        return ProgressCard(
                          title: '今日打卡',
                          subtitle:
                              '已刷 ${progress.completedCount} / ${progress.goalCount} 题，${progress.completed ? '今日目标已完成，保持节奏。' : '坚持每天一点点推进。'}',
                          progress: progress.progress,
                          trailing: _SmallActionPill(
                            label: progress.completed ? '调目标' : '去打卡',
                            onTap: progress.completed
                                ? _showDailyGoalSheet
                                : () => _openPractice(catalog),
                          ),
                          onTap: _showDailyGoalSheet,
                        );
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _PracticeGrid(
                      onPractice: () => _openPractice(catalog),
                      onRandom: () => _openPractice(catalog, random: true),
                      onExam: () => _openPractice(
                        catalog,
                        random: true,
                        title: '模拟考试',
                        limit: 20,
                      ),
                      onWrong: () => AppNavigator.pushWrong(
                        context,
                        onOpenMember: widget.onOpenMember,
                      ).then((_) => _refreshSummary()),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (snapshot.connectionState == ConnectionState.waiting)
                      const _LoadingBankCard()
                    else if (snapshot.hasError)
                      _ErrorBankCard(message: snapshot.error.toString())
                    else if (catalog != null && currentMajor != null)
                      _CurrentBankCard(
                        major: currentMajor,
                        level: currentLevel,
                        onOpenDetail: () => _openBankDetail(
                            catalog, currentMajor, currentLevel),
                        onChangeBank: () => _showBankPicker(catalog),
                      ),
                    const SizedBox(height: AppSpacing.md),
                    _LearningDataCard(summary: summary),
                    const SizedBox(height: AppSpacing.md),
                    _MemberGuideCard(onTap: widget.onOpenMember),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }

  void _refreshSummary() {
    if (!mounted) return;
    _refreshLearningData();
  }

  void _refreshLearningData() {
    if (!mounted) return;
    setState(() {
      _summary = _learningStore.summary();
      _dailyProgress = _learningStore.todayProgress();
    });
  }

  QuestionMajor? _currentMajor(Catalog? catalog) {
    if (catalog == null || catalog.majors.isEmpty) return null;
    if (_selectedMajorName == null) return catalog.majors.first;
    for (final major in catalog.majors) {
      if (major.name == _selectedMajorName) return major;
    }
    return catalog.majors.first;
  }

  QuestionLevel? _currentLevel(QuestionMajor? major) {
    if (major == null || major.levels.isEmpty) return null;
    if (_selectedLevelName == null) return major.levels.first;
    for (final level in major.levels) {
      if (level.name == _selectedLevelName) return level;
    }
    return major.levels.first;
  }

  Future<void> _openPractice(
    Catalog? catalog, {
    bool random = false,
    String? title,
    int limit = 100,
  }) async {
    final major = _currentMajor(catalog);
    final level = _currentLevel(major);
    await AppNavigator.pushPractice(
      context,
      title: title ?? (random ? '随机练习' : '顺序练习'),
      major: major?.name,
      level: level?.name,
      random: random,
      limit: limit,
    );
    _refreshSummary();
  }

  Future<void> _selectBank(QuestionMajor major, QuestionLevel level) async {
    await _localStore.setString('selected_major', major.name);
    await _localStore.setString('selected_level', level.name);
    if (!mounted) return;
    setState(() {
      _selectedMajorName = major.name;
      _selectedLevelName = level.name;
    });
    widget.onBankChanged?.call();
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已切换到：${major.name} / ${level.name}')),
    );
  }

  Future<void> _showDailyGoalSheet() async {
    final currentGoal = await _learningStore.dailyGoal();
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        const goals = [10, 20, 30, 50];
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(AppSpacing.radiusXl),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text('每日刷题目标', style: AppTextStyles.title),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text(
                '目标会用于首页今日打卡进度。建议先从 20 题开始，稳定后再提高。',
                style: AppTextStyles.body,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  for (final goal in goals)
                    ChoiceChip(
                      label: Text('$goal 题/天'),
                      selected: goal == currentGoal,
                      onSelected: (_) async {
                        await _learningStore.setDailyGoal(goal);
                        if (!context.mounted) return;
                        Navigator.of(context).pop();
                        _refreshLearningData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('每日目标已调整为 $goal 题')),
                        );
                      },
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openBankDetail(
    Catalog catalog,
    QuestionMajor major,
    QuestionLevel? level,
  ) async {
    final action = await AppNavigator.pushBankDetail(
      context,
      major: major,
      level: level,
    );
    if (!mounted) return;
    switch (action) {
      case BankDetailAction.startPractice:
        await _openPractice(catalog);
      case BankDetailAction.changeBank:
        _showBankPicker(catalog);
      case null:
        break;
    }
  }

  void _showBankPicker(Catalog catalog) {
    final currentMajor = _currentMajor(catalog);
    final currentLevel = _currentLevel(currentMajor);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.78,
          minChildSize: 0.46,
          maxChildSize: 0.92,
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
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text('切换专业题库', style: AppTextStyles.title),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const Text(
                    '选择专业和等级后，首页、刷题和模拟考试会同步使用该题库。',
                    style: AppTextStyles.body,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  for (final major in catalog.majors)
                    _BankMajorCard(
                      major: major,
                      selectedMajorName: currentMajor?.name,
                      selectedLevelName: currentLevel?.name,
                      onSelect: _selectBank,
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

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({
    required this.majorName,
    required this.levelName,
  });

  final String majorName;
  final String levelName;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('电力考试刷题', style: AppTextStyles.display),
              const SizedBox(height: AppSpacing.xs),
              Text('$majorName / $levelName', style: AppTextStyles.body),
            ],
          ),
        ),
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.verified_rounded, color: AppColors.primary),
        ),
      ],
    );
  }
}

class _StudyHeroCard extends StatelessWidget {
  const _StudyHeroCard({required this.onStart});

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        gradient: const LinearGradient(
          colors: [Color(0xFF047857), Color(0xFF10B981), Color(0xFF2DD4BF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              '今日建议',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            '先刷 20 题，巩固薄弱题型',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              height: 1.2,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          const Text(
            '免费刷题，无需登录；登录仅用于保存学习记录。',
            style: TextStyle(color: Color(0xDFFFFFFF), height: 1.5),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: 180,
            child: FilledButton(
              onPressed: onStart,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primaryDark,
              ),
              child: const Text('立即开始刷题'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsStrip extends StatelessWidget {
  const _StatsStrip({required this.summary, required this.catalogTotal});

  final LearningSummary summary;
  final int catalogTotal;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: StatCard(
            value: '${summary.attemptedCount}',
            label: '已做题',
            accent: AppColors.textPrimary,
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: StatCard(
            value: '${summary.wrongCount}',
            label: '错题本',
            accent: AppColors.danger,
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: StatCard(
            value: catalogTotal == 0 ? '-' : '$catalogTotal',
            label: '题库量',
            accent: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _SmallActionPill extends StatelessWidget {
  const _SmallActionPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.primaryDark,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _PracticeGrid extends StatelessWidget {
  const _PracticeGrid({
    required this.onPractice,
    required this.onRandom,
    required this.onExam,
    required this.onWrong,
  });

  final VoidCallback onPractice;
  final VoidCallback onRandom;
  final VoidCallback onExam;
  final VoidCallback onWrong;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      childAspectRatio: 1.85,
      children: [
        FeatureGridItem(
          title: '顺序练习',
          subtitle: '系统刷题',
          icon: Icons.format_list_numbered_rounded,
          onTap: onPractice,
        ),
        FeatureGridItem(
          title: '随机练习',
          subtitle: '快速巩固',
          icon: Icons.shuffle_rounded,
          accent: AppColors.teal,
          onTap: onRandom,
        ),
        FeatureGridItem(
          title: '模拟考试',
          subtitle: '考前冲刺',
          icon: Icons.timer_outlined,
          accent: AppColors.info,
          onTap: onExam,
        ),
        FeatureGridItem(
          title: '错题强化',
          subtitle: '薄弱突破',
          icon: Icons.psychology_alt_outlined,
          accent: AppColors.danger,
          onTap: onWrong,
        ),
      ],
    );
  }
}

class _CurrentBankCard extends StatelessWidget {
  const _CurrentBankCard({
    required this.major,
    required this.level,
    required this.onOpenDetail,
    required this.onChangeBank,
  });

  final QuestionMajor major;
  final QuestionLevel? level;
  final VoidCallback onOpenDetail;
  final VoidCallback onChangeBank;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('当前题库', style: AppTextStyles.subtitle)),
              _SmallActionPill(label: '切换专业', onTap: onChangeBank),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              onTap: onOpenDetail,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(major.name, style: AppTextStyles.subtitle),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            '共 ${major.total} 题，支持 ${major.levels.length} 个等级题库',
                            style: AppTextStyles.body,
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.textTertiary,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Divider(height: 28),
          Row(
            children: [
              const Text('等级', style: AppTextStyles.body),
              const Spacer(),
              Text(
                level?.name ?? '初级工',
                style:
                    AppTextStyles.subtitle.copyWith(color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LearningDataCard extends StatelessWidget {
  const _LearningDataCard({required this.summary});

  final LearningSummary summary;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('学习数据', style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                  child: _MetricLine(
                      label: '待复习', value: '${summary.dueReviewCount}')),
              Expanded(
                  child: _MetricLine(
                      label: '已掌握', value: '${summary.masteredCount}')),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricLine extends StatelessWidget {
  const _MetricLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: AppTextStyles.title),
          const SizedBox(height: AppSpacing.xxs),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}

class _MemberGuideCard extends StatelessWidget {
  const _MemberGuideCard({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: const Color(0xFF102A43),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.workspace_premium_outlined, color: Color(0xFFFFD166)),
              SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  '会员权益',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            '解锁题目解析、智能错题强化、遗忘提醒与考前冲刺。',
            style: TextStyle(color: Color(0xCCFFFFFF), height: 1.5),
          ),
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            label: '查看会员权益',
            onPressed: onTap,
            icon: Icons.arrow_forward_rounded,
          ),
        ],
      ),
    );
  }
}

class _BankMajorCard extends StatelessWidget {
  const _BankMajorCard({
    required this.major,
    required this.selectedMajorName,
    required this.selectedLevelName,
    required this.onSelect,
  });

  final QuestionMajor major;
  final String? selectedMajorName;
  final String? selectedLevelName;
  final void Function(QuestionMajor major, QuestionLevel level) onSelect;

  @override
  Widget build(BuildContext context) {
    final isSelectedMajor = selectedMajorName == major.name;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text(major.name, style: AppTextStyles.subtitle)),
                Text('${major.total} 题', style: AppTextStyles.body),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final level in major.levels)
                  ChoiceChip(
                    label: Text('${level.name} · ${level.total}'),
                    selected:
                        isSelectedMajor && selectedLevelName == level.name,
                    onSelected: (_) => onSelect(major, level),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingBankCard extends StatelessWidget {
  const _LoadingBankCard();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorBankCard extends StatelessWidget {
  const _ErrorBankCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Text('题库连接失败：$message', style: AppTextStyles.body),
    );
  }
}
