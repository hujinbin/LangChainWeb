import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type setupProxy from './setupProxy';

interface Response {
  status: number;
  contentType: string;
  body: string;
  chunks: number;
}

const listen = (server: http.Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });

const close = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close(error => error ? reject(error) : resolve());
  });

function request(port: number, pathname: string, body?: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const outgoing = http.request({
      hostname: '127.0.0.1', port, path: pathname,
      method: body === undefined ? 'GET' : 'POST',
      headers: { token: 'proxy-test-token', 'Content-Type': 'application/json', Connection: 'close' }
    }, incoming => {
      const parts: Buffer[] = [];
      incoming.on('data', chunk => parts.push(Buffer.from(chunk)));
      incoming.once('error', reject);
      incoming.once('end', () => resolve({
        status: incoming.statusCode || 0,
        contentType: String(incoming.headers['content-type'] || ''),
        body: Buffer.concat(parts).toString('utf8'), chunks: parts.length
      }));
    });
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error('本地代理验证超时')));
    outgoing.once('error', reject);
    outgoing.end(body);
  });
}

async function main(): Promise<void> {
  const original = process.env.REACT_APP_PROXY_TARGET;
  const originalPartner = process.env.REACT_APP_PARTNER_PROXY_TARGET;
  const partner = http.createServer((req, res) => {
    res.end(JSON.stringify({ path: req.url, host: req.headers.host }));
  });
  let forwarded = 0;
  const upstream = http.createServer((incoming, response) => {
    forwarded++;
    if (incoming.url === '/api/user/login' || incoming.url === '/api/user/unrelated') {
      response.end(String(incoming.headers['x-workflow-account'] || ''));
      return;
    }
    if (incoming.url === '/api/stream') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('event: stage\ndata: 准备完成\n\n');
      setTimeout(() => response.end('data: 逐步回复\n\n'), 60);
      return;
    }
    if (incoming.url === '/outputs/example.txt') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('生成素材');
      return;
    }
    let body = '';
    incoming.setEncoding('utf8');
    incoming.on('data', chunk => { body += chunk; });
    incoming.once('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ url: incoming.url, method: incoming.method, token: incoming.headers.token, body }));
    });
  });
  const app = express();
  const proxy = http.createServer(app);
  try {
    const upstreamPort = await listen(upstream);
    process.env.REACT_APP_PARTNER_PROXY_TARGET = `http://127.0.0.1:${await listen(partner)}`;
    process.env.REACT_APP_PROXY_TARGET = `http://127.0.0.1:${upstreamPort}`;
    // 从 CRA 实际读取的入口加载，确保极薄的 JavaScript 桥接也可正常执行。
    const configure = require('../src/setupProxy.js') as typeof setupProxy;
    configure(app);
    app.use((_incoming, response) => { response.status(404).end(); });
    const port = await listen(proxy);
    const body = JSON.stringify({ message: '验证中文对话' });
    const echo = await request(port, '/api/echo?model=flash', body);
    assert.equal(echo.status, 200);
    assert.deepEqual(JSON.parse(echo.body), { url: '/api/echo?model=flash', method: 'POST', token: 'proxy-test-token', body });
    const stream = await request(port, '/api/stream');
    assert.equal(stream.status, 200);
    assert.match(stream.contentType, /text\/event-stream/);
    assert.ok(stream.chunks >= 2, '流式数据必须分批到达');
    assert.ok(stream.body.includes('准备完成') && stream.body.includes('逐步回复'));
    assert.equal((await request(port, '/outputs/example.txt')).body, '生成素材');
    assert.equal((await request(port, '/unproxied')).status, 404);
    for (const path of ['/api/admin/login', '/api/partner-internal/v1/login', '/admin/static/js/main.js']) {
      assert.equal((await request(port, path)).status, 404, path);
    }
    assert.equal((await request(port, '/admin/')).status, 302);
    const consolePage = await request(port, '/partner/');
    assert.equal(consolePage.status, 200);
    assert.match(consolePage.contentType, /text\/html/);
    assert.match(consolePage.body, /代理商/);
    const asset = await request(port, '/partner/app.js');
    assert.equal(asset.status, 200);
    assert.match(asset.contentType, /javascript/);
    const partnerSession = await request(port, '/partner/api/session');
    assert.deepEqual(JSON.parse(partnerSession.body), { path: '/partner/api/session', host: `127.0.0.1:${port}` });
    assert.equal((await request(port, '/api/user/login', '{}')).body, '1');
    assert.equal((await request(port, '/api/user/unrelated')).body, '');
    assert.equal(forwarded, 5);
    console.log('TypeScript 开发代理验证通过：真实入口、路径/参数、POST 正文、令牌、流式回复、素材与非代理路径。');
  } finally {
    if (original === undefined) delete process.env.REACT_APP_PROXY_TARGET;
    else process.env.REACT_APP_PROXY_TARGET = original;
    if (originalPartner === undefined) delete process.env.REACT_APP_PARTNER_PROXY_TARGET;
    else process.env.REACT_APP_PARTNER_PROXY_TARGET = originalPartner;
    await close(partner);
    await close(proxy);
    await close(upstream);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '开发代理验证失败');
  process.exitCode = 1;
});
