import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sgcc_exam_app/app/app_routes.dart';
import 'package:sgcc_exam_app/app/app.dart';
import 'package:sgcc_exam_app/features/questions/question_models.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> settleRoute(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> bringIntoView(WidgetTester tester, Finder finder) async {
    await settleRoute(tester);
    if (finder.evaluate().isEmpty) {
      await tester.scrollUntilVisible(
        finder,
        260,
        scrollable: find.byType(Scrollable).first,
        maxScrolls: 12,
      );
    } else {
      await tester.ensureVisible(finder);
    }
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('App boots with primary navigation', (tester) async {
    await tester.pumpWidget(const SgccExamApp());

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('首页'), findsWidgets);
    expect(find.text('刷题'), findsWidgets);
    expect(find.text('错题'), findsWidgets);
    expect(find.text('会员'), findsWidgets);
    expect(find.text('我的'), findsWidgets);
  });

  testWidgets('Bottom navigation switches major sections', (tester) async {
    await tester.pumpWidget(const SgccExamApp());

    await tester.tap(find.byIcon(Icons.workspace_premium_outlined));
    await tester.pump();
    expect(find.text('会员权益'), findsWidgets);

    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pump();
    expect(find.text('我的'), findsWidgets);

    await tester.tap(find.byIcon(Icons.edit_note_outlined));
    await tester.pump();
    expect(find.text('顺序练习'), findsWidgets);
  });

  testWidgets('Home practice entries navigate to concrete pages',
      (tester) async {
    Future<void> verifyEntry(Finder entry, String expectedTitle) async {
      await tester.pumpWidget(
        KeyedSubtree(key: UniqueKey(), child: const SgccExamApp()),
      );
      await bringIntoView(tester, entry);
      await tester.tap(entry);
      await settleRoute(tester);
      expect(find.text(expectedTitle), findsWidgets);
    }

    await verifyEntry(find.text('立即开始刷题'), '顺序练习');
    await verifyEntry(find.text('去打卡'), '顺序练习');
    await verifyEntry(find.text('随机练习'), '随机练习');
    await verifyEntry(find.text('模拟考试'), '模拟考试');
    await verifyEntry(find.text('错题强化'), '错题强化');
  });

  testWidgets('Placeholder route always gives visible feedback',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () {
                    AppNavigator.pushPlaceholder(
                      context,
                      title: '测试功能',
                      description: '用于确认暂未开发入口不会无响应。',
                    );
                  },
                  child: const Text('打开占位页'),
                ),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('打开占位页'));
    await tester.pumpAndSettle();

    expect(find.text('测试功能'), findsOneWidget);
    expect(find.text('功能开发中'), findsOneWidget);
  });

  test('Question type helpers preserve existing data logic', () {
    const single = Question(
      id: '1',
      major: '变电二次安装工',
      level: '初级工',
      type: '单选题',
      question: '题干',
      options: {'A': '选项'},
      answer: 'A',
    );
    const multiple = Question(
      id: '2',
      major: '变电二次安装工',
      level: '初级工',
      type: '多选题',
      question: '题干',
      options: {'A': '选项', 'B': '选项'},
      answer: 'AB',
    );
    const judge = Question(
      id: '3',
      major: '变电二次安装工',
      level: '初级工',
      type: '判断题',
      question: '题干',
      options: {'A': '正确', 'B': '错误'},
      answer: 'A',
    );

    expect(single.isMultiple, isFalse);
    expect(single.isJudge, isFalse);
    expect(multiple.isMultiple, isTrue);
    expect(multiple.isJudge, isFalse);
    expect(judge.isMultiple, isFalse);
    expect(judge.isJudge, isTrue);
  });
}
