---
title: 'vscode:// 协议'
description: '为什么在浏览器中输入 vscode:// 可以打开 VS Code，以及 VS Code 如何注册自定义协议处理器。'
category: 'Tooling'
pubDate: 'Jul 19 2025'
---

## 为什么在浏览器中输入 `vscode://` 可以打开 VS Code？

因为 VS Code 注册了一个自定义的「协议处理器」（protocol handler），也叫做 [「URL scheme handler」](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes)。这种机制允许特定应用程序响应特定格式的 URL。

---

### 一、什么是协议处理器？

通常我们在浏览器地址栏里输入：

* `https://example.com`：使用的是 `https` 协议，浏览器通过这个协议访问网站。
* `mailto:someone@example.com`：使用的是 `mailto` 协议，触发打开默认的邮件客户端。

类似地，`vscode://` 就是一个 **自定义协议**，它告诉操作系统“这个请求是给 Visual Studio Code 的”。

---

### 二、VS Code 是怎么实现这个功能的？

VS Code 安装后会注册 `vscode://` 这个 URL 协议，让系统知道该如何处理这种链接：

* 在 Windows 上，会在注册表中添加相关项。
* 在 macOS 上，会通过 `Info.plist` 注册自定义 URL Scheme。
  * 补充：`Info.plist` 是 MacOS 应用的“身份证”，包含应用名称、版本号、应用图标等，由于 VSCode 用了 electron，所以并不直接写这个文件，而是在构建的过程中生成，例如 VSCode 中的 `product.json` 的[源码](https://github.com/microsoft/vscode/blob/8a42946cc6b80cdd8d4d372b6ba5d13805cf27cd/product.json#L34C1-L34C28)，写的是 `"urlProtocol": "code-oss"`，而不是 `vscode`，因为这是 VSCode 的开源版本（OSS 表示 Open Source Software）
* 在 Linux 上，可能通过 `.desktop` 文件注册。

当你点击浏览器中的 `vscode://` 链接时，系统就会启动 VS Code 应用，并将 URL 参数传给它。

---

### 三、用途和例子

这个功能主要用于集成开发者工具和跳转，例如：

```bash
vscode://file/c:/my-project/index.js:25:10
```

表示：

> 打开 VS Code，并定位到 `C:\my-project\index.js` 文件的第 25 行第 10 列。

### 尝试在 LocatorJS 插件中添加 Trae CN 的协议

知道原理之后，我们可以在 Applicaitons 里找到 Trae CN，右键选中**“显示包内容”**，在 `Info.plist` 文件中找到这几行：

```xml
<key>CFBundleURLSchemes</key>
  <array>
  <string>trae-cn</string>
</array>
```

可知它的协议是 `trae-cn`，现在直接去修改 LocatorJS 的 Custom link 就可以啦！
