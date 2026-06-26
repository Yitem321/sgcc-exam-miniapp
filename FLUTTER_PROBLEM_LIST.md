# Flutter 刷题 App 问题清单与验收映射

更新日期：2026-06-26

## 1. 扫描范围

已检查当前 Flutter 项目核心目录：

- `flutter_app/lib/main.dart`
- `flutter_app/lib/app/app.dart`
- `flutter_app/lib/app/app_routes.dart`
- `flutter_app/lib/core`
- `flutter_app/lib/design_system`
- `flutter_app/lib/features/home`
- `flutter_app/lib/features/practice`
- `flutter_app/lib/features/wrong`
- `flutter_app/lib/features/member`
- `flutter_app/lib/features/mine`
- `flutter_app/lib/features/questions`
- `flutter_app/lib/features/learning`

## 2. 按钮与入口状态

### 已接入并有明确承接

- `立即开始刷题` -> `AppNavigator.pushPractice` -> `PracticePage`
- `去打卡` -> `AppNavigator.pushPractice` -> `PracticePage`
- `顺序练习` -> `AppNavigator.pushPractice` -> `PracticePage`
- `随机练习` -> `AppNavigator.pushPractice(random: true)` -> `PracticePage`
- `模拟考试` -> `AppNavigator.pushPractice(random: true, limit: 20)` -> `PracticePage`
- `错题强化` -> `AppNavigator.pushWrong` -> `WrongPage`
- `当前题库` -> `AppNavigator.pushBankDetail` -> `BankDetailPage`
- `切换专业` -> 首页题库选择 Bottom Sheet
- `今日打卡` -> 动态显示今日已刷题数和每日目标，点击可调整目标
- `查看会员权益` -> 底部 Tab 切换到 `MemberPage`
- 底部导航：首页、刷题、错题、会员、我的 -> `IndexedStack` 五个页面
- 桌面调试 -> 内容限制为手机宽度，避免 Windows 窗口被拉宽后变成网页式横屏布局
- 当前题库卡 -> 题库信息行进入详情，`切换专业` 胶囊按钮只打开题库选择，避免嵌套点击误触

### 暂未发现的死入口

当前扫描未发现明显的 `onTap: null` 或 `onPressed: null` 死入口。部分按钮会根据业务状态禁用，例如多选题未选择时不能提交，这是符合预期的状态控制。

## 3. 路由注册状态

统一路由集中在 `flutter_app/lib/app/app_routes.dart`：

- `/`
- `/practice`
- `/wrong`
- `/member`
- `/mine`
- `/bank-detail`
- `/placeholder`

常用跳转统一通过 `AppNavigator`：

- `pushPractice`
- `pushWrong`
- `pushBankDetail`
- `pushPlaceholder`

## 4. 页面接入状态

### 已接入页面

- `HomePage`：首页、学习卡、动态今日打卡、练习入口、题库卡、学习数据、会员引导
- `LearningStateStore`：学习记录、错题状态、每日目标、今日进度统计
- `PracticePage`：刷题、答题、题目导航、解析入口、收藏
- `WrongPage`：错题强化、记忆曲线分组、会员预览/解锁逻辑
- `MemberPage`：会员权益、套餐 UI、Apple IAP 预留
- `MinePage`：登录占位、学习数据、应用信息、客服入口
- `BankDetailPage`：当前题库详情、开始刷题、切换题库
- `FeaturePlaceholderPage`：暂未完成的协议/说明类详情承接页
- `_DesktopPhonePreview`：桌面端调试专用的手机宽度容器，移动端不生效

## 5. 空壳或半成品页面

- `FeaturePlaceholderPage` 是有意保留的占位页，用于保证暂未开发内容不无响应。
- `MemberPage` 的 Apple IAP 仍是 UI 骨架，真实内购未接入。
- `MinePage` 登录仍是本地占位账号，真实 Apple 登录/服务端账号同步未接入。
- 使用说明、隐私政策、用户协议、关于我们仍需正式文案。

## 6. 与小程序版或商业化目标仍不一致的点

- 小程序支付已暂停，App 版需要改走 Apple IAP。
- 会员状态目前本地存储，正式上线需要服务端校验和跨设备同步。
- 题目解析权限、免费次数、会员权益仍需与真实账户/内购闭环联动。
- 今日打卡已接入本地学习记录，但跨设备学习目标同步需要等真实账号体系完成后再接入服务端。
- 目前主要在 Windows Debug 形态验证，iOS/Android 真机视觉 QA 尚未完成。

## 7. UI 组件整理状态

已建立并复用 Design System：

- `app_theme.dart`
- `app_colors.dart`
- `app_text_styles.dart`
- `app_spacing.dart`
- `app_card.dart`
- `primary_button.dart`
- `feature_grid_item.dart`
- `stat_card.dart`
- `progress_card.dart`

后续建议继续把页面内局部组件抽为可复用模块，尤其是：

- 题目选项组件
- 题目导航 Sheet
- 会员权益套餐卡
- 错题状态标签
- 协议/说明类详情页模板

## 8. 当前验证状态

已通过：

```powershell
dart analyze flutter_app
```

完整 Flutter 命令暂受本机 SDK cache 权限影响，待 `C:\Users\39624\develop\flutter\bin\cache` 写权限恢复后执行：

```powershell
flutter analyze
flutter test
flutter build windows --debug
```
