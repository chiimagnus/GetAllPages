# GetAllPages

[English](README_EN.md) | [中文](README.md)

> 不仅仅是单个网页，而是整个文档目录的智能剪藏！

GetAllPages 是一个强大的浏览器插件，能够获取整个技术文档的目录和所有内容，让你的AI助手有更多上下文背景！

## ✨ 特性

- 🔍 智能识别 - 自动识别网站的侧边栏导航
- 🔗 提取侧边栏中所有的链接，保存为markdown文件
- [] 📚 批量提取 - 一键提取整个文档站点的所有页面内容

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

3. **分析文档结构** - 点击"🔍 智能分析"按钮，插件会自动识别页面的导航结构，并提取侧边栏中所有的链接，自动保存为markdown文件

### 项目结构

```bash
scripts/                # 构建和开发相关的脚本
├── utils.ts            # 构建工具函数，提供路径解析、环境判断等基础功能
├── prepare.ts          # 开发环境准备脚本，生成HTML存根文件，监听文件变化
├── manifest.ts         # 生成扩展manifest.json文件的脚本
```

```bash
src/                    # 核心代码
├── background/         # 后台脚本
├── contentScripts/     # 内容脚本
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

## 🛠️ 可能的技术方案

为了适应各种现代网站架构，GetAllPages 采用多层次的内容提取策略：

### 方案1: 网络请求拦截

- **原理**: 监听页面的API请求，捕获导航数据
- **优势**: 获取真实的导航结构，不依赖DOM
- **适用**: 使用API获取导航的现代SPA应用
- **状态**: 🚧 尚未采用

### 方案2: 页面脚本注入

- **原理**: 注入脚本访问页面的JavaScript变量和应用状态
- **优势**: 直接获取React/Vue等框架的组件数据
- **适用**: 基于现代前端框架的文档网站
- **状态**: 🚧 尚未采用

### 方案3: Sitemap解析

- **原理**: 解析网站的sitemap.xml获取完整页面列表
- **优势**: 简单可靠，大多数网站都有sitemap
- **适用**: 遵循SEO最佳实践的文档网站
- **状态**: ❌ 不太可行

### 方案4: HTML元素识别

- **原理**: 使用CSS选择器识别侧边栏导航元素
- **优势**: 实现简单，适用于传统网站
- **适用**: 使用传统HTML结构的文档网站
- **状态**: ✅ 目前采用，在Logseq等现代文档网站中表现不佳

### 方案5: AI驱动自动化

- **原理**: 使用AI（如browser-use）智能识别页面结构
- **优势**: 通用性最强，可处理任何网站设计
- **适用**: 复杂或非标准的网站结构
- **状态**: 🚧 尚未采用

## 📋 支持的网站

目前已测试支持的网站类型：

- [x] Apple Developer Documentation
- [] MDN Web Docs
- [] Vue.js 官方文档
- [] React 官方文档
- [x] 大部分基于侧边栏导航的技术文档站点
