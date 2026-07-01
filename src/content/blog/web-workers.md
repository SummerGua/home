---
title: 'Web Workers'
description: 'Web Workers 允许在后台线程运行脚本，把繁重计算从主线程抽离出来，但 worker 中没有 Window 对象。'
tags: 'JavaScript'
pubDate: 'Jul 18 2024'
---

MDN: Web Workers 允许我们在后台线程（or worker thread）运行脚本，把繁重的计算抽离出来从而不阻塞主线程。但是 worker 中没有 `Window` 对象。

## 通信与能力

worker 和主线程的通信方法：`postMessage` 和 `onmessage`。

worker 可以使用 `fetch` 或 `XMLHttpRequest` API 进行网络请求。

## worker 类型

- [Dedicated workers](https://developer.mozilla.org/en-US/docs/Web/API/Worker)
  最普通的 worker，被一个脚本使用。

```javascript
const myWorker = new Worker("/worker.js");

const first = document.querySelector("input#number1");
const second = document.querySelector("input#number2");
first.onchange = () => {
  myWorker.postMessage([first.value, second.value]);
  console.log("Message posted to worker");
};
```

- [Shared workers](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)
  是可被多个运行在不同 Window 和 iFrame 里的脚本使用的 worker，这些 Window 和 iFrame 需要在相同的 domain 中工作。脚本之间必须通过一个 active port 进行通信。

```javascript
const myWorker = new SharedWorker("worker.js");

myWorker.port.start();
myWorker.port.onmessage = (e) => {/*...*/};
myWorker.port.postMessage(/*...*/);
```

- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
  本质上充当位于 Web 应用程序、浏览器和网络（如果可用）之间的代理服务器。可以推送通知、创造离线体验、拦截网络请求等。
