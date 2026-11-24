# cURL 示例

变量：

```bash
export JUE_API_BASE="https://langchain.example.com"
export JUE_CLIENT_ID="jue_xxxxxxxxxxxxxxxxxxxx"
export JUE_CLIENT_SECRET="创建时返回的 Secret"
```

## 换取 Token

```bash
curl -s -X POST "$JUE_API_BASE/api/open/v1/token" \
  -H "Content-Type: application/json" \
  -d "{\"grantType\":\"client_credentials\",\"clientId\":\"$JUE_CLIENT_ID\",\"clientSecret\":\"$JUE_CLIENT_SECRET\"}"
```

保存返回的 `access_token`：

```bash
export JUE_TOKEN="eyJhbGciOi..."
```

## 读取工作流

```bash
curl -s "$JUE_API_BASE/api/open/v1/workflows?page=1&pageSize=20" \
  -H "Authorization: Bearer $JUE_TOKEN"
```

## 运行工作流

```bash
curl -s -X POST "$JUE_API_BASE/api/open/v1/workflows/<WORKFLOW_ID>/run" \
  -H "Authorization: Bearer $JUE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-20260101-001" \
  -d '{"input":{"topic":"秋季新品发布"},"simulate":false}'
```

## 查询执行记录

```bash
curl -s "$JUE_API_BASE/api/open/v1/executions/<EXECUTION_ID>" \
  -H "Authorization: Bearer $JUE_TOKEN"
```

## 查询积分

```bash
curl -s "$JUE_API_BASE/api/open/v1/credits" \
  -H "Authorization: Bearer $JUE_TOKEN"
```
