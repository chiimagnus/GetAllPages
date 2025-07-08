import { readonly, ref } from 'vue'
import { sendMessage } from 'webext-bridge/popup'

export interface LinkInfo {
  id: string
  title: string
  url: string
  source: 'sidebar' | 'content'
  level: number
  description: string
  context: string
}

export interface PageInfo {
  title: string
  url: string
  domain: string
}

export interface LinkExtractionResult {
  currentPage: PageInfo
  sidebarLinks: LinkInfo[]
  contentLinks: LinkInfo[]
  summary: {
    totalLinks: number
    sidebarLinksCount: number
    contentLinksCount: number
  }
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
  const currentLinkData = ref<LinkExtractionResult | null>(null)
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
      }, { context: 'content-script', tabId }) as AnalysisResult
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

  // 提取页面链接
  const extractPageLinks = async (tabId: number): Promise<LinkExtractionResult | null> => {
    isAnalyzing.value = true
    try {
      const result = await sendMessage('extractPageLinks', {
        sidebarSelectors,
        contentSelectors,
      }, { context: 'content-script', tabId }) as any

      if (result.success) {
        currentLinkData.value = result.data
        return result.data
      }
      else {
        throw new Error(result.error || '提取链接失败')
      }
    }
    catch (error) {
      console.error('提取页面链接失败:', error)
      throw error
    }
    finally {
      isAnalyzing.value = false
    }
  }

  // 生成并下载Markdown文件
  const generateMarkdownFile = async (linkData: LinkExtractionResult) => {
    isExtracting.value = true
    try {
      const result = await sendMessage('generateMarkdownFile', {
        linkData: JSON.parse(JSON.stringify(linkData)),
      }, 'background') as any

      if (!result.success) {
        throw new Error(result.error || '生成文件失败')
      }
    }
    catch (error) {
      console.error('生成文件过程出错:', error)
      throw error
    }
    finally {
      isExtracting.value = false
    }
  }

  // 停止操作
  const stopOperation = () => {
    isAnalyzing.value = false
    isExtracting.value = false
  }

  return {
    isAnalyzing: readonly(isAnalyzing),
    isExtracting: readonly(isExtracting),
    currentLinkData: readonly(currentLinkData),
    extractionProgress: readonly(extractionProgress),
    checkPageStructure,
    extractPageLinks,
    generateMarkdownFile,
    stopOperation,
  }
}
