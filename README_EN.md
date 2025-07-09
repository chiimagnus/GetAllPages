# GetAllPages

[English](README_EN.md) | [中文](README.md)

> Not just a single webpage, but an intelligent collection of entire documentation directories!

GetAllPages is a powerful browser extension that captures the entire table of contents and all content of technical documentation, providing more contextual background for your AI assistant!

## ✨ Features

- 🔍 Smart Recognition - Automatically identifies the sidebar navigation of websites
- 🔗 Extracts all links from the sidebar and saves them as markdown files
- [] 📚 Batch Extraction - One-click extraction of all pages in the documentation site

## 🚀 Quick Start

### Installation

1. Clone the project locally:

```bash
git clone https://github.com/your-username/GetAllPages.git
cd GetAllPages
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the extension:

```bash
pnpm build
```

4. Load the extension in your browser:
   - Open the extensions management page in Chrome/Edge
   - Enable "Developer mode"
   - Click "Load unpacked extension"
   - Select the `extension` folder in the project

### Usage

1. **Visit the target website** - Open the documentation site you want to extract (e.g., https://developer.apple.com/documentation)

2. **Click the extension icon** - Click the GetAllPages icon in the browser toolbar

3. **Analyze the documentation structure** - Click the "🔍 Smart Analysis" button, and the extension will automatically identify the navigation structure of the page, extract all links from the sidebar, and save them as markdown files

### Project Structure

```bash
scripts/                # Scripts related to build and development
├── utils.ts            # Build utility functions, providing path resolution, environment detection, and other basic functions
├── prepare.ts          # Development environment setup script, generates HTML stub files, and monitors file changes
├── manifest.ts         # Script to generate the extension's manifest.json file
```

```bash
src/                    # Core code
├── background/         # Background scripts
├── contentScripts/     # Content scripts
├── popup/              # Popup interface
├── options/            # Settings page
├── composables/        # Vue composable functions
└── components/         # Vue components
```

## 🔧 Tech Stack

- **Framework**: Vue 3 + TypeScript
- **Build Tool**: Vite
- **UI Framework**: UnoCSS
- **Browser API**: WebExtension API
- **Communication**: webext-bridge

## 📋 Supported Websites

Currently tested and supported website types:

- [x] Apple Developer Documentation
- [] MDN Web Docs
- [] Vue.js Official Documentation
- [] React Official Documentation
- [x] Most technical documentation sites with sidebar navigation
