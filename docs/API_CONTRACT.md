# API Contract

The `server/` app is the shared backend for both `miniprogram/` and `flutter_app/`.

Default production base URL:

```text
https://api.synexa.cc
```

## Response Envelope

Successful responses generally include:

```json
{
  "success": true
}
```

Failed responses generally include:

```json
{
  "success": false,
  "message": "Human readable error"
}
```

Clients should treat HTTP non-2xx responses or `success === false` as request failures.

## Question Data Shape

Question items are expected to keep the existing JSON structure:

```json
{
  "id": "string",
  "major": "string",
  "level": "string",
  "question_type": "string",
  "question": "string",
  "options": {
    "A": "string",
    "B": "string"
  },
  "answer": "string"
}
```

Do not rename `question_type` without backward-compatible adapters in both clients.

## Shared Public APIs

### `GET /health`

Health check for deployment and monitoring.

Expected fields:

- `success`
- `service`
- `questionTotal`

### `GET /api/catalog`

Returns the question bank catalog.

Expected response:

```json
{
  "success": true,
  "catalog": {
    "total": 0,
    "majors": [
      {
        "name": "string",
        "total": 0,
        "levels": [
          {
            "name": "string",
            "total": 0
          }
        ]
      }
    ]
  }
}
```

Used by:

- WeChat Mini Program
- Flutter App

### `GET /api/stats`

Returns question statistics for optional `major` and `level`.

Query parameters:

- `major`
- `level`

Used by:

- WeChat Mini Program

### `GET /api/questions`

Returns a list of questions.

Query parameters:

- `major`
- `level`
- `type`
- `random`
- `limit`

Expected response:

```json
{
  "success": true,
  "questions": []
}
```

Used by:

- WeChat Mini Program
- Flutter App

### `POST /api/questions/by-ids`

Returns question items by id.

Request body:

```json
{
  "ids": ["question-id"]
}
```

Used by:

- WeChat Mini Program
- Flutter App

### `GET /api/questions/:id`

Returns one question by id.

Used by:

- Server-compatible clients or tools

### `POST /api/explain`

Requests an AI explanation for a question.

Request body:

```json
{
  "id": "string",
  "question": "string",
  "options": {},
  "answer": "string",
  "questionType": "string",
  "major": "string",
  "level": "string"
}
```

Expected response:

```json
{
  "success": true,
  "provider": "deepseek",
  "cached": false,
  "explanation": "string"
}
```

Used by:

- WeChat Mini Program
- Flutter App

### `POST /api/auth/wechat-login`

WeChat login endpoint.

Request body:

```json
{
  "code": "wx.login code"
}
```

Used by:

- WeChat Mini Program

Flutter should not call this endpoint unless a dedicated WeChat login flow is implemented for Flutter.

### `POST /api/users/me/study-records`

Synchronizes local study records.

Used by:

- WeChat Mini Program

### `GET /api/users/me/ai-analysis-membership`

Returns AI analysis membership or entitlement status.

Used by:

- Membership-capable clients

### Payment APIs

Current payment endpoints are backend-owned and should remain backward compatible:

- `POST /api/pay/wechat/notify`
- `GET /api/pay/wechat/status`
- `POST /api/pay/ai-analysis/order`
- `POST /api/pay/ai-analysis/order/confirm`
- `POST /api/pay/ai-analysis-7d/order`

WeChat payment configuration and certificates must never be committed.

### Operational and Debug APIs

The following endpoints should be restricted or reviewed before public production exposure:

- `GET /api/admin/business/overview`
- `GET /api/debug/env`
- `POST /api/ai/test/deepseek`
- `POST /api/ai/test/openai`
- `POST /api/ai/test/cache`
- `GET /api/explain/cache/stats`
- `POST /api/explain/cache/clear`
- `GET /api/ai/status`

Protected operations require an admin token via `x-admin-token` header or `?token=` query parameter:

- `GET /api/admin/business/overview`
- `GET /api/debug/env`
- `POST /api/ai/test/deepseek`
- `POST /api/ai/test/openai`
- `POST /api/ai/test/cache`
- `POST /api/explain/cache/clear`

`GET /api/ai/status` remains public because it only returns coarse runtime status and is used by deployment health checks.

## Client Compatibility Notes

- Both clients currently use `question_type` from server data.
- Both clients call `/api/explain` with `questionType`.
- The WeChat Mini Program has local fallback question data.
- The Flutter App currently depends more directly on remote API availability.
