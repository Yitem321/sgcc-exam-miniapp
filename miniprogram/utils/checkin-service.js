const DEFAULT_TARGET = 20;

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function todayKey() {
  return dateKey(new Date());
}

function nextDayStart(timestamp) {
  const date = new Date(timestamp || Date.now());
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

function getGoal() {
  const goal = wx.getStorageSync("dailyCheckinGoal") || {};
  const target = Number(goal.target || DEFAULT_TARGET);
  const updatedAt = Number(goal.updatedAt || 0);
  const nextEditableAt = updatedAt ? nextDayStart(updatedAt) : 0;
  return {
    target,
    updatedAt,
    nextEditableAt,
    canEdit: !updatedAt || Date.now() >= nextEditableAt
  };
}

function setGoal(target) {
  const goal = getGoal();
  if (!goal.canEdit) {
    return {
      success: false,
      message: "今日目标已锁定，明天可修改"
    };
  }
  const cleanTarget = Math.max(1, Math.min(999, Number(target || DEFAULT_TARGET)));
  wx.setStorageSync("dailyCheckinGoal", {
    target: cleanTarget,
    updatedAt: Date.now()
  });
  return { success: true, goal: getGoal() };
}

function answeredCountOn(date) {
  const key = dateKey(date);
  const records = wx.getStorageSync("records") || {};
  return Object.keys(records).filter((id) => {
    const answeredAt = records[id] && records[id].answeredAt;
    return answeredAt && dateKey(new Date(answeredAt)) === key;
  }).length;
}

function getCheckinDates() {
  return wx.getStorageSync("checkinDates") || [];
}

function isCheckedIn(key) {
  return getCheckinDates().indexOf(key) !== -1;
}

function checkInToday() {
  const goal = getGoal();
  const key = todayKey();
  const done = answeredCountOn(new Date());
  if (isCheckedIn(key)) {
    return { success: true, already: true, message: "今日已打卡" };
  }
  if (done < goal.target) {
    return {
      success: false,
      message: "今日目标未完成",
      done,
      target: goal.target
    };
  }
  const dates = getCheckinDates();
  dates.push(key);
  wx.setStorageSync("checkinDates", Array.from(new Set(dates)));
  return { success: true, message: "打卡成功" };
}

function streakDays() {
  const dates = new Set(getCheckinDates());
  let count = 0;
  const cursor = new Date();
  while (dates.has(dateKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function monthCalendar(year, month) {
  const checked = new Set(getCheckinDates());
  const today = todayKey();
  const first = new Date(year, month - 1, 1);
  const total = new Date(year, month, 0).getDate();
  const prefix = first.getDay();
  const days = [];
  for (let i = 0; i < prefix; i += 1) {
    days.push({ day: "", key: "", checked: false, today: false, empty: true });
  }
  for (let day = 1; day <= total; day += 1) {
    const key = dateKey(new Date(year, month - 1, day));
    days.push({
      day,
      key,
      checked: checked.has(key),
      today: key === today,
      empty: false
    });
  }
  return days;
}

function summary() {
  const goal = getGoal();
  const todayDone = answeredCountOn(new Date());
  const key = todayKey();
  return {
    goal,
    todayDone,
    todayKey: key,
    checkedToday: isCheckedIn(key),
    canCheckIn: todayDone >= goal.target && !isCheckedIn(key),
    streakDays: streakDays(),
    totalCheckins: getCheckinDates().length
  };
}

module.exports = {
  DEFAULT_TARGET,
  answeredCountOn,
  checkInToday,
  getGoal,
  monthCalendar,
  setGoal,
  summary,
  todayKey
};
