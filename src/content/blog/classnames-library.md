---
title: 'classNames 库'
description: 'React 组件里组合 CSS Modules 和 Tailwind 类名时，classNames 可以很方便地处理字符串拼接。'
tags: ['React', 'Frontend']
pubDate: 'Jul 15 2025'
---

React 组件通常将 CSSModule 和 TailwinCSS 配合使用，需要组合类名，`classNames` 可以很方便地做到这一点。

```javascript
const classNames = require('classnames');
classNames('foo', 'bar'); // => 'foo bar'
```

可见 `classNames` 函数的返回值是一个字符串。

[源代码](https://github.com/JedWatson/classnames/blob/main/index.js) 只有 50 行，很简单，首先用 `arguments` 遍历函数参数，使用 `parseValue` 拼接到空字符串后最后返回。

## `parseValue`

`parseValue` 用于处理不同类型的参数，值得注意的：

下面这个方法把 `arg` 作为第二个参数，告诉 `apply` 把 `arg` 数组的元素**展开**作为 `classNames` 的参数。

```javascript
if (Array.isArray(arg)) {
    return classNames.apply(null, arg);
}
```

下面的代码用于检测 `arg` 是否有一个自定义的、非原生的 `toString` 方法。如果是，就可以用这个自定义方法来获取字符串，否则就按默认逻辑处理。

```javascript
if (arg.toString !== Object.prototype.toString && !arg.toString.toString().includes('[native code]')) {
    return arg.toString();
}
```
