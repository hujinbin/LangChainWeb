# 开放 API 使用指南

开放 API 允许第三方服务以站点账号的身份读取工作流、触发运行、查询执行记录与积分。所有调用都走服务端，**不要把 clientSecret 放进浏览器**。

## 1. 创建密钥

在本站[代理商后台](/partner/#keys)的「API 密钥」页填写名称、权限范围、到期时间、IP 白名单、每分钟请求数与并发上限。创建成功后：

- `clientId`：公开标识，可出现在日志中。
- `clientSecret`：只显示一次，请立即保存到服务端环境变量或密钥管理系统。

权限范围：

| Scope | 说明 |
| --- | --- |
| `workflow:read` | 读取工作流列表与详情 |
| `workflow:run` | 触发工作流运行 |
| `execution:read` | 查询执行记录 |
| `credits:read` | 查询积分账户与计费规则 |
| `model:read` | 读取可用模型目录 |

## 2. 换取 Token

`POST /api/open/v1/token`

```json
{
  "grantType": "client_credentials",
  "clientId": "jue_xxxxxxxxxxxxxxxxxxxx",
  "clientSecret": "创建时返回的明文 Secret"
}
```

响应：

```json
{
  "code": 200,
  "data": {
    "access_token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "expires_in": 7200,
    "scope": "workflow:read workflow:run execution:read credits:read",
    "client_id": "jue_xxxxxxxxxxxxxxxxxxxx"
  }
}
```

Token 最长有效期为 2 小时，密钥较早到期时随密钥到期。轮换 Secret 后需要重新换取 Token。`clientSecret` 校验使用常量时间比较，服务端只保存 SHA-256 摘要。

## 3. 调用接口

统一请求头：

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

| 方法 | 路径 | Scope | 说明 |
| --- | --- | --- | --- |
| GET | `/api/open/v1/models` | `model:read` | 获取文本、图片、视频与 Embedding 模型目录 |
| GET | `/api/open/v1/workflows?page=1&pageSize=20` | `workflow:read` | 分页读取工作流 |
| GET | `/api/open/v1/workflows/{id}` | `workflow:read` | 读取工作流完整定义 |
| POST | `/api/open/v1/workflows/{id}/run` | `workflow:run` | 触发运行，可同步等待结果 |
| GET | `/api/open/v1/executions/{id}` | `execution:read` | 查询执行状态、节点结果与计费 |
| GET | `/api/open/v1/credits` | `credits:read` | 查询积分账户与计费规则 |

运行工作流请求体：

```json
{
  "input": { "topic": "秋季新品发布" },
  "simulate": false
}
```

- `input`：工作流输入，最大 256KB。
- `simulate`：`true` 时只做模拟校验，不调用模型、不计费。

每次运行必须提供独立的请求号，可使用请求体 `requestId` 或请求头 `Idempotency-Key: <唯一字符串>`，24 小时内相同密钥与参数重复请求返回首次结果。相同请求正在运行或参数冲突时返回 409。

## 4. 错误码与限流

| HTTP | errorCode | 说明 |
| --- | --- | --- |
| 401 | `OPEN_API_UNAUTHORIZED` | 缺少 Bearer Token |
| 401 | `OPEN_API_TOKEN_INVALID` | Token 无效或过期 |
| 401 | `OPEN_API_INVALID_CLIENT` | clientId / clientSecret 不正确 |
| 403 | `OPEN_API_SCOPE_DENIED` | 密钥缺少所需权限 |
| 403 | `OPEN_API_IP_DENIED` | 来源 IP 未获授权 |
| 401 | `OPEN_API_KEY_EXPIRED` | 密钥已过期 |
| 409 | `OPEN_API_REQUEST_CONFLICT` | 请求号正在使用或参数冲突 |
| 429 | `OPEN_API_CONCURRENCY_LIMIT` | 达到并发上限 |
| 404 | `OPEN_API_WORKFLOW_NOT_FOUND` | 工作流不存在或不属于该账号 |
| 402 | `INSUFFICIENT_CREDITS` | 积分不足 |
| 429 | `OPEN_API_RATE_LIMITED` | 超过密钥限流 |
| 500 | `OPEN_API_FAILED` | 服务端异常，附 `requestId` |

默认限流 60 次/分钟/密钥，默认并发 5 个运行，可在后台按密钥调整。429 响应通过 `Retry-After`（秒）提示重试时间。每次调用都会写入 `open_api_audit`，保留 30 天。

## 5. 调用方示例（Node.js）

```js
const base = process.env.JUE_API_BASE; // 例如 https://langchain.example.com

async function main() {
  const tokenResponse = await fetch(`${base}/api/open/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'client_credentials',
      clientId: process.env.JUE_CLIENT_ID,
      clientSecret: process.env.JUE_CLIENT_SECRET,
    }),
  });
  const { data } = await tokenResponse.json();
  const headers = {
    Authorization: `Bearer ${data.access_token}`,
    'Content-Type': 'application/json',
  };

  const workflows = await (await fetch(`${base}/api/open/v1/workflows`, { headers })).json();
  const workflowId = workflows.data.items[0].id;

  const run = await (
    await fetch(`${base}/api/open/v1/workflows/${workflowId}/run`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': `demo-${Date.now()}` },
      body: JSON.stringify({ input: { topic: '秋季新品发布' }, simulate: false }),
    })
  ).json();
  console.log(run);
}

main().catch(console.error);
```

## 6. Python 示例

```python
import os
import requests

url = os.environ["JUE_API_BASE"] + "/api/open/v1"
response = requests.post(url + "/token", json={
    "clientId": os.environ["JUE_CLIENT_ID"],
    "clientSecret": os.environ["JUE_CLIENT_SECRET"]
}, timeout=20)
response.raise_for_status()
headers = {"Authorization": "Bearer " + response.json()["data"]["access_token"]}
models = requests.get(url + "/models", headers=headers, timeout=20)
models.raise_for_status()
print(models.json()["data"])
```

## 7. 自有后端兼容契约

前端只依赖公开 HTTP 契约，自有后端需要实现：

| 能力 | 契约 |
| --- | --- |
| 站点配置 | `GET /api/site/config` 返回 `{code:200,data:{siteId,name,logoUrl,seo,contact,registerEnabled}}`；域名未登记返回 403 + `errorCode=SITE_NOT_REGISTERED`；停用返回 `SITE_DISABLED` |
| 工作流账号 | 登录、注册、验证码、资料与改密使用 `/api/aiWorkflow/account/` 前缀 |
| 登录态 | 请求头携带 `token` 与 `Authorization`；401 时前端清理登录态 |
| 工作流 | `/api/aiWorkflow` 下与 `src/services/api.ts` 一致的模型目录、工作流 CRUD、运行、执行记录与积分接口 |
| 智能体 | `/api/aiAgents` 下的 catalog、projects、运行、取消、导出与资产读取 |
| 小说 | `/api/aiAgents/novel` 下的 catalog、projects、outline、章节生成/编辑、cancel、status、export |
| 模型目录 | `GET /api/aiWorkflow/models` 至少返回 `text`、`image`、`video`，可附带 `embedding` |
| 开放 API | `/api/open/v1/token`、models、workflows、run、executions、credits |

跨域部署时后端必须允许站点来源，并放行 `token`、`Authorization`、`X-Site-Id`、`Idempotency-Key` 请求头。

本地接入时，将 `REACT_APP_PROXY_TARGET` 指向业务接口源站，将 `REACT_APP_PARTNER_PROXY_TARGET` 指向代理商服务，然后运行 `npm start`。浏览器继续使用同源访问地址。

## 8. cURL 示例

变量：

```bash
export JUE_API_BASE="https://langchain.example.com"
export JUE_CLIENT_ID="jue_xxxxxxxxxxxxxxxxxxxx"
export JUE_CLIENT_SECRET="创建时返回的 Secret"
```

### 换取 Token

```bash
curl -s -X POST "$JUE_API_BASE/api/open/v1/token" \
  -H "Content-Type: application/json" \
  -d "{\"grantType\":\"client_credentials\",\"clientId\":\"$JUE_CLIENT_ID\",\"clientSecret\":\"$JUE_CLIENT_SECRET\"}"
```

保存返回的 `access_token`：

```bash
export JUE_TOKEN="eyJhbGciOi..."
```

### 读取工作流

```bash
curl -s "$JUE_API_BASE/api/open/v1/workflows?page=1&pageSize=20" \
  -H "Authorization: Bearer $JUE_TOKEN"
```

### 运行工作流

```bash
curl -s -X POST "$JUE_API_BASE/api/open/v1/workflows/<WORKFLOW_ID>/run" \
  -H "Authorization: Bearer $JUE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-20260101-001" \
  -d '{"input":{"topic":"秋季新品发布"},"simulate":false}'
```

### 查询执行记录

```bash
curl -s "$JUE_API_BASE/api/open/v1/executions/<EXECUTION_ID>" \
  -H "Authorization: Bearer $JUE_TOKEN"
```

### 查询积分

```bash
curl -s "$JUE_API_BASE/api/open/v1/credits" \
  -H "Authorization: Bearer $JUE_TOKEN"
```
