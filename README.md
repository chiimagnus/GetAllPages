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

## 🧪 技术探索历程

在开发过程中，我们尝试了多种技术方案来支持不同类型的网站，以下是我们的探索过程和经验总结：

### ✅ 成功方案：智能滚动分析

- **适用场景**：传统HTML文档网站，使用标准 `<a href>` 链接结构
- **工作原理**：
  1. 自动识别页面的侧边栏导航区域
  2. 通过智能滚动触发动态内容加载
  3. 提取所有 `<a href>` 链接元素
  4. 去重和数据清理
  5. 生成结构化的markdown文件
- **代表网站**：Apple Developer Documentation、MDN Web Docs

### ❌ 尝试但放弃的方案

#### 1. Sitemap解析方案

- **目标**：通过解析网站的sitemap.xml获取所有页面链接
- **失败原因**：许多现代文档网站（如Logseq Plugin Documentation）不提供sitemap文件
- **学到的经验**：不能依赖所有网站都遵循传统的SEO最佳实践

#### 2. 脚本注入方案

- **目标**：注入JavaScript代码直接访问页面的应用状态和全局变量
- **失败原因**：现代网站的Content Security Policy (CSP)阻止内联脚本执行
- **学到的经验**：安全策略是现代web开发的重要考量，不能绕过

#### 3. 网络请求拦截方案

- **目标**：拦截页面的API请求，从响应中提取导航数据
- **失败原因**：许多网站的导航数据在初始HTML中，不通过额外API请求获取
- **学到的经验**：不同网站的架构差异很大，没有通用的数据获取模式

#### 4. 智能DOM分析方案

- **目标**：处理现代JavaScript应用中不使用标准 `<a href>` 链接的情况
- **技术思路**：
  - 等待页面完全渲染
  - 查找 `div`、`span` 等非链接元素
  - 从文本内容推断URL结构
  - 智能去重和数据清理
- **为什么需要这个方案**：
  - 现代SPA应用（如Logseq文档）使用JavaScript路由
  - 导航项可能是 `<div onclick="navigate()">` 而不是 `<a href="...">`
  - 需要从文本内容构造URL：`onSettingsChanged` → `/logseq/onSettingsChanged`

### ❓ 尚未尝试

- Browser-use

## 📋 支持的网站

目前已测试支持的网站类型：

- ✅ **Apple Developer Documentation** - 完美支持
- ⚠️ **MDN Web Docs** - 基本支持
- ⚠️ **GitHub Pages** - 取决于主题和结构
- ❌ **Logseq Plugin Documentation** - 不支持（使用JavaScript路由）
- ❌ **现代SPA应用** - 不支持（无标准链接结构）
