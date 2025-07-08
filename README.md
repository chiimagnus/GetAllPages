# GetAllPages - 文档剪藏工具

> 不仅仅是单个网页，而是整个文档目录的智能剪藏！

GetAllPages 是一个强大的浏览器插件，能够智能识别网站的文档结构，批量提取整个文档站点的内容，并生成结构化的 Markdown 文件。

## ✨ 特性

- 🔍 **智能识别** - 自动识别网站的侧边栏导航和主要内容区域
- 📚 **批量提取** - 一键提取整个文档站点的所有页面内容
- 📝 **Markdown 转换** - 将 HTML 内容转换为格式良好的 Markdown 文件
- 🗂️ **结构保持** - 保持原有的目录层级关系
- 🚫 **反爬虫友好** - 内置延迟和随机化机制，避免被网站封禁
- 🎯 **支持多种网站** - 兼容 Apple Developer Documentation、各种技术文档站点等

## 🎯 适用场景

- **技术文档备份** - 备份 Apple Developer Documentation、MDN、Vue.js 文档等
- **离线阅读** - 将在线文档下载到本地，支持离线阅读
- **知识管理** - 将重要的技术文档整理到个人知识库
- **团队分享** - 快速分享完整的技术文档给团队成员

## 🚀 快速开始

### 安装

1. 克隆项目到本地：
```bash
git clone https://github.com/your-username/GetAllPages.git
cd GetAllPages
```

2. 安装依赖：
```bash
pnpm install
```

3. 构建插件：
```bash
pnpm build
```

4. 在浏览器中加载插件：
   - 打开 Chrome/Edge 的扩展管理页面
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `extension` 文件夹

### 使用方法

1. **访问目标网站** - 打开你想要提取的文档网站（如 https://developer.apple.com/documentation）

2. **点击插件图标** - 在浏览器工具栏中点击 GetAllPages 图标

3. **分析文档结构** - 点击"🔍 分析文档结构"按钮，插件会自动识别页面的导航结构

4. **开始提取** - 点击"📥 开始提取内容"按钮，插件会自动访问所有页面并提取内容

5. **下载文件** - 提取完成后，所有 Markdown 文件会自动下载到你的下载文件夹

## 🛠️ 开发

### 开发环境

```bash
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

### 项目结构

```
src/
├── background/          # 后台脚本
├── contentScripts/      # 内容脚本
├── popup/              # 弹窗界面
├── options/            # 设置页面
├── composables/        # Vue 组合式函数
└── components/         # Vue 组件
```

## 🔧 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI 框架**: UnoCSS
- **浏览器 API**: WebExtension API
- **通信**: webext-bridge

## 📋 支持的网站

目前已测试支持的网站类型：

- [] Apple Developer Documentation
- [] MDN Web Docs
- [] Vue.js 官方文档
- [] React 官方文档
- [] 大部分基于侧边栏导航的技术文档站点
