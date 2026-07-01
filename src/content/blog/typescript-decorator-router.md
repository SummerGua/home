---
title: '用 TypeScript 装饰器实现路由系统'
description: '通过一个最小示例理解 NestJS 风格路由装饰器的核心原理：注册路由元信息，并在请求到达时调用对应控制器方法。'
tags: 'Frontend'
pubDate: 'Jul 2 2026'
---

一直很好奇 NestJS 是如何实现一个艾特符号就能定义路由，比如：

```typescript
@Controller()
export class HelloController {
  @Get("/hello")
  hello(req: http.IncomingMessage, res: http.ServerResponse) {
    res.end("hello");
  }
}
```

还好现在有 AI 不需要看源码，原理很简单，使用装饰器的时候把对应的路径记录下来，然后在请求到达的时候根据路径调用对应的方法。

我们可以定义三个文件：

- `controller.ts`
- `decorator.ts`
- `index.ts`

首先是 `decorator.ts`

```typescript
export interface Route {
  method: string;
  path: string;
  methodName: string;
}

export const routes: Route[] = [];

export function Get(path: string) {
  /**
   * @param target 控制器实例
   * @param propertyKey 方法名
   */
  return function (target: any, propertyKey: string) {
    routes.push({
      method: "GET",
      path,
      methodName: propertyKey,
    });
  };
}
```

然后定义一个 `controller.ts`

```typescript
import * as http from "node:http";
import { Get } from "./decorator";

export class HelloController {
  @Get("/hello") // 把 /hello 路径和方法名记录下来
  hello(req: http.IncomingMessage, res: http.ServerResponse) {
    res.end("hello");
  }
}
```

最后在 `index.ts` 中启动服务

```typescript
import * as http from "node:http";
import { Get, routes } from "./decorator";
import { HelloController } from "./controller";

const controller = new HelloController();

const server = http.createServer((req, res) => {
  // 从 routes 中找到对应的路由
  const route = routes.find(
    (item) => item.method === req.method && item.path === req.url,
  );

  // 如果没有找到对应的路由，返回 404
  if (!route) {
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }

  // 取出对应的方法
  const handler = controller[route.methodName];
  // 可以先判断 handler 是否是函数，此处省略
  // 调用方法，this 指向 controller 实例
  handler.call(controller, req, res);
});

server.listen(3000, () => {
  console.log("server running: http://localhost:3000/hello");
});
```
