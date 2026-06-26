import 'package:flutter/material.dart';

import '../../design_system/app_card.dart';
import '../../design_system/app_colors.dart';
import '../../design_system/app_spacing.dart';
import '../../design_system/app_text_styles.dart';
import '../../design_system/primary_button.dart';
import '../questions/question_models.dart';

class BankSelection {
  const BankSelection({required this.major, required this.level});

  final QuestionMajor major;
  final QuestionLevel level;
}

class BankSelectPage extends StatefulWidget {
  const BankSelectPage({
    super.key,
    required this.catalog,
    required this.currentMajor,
    required this.currentLevel,
  });

  final Catalog catalog;
  final QuestionMajor? currentMajor;
  final QuestionLevel? currentLevel;

  @override
  State<BankSelectPage> createState() => _BankSelectPageState();
}

class _BankSelectPageState extends State<BankSelectPage> {
  final _searchController = TextEditingController();
  late QuestionMajor? _selectedMajor = widget.currentMajor ??
      (widget.catalog.majors.isEmpty ? null : widget.catalog.majors.first);
  late QuestionLevel? _selectedLevel =
      _resolveInitialLevel(_selectedMajor, widget.currentLevel);
  String _keyword = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filteredMajors = _filteredMajors();
    return Scaffold(
      appBar: AppBar(title: const Text('选择专业')),
      body: Column(
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
                _PageTitle(total: widget.catalog.majors.length),
                const SizedBox(height: AppSpacing.sm),
                _SearchBox(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _keyword = value.trim()),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_selectedMajor != null && _selectedLevel != null)
                  _CurrentSelectionCard(
                    major: _selectedMajor!,
                    level: _selectedLevel!,
                    onLevelTap: (level) {
                      setState(() => _selectedLevel = level);
                    },
                  ),
                const SizedBox(height: AppSpacing.md),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: Text('全部专业', style: AppTextStyles.subtitle),
                      ),
                      if (filteredMajors.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(AppSpacing.lg),
                          child: Text('没有找到匹配专业', style: AppTextStyles.body),
                        )
                      else
                        for (final major in filteredMajors)
                          _MajorListTile(
                            major: major,
                            selected: major.name == _selectedMajor?.name,
                            onTap: () {
                              setState(() {
                                _selectedMajor = major;
                                _selectedLevel =
                                    _resolveInitialLevel(major, _selectedLevel);
                              });
                            },
                          ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _BottomConfirmBar(
            enabled: _selectedMajor != null && _selectedLevel != null,
            onConfirm: () {
              final major = _selectedMajor;
              final level = _selectedLevel;
              if (major == null || level == null) return;
              Navigator.of(context).pop(BankSelection(
                major: major,
                level: level,
              ));
            },
          ),
        ],
      ),
    );
  }

  List<QuestionMajor> _filteredMajors() {
    if (_keyword.isEmpty) return widget.catalog.majors;
    return widget.catalog.majors
        .where((major) => major.name.contains(_keyword))
        .toList();
  }

  QuestionLevel? _resolveInitialLevel(
    QuestionMajor? major,
    QuestionLevel? preferred,
  ) {
    if (major == null || major.levels.isEmpty) return null;
    if (preferred != null) {
      for (final level in major.levels) {
        if (level.name == preferred.name) return level;
      }
    }
    return major.levels.first;
  }
}

class _PageTitle extends StatelessWidget {
  const _PageTitle({required this.total});

  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('选择专业', style: AppTextStyles.display),
              SizedBox(height: AppSpacing.xxs),
              Text('搜索专业名称，选择后点击确认生效', style: AppTextStyles.body),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$total 个',
            style: const TextStyle(
              color: AppColors.primaryDark,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({
    required this.controller,
    required this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: '搜索专业名称，如 通信、变电、配网',
        prefixIcon: const Icon(Icons.search_rounded),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class _CurrentSelectionCard extends StatelessWidget {
  const _CurrentSelectionCard({
    required this.major,
    required this.level,
    required this.onLevelTap,
  });

  final QuestionMajor major;
  final QuestionLevel level;
  final ValueChanged<QuestionLevel> onLevelTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('当前选择', style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.sm),
          Text(major.name, style: AppTextStyles.subtitle),
          const SizedBox(height: AppSpacing.xxs),
          const Text('专业决定首页统计、刷题和模拟考试范围', style: AppTextStyles.caption),
          const Divider(height: 24),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('等级', style: AppTextStyles.subtitle),
                    SizedBox(height: AppSpacing.xxs),
                    Text('选择一个等级后开始练习', style: AppTextStyles.caption),
                  ],
                ),
              ),
              _LevelPickerButton(
                level: level,
                levels: major.levels,
                onLevelTap: onLevelTap,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LevelPickerButton extends StatelessWidget {
  const _LevelPickerButton({
    required this.level,
    required this.levels,
    required this.onLevelTap,
  });

  final QuestionLevel level;
  final List<QuestionLevel> levels;
  final ValueChanged<QuestionLevel> onLevelTap;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<QuestionLevel>(
      onSelected: onLevelTap,
      itemBuilder: (context) => [
        for (final item in levels)
          PopupMenuItem<QuestionLevel>(
            value: item,
            child: Text(item.name),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              level.name,
              style: const TextStyle(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: AppColors.primaryDark,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}

class _MajorListTile extends StatelessWidget {
  const _MajorListTile({
    required this.major,
    required this.selected,
    required this.onTap,
  });

  final QuestionMajor major;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: AppColors.border),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      major.name,
                      style: AppTextStyles.subtitle.copyWith(
                        color: selected
                            ? AppColors.primaryDark
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text('点击选择专业，再选择等级', style: AppTextStyles.caption),
                  ],
                ),
              ),
              if (selected)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    '当前',
                    style: TextStyle(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomConfirmBar extends StatelessWidget {
  const _BottomConfirmBar({
    required this.enabled,
    required this.onConfirm,
  });

  final bool enabled;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        decoration: BoxDecoration(
          color: AppColors.surface.withValues(alpha: 0.98),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 22,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: PrimaryButton(
          label: '确认并返回首页',
          icon: Icons.check_rounded,
          onPressed: enabled ? onConfirm : null,
        ),
      ),
    );
  }
}
