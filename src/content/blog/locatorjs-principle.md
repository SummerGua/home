---
title: 'LocatorJS 原理'
description: '拆解 LocatorJS 插件：如何通过元素回溯到 Vue / React 组件源码，以及背后的 __vueParentComponent 和 React DevTools Hook。'
tags: 'Frontend'
pubDate: 'Jul 19 2025'
---

## 插件面板

<img width="464" height="348" alt="Image" src="/blog-assets/locatorjs-principle/8c486bb8646c.webp"  />

## 定位代码

面对这样一个项目我们该怎么看源码呢？众所周知 Chrome Extension 都需要 manifest 文件，所以很容易找到：

<img width="148" height="302" alt="Image" src="/blog-assets/locatorjs-principle/7c18ed61c0cc.webp"  />

然后每个目录都翻了一下，发现：

<img width="780" height="318" alt="Image" src="/blog-assets/locatorjs-principle/8fb10bde035e.webp"  />

这里的 runtime 很有可能是主要逻辑，所以去 runtime 看看，当然这样也挺无头苍蝇的。发现按下 Option 时会出现几个 icon，其中一个的提示词是「Copy path」，所以直接在项目里搜。

找到了：`packages/runtime/src/components/Outline.tsx`

<img width="376" height="165" alt="Image" src="/blog-assets/locatorjs-principle/88a2b3f215a0.webp"  />

找这个函数，一路向上找到 `packages/runtime/src/adapters/getElementInfo.tsx`

<img width="998" height="591" alt="Image" src="/blog-assets/locatorjs-principle/72db637ea295.webp"  />

这个函数需要四个渲染方式的 adapter，根据 HTML 元素返回对应的元素信息，比如是哪个组件、在哪个文件第几行等等。

## 通过元素获得组件信息

adapters 目录下有四个文件夹：

<img width="207" height="246" alt="Image" src="/blog-assets/locatorjs-principle/11ba62b8abd6.webp"  />

点开 react 一看文件也太多了💦，还好 vue 只有两个，先看 vue。

### 根据元素找到 Vue 的组件信息

这里的元素类型怎么从 `HTMLElement` 变成了 `VueElement`？

<img width="743" height="275" alt="Image" src="/blog-assets/locatorjs-principle/c42aeab140ef.webp"  />

不妨问问 GPT `__vueParentComponent` 是什么：

> 在 Vue 3 中，每个组件在运行时会被创建为一个“组件实例对象”。这个对象中包含了很多内部字段，比如 `setupState`、`ctx`、`props`、`slots` 等。
>
> 其中，`__vueParentComponent` 表示的是：当前组件实例在创建过程中，用于引用其 **父组件的实例**。

它还给了一个例子：

```javascript
// 假设你在浏览器控制台调试组件时
const el = document.querySelector('.my-vue-component')
const parent = el.__vueParentComponent
console.log(parent.type.name) // 父组件名称
```

因为一个元素不一定是组件最外层，所以通过这种方式，就获得了我们选中元素**所在组件**。Vue 组件实例还非常大方地提供了它所在的文件：

<img width="604" height="287" alt="Image" src="/blog-assets/locatorjs-principle/4a17f4739fea.webp"  />

这样不仅能把外框画出来，还能确定指定元素的文件信息，就能点击跳转啦。

那么问题来了，LocatorJS 是怎么像控制台元素选中一样，确定我们鼠标指向的元素的？这时得回头看看该函数的引用了。

好吧，只是监听 `mouseover` 事件……

<img width="743" height="275" alt="Image" src="/blog-assets/locatorjs-principle/e6e5d6156245.webp"  />

## 根据元素找到 React 的组件信息

React 比较复杂，不像 Vue 元素本身不带有组件信息，这里需要找到 `fiber`：

<img width="762" height="210" alt="Image" src="/blog-assets/locatorjs-principle/22ce3f41a372.webp"  />

这个函数的实现比想象中的简单很多：

```typescript
import { Fiber, Renderer } from "@locator/shared";
import { findDebugSource } from "./findDebugSource";

export function findFiberByHtmlElement(
  target: HTMLElement,
  shouldHaveDebugSource: boolean
): Fiber | null {
  const renderers = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers;
  const renderersValues = renderers?.values();
  if (renderersValues) {
    for (const renderer of Array.from(renderersValues) as Renderer[]) {
      if (renderer.findFiberByHostInstance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = renderer.findFiberByHostInstance(target as any);
        if (found) {
          if (shouldHaveDebugSource) {
            return findDebugSource(found)?.fiber || null;
          } else {
            return found;
          }
        }
      }
    }
  }
  return null;
}
```

关键点是 `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`，这是 React 开发者工具注入到全局 `window` 对象中的钩子，通过它可以访问 React 的渲染器信息。

这里需要了解 React 的 Fiber，等本人学了再来写吧！
