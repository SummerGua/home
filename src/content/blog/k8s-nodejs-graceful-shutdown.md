---
title: 'K8s + Node.js 实现优雅退出'
description: '从 Node.js 信号监听到 Kubernetes Pod 终止流程，理解为什么容器里应该 exec node dist/index.js，而不是用 pm2 包一层。'
tags: 'Backend'
pubDate: 'Jul 2 2026'
---

最近遇到一个很常见的问题：Node.js 服务跑在 K8s 里，发布或者扩缩容的时候，Pod 被删掉了，但是线上偶尔会有请求中断。

这类问题通常不是代码逻辑错了，而是服务没有做好**优雅退出**。

## 什么是优雅退出

一个 HTTP 服务正在处理请求时，如果进程被直接杀掉，请求就会突然断开。

优雅退出的目标是：

- 不再接收新的请求
- 等正在处理的请求完成
- 关闭数据库、Redis、消息队列等连接
- 最后再退出进程

在 Node.js 里，最小实现大概是这样：

```typescript
import http from "node:http";

const server = http.createServer((req, res) => {
  res.end("hello");
});

server.listen(3000, () => {
  console.log("server running on http://localhost:3000");
});

function shutdown(signal: string) {
  console.log(`receive ${signal}, start graceful shutdown`);

  // 先停止接收新连接，已有连接会继续处理
  server.close((error) => {
    if (error) {
      console.error("close server failed", error);
      process.exit(1);
    }

    console.log("server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

这里有两个信号：

- `SIGINT`：本地按 `Ctrl+C` 时常见
- `SIGTERM`：K8s 删除 Pod 时默认发送的信号

所以在 K8s 里不能只监听 `SIGINT`，一定要监听 `SIGTERM`。

## K8s 删除 Pod 时发生了什么

当一个 Pod 被删除时，K8s 大概会做几件事：

1. 把 Pod 标记为 terminating
2. 从 Service 的 endpoints 中摘掉这个 Pod
3. 给容器里的主进程发送 `SIGTERM`
4. 等待一段优雅退出时间
5. 如果进程还没退出，再发送 `SIGKILL` 强制杀掉

这里的等待时间由 `terminationGracePeriodSeconds` 控制，默认是 30 秒。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-server
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: node-server
          image: node-server:latest
          ports:
            - containerPort: 3000
```

如果你的接口最长可能处理 10 秒，30 秒通常够用。如果有长连接、慢任务或者复杂清理逻辑，就需要适当调大。

## 启动脚本

容器里最推荐的启动方式是：

```dockerfile
CMD ["node", "dist/index.js"]
```

有时也会用 `run.sh` 脚本，里面必须用 `exec`：

```sh
#!/bin/sh
exec node dist/index.js
```

由于 K8s 发出的终止信号会发给容器内的 PID=1 的进程，用 `npm run` 启动服务是不行的，如果写成下面这样，node 会变成 npm 的子进程，我们的服务无法直接收到终止信号。

```sh
npm run start
```

## 为什么不要用 pm2

在虚拟机上用 pm2 管 Node 服务很常见，但在 K8s 里一般不建议这样做。

K8s 本身已经负责进程拉起、失败重启、实例数量和滚动发布。这个时候再套一层 pm2，反而会让进程模型变复杂：

- K8s 管的是容器主进程
- pm2 再去管理真正的 Node 业务进程
- 信号先到 pm2，不一定能按预期传给业务进程
- 本地用 `SIGINT` 验证退出时，业务进程也可能收不到信号

最终表现就是：你明明在代码里写了 `process.on("SIGINT")` 或 `process.on("SIGTERM")`，但发布时日志里看不到退出逻辑执行。

所以在 K8s 里更清晰的方式是让 Node 进程直接作为容器主进程运行：

```sh
exec node dist/index.js
```

把进程管理交给 K8s，把业务退出逻辑交给 Node。

## 一个简单的完整配置

Dockerfile 可以这样写：

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist ./dist

CMD ["node", "dist/index.js"]
```

Deployment 里配置优雅退出时间：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-server
spec:
  replicas: 2
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: node-server
          image: node-server:latest
          ports:
            - containerPort: 3000
```

Node 代码里监听信号：

```typescript
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

这三件事配齐以后，一个基础的 K8s + Node.js 优雅退出就差不多了。

## 总结

优雅退出的核心不是某个复杂框架，而是三件简单的事：

- Node 代码要监听 `SIGTERM`，本地调试可以顺手监听 `SIGINT`
- 容器启动时用 `exec node dist/index.js`，让信号能传到 Node 进程
- K8s 里配置合适的 `terminationGracePeriodSeconds`

不要在 K8s 里再用 pm2 包一层，除非你非常确定自己需要它，并且已经验证信号能正确传到业务进程。大多数 Node.js Web 服务，直接交给 K8s 管就够了。
