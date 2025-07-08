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

onMessage('startSelectionMode', () => {
  return analyzer.startSelectionMode()
})

onMessage('stopSelectionMode', () => {
  return analyzer.stopSelectionMode()
})

onMessage('extractLinksFromSelected', async () => {
  return await analyzer.extractLinksFromSelectedElements()
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => {
  console.info('[GetAllPages] Content script loaded')
})()
