import { readonly, ref } from 'vue'
import { sendMessage } from 'webext-bridge/popup'

export interface PageInfo {
  id: string
  title: string
  url: string
  level: number
  parent?: string
  content?: {
    html: string
    text: string
    title: string
    url: string
  }
}

export interface DocumentStructure {
  baseUrl: string
  totalPages: number
  pages: PageInfo[]
  hierarchy: PageInfo[]
}

export interface AnalysisResult {
  supported: boolean
  sidebarFound: boolean
  contentFound: boolean
  url: string
}

export function useDocumentAnalyzer() {
  const isAnalyzing = ref(false)
  const isExtracting = ref(false)
  const currentStructure = ref<DocumentStructure | null>(null)
  const extractionProgress = ref({ current: 0, total: 0, currentPage: '' })

  // 常见的侧边栏选择器
  const sidebarSelectors = [
    '[role="navigation"]',
    '.sidebar',
    '.nav-sidebar',
    '.documentation-sidebar',
    '.toc',
    '.table-of-contents',
    '#sidebar',
    '.menu',
    '.navigation',
    // Apple Developer Documentation 特定选择器
    '.navigator-content',
    '.hierarchy-item',
    // 其他常见文档网站
    '.docs-sidebar',
    '.doc-nav',
    '.side-nav',
    '.doc-navigation',
    '.docs-nav',
    '.documentation-nav',
  ]

  // 主要内容区域选择器
  const contentSelectors = [
    '[role="main"]',
    '.main-content',
    '.content',
    '.documentation-content',
    '.article-content',
    '#main',
    '#content',
    '.page-content',
    // Apple Developer Documentation 特定
    '.content-wrapper',
    '.article-wrapper',
    // 其他常见选择器
    '.doc-content',
    '.docs-content',
    'main',
    'article',
  ]

  // 检查页面是否支持解析
  const checkPageStructure = async (tabId: number): Promise<AnalysisResult> => {
    try {
      const result = await sendMessage('checkPageStructure', {
        sidebarSelectors,
        contentSelectors,
      }, { context: 'content-script', tabId })
      return result
    }
    catch (error) {
      console.error('检查页面结构失败:', error)
      return {
        supported: false,
        sidebarFound: false,
        contentFound: false,
        url: '',
      }
    }
  }

  // 分析文档结构
  const analyzeStructure = async (tabId: number): Promise<DocumentStructure | null> => {
    isAnalyzing.value = true
    try {
      const result = await sendMessage('analyzeStructure', {
        sidebarSelectors,
        contentSelectors,
      }, { context: 'content-script', tabId }) as any

      if (result.success) {
        currentStructure.value = result.structure
        return result.structure
      }
      else {
        throw new Error(result.error || '分析失败')
      }
    }
    catch (error) {
      console.error('分析文档结构失败:', error)
      throw error
    }
    finally {
      isAnalyzing.value = false
    }
  }

  // 开始批量提取
  const startExtraction = async (structure: DocumentStructure, originalTabId: number) => {
    isExtracting.value = true
    extractionProgress.value = { current: 0, total: structure.pages.length, currentPage: '' }

    try {
      const result = await sendMessage('startExtraction', {
        structure: JSON.parse(JSON.stringify(structure)),
        originalTabId,
      }, 'background') as any

      if (!result.success) {
        throw new Error(result.error || '提取失败')
      }
    }
    catch (error) {
      console.error('提取过程出错:', error)
      throw error
    }
    finally {
      isExtracting.value = false
    }
  }

  // 停止提取
  const stopExtraction = () => {
    isExtracting.value = false
  }

  return {
    isAnalyzing: readonly(isAnalyzing),
    isExtracting: readonly(isExtracting),
    currentStructure: readonly(currentStructure),
    extractionProgress: readonly(extractionProgress),
    checkPageStructure,
    analyzeStructure,
    startExtraction,
    stopExtraction,
  }
}
