import 'package:flutter/material.dart';

import '../features/home/home_page.dart';
import '../features/member/member_page.dart';
import '../features/mine/mine_page.dart';
import '../features/practice/practice_page.dart';
import '../features/wrong/wrong_page.dart';
import 'theme.dart';

class SgccExamApp extends StatelessWidget {
  const SgccExamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: '电力考试刷题',
      theme: buildAppTheme(),
      builder: (context, child) => _DesktopPhonePreview(child: child),
      home: const AppShell(),
    );
  }
}

class _DesktopPhonePreview extends StatelessWidget {
  const _DesktopPhonePreview({required this.child});

  final Widget? child;

  static const _desktopMaxWidth = 430.0;

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.windows ||
        platform == TargetPlatform.macOS ||
        platform == TargetPlatform.linux;
    if (!isDesktop || child == null) return child ?? const SizedBox.shrink();

    return ColoredBox(
      color: const Color(0xFFE8EEF2),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _desktopMaxWidth),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 34,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  int _practiceRevision = 0;

  void _selectTab(int index) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    setState(() => _index = index);
  }

  void _handleBankChanged() {
    setState(() => _practiceRevision++);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomePage(
        onOpenMember: () => _selectTab(3),
        onOpenMine: () => _selectTab(4),
        onBankChanged: _handleBankChanged,
      ),
      PracticePage(key: ValueKey('practice-$_practiceRevision')),
      WrongPage(onOpenMember: () => _selectTab(3)),
      const MemberPage(),
      const MinePage(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: '首页',
          ),
          NavigationDestination(
            icon: Icon(Icons.edit_note_outlined),
            selectedIcon: Icon(Icons.edit_note),
            label: '刷题',
          ),
          NavigationDestination(
            icon: Icon(Icons.auto_stories_outlined),
            selectedIcon: Icon(Icons.auto_stories),
            label: '错题',
          ),
          NavigationDestination(
            icon: Icon(Icons.workspace_premium_outlined),
            selectedIcon: Icon(Icons.workspace_premium),
            label: '会员',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
