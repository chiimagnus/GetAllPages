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
  const isSelectionMode = ref(false)
  const currentLinkData = ref<LinkExtractionResult | null>(null)
  const extractionProgress = ref({ current: 0, total: 0, currentPage: '' })

  // 常见的侧边栏选择器 - 按优先级排序，避免匹配到顶部导航
  const sidebarSelectors = [
    // Apple Developer Documentation 特定选择器（优先级最高）
    '.navigator', // 最外层导航容器
    '.navigator-content', // 导航内容
    '.hierarchy-item', // 层级项目
    '.documentation-sidebar',
    '.doc-sidebar',
    '.sidebar-content',
    '.navigation-sidebar',
    '.left-nav',
    '.left-sidebar',
    '.docs-sidebar',
    '.doc-nav',
    '.side-nav',
    '.doc-navigation',
    '.docs-nav',
    // 通用侧边栏选择器
    '.sidebar',
    '.nav-sidebar',
    '.toc',
    '.table-of-contents',
    '#sidebar',
    '.menu:not(header .menu):not(nav .menu)', // 排除头部菜单
    // 更通用的导航选择器（但排除顶部导航）
    'aside[class*="nav"]',
    'aside[class*="sidebar"]',
    '[class*="navigation"]:not(header [class*="navigation"])',
    '[class*="nav-menu"]:not(header [class*="nav-menu"])',
    // 最后才考虑通用导航（可能匹配到顶部导航）
    '.navigation:not(header .navigation)',
    '[role="navigation"]:not(header [role="navigation"])',
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

  // 开始区域选择模式
  const startSelectionMode = async (tabId: number) => {
    isSelectionMode.value = true
    try {
      const result = await sendMessage('startSelectionMode', {}, { context: 'content-script', tabId }) as any
      return result
    }
    catch (error) {
      console.error('启动选择模式失败:', error)
      isSelectionMode.value = false
      throw error
    }
  }

  // 停止区域选择模式
  const stopSelectionMode = async (tabId: number) => {
    try {
      const result = await sendMessage('stopSelectionMode', {}, { context: 'content-script', tabId }) as any
      return result
    }
    catch (error) {
      console.error('停止选择模式失败:', error)
      throw error
    }
    finally {
      isSelectionMode.value = false
    }
  }

  // 从选择的区域提取链接
  const extractLinksFromSelected = async (tabId: number): Promise<LinkExtractionResult | null> => {
    isAnalyzing.value = true
    try {
      const result = await sendMessage('extractLinksFromSelected', {}, { context: 'content-script', tabId }) as any

      if (result.success) {
        // 转换数据格式以匹配现有接口
        const linkData: LinkExtractionResult = {
          currentPage: result.data.currentPage,
          sidebarLinks: [], // 选择模式下不区分sidebar和content
          contentLinks: result.data.extractedLinks,
          summary: {
            totalLinks: result.data.summary.totalLinks,
            sidebarLinksCount: 0,
            contentLinksCount: result.data.summary.totalLinks,
          },
        }
        currentLinkData.value = linkData
        return linkData
      }
      else {
        throw new Error(result.error || '提取链接失败')
      }
    }
    catch (error) {
      console.error('从选择区域提取链接失败:', error)
      throw error
    }
    finally {
      isAnalyzing.value = false
    }
  }

  // 停止操作
  const stopOperation = () => {
    isAnalyzing.value = false
    isExtracting.value = false
    isSelectionMode.value = false
  }

  return {
    isAnalyzing: readonly(isAnalyzing),
    isExtracting: readonly(isExtracting),
    isSelectionMode: readonly(isSelectionMode),
    currentLinkData: readonly(currentLinkData),
    extractionProgress: readonly(extractionProgress),
    checkPageStructure,
    extractPageLinks,
    extractLinksFromSelected,
    startSelectionMode,
    stopSelectionMode,
    generateMarkdownFile,
    stopOperation,
  }
}
