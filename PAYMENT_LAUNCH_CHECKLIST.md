# 微信支付上线检查清单

## 已接入链路

- 小程序选择 VIP 套餐后，请求服务端创建微信支付 JSAPI 订单。
- 服务端调用微信支付 API v3 `transactions/jsapi` 获取 `prepay_id`。
- 小程序使用 `wx.requestPayment` 拉起微信支付。
- 支付成功后，服务端通过微信支付回调验签、解密通知，并校验订单状态、金额和 openid。
- 服务端写入会员权益，到期时间按套餐天数累计。
- 小程序支付后会查询订单确认接口，刷新本地会员权益。

## 当前证书信息

- 商户号：`1114458826`
- 小程序 AppID：`wx60a4633d8d479296`
- 商户 API 证书序列号：`4CE3F6D74EFD492F5D7B05BA76C73C646C919DD5`
- 商户私钥路径：`server/certs/1114458826_20260624/apiclient_key.pem`
- 微信支付公钥路径：`server/certs/wechatpay_pub_key.pem`
- 支付回调地址：`https://api.synexa.cc/api/pay/wechat/notify`

## 必须手动补齐

在 `server/.env` 填入：

```env
WECHAT_APP_SECRET=你的小程序 AppSecret
WECHAT_PAY_API_V3_KEY=你在微信商户平台设置的 API v3 key
WECHAT_PAY_PUBLIC_KEY_ID=微信支付公钥 ID
ADMIN_TOKEN=后台查询用的随机长密码
```

说明：

- `WECHAT_APP_SECRET` 用于 `wx.login` 换取用户 OpenID，JSAPI 支付下单必须有 OpenID。
- `WECHAT_PAY_API_V3_KEY` 用于解密微信支付平台证书和支付回调资源，无法从证书文件推导出来。
- `WECHAT_PAY_PUBLIC_KEY_ID` 在微信支付公钥下载页面可见，通常以 `PUB_KEY_ID_` 开头，用于匹配回调头里的 `Wechatpay-Serial`。
- `ADMIN_TOKEN` 用于查看只读后台数据，请设置成不容易猜到的长字符串。

## 部署前验证

在服务器上执行：

```bash
cd server
node -e "require('dotenv').config({path:'.env'}); const pay=require('./wechat-pay.js'); console.log(pay.getPublicConfigStatus(), pay.isConfigured())"
```

预期：

- `missing` 为空数组
- `isConfigured()` 输出 `true`

也可以访问：

```text
GET https://api.synexa.cc/api/pay/wechat/status
```

预期：

- `configured: true`
- `config.missing: []`

## 审核前建议

- 用微信开发者工具真机预览，使用真实微信号完成一笔小额支付。
- 确认支付成功后“会员权益”状态变成已开通。
- 确认题目解析和错题强化不再提示开通。
- 确认 `data/wechatpay_orders.json` 有订单记录。
- 确认 `data/ai_analysis_memberships.json` 有对应 openid 的会员记录。
- 也可以访问 `https://api.synexa.cc/api/admin/business/overview?token=你的ADMIN_TOKEN` 查看用户、订单和会员概览。
- 小程序后台需要配置 request 合法域名：`https://api.synexa.cc`。
- 微信商户平台需要确认产品权限、商户号与小程序 AppID 绑定正常。
