/* eslint-disable no-console */
import { onMessage } from 'webext-bridge/content-script'
import { DocumentAnalyzer } from './DocumentAnalyzer'

// 初始化分析器
const analyzer = new DocumentAnalyzer()

// 监听来自popup和background的消息
onMessage('checkPageStructure', ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any
  return analyzer.checkPageStructure(sidebarSelectors, contentSelectors)
})

onMessage('analyzeStructure', async ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any
  return await analyzer.analyzeStructure(sidebarSelectors, contentSelectors)
})

onMessage('extractPageLinks', async ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any
  return await analyzer.extractPageLinks(sidebarSelectors, contentSelectors)
})

onMessage('extractPageLinksWithScrolling', async ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any

  try {
    // 执行滚动提取
    const result = await analyzer.extractPageLinksWithScrolling(sidebarSelectors, contentSelectors)

    // 如果提取成功，自动保存markdown文件
    if (result.success && result.data) {
      try {
        // 直接通过background script保存文件，不依赖popup状态
        const { sendMessage } = await import('webext-bridge/content-script')
        await sendMessage('generateMarkdownFile', {
          linkData: JSON.parse(JSON.stringify(result.data)),
        }, 'background')

        console.log('[GetAllPages] 滚动提取完成并已自动保存markdown文件')

        // 确保分析状态更新为完成
        await sendMessage('updateAnalyzingState', {
          isAnalyzing: false,
          linkData: JSON.parse(JSON.stringify(result.data)),
          error: null,
        }, 'background')
      }
      catch (saveError) {
        console.error('[GetAllPages] 自动保存失败:', saveError)
        // 保存失败时也要更新状态，但标记错误
        try {
          const { sendMessage } = await import('webext-bridge/content-script')
          await sendMessage('updateAnalyzingState', {
            isAnalyzing: false,
            linkData: result.data ? JSON.parse(JSON.stringify(result.data)) : null,
            error: `保存失败: ${(saveError as Error).message}`,
          }, 'background')
        }
        catch {
          // 忽略状态更新失败
        }
      }
    }

    return result
  }
  catch (error) {
    console.error('[GetAllPages] 滚动提取失败:', error)
    return { success: false, error: (error as Error).message }
  }
})

// 处理来自background的标签页切换消息
onMessage('tab-prev', ({ data }) => {
  // 这个消息用于通知当前页面之前的标签页信息
  // 目前我们只是记录日志，不需要特殊处理
  console.log('[GetAllPages] Previous tab info:', data)
  return { success: true }
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => {
  console.info('[GetAllPages] Content script loaded')
})()
