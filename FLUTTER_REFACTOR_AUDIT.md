# Flutter 刷题 App 重构问题清单

更新时间：2026-06-26

## 1. 当前结构扫描

已扫描目录：

- `flutter_app/lib/main.dart`
- `flutter_app/lib/app`
- `flutter_app/lib/core`
- `flutter_app/lib/features/home`
- `flutter_app/lib/features/practice`
- `flutter_app/lib/features/wrong`
- `flutter_app/lib/features/member`
- `flutter_app/lib/features/mine`
- `flutter_app/lib/features/questions`
- `flutter_app/lib/features/learning`
- `flutter_app/lib/features/auth`

当前 Flutter 版没有 `lib/routes` 或 `app_router` 目录，路由与页面跳转之前主要散落在页面内部。

## 2. 跳转与路由问题

### 已发现的问题

- 首页 `立即开始刷题`、`去打卡`、`顺序练习`、`随机练习`、`模拟考试` 之前都直接在页面内构造 `PracticePage`，缺少统一路由层。
- `模拟考试` 之前只是复用普通刷题入口，标题和题量语义不明确。
- `错题强化` 之前直接 `Navigator.push` 到 `WrongPage`，没有统一路径管理。
- `WrongPage` 内点击错题复习之前直接创建 `PracticePage`，路由散落。
- `当前题库 / 切换专业` 之前交互语义不清晰，容易直接进入刷题而不是切换题库。
- 底部导航是 `IndexedStack`，页面可切换，但没有统一 tab 枚举或路由语义。

### 第一阶段已处理

- 新增 `flutter_app/lib/app/app_routes.dart`，集中管理 App 路由常量、tab 枚举和常用跳转方法。
- 首页所有练习入口改为通过 `AppNavigator.pushPractice` 进入。
- 错题页进入刷题复习改为通过 `AppNavigator.pushPractice` 进入。
- `切换专业` 改为弹出题库选择面板，并保存用户选择。
- 底部 `刷题` 页读取已选择题库，避免和首页选择不一致。

## 3. 页面接入问题

### 已接入页面

- 首页：`HomePage`
- 刷题页：`PracticePage`
- 错题强化：`WrongPage`
- 会员权益：`MemberPage`
- 我的：`MinePage`

### 页面空壳或半成品

- `MemberPage` 当前是会员权益展示骨架，Apple IAP 未接入。
- `MinePage` 当前是本机账号登录，真实 Apple 登录/服务端账号体系未接入。
- `PracticePage` 已具备刷题、解析、题目导航、错题状态，但视觉还需第二阶段系统重构。
- `WrongPage` 已具备错题状态和复习入口，但会员转化、记忆曲线分组还需第三阶段增强。

## 4. 和小程序/目标体验不一致的问题

- 首页信息层级之前偏“简单卡片堆叠”，缺少成熟 App 的学习目标、进度、数据、会员引导结构。
- 刷题页目前仍偏基础实现，底部操作、判断题/多选题体验、解析会员转化位需要重构。
- 错题强化页还没有完整展示“今日待复习、1天后、3天后、7天后、已掌握”的记忆曲线分组。
- 会员页未接入 iOS 内购，只是 UI 骨架。
- 我的页协议/隐私/客服等条目目前没有独立详情页承接。

## 5. UI 组件重复与混乱

### 已发现

- 卡片圆角、阴影、padding 在多个页面重复定义。
- 统计卡在首页和我的页重复。
- 功能入口卡片只在首页内部实现，无法复用。
- 进度条卡片没有公共组件。
- 主按钮样式依赖全局 theme 和局部 `FilledButton` 混写。

### 第一阶段已处理

新增 Design System：

- `flutter_app/lib/design_system/app_colors.dart`
- `flutter_app/lib/design_system/app_text_styles.dart`
- `flutter_app/lib/design_system/app_spacing.dart`
- `flutter_app/lib/design_system/app_theme.dart`
- `flutter_app/lib/design_system/app_card.dart`
- `flutter_app/lib/design_system/primary_button.dart`
- `flutter_app/lib/design_system/feature_grid_item.dart`
- `flutter_app/lib/design_system/stat_card.dart`
- `flutter_app/lib/design_system/progress_card.dart`

首页已优先使用上述组件。

## 6. 后续阶段待办

### 第二阶段：刷题页

- 已完成：顶部显示当前专业、等级、题号进度。
- 已完成：题干卡片与选项卡片统一视觉。
- 已完成：判断题改为两个大按钮。
- 已完成：多选题增加明确提交区域。
- 已完成：底部统一为：上一题、收藏、解析、下一题。
- 已完成：解析入口加入会员转化位置。
- 待完善：收藏当前仅为页面内临时状态，后续应接入本地/服务端收藏数据。
- 已完成：收藏已接入本地持久化，重进刷题页后仍能保留收藏状态。
- 待完善：解析权益后续应接入会员状态，免费次数和会员弹窗需和 Apple IAP 联动。

### 第三阶段：错题强化与会员转化

- 已完成：错题页增加复习计划概览。
- 已完成：按记忆曲线分组：今日待复习、1天后、3天后、7天后、已掌握。
- 已完成：免费用户展示少量预览，会员用户可展示完整错题强化。
- 已完成：新增会员权益状态抽象，供 Apple IAP 验证成功后写入权益。
- 已完成：会员页强化错题强化、解析、遗忘提醒、考前冲刺等价值表达。
- 待完善：会员页接入 Apple IAP 的商品、购买、恢复购买和服务端验证。
- 待完善：会员权益状态需要由 Apple 服务端校验结果写入，当前没有真实支付闭环。

### 我的页与基础承接

- 已完成：我的页改为统一 Design System 卡片风格。
- 已完成：使用说明、隐私政策、用户协议、关于我们均有占位详情页承接，不再无响应。
- 已完成：联系客服 QQ 有明确反馈。
- 待完善：上线前需要替换为正式协议、隐私政策和关于我们正文。
# 2026-06-26 自查修复记录

- 已修复：从二级页面触发会员/我的等入口时，先回到根页面再切换底部 tab，避免底层 tab 已切换但当前 push 页面仍覆盖在上方。
- 已修复：题库切换后刷新底部“刷题”页实例，避免 `IndexedStack` 缓存旧题库导致切换后刷题仍使用旧数据。
- 已新增：widget 测试覆盖 App 启动、底部导航主要 tab 切换，防止基础点击跳转再次回退。
