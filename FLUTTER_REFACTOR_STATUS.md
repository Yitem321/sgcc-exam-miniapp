# Flutter 刷题 App 重构状态清单

更新日期：2026-06-26

## 当前结论

Flutter 版已完成三阶段主体重构：统一路由、首页改造、刷题页重构、错题强化与会员转化骨架。当前版本已经可以运行 Windows Debug 包，并通过 `flutter analyze`、`flutter test`、`flutter build windows --debug`。

## 已完成

- 路由集中到 `flutter_app/lib/app/app_routes.dart`，首页和错题页的练习入口统一通过 `AppNavigator` 跳转。
- 底部导航五个 Tab 已接入：首页、刷题、错题、会员、我的。
- 首页入口已接入：立即开始刷题、去打卡、顺序练习、随机练习、模拟考试、错题强化、当前题库详情、切换专业。
- 当前题库卡片点击进入题库详情页，详情页可查看题库量、等级列表，并继续开始刷题或切换专业/等级。
- 当前题库详情页不再跨页面直接操作首页，而是返回 `BankDetailAction`，由首页统一处理继续刷题或打开题库选择，降低路由和弹窗状态冲突。
- 题库选择会保存专业与等级，并触发刷题页刷新，避免旧题库缓存。
- 已建立 Design System：颜色、字号、间距、卡片、主按钮、功能入口、统计卡、进度卡。
- 刷题页已支持题干、选项卡片、单选/判断自动提交、多选提交、答题反馈、收藏、解析入口、题目导航。
- 错题强化已接入记忆曲线概念：今日待复习、1天后、3天后、7天后、已掌握。
- 会员页已完成权益展示、套餐 UI 和 Apple IAP 预留入口。
- 我的页已接入登录占位、学习资产、协议/说明/关于我们占位页、客服 QQ。

## 当前问题清单

- 会员购买仍是 Apple IAP 预留骨架，尚未接入真实商品、购买、恢复购买和服务端票据验证。
- 登录仍是本地账号占位，尚未接入 Apple 登录或正式后端账号体系。
- 使用说明、隐私政策、用户协议、关于我们目前是占位页，上线前需要替换为正式内容。
- 自动化测试已覆盖关键导航和题型逻辑，但尚未覆盖真实 API 返回数据下的完整刷题链路。
- Windows 端用于调试已经限定手机尺寸体验，iOS/Android 真机仍需要后续视觉 QA。

## 验收覆盖

- `flutter analyze`：静态检查，无严重错误。
- `flutter test`：覆盖 App 启动、底部导航、首页主要入口、占位页反馈、题型识别。
- `flutter build windows --debug`：Windows Debug 包可构建。

## 当前验证注意

本轮继续开发时，当前命令执行用户为 `yitem321\codexsandboxoffline`，Flutter SDK 缓存目录 `C:\Users\39624\develop\flutter\bin\cache` 对该用户组只有读取权限，导致 `flutter` 工具无法写入 `lockfile`。项目代码已用 Dart formatter 格式化，并通过 `dart analyze flutter_app`；等 Flutter cache 写权限恢复后，需要重新执行完整三连：

```powershell
$env:Path = $env:Path + ';' + "$env:USERPROFILE\develop\flutter\bin"
flutter analyze
flutter test
flutter build windows --debug
```

## 后续建议

1. 接 Apple IAP：商品配置、购买、恢复购买、服务端校验、会员状态同步。
2. 接真实登录：Apple 登录或手机号以外的合规账号体系，确保学习记录跨设备同步。
3. 完成正式协议文档：隐私政策、用户协议、会员服务协议、关于我们。
4. 增加端到端测试：用 mock API 验证题库切换、刷题、答题、错题强化闭环。
5. 做 iOS/Android 真机视觉验收：安全区、底部导航、弹窗、横向溢出、弱网状态。
