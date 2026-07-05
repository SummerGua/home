---
title: 'a2a-js 源码学习'
description: 'a2a-js SDK 从服务端启动、消息发送到客户端流式解析的一次自顶向下的源码走读，附 v0.3.7 长任务推送机制。'
tags: 'Frontend'
pubDate: 'Jan 4 2026'
---

由于最近做了一些 a2a 服务开发的工作，所以对 a2a 底层的实现产生了一些兴趣，来看看源码是怎么写的吧。

我比较喜欢自顶向下也就是由浅入深的学习方法，从如何使用开始直到深层逻辑。所以先来看看如何启动一个 a2a 服务以及如何访问它。

## v0.2.1

### server

```typescript
const taskStore: TaskStore = new InMemoryTaskStore();
const agentExecutor: AgentExecutor = new MyAgentExecutor();

const requestHandler = new DefaultRequestHandler(
  coderAgentCard,
  taskStore,
  agentExecutor
);

const appBuilder = new A2AExpressApp(requestHandler);
const expressApp = appBuilder.setupRoutes(express(), '');

const PORT = process.env.CODER_AGENT_PORT || 41242; // Different port for coder agent
expressApp.listen(PORT, () => {
  console.log(`[MyAgent] Server using new framework started on http://localhost:${PORT}`);
  console.log(`[MyAgent] Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  console.log('[MyAgent] Press Ctrl+C to stop the server');
});
```

可以看到服务端启动了一个 express 服务，agent card 默认监听在 `.well-known/agent.json`。

这里的 `.well-known` 路径可不是乱写的，是有背景的，[可见维基百科](https://en.wikipedia.org/wiki/Well-known_URI) Well-known URI：

> A **well-known URI** 是 [URL](https://en.wikipedia.org/wiki/URL) 路径前缀以 `/.well-known/` 开头的统一资源标识符。它们在 Web 服务器中得到实现，以便对服务器提供的**众所周知的服务**或信息的请求可以在不同服务器上通过一致的**众所周知的** URL 访问。
>
> 规范在 RFC 8615。

由浅入深，我们先看 `A2AExpressApp`，它对 express 实例添加了几个路由：

<img width="1570" height="1107" alt="Image" src="/blog-assets/a2a-js-source/ec1c99ef7503.webp"  />

这个 post 路由将处理后的 stream 发送出去：

<img width="1391" height="1132" alt="Image" src="/blog-assets/a2a-js-source/526adb854295.webp"  />

`src/server/transports/jsonrpc_transport_handler.ts` 里有 `handle` 方法，使用了 `requestHandler` 的发送流方法：

<img width="1464" height="1229" alt="Image" src="/blog-assets/a2a-js-source/2b3afd2f71c9.webp"  />

也就是从任务队列中取出 event 之后 yield：

<img width="1303" height="1190" alt="Image" src="/blog-assets/a2a-js-source/995a096955fe.webp"  />

events 就是一个出队的过程，**最后这个 await 非常关键**：

<img width="1277" height="756" alt="Image" src="/blog-assets/a2a-js-source/d64bd2809a49.webp"  />

**只有在我们实现 `execute` 里再次 `eventBus.push` 才会继续出队！** 作为一个初级工程师，我第一次见这种写法，太高明了。

<img width="956" height="572" alt="Image" src="/blog-assets/a2a-js-source/4681de90d0d1.webp"  />

再来看 `DefaultRequestHandler`，它定义了与任务相关的各种方法，比如发送、取消等：

<img width="943" height="1079" alt="Image" src="/blog-assets/a2a-js-source/82dc35f30b00.webp"  />

用的是我们写的 executor：

<img width="1243" height="940" alt="Image" src="/blog-assets/a2a-js-source/184ba2a5a1d8.webp"  />

#### 发送消息

实现 `AgentExecutor` 类时，我们使用 `eventBus.publish(task)` 去发送一条消息，那么这里的 `publish` 干了什么？

它调用了 events 包里的 EventEmitter，这是一个官方的包：

<img width="1374" height="1185" alt="Image" src="/blog-assets/a2a-js-source/accab7dcb57f.webp"  />

这是一个官方的包，可以看[文档](https://nodejs.org/api/events.html)，帮我们实现了事件总线，所以说我们需要看下 SDK `event` 上挂载了什么函数：

<img width="489" height="350" alt="Image" src="/blog-assets/a2a-js-source/0a9516d19a2f.png"  />

搜索 `.on` 就能直接找到：

<img width="1661" height="1193" alt="Image" src="/blog-assets/a2a-js-source/dc64a431ef66.webp"  />

### client

```typescript
const client = new A2AClient("http://localhost:41241");

// a2a 数据格式
const streamParams: MessageSendParams = {
  message: {
    messageId: messageId,
    role: "user",
    parts: [{ kind: "text", text: "Stream me some updates!" }],
    kind: "message"
  },
};

// 发送消息
const stream = client.sendMessageStream(streamParams);
```

client 比较简单，只需要创建一个对象，使用 `sendMessageStream` 发送消息。

在源码中，有一个私有方法，作用是获取 agent card，把其中的 url 作为 endpoint：

<img width="1316" height="1294" alt="Image" src="/blog-assets/a2a-js-source/bcd29cdc9232.webp"  />

对于发送消息，需要构造一个 JSONRPC 2.0 格式的请求体，最后用 `_parseA2ASseStream` 解析 SSE 响应：

<img width="1376" height="1080" alt="Image" src="/blog-assets/a2a-js-source/a94259165941.webp"  />

这里的处理非常原始，作者用生成器函数自己实现了一个流处理，谷歌程序员（or AI？）还是挺厉害的。至于最后的 `_processSseEventData` 不放图了，其实也就是完成 `JSON.parse()` 这种任务，把反序列化的结果返回出来，没什么特别的。

<img width="1258" height="1048" alt="Image" src="/blog-assets/a2a-js-source/2b7bd0988ace.webp"  />

流处理用到的方法，来自 AI 的解释：

1. `.pipeThrough(new TextDecoderStream())`
   - **TextDecoderStream**：将原始的二进制数据流（Uint8Array）转换为文本字符串流
   - **pipeThrough()**：管道方法，将流数据通过一个转换流进行处理
   - 作用：自动将字节流解码为指定编码（默认 UTF-8）的文本

2. `.getReader()`
   - 获取流的读取器（ReadableStreamDefaultReader）
   - 可以通过这个读取器按需读取流中的数据

## v0.3.7

### 长任务

对于一些长的 agent 任务（比如十分钟或半小时以上），流式传输不可能始终保持连接，所以 a2a 提供了消息推送机制。

首先在 agent card 中指定 `pushNotifications` 属性为 `true`：

```typescript
const movieAgentCard: AgentCard = {
  // ... other properties
  capabilities: {
    streaming: true,
    pushNotifications: true, // Enable push notifications
    stateTransitionHistory: true,
  },
  // ... rest of agent card
};
```

client 可以在发送消息时添加一些配置，指定一个 POST 的消息推送接口：

```typescript
// Configure push notification for a message
const pushConfig: PushNotificationConfig = {
  id: 'my-notification-config', // Optional, defaults to task ID
  url: 'https://my-app.com/webhook/task-updates', // 自定义接口
  token: 'your-auth-token', // Optional authentication token
};

const sendParams: MessageSendParams = {
  message: {
    messageId: uuidv4(),
    role: 'user',
    parts: [{ kind: 'text', text: 'Hello, agent!' }],
    kind: 'message',
  },
  configuration: {
    blocking: true,
    acceptedOutputModes: ['text/plain'],
    pushNotificationConfig: pushConfig, // Add push notification config
  },
};
```

服务端实现 `PushNotificationSender` 里的 `send` 方法，初始化的时候放到 `DefaultRequestHandler` 里。
