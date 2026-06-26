# SGCC Exam Flutter App

这是从小程序迁移到 iOS App 的 Flutter MVP 工程。

## 当前目标

- 复用现有后端 `https://api.synexa.cc`
- 先跑通题库浏览、刷题、会员页和登录/会员接口骨架
- 后续接入 Apple In-App Purchase，iOS 端不再使用微信支付购买虚拟会员

## 本机启动

当前电脑还没有安装 Flutter SDK。安装后在本目录执行：

```powershell
flutter create .
flutter pub get
flutter run
```

如果 `flutter create .` 提示文件已存在，选择保留已有 `lib` 和 `pubspec.yaml`，让 Flutter 补齐 `ios`、`android`、`macos` 等平台目录即可。

## 目录

```text
lib/
  app/                 App 壳、主题
  core/                API Client、配置
  features/home/       首页
  features/practice/   顺序练习
  features/member/     会员权益，预留 Apple IAP
  features/mine/       我的
  features/questions/  题库模型与仓库
```

## iOS 付费路线

iOS 上会员、题目解析、错题强化属于数字权益，必须接 Apple IAP。后续需要新增服务端接口：

- `POST /api/iap/apple/verify`
- `GET /api/users/me/membership`

App 支付完成后将 Apple transaction 发给后端验证，由后端开通会员。
