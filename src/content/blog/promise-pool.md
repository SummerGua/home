---
title: 'promise-pool'
description: '管理多个 promise 的库 @supercharge/promise-pool 的基本用法、完整用法和源码分析。'
tags: 'Frontend'
pubDate: 'Oct 28 2025'
---

[官方文档](https://superchargejs.com/docs/3.x/promise-pool)

promise-pool 顾名思义，是一个管理多个 promise 的库，npm 的周下载量高达 [30 万](https://www.npmjs.com/package/@supercharge/promise-pool?activeTab=versions)，不过最新版本已经是两年前发布的了。

## 基本用法

- `for` 方法传入任务

- 最后一定要使用`process`方法开启运行。

```typescript
import { PromisePool } from '@supercharge/promise-pool'

const { results, errors } = await PromisePool
  .for([1, 2, 3])
  .process(async num => {
    return num * 2
  })
// 打印结果
// [ 2, 4, 6 ] []
```

## 完整用法

包含并发控制、超时限制等。

```typescript
import { PromisePool } from "@supercharge/promise-pool";

// 定义任务函数
const promise1 = function () {
  return new Promise((res) => {
    setTimeout(() => {
      res("promise1结果");
    }, 2000);
  });
};

// 演示不同的任务类型
const tasks = [
  promise1, // 异步函数
  () => 42, // 同步函数返回数字
  () => "直接返回的字符串",
  () => {
    return new Promise((res) => {
      setTimeout(() => res("延迟结果"), 500);
    });
  },
];

const { results, errors } = await PromisePool.for(tasks)
  .withConcurrency(2) // 同时处理2个任务
  .withTaskTimeout(300) // 每个任务的超时时间
  .handleError((err, task, pool) => {
    console.log("捕获错误:", err.message);
    return `错误处理结果: ${err.message}`;
  })
  .onTaskFinished((item, pool) => {
    console.log(`任务${pool.processedCount()}完成`);
  })
  .process(async (task) => {
    return await task();
  });

console.log("\n=== 最终结果 ===");
console.log("Results:", results);
console.log("Errors:", errors);
console.log("处理完成的任务数:", results.length);

/**
任务1完成
任务2完成
捕获错误: Task in promise pool timed out after 300ms
任务3完成
捕获错误: Task in promise pool timed out after 300ms
任务4完成

=== 最终结果 ===
Results: [ 42, '直接返回的字符串' ]
Errors: []
处理完成的任务数: 2
*/
```

最后 errors 数组为空的原因是错误被 `handleError` 方法捕获了，如果不写是有的。

## 源码分析

链式调用是如何实现的？并发控制呢？

入口是一个 class：

```typescript
export class PromisePool {
    private readonly items: SomeIterable<T>
    private concurrency: number

    withConcurrency (concurrency: number) {
        this.concurrency = concurrency
        return this // 关键
    }

    static withConcurrency (concurrency: number) {
        return new this().withConcurrency(concurrency)
    }

    for (items): PromisePool<ItemType> {
        const pool = new PromisePool<ItemType>(items).withConcurrency(this.concurrency)
        // 部分逻辑省略
        return pool
    }

    static for (items: SomeIterable<T>): PromisePool<T> {
        return new this().for(items)
    }

    async process (callback):  {
        return new PromisePoolExecutor<T, ResultType>()
          .useConcurrency(this.concurrency)
          .useCorrespondingResults(this.shouldResultsCorrespond)
          .withTaskTimeout(this.timeout)
          .withHandler(callback)
          .handleError(this.errorHandler)
          .onTaskStarted(this.onTaskStartedHandlers)
          .onTaskFinished(this.onTaskFinishedHandlers)
          .for(this.items)
          .start()
    }
}
```

- 由于不需要手动 new 一个实例，所以它在静态方法中帮我们 new 了
- 最后的 `process` 实际上调用的是另一个类，这样每个类都有自己的责任，从而解耦
