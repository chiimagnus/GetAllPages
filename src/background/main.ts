import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
import browser from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
}

browser.runtime.onInstalled.addListener((): void => {
  console.log('GetAllPages Extension installed')
})

// 全局状态管理
interface GlobalState {
  isAnalyzing: boolean
  isExtracting: boolean
  currentLinkData: any | null
  lastError: string | null
  lastCompletedAt: number | null
  autoSaveEnabled: boolean
}

const globalState: GlobalState = {
  isAnalyzing: false,
  isExtracting: false,
  currentLinkData: null,
  lastError: null,
  lastCompletedAt: null,
  autoSaveEnabled: true,
}

// 广播状态变化到所有popup
async function broadcastStateChange() {
  try {
    // 发送状态更新到popup，使用JSON序列化确保类型兼容
    await sendMessage('stateUpdated', JSON.parse(JSON.stringify(globalState)), 'popup')
  }
  catch {
    // popup可能未打开，忽略错误
    console.log('[Background] 无法广播状态变化，popup可能未打开')
  }
}

// 链接提取和Markdown生成服务
class LinkExtractionService {
  private isProcessing = false

  async generateMarkdownFile(linkData: any) {
    if (this.isProcessing) {
      throw new Error('已有任务在进行中')
    }

    this.isProcessing = true
    globalState.isExtracting = true

    try {
      const markdownContent = this.generateMarkdownFromLinks(linkData)
      await this.downloadFile(markdownContent, 'extracted-links.md', 'text/markdown')

      // 更新全局状态
      globalState.lastCompletedAt = Date.now()
      globalState.currentLinkData = linkData
      globalState.lastError = null

      // 通知完成
      this.notifySuccess('Markdown文件已生成并下载')

      console.log('[GetAllPages] Markdown文件生成完成，链接数量:', linkData?.summary?.totalLinks || 0)

      // 广播状态变化
      await broadcastStateChange()
    }
    catch (error) {
      console.error('生成文件过程出错:', error)
      globalState.lastError = (error as Error).message
      this.notifyError((error as Error).message)
      throw error
    }
    finally {
      this.isProcessing = false
      globalState.isExtracting = false
    }
  }

  // 从链接数据生成Markdown内容
  generateMarkdownFromLinks(linkData: any): string {
    const { currentPage, sidebarLinks, contentLinks, summary } = linkData

    // 添加调试日志
    console.log('[GetAllPages] 生成Markdown - 数据统计:')
    console.log(`  - 侧边栏链接数组长度: ${sidebarLinks?.length || 0}`)
    console.log(`  - 内容区链接数组长度: ${contentLinks?.length || 0}`)
    console.log(`  - 统计信息: ${JSON.stringify(summary)}`)

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
    // 在background script中，我们需要使用data URL而不是blob URL
    const dataUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`

    await browser.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false,
    })
  }
}

// 初始化链接提取服务
const linkExtractionService = new LinkExtractionService()

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async ({ tabId }: { tabId: number }) => {
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

  console.log('previous tab', tab)
  sendMessage('tab-prev', { title: tab.title || '' }, { context: 'content-script', tabId })
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

// 获取全局状态
onMessage('getGlobalState', () => {
  return {
    success: true,
    state: globalState,
  }
})

// 更新分析状态
onMessage('updateAnalyzingState', async ({ data }) => {
  const { isAnalyzing, linkData, error } = data as any
  globalState.isAnalyzing = isAnalyzing

  if (linkData) {
    globalState.currentLinkData = linkData
    // 如果分析完成且有数据，记录完成时间
    if (!isAnalyzing && linkData) {
      globalState.lastCompletedAt = Date.now()
    }
  }

  if (error) {
    globalState.lastError = error
  }
  else if (!isAnalyzing) {
    // 分析成功完成时清除错误
    globalState.lastError = null
  }

  // 广播状态变化
  await broadcastStateChange()

  return { success: true }
})

// 更新提取状态
onMessage('updateExtractingState', async ({ data }) => {
  const { isExtracting } = data as any
  globalState.isExtracting = isExtracting

  // 广播状态变化
  await broadcastStateChange()

  return { success: true }
})

// 清除错误状态
onMessage('clearError', () => {
  globalState.lastError = null
  return { success: true }
})
