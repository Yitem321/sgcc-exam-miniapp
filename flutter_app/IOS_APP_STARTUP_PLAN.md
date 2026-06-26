# iOS App Startup Plan

## 1. 账号与证书

你正在注册 Apple Developer Program。账号完成后需要准备：

- Apple Team ID
- App Store Connect 访问权限
- Bundle ID，例如 `com.synexa.sgccExam`
- App 图标 1024x1024
- 隐私政策 URL
- 技术支持 URL

## 2. Flutter 工程启动

本目录已经放入 Flutter 业务代码。安装 Flutter SDK 后执行：

```powershell
cd E:\BaiduSyncdisk\AI\sgcc-exam-miniapp\flutter_app
flutter create .
flutter pub get
flutter run
```

建议第一阶段先跑 Android/Windows 模拟，等 UI 和接口稳定后再切到 iOS 真机与 TestFlight。

## 3. 复用现有后端

当前 App 已按以下接口设计：

- `GET /api/catalog`
- `GET /api/questions`
- `POST /api/questions/by-ids`
- `POST /api/explain`
- `GET /api/users/me/ai-analysis-membership`

后续需要新增 Apple IAP 相关接口：

- `POST /api/iap/apple/verify`
- `GET /api/users/me/membership`
- `POST /api/users/me/study-records`

## 4. Apple IAP 设计

iOS 上会员、解析、错题强化属于数字权益，不能使用微信支付或支付宝绕过 Apple IAP。

第一版建议使用非续期订阅：

| 套餐 | App 内展示 | 后端天数 |
| --- | --- | --- |
| 7天 VIP | 题目解析 + 错题强化 | 7 |
| 1个月 VIP | 阶段复习和错题巩固 | 30 |
| 3个月 VIP | 长期备考和考前冲刺 | 90 |
| 12个月 VIP | 全年系统巩固 | 365 |

App Store Connect 中价格需要选择 Apple 价格档位，可能无法完全等于小程序里的 3.5 / 8 / 20 / 68。

## 5. 审核注意

- 不使用“国家电网官方”等易混淆表达。
- 不承诺包过、押题必中。
- 会员权益描述保持为辅助学习。
- 提供审核账号或免登录体验路径。
- 隐私政策说明学习记录、错题记录、购买记录和解析服务。

## 6. 第一版 MVP

优先级从高到低：

1. 首页和题库目录
2. 顺序练习
3. 题目解析
4. 错题本与错题强化
5. 我的与登录
6. Apple IAP 购买与服务端验证
7. TestFlight 测试
