---
title: 'Webpack tapable 原理'
description: 'Webpack 的插件系统底层依赖 tapable。通过一个最小实现，理解 hook / tap / call 三者的关系，并自己写一个 Webpack 插件。'
tags: 'Frontend'
pubDate: 'Aug 4 2025'
---

## tapable 是什么

众所周知，Webpack 有一个强大的插件系统，项目中经常用到的有：

- `HtmlWebpackPlugin` 用于自动生成 HTML
- `BundleAnalyzerPlugin` 用于分析打包体积
- `HotModuleReplacementPlugin` 用于模块热更新

这些都依赖了 Webpack 的 **[tapable](https://github.com/webpack/tapable)** 模块。

## 使用 tapable

现在我们来体验一下 tapable 的使用姿势：

- `npm init -y`
- `npm install --save tapable`
- `tapable_example.js`

让 Gemini 给我们生成一段简单的例子：

**解释：**

- 这个脚本实现了两个插件，分别是**打印文件长度**和检测 TODO 标记。
- 脚本的核心在于 `FileProcessor` 类中的 `this.hooks.process` 由 `SyncHook` 实现，它返回了一个具有 `tap` 方法和 `call` 方法的对象，因此可以把插件「挂」上去，并调用 `call` 执行。

**深入：**

- `Processor` 负责一个核心流程系统
- `hook` 是事件通道，负责收集/执行被注册的回调函数
- `plugin` 是一个小的功能模块
- `Processor` 只知道在某个时机需要 `call` 一个 `hook`，但不知道有哪些 `plugin` 会响应它

```javascript
// 1. 引入 SyncHook
const { SyncHook } = require('tapable');

// 2. 模拟核心流程类 (例如 Webpack 的 Compiler 或 Compilation)
class FileProcessor {
    constructor() {
        // 最佳实践：将所有 Hook 放在 hooks 属性中
        // SyncHook 构造函数中的数组 ['filename', 'content'] 定义了 Hook 被触发时将接收的参数名称，这个数组主要用于性能优化和代码生成
        this.hooks = {
            // 定义一个同步 Hook，它将接收两个参数
            process: new SyncHook(['filename', 'content'])
        };
    }

    // 核心方法：触发 Hook
    run(filename, content) {
        console.log(`\n--- 核心流程：开始处理文件 [${filename}] ---`);
        // 调用 Hook，触发所有已注册的回调，并传入参数
        this.hooks.process.call(filename, content);
        console.log(`--- 核心流程：文件处理完毕 ---`);
    }
}

// -----------------------------------------------------
// 3. 插件定义 (注册方)
// -----------------------------------------------------

// 插件 A：打印日志
function LoggerPlugin() {
    return {
        apply: (processor) => {
            // 插件使用 tap 方法注册到 Hook 上
            processor.hooks.process.tap('LoggerPlugin', (filename, content) => {
                console.log(`[LoggerPlugin] 正在处理文件: ${filename}，内容长度: ${content.length}`);
            });
        }
    };
}

// 插件 B：内容检查
function ContentCheckerPlugin() {
    return {
        apply: (processor) => {
            // 插件使用 tap 方法注册到 Hook 上
            processor.hooks.process.tap('ContentCheckerPlugin', (filename, content) => {
                if (content.includes('TODO')) {
                    console.log(`[CheckerPlugin] ⚠️ 文件 ${filename} 包含 'TODO' 标记，需要注意！`);
                }
            });
        }
    };
}

// -----------------------------------------------------
// 4. 运行示例
// -----------------------------------------------------

// 实例化核心处理器
const processor = new FileProcessor();

// 实例化并应用插件（通常在 Webpack 配置中完成）
new LoggerPlugin().apply(processor);
new ContentCheckerPlugin().apply(processor);

// 触发 Hook
processor.run('main.js', 'console.log("Hello Tapable");');
processor.run('module.js', 'let a = 1; // TODO: 优化此逻辑');
```

可以看出 Tapable 使用了**发布/订阅模式**，用 `tap` 注册事件，用 `call` 调用事件。

运行一下：

```
--- 核心流程：开始处理文件 [main.js] ---
[LoggerPlugin] 正在处理文件: main.js，内容长度: 29
--- 核心流程：文件处理完毕 ---

--- 核心流程：开始处理文件 [module.js] ---
[LoggerPlugin] 正在处理文件: module.js，内容长度: 25
[CheckerPlugin] ⚠️ 文件 module.js 包含 'TODO' 标记，需要注意！
--- 核心流程：文件处理完毕 ---
```

## 实现上述的 tapable

现在我们把文件开头的导入删除，自己实现一个 `SyncHook` 类，非常简单：

```javascript
class SyncHook {
  constructor(args) {
    this.args = args;
    this.taps = [];
  }

  tap(name, fn) {
    this.taps.push({ name, fn });
  }

  call(...args) {
    this.taps.forEach((tap) => tap.fn(...args));
  }
}
```

## 实现一个 Webpack 插件

插件是一个包含 `apply` 方法的类，在 `apply` 里把想要执行的逻辑 tap 到对应的 hook 即可。

### `MyHelloWorldPlugin.js`

```javascript
// plugins/MyHelloWorldPlugin.js

class MyHelloWorldPlugin {
  // 构造函数，接收 options (如果有的话)
  constructor(options = {}) {
    this.options = options;
    // 插件名称是必需的，用于 Tapable 机制追踪
    this.pluginName = "MyHelloWorldPlugin";
  }

  // apply 方法是所有 Webpack 插件的入口
  apply(compiler) {
    // compiler 对象继承自 Tapable，它包含了 Webpack 所有的 Hook

    // 1. 选择 Hook: compiler.hooks.done
    //    'done' Hook 是在 Webpack 编译流程完成后触发的，是 SyncHook。

    // 2. 使用 tap 方法注册回调（同步 Hook 使用 tap）
    compiler.hooks.done.tap(
      this.pluginName, // 传入插件名称
      (stats) => {
        // 3. 插件的执行逻辑
        console.log("\n======================================");
        console.log(
          `🎉 Webpack Build Completed! ${this.pluginName} is running.`
        );
        if (this.options.message) {
          console.log(`Plugin Message: ${this.options.message}`);
        }
        console.log("======================================");
      }
    );
  }
}

module.exports = MyHelloWorldPlugin;
```

### `webpack.config.js`

导入刚刚实现的插件，实例化之后放到 `plugins` 数组中：

```javascript
const path = require("path");
const MyHelloWorldPlugin = require("./plugins/MyHelloWorldPlugin.js");

module.exports = {
  // 1. 设置构建模式
  mode: "development",

  // 2. 设置入口文件
  entry: "./src/index.js",

  // 3. 设置输出
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },

  // 4. 引入插件！
  plugins: [
    // 实例化你的插件，并传入一个选项（可选）
    new MyHelloWorldPlugin({
      message: "Hello World from my custom Tapable plugin!",
    }),
  ],
};
```
