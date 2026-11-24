# 开放 API 使用指南

开放 API 允许第三方服务以站点账号的身份读取工作流、触发运行、查询执行记录与积分。所有调用都走服务端，**不要把 clientSecret 放进浏览器**。

## 1. 创建密钥

在站点后台 `AI 平台 → 开放 API → 创建密钥` 填写名称、权限范围与限流。创建成功后：

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

Token 有效期 2 小时。`clientSecret` 校验使用常量时间比较，服务端只保存 SHA-256 摘要。

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

支持幂等：在运行请求中携带 `Idempotency-Key: <唯一字符串>`，10 分钟内相同密钥重复请求会返回首次结果。当前幂等缓存为单实例内存实现，多实例部署请使用共享存储。

## 4. 错误码与限流

| HTTP | errorCode | 说明 |
| --- | --- | --- |
| 401 | `OPEN_API_UNAUTHORIZED` | 缺少 Bearer Token |
| 401 | `OPEN_API_TOKEN_INVALID` | Token 无效或过期 |
| 401 | `OPEN_API_INVALID_CLIENT` | clientId / clientSecret 不正确 |
| 403 | `OPEN_API_SCOPE_DENIED` | 密钥缺少所需权限 |
| 404 | `OPEN_API_WORKFLOW_NOT_FOUND` | 工作流不存在或不属于该账号 |
| 402 | `INSUFFICIENT_CREDITS` | 积分不足 |
| 429 | `OPEN_API_RATE_LIMITED` | 超过密钥限流 |
| 500 | `OPEN_API_FAILED` | 服务端异常，附 `requestId` |

默认限流 60 次/分钟/密钥，可在后台按密钥调整。每次调用都会写入 `open_api_audit`，保留 30 天。

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

## 6. 自有后端兼容契约

前端只依赖公开 HTTP 契约，自有后端需要实现：

| 能力 | 契约 |
| --- | --- |
| 站点配置 | `GET /api/site/config` 返回 `{code:200,data:{siteId,name,logoUrl,seo,contact,registerEnabled}}`；域名未登记返回 403 + `errorCode=SITE_NOT_REGISTERED`；停用返回 `SITE_DISABLED` |
| 登录态 | 请求头携带 `token` 与 `Authorization`；401 时前端清理登录态 |
| 工作流 | `/api/aiWorkflow` 下与 `src/services/api.ts` 一致的模型目录、工作流 CRUD、运行、执行记录与积分接口 |
| 智能体 | `/api/aiAgents` 下的 catalog、projects、运行、取消、导出与资产读取 |
| 小说 | `/api/aiAgents/novel` 下的 catalog、projects、outline、章节生成/编辑、cancel、status、export |
| 模型目录 | `GET /api/aiWorkflow/models` 至少返回 `text`、`image`、`video`，可附带 `embedding` |
| 开放 API | `/api/open/v1/token`、models、workflows、run、executions、credits |

跨域部署时后端必须允许站点来源，并放行 `token`、`Authorization`、`X-Site-Id`、`Idempotency-Key` 请求头。
