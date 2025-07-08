import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('GetAllPages Extension installed')
})

// 链接提取和Markdown生成服务
class LinkExtractionService {
  private isProcessing = false

  async generateMarkdownFile(linkData: any) {
    if (this.isProcessing) {
      throw new Error('已有任务在进行中')
    }

    this.isProcessing = true

    try {
      const markdownContent = this.generateMarkdownFromLinks(linkData)
      await this.downloadFile(markdownContent, 'extracted-links.md', 'text/markdown')

      // 通知完成
      this.notifySuccess('Markdown文件已生成并下载')
    }
    catch (error) {
      console.error('生成文件过程出错:', error)
      this.notifyError((error as Error).message)
    }
    finally {
      this.isProcessing = false
    }
  }

  // 从链接数据生成Markdown内容
  generateMarkdownFromLinks(linkData: any): string {
    const { currentPage, sidebarLinks, contentLinks, summary } = linkData

    let markdown = `# ${currentPage.title}\n\n`
    markdown += `**页面URL:** ${currentPage.url}\n`
    markdown += `**域名:** ${currentPage.domain}\n`
    markdown += `**提取时间:** ${new Date().toLocaleString('zh-CN')}\n\n`

    markdown += `## 📊 链接统计\n\n`
    markdown += `- **总链接数:** ${summary.totalLinks}\n`
    markdown += `- **侧边栏链接:** ${summary.sidebarLinksCount}\n`
    markdown += `- **内容区域链接:** ${summary.contentLinksCount}\n\n`

    if (sidebarLinks.length > 0) {
      markdown += `## 🔗 侧边栏链接\n\n`
      sidebarLinks.forEach((link: any, index: number) => {
        markdown += `### ${index + 1}. ${link.title}\n\n`
        markdown += `- **URL:** ${link.url}\n`
        if (link.description) {
          markdown += `- **描述:** ${link.description}\n`
        }
        if (link.context) {
          markdown += `- **上下文:** ${link.context}\n`
        }
        markdown += `- **层级:** ${link.level}\n\n`
      })
    }

    if (contentLinks.length > 0) {
      markdown += `## 📄 内容区域链接\n\n`
      contentLinks.forEach((link: any, index: number) => {
        markdown += `### ${index + 1}. ${link.title}\n\n`
        markdown += `- **URL:** ${link.url}\n`
        if (link.description) {
          markdown += `- **描述:** ${link.description}\n`
        }
        if (link.context) {
          markdown += `- **上下文:** ${link.context}\n`
        }
        markdown += `\n`
      })
    }

    markdown += `\n---\n\n*由 GetAllPages 浏览器扩展生成*\n`

    return markdown
  }

  // 通知成功
  notifySuccess(message: string) {
    sendMessage('operationSuccess', { message }, 'popup').catch(console.error)
  }

  // 通知错误
  notifyError(message: string) {
    sendMessage('operationError', { message }, 'popup').catch(console.error)
  }

  // 下载文件
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
}

// 初始化链接提取服务
const linkExtractionService = new LinkExtractionService()

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

// 处理Markdown文件生成相关消息
onMessage('generateMarkdownFile', async ({ data }) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: '缺少数据' }
    }
    const linkData = data as any
    await linkExtractionService.generateMarkdownFile(linkData.linkData)
    return { success: true }
  }
  catch (error) {
    return { success: false, error: (error as Error).message }
  }
})
