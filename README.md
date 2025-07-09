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

## 📋 支持的网站

目前已测试支持的网站类型：

- [x] Apple Developer Documentation
- [] MDN Web Docs
- [] Vue.js 官方文档
- [] React 官方文档
- [x] 大部分基于侧边栏导航的技术文档站点
