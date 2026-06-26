import '../../core/local_store.dart';

enum QuestionMasteryStatus {
  unattempted,
  recentWrong,
  needReinforce,
  mastered,
}

class QuestionLearningState {
  QuestionLearningState({
    required this.questionId,
    this.wrongCount = 0,
    this.rightCount = 0,
    this.consecutiveCorrect = 0,
    this.consecutiveWrong = 0,
    this.lastReviewTime = 0,
    this.nextReviewTime = 0,
    this.masteryScore = 0,
    this.lastCorrect,
  });

  final String questionId;
  int wrongCount;
  int rightCount;
  int consecutiveCorrect;
  int consecutiveWrong;
  int lastReviewTime;
  int nextReviewTime;
  int masteryScore;
  bool? lastCorrect;

  factory QuestionLearningState.fromJson(Map<String, dynamic> json) {
    return QuestionLearningState(
      questionId: json['questionId']?.toString() ?? '',
      wrongCount: json['wrongCount'] as int? ?? 0,
      rightCount: json['rightCount'] as int? ?? 0,
      consecutiveCorrect: json['consecutiveCorrect'] as int? ?? 0,
      consecutiveWrong: json['consecutiveWrong'] as int? ?? 0,
      lastReviewTime: json['lastReviewTime'] as int? ?? 0,
      nextReviewTime: json['nextReviewTime'] as int? ?? 0,
      masteryScore: json['masteryScore'] as int? ?? 0,
      lastCorrect: json['lastCorrect'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
        'questionId': questionId,
        'wrongCount': wrongCount,
        'rightCount': rightCount,
        'consecutiveCorrect': consecutiveCorrect,
        'consecutiveWrong': consecutiveWrong,
        'lastReviewTime': lastReviewTime,
        'nextReviewTime': nextReviewTime,
        'masteryScore': masteryScore,
        'lastCorrect': lastCorrect,
      };

  QuestionMasteryStatus get status {
    if (wrongCount == 0 && rightCount == 0) {
      return QuestionMasteryStatus.unattempted;
    }
    if (lastCorrect == false || consecutiveWrong > 0) {
      return QuestionMasteryStatus.recentWrong;
    }
    if (consecutiveCorrect >= 2 && masteryScore >= 70) {
      return QuestionMasteryStatus.mastered;
    }
    if (wrongCount > 0 && lastCorrect == true) {
      return QuestionMasteryStatus.needReinforce;
    }
    return QuestionMasteryStatus.unattempted;
  }

  bool shouldStayInWrongBook(int now) {
    if (wrongCount <= 0) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return !(consecutiveCorrect >= 3 && now - lastReviewTime > sevenDays);
  }
}

class LearningStateStore {
  LearningStateStore({LocalStore? store}) : _store = store ?? LocalStore();

  static const _key = 'question_learning_states_v1';
  static const _dailyGoalKey = 'daily_practice_goal_v1';
  static const _defaultDailyGoal = 20;
  final LocalStore _store;

  Future<Map<String, QuestionLearningState>> loadStates() async {
    final raw = await _store.getJson<Map<String, dynamic>>(_key) ?? {};
    return raw.map(
      (key, value) => MapEntry(
        key,
        QuestionLearningState.fromJson(value as Map<String, dynamic>),
      ),
    );
  }

  Future<QuestionLearningState> getState(String questionId) async {
    final states = await loadStates();
    return states[questionId] ?? QuestionLearningState(questionId: questionId);
  }

  Future<QuestionLearningState> recordAnswer({
    required String questionId,
    required bool correct,
  }) async {
    final states = await loadStates();
    final state =
        states[questionId] ?? QuestionLearningState(questionId: questionId);
    final currentTime = DateTime.now().millisecondsSinceEpoch;
    state.lastReviewTime = currentTime;
    state.lastCorrect = correct;
    if (correct) {
      state.rightCount += 1;
      state.consecutiveCorrect += 1;
      state.consecutiveWrong = 0;
    } else {
      state.wrongCount += 1;
      state.consecutiveWrong += 1;
      state.consecutiveCorrect = 0;
    }
    state.masteryScore = _calculateMasteryScore(state);
    state.nextReviewTime = currentTime + _nextIntervalMs(state);
    states[questionId] = state;
    await _save(states);
    return state;
  }

  Future<List<String>> wrongBookIds() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final states = await loadStates();
    return states.values
        .where((state) => state.shouldStayInWrongBook(now))
        .map((state) => state.questionId)
        .toList();
  }

  Future<LearningSummary> summary() async {
    final states = await loadStates();
    final now = DateTime.now().millisecondsSinceEpoch;
    final attempted =
        states.values.where((state) => state.rightCount + state.wrongCount > 0);
    final wrong =
        states.values.where((state) => state.shouldStayInWrongBook(now)).length;
    final mastered = states.values
        .where((state) => state.status == QuestionMasteryStatus.mastered)
        .length;
    final due = states.values
        .where(
            (state) => state.nextReviewTime > 0 && state.nextReviewTime <= now)
        .length;
    return LearningSummary(
      attemptedCount: attempted.length,
      wrongCount: wrong,
      masteredCount: mastered,
      dueReviewCount: due,
    );
  }

  Future<int> dailyGoal() async {
    final raw = await _store.getString(_dailyGoalKey);
    final parsed = int.tryParse(raw ?? '');
    if (parsed == null || parsed <= 0) return _defaultDailyGoal;
    return parsed;
  }

  Future<void> setDailyGoal(int goal) async {
    if (goal <= 0) return;
    await _store.setString(_dailyGoalKey, '$goal');
  }

  Future<DailyProgress> todayProgress() async {
    final states = await loadStates();
    final goal = await dailyGoal();
    final todayCount =
        states.values.where((state) => _isToday(state.lastReviewTime)).length;
    return DailyProgress(
      completedCount: todayCount,
      goalCount: goal,
    );
  }

  Future<void> _save(Map<String, QuestionLearningState> states) {
    return _store.setJson(
      _key,
      states.map((key, value) => MapEntry(key, value.toJson())),
    );
  }

  int _calculateMasteryScore(QuestionLearningState state) {
    var score = 20 + state.rightCount * 12 + state.consecutiveCorrect * 18;
    score -= state.wrongCount * 10 + state.consecutiveWrong * 18;
    return score.clamp(0, 100);
  }

  int _nextIntervalMs(QuestionLearningState state) {
    const day = 24 * 60 * 60 * 1000;
    if (state.lastCorrect == false) return day;
    if (state.consecutiveCorrect <= 1) return 2 * day;
    if (state.consecutiveCorrect == 2) return 4 * day;
    if (state.consecutiveCorrect == 3) return 7 * day;
    return 15 * day;
  }

  bool _isToday(int timestamp) {
    if (timestamp <= 0) return false;
    final now = DateTime.now();
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return now.year == date.year &&
        now.month == date.month &&
        now.day == date.day;
  }
}

class LearningSummary {
  const LearningSummary({
    required this.attemptedCount,
    required this.wrongCount,
    required this.masteredCount,
    required this.dueReviewCount,
  });

  final int attemptedCount;
  final int wrongCount;
  final int masteredCount;
  final int dueReviewCount;
}

class DailyProgress {
  const DailyProgress({
    required this.completedCount,
    required this.goalCount,
  });

  final int completedCount;
  final int goalCount;

  double get progress {
    if (goalCount <= 0) return 0;
    return (completedCount / goalCount).clamp(0, 1);
  }

  bool get completed => completedCount >= goalCount;
}
