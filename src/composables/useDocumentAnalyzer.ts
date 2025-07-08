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
  const lastError = ref<string | null>(null)

  // 恢复全局状态
  const restoreGlobalState = async () => {
    try {
      const result = await sendMessage('getGlobalState', {}, 'background') as any
      if (result.success && result.state) {
        isAnalyzing.value = result.state.isAnalyzing
        isExtracting.value = result.state.isExtracting
        currentLinkData.value = result.state.currentLinkData
        lastError.value = result.state.lastError
      }
    }
    catch (error) {
      console.error('恢复全局状态失败:', error)
    }
  }

  // 更新全局分析状态
  const updateGlobalAnalyzingState = async (analyzing: boolean, linkData?: LinkExtractionResult | null, error?: string) => {
    try {
      await sendMessage('updateAnalyzingState', {
        isAnalyzing: analyzing,
        linkData: linkData ? JSON.parse(JSON.stringify(linkData)) : null,
        error: error || null,
      } as any, 'background')
    }
    catch (err) {
      console.error('更新分析状态失败:', err)
    }
  }

  // 更新全局提取状态
  const updateGlobalExtractingState = async (extracting: boolean) => {
    try {
      await sendMessage('updateExtractingState', {
        isExtracting: extracting,
      }, 'background')
    }
    catch (err) {
      console.error('更新提取状态失败:', err)
    }
  }

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
      }, { context: 'content-script', tabId }) as unknown as AnalysisResult
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
    await updateGlobalExtractingState(true)

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
      await updateGlobalExtractingState(false)
    }
  }

  // 使用滚动方式提取页面链接并自动保存
  const extractPageLinksWithScrolling = async (tabId: number): Promise<LinkExtractionResult | null> => {
    isAnalyzing.value = true
    await updateGlobalAnalyzingState(true)

    try {
      const result = await sendMessage('extractPageLinksWithScrolling', {
        sidebarSelectors,
        contentSelectors,
      }, { context: 'content-script', tabId }) as any

      if (result.success) {
        currentLinkData.value = result.data
        await updateGlobalAnalyzingState(false, result.data)

        // 自动保存为markdown文件
        try {
          await generateMarkdownFile(result.data)
        }
        catch (saveError) {
          console.error('自动保存失败:', saveError)
          // 保存失败不影响分析结果
        }

        return result.data
      }
      else {
        const errorMsg = result.error || '滚动提取链接失败'
        await updateGlobalAnalyzingState(false, null, errorMsg)
        throw new Error(errorMsg)
      }
    }
    catch (error) {
      console.error('滚动提取页面链接失败:', error)
      await updateGlobalAnalyzingState(false, null, (error as Error).message)
      throw error
    }
    finally {
      isAnalyzing.value = false
    }
  }

  // 停止操作
  const stopOperation = async () => {
    isAnalyzing.value = false
    isExtracting.value = false
    await updateGlobalAnalyzingState(false)
    await updateGlobalExtractingState(false)
  }

  return {
    isAnalyzing: readonly(isAnalyzing),
    isExtracting: readonly(isExtracting),
    currentLinkData: readonly(currentLinkData),
    lastError: readonly(lastError),
    restoreGlobalState,
    checkPageStructure,
    extractPageLinks,
    extractPageLinksWithScrolling,
    generateMarkdownFile,
    stopOperation,
  }
}
