import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

// remove or turn this off if you don't use side panel
const USE_SIDE_PANEL = true

// to toggle the sidepanel with the action button in chromium:
if (USE_SIDE_PANEL) {
  // @ts-expect-error missing types
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error))
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('GetAllPages Extension installed')
})

// 文档提取服务
class DocumentExtractionService {
  private isExtracting = false
  private currentExtraction: any = null

  async startExtraction(structure: any, originalTabId: number) {
    if (this.isExtracting) {
      throw new Error('已有提取任务在进行中')
    }

    this.isExtracting = true
    this.currentExtraction = {
      structure,
      originalTabId,
      extractedPages: [],
      currentIndex: 0,
      startTime: Date.now(),
    }

    try {
      await this.processExtractionQueue()
    }
    catch (error) {
      console.error('提取过程出错:', error)
      this.notifyError((error as Error).message)
      this.stopExtraction()
    }
  }

  async processExtractionQueue() {
    const { structure, originalTabId } = this.currentExtraction
    const pages = structure.pages

    for (let i = 0; i < pages.length; i++) {
      if (!this.isExtracting)
        break

      const page = pages[i]
      this.currentExtraction.currentIndex = i

      // 通知进度
      this.notifyProgress(i + 1, pages.length, page.title)

      try {
        // 提取页面内容
        const content = await this.extractPageContent(page.url, originalTabId)

        if (content.success) {
          this.currentExtraction.extractedPages.push({
            ...page,
            content: content.content,
          })
        }

        // 反爬虫延迟
        await this.delay(this.getRandomDelay())
      }
      catch (error) {
        console.error(`提取页面失败 ${page.url}:`, error)
        // 继续处理下一个页面
      }
    }

    if (this.isExtracting) {
      await this.generateAndDownloadFiles()
      this.completeExtraction()
    }
  }

  async extractPageContent(url: string, _originalTabId: number) {
    try {
      // 创建新标签页
      const tab = await browser.tabs.create({ url, active: false })

      return new Promise((resolve) => {
        // 等待页面加载完成
        const loadListener = (tabId: number, changeInfo: any) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            browser.tabs.onUpdated.removeListener(loadListener)

            // 延迟确保页面完全渲染
            setTimeout(async () => {
              try {
                const response = await browser.tabs.sendMessage(tab.id!, {
                  action: 'extractContent',
                })

                // 关闭标签页
                browser.tabs.remove(tab.id!)
                resolve(response)
              }
              catch (error) {
                browser.tabs.remove(tab.id!)
                resolve({ success: false, error: (error as Error).message })
              }
            }, 1000)
          }
        }

        browser.tabs.onUpdated.addListener(loadListener)

        // 超时处理
        setTimeout(() => {
          browser.tabs.onUpdated.removeListener(loadListener)
          browser.tabs.remove(tab.id!)
          resolve({ success: false, error: '页面加载超时' })
        }, 30000)
      })
    }
    catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async generateAndDownloadFiles() {
    const { extractedPages, structure } = this.currentExtraction

    // 生成README文件
    const readmeContent = this.generateReadme(structure, extractedPages)
    await this.downloadFile(readmeContent, 'README.md', 'text/markdown')

    // 转换每个页面为Markdown
    for (const page of extractedPages) {
      const markdownContent = this.convertToMarkdown(page)
      const fileName = `${this.sanitizeFileName(page.title)}.md`

      await this.downloadFile(markdownContent, fileName, 'text/markdown')
      await this.delay(100) // 避免下载过快
    }
  }

  convertToMarkdown(page: any): string {
    if (!page.content)
      return ''

    // 简化的HTML到Markdown转换
    const markdown = page.content.html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n---\n\n')
      .replace(/<[^>]+>/g, '') // 移除剩余的HTML标签
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 清理多余的空行

    // 添加元数据
    const frontMatter = `---
title: ${page.title}
url: ${page.url}
extracted_at: ${new Date().toISOString()}
---

`

    return frontMatter + markdown.trim()
  }

  generateReadme(structure: any, pages: any[]): string {
    const siteName = new URL(structure.baseUrl).hostname
    const extractedAt = new Date().toLocaleString('zh-CN')

    let readme = `# ${siteName} 文档导出

导出时间: ${extractedAt}
总页面数: ${pages.length}
原始网站: ${structure.baseUrl}

## 目录结构

`

    pages.forEach((page) => {
      const indent = '  '.repeat(page.level)
      const fileName = `${this.sanitizeFileName(page.title)}.md`
      readme += `${indent}- [${page.title}](${fileName})\n`
    })

    readme += `\n## 使用说明

这些文件是从 ${siteName} 自动提取的文档内容。每个Markdown文件都包含了原始页面的主要内容，并保持了原有的格式结构。

生成工具: GetAllPages Browser Extension
`

    return readme
  }

  sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  async downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)

    await browser.downloads.download({
      url,
      filename,
      saveAs: false,
    })

    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getRandomDelay() {
    // 随机延迟 1-3 秒，避免被反爬虫
    return 1000 + Math.random() * 2000
  }

  // 通知方法
  notifyProgress(current: number, total: number, currentPage: string) {
    sendMessage('extractionProgress', {
      current,
      total,
      currentPage,
    }, 'popup')
  }

  notifyError(error: string) {
    sendMessage('extractionError', { error }, 'popup')
  }

  completeExtraction() {
    this.isExtracting = false
    this.currentExtraction = null

    sendMessage('extractionComplete', {}, 'popup')
  }

  stopExtraction() {
    this.isExtracting = false
    this.currentExtraction = null
  }
}

// 初始化提取服务
const extractionService = new DocumentExtractionService()

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)
    previousTabId = tabId
  }
  catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  sendMessage('tab-prev', { title: tab.title }, { context: 'content-script', tabId })
})

onMessage('get-current-tab', async () => {
  try {
    const tab = await browser.tabs.get(previousTabId)
    return {
      title: tab?.title,
    }
  }
  catch {
    return {
      title: undefined,
    }
  }
})

// 处理文档提取相关消息
onMessage('startExtraction', async ({ data }) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: '缺少数据' }
    }
    const extractionData = data as any
    await extractionService.startExtraction(extractionData.structure, extractionData.originalTabId)
    return { success: true }
  }
  catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

onMessage('stopExtraction', async () => {
  extractionService.stopExtraction()
  return { success: true }
})
