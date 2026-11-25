# Open API guide

Use this API from your server to run saved workflows, read executions and inspect credits. Requests are scoped to the site and account associated with the API key.

## Create an API key

In the [partner console](/partner/#keys), open **API keys**, create a key, select scopes and save the secret when it appears. Configure an expiry, allowed IP addresses or CIDR ranges, a per-minute limit and a concurrent run limit. Keep the secret on your server. Rotate it from the same page.

## Get an access token

```bash
curl -X POST "$JUE_API_BASE/api/open/v1/token" \
  -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$JUE_CLIENT_ID\",\"clientSecret\":\"$JUE_CLIENT_SECRET\"}"
```

Read `data.access_token` and send it as `Authorization: Bearer <token>`. The token expires after at most two hours. Revoking, rotating or disabling the key invalidates previously issued tokens.

## Endpoint reference

| Method | Path (under /api/open/v1) | Scope |
| --- | --- | --- |
| GET | /models | model:read |
| GET | /workflows?page=1&pageSize=20 | workflow:read |
| GET | /workflows/{id} | workflow:read |
| POST | /workflows/{id}/run | workflow:run |
| GET | /executions/{id} | execution:read |
| GET | /credits | credits:read |

Submit JSON with an `input` object and a unique `requestId` or `Idempotency-Key` header. Use `simulate: true` to preview the workflow. Keep the request ID for retries. Matching requests reuse the original result for 24 hours. A conflicting payload or an in-flight request returns 409. Read `data.executionId` to retrieve the execution.

## Errors and limits

| HTTP | Meaning |
| --- | --- |
| 400 | Missing request ID or invalid input |
| 401 | Invalid, expired or revoked credentials |
| 402 | Insufficient credits |
| 403 | Missing scope or denied IP address |
| 404 | Resource unavailable to this account |
| 409 | Request ID conflict |
| 429 | Rate or concurrency limit exceeded |

Inspect `errorCode`, `msg` and `requestId` when diagnosing a failure. Wait the number of seconds in `Retry-After` after a 429. Defaults are 60 requests per minute and five concurrent runs per key.

## Python example

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

## Bring your own backend

Serve the browser endpoints under /api. Return JSON envelopes with code, msg and data. The browser sends the user login token in the token header. Use /api/aiWorkflow/account/ for the workflow account endpoints. Configure site identity at /api/site/config and implement login, workflow CRUD, model discovery, execution, agents, credits and knowledge endpoints used by your deployment. During local development, set REACT_APP_PROXY_TARGET to the business API origin and REACT_APP_PARTNER_PROXY_TARGET to the partner service origin.
