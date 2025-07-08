/* eslint-disable no-console */
/**
 * 文档分析器主类
 * 协调各个模块的功能，提供统一的API接口
 */

import { getBaseUrl, isValidContent, isValidSidebar } from './utils'
import { LinkExtractor } from './LinkExtractor'
import { ScrollingLinkExtractor } from './ScrollingLinkExtractor'

export class DocumentAnalyzer {
  private sidebarSelectors: string[] = []
  private contentSelectors: string[] = []
  private linkExtractor: LinkExtractor
  private scrollingExtractor: ScrollingLinkExtractor

  constructor() {
    this.linkExtractor = new LinkExtractor()
    this.scrollingExtractor = new ScrollingLinkExtractor()
  }

  /**
   * 检查页面是否支持解析
   */
  checkPageStructure(sidebarSelectors: string[], contentSelectors: string[]) {
    this.sidebarSelectors = sidebarSelectors
    this.contentSelectors = contentSelectors

    const sidebar = this.findSidebar()
    const content = this.findMainContent()

    return {
      supported: !!(sidebar && content),
      sidebarFound: !!sidebar,
      contentFound: !!content,
      url: window.location.href,
    }
  }

  /**
   * 分析页面链接结构
   */
  async analyzeStructure(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      // 停止之前的DOM观察器
      this.linkExtractor.stopDOMObserver()

      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? await this.linkExtractor.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? await this.linkExtractor.extractLinksFromElement(mainContent, 'content') : []

      // 分析完成后停止DOM观察器
      this.linkExtractor.stopDOMObserver()

      return {
        success: true,
        structure: {
          baseUrl: getBaseUrl(),
          currentPage: {
            title: document.title,
            url: window.location.href,
          },
          sidebarLinks,
          contentLinks,
          totalLinks: sidebarLinks.length + contentLinks.length,
        },
      }
    }
    catch (error) {
      console.error('分析结构失败:', error)
      // 确保在错误情况下也停止观察器
      this.linkExtractor.stopDOMObserver()
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 提取当前页面的链接信息（仅侧边栏）
   */
  async extractPageLinks(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()

      // 只提取侧边栏链接
      const sidebarLinks = sidebar ? await this.linkExtractor.extractLinksFromElement(sidebar, 'sidebar') : []

      console.log(`[DocumentAnalyzer] 快速提取完成，侧边栏链接: ${sidebarLinks.length} 个`)

      return {
        success: true,
        data: {
          currentPage: {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
          },
          sidebarLinks,
          contentLinks: [], // 不再提取内容区链接
          summary: {
            totalLinks: sidebarLinks.length,
            sidebarLinksCount: sidebarLinks.length,
            contentLinksCount: 0,
          },
        },
      }
    }
    catch (error) {
      console.error('提取链接失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 使用滚动方式提取当前页面的链接信息（仅侧边栏）
   */
  async extractPageLinksWithScrolling(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()

      // 只使用滚动提取器提取侧边栏链接
      const sidebarLinks = sidebar ? await this.scrollingExtractor.startScrollingExtraction(sidebar, 'sidebar') : []

      console.log(`[DocumentAnalyzer] 滚动提取完成，侧边栏链接: ${sidebarLinks.length} 个`)

      return {
        success: true,
        data: {
          currentPage: {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
          },
          sidebarLinks,
          contentLinks: [], // 不再提取内容区链接
          summary: {
            totalLinks: sidebarLinks.length,
            sidebarLinksCount: sidebarLinks.length,
            contentLinksCount: 0,
          },
        },
      }
    }
    catch (error) {
      console.error('滚动提取链接失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 查找侧边栏元素
   */
  private findSidebar(): Element | null {
    console.log(`[GetAllPages] 开始查找侧边栏，共有 ${this.sidebarSelectors.length} 个选择器`)

    for (const selector of this.sidebarSelectors) {
      const element = document.querySelector(selector)
      console.log(`[GetAllPages] 尝试选择器 "${selector}": ${element ? '找到元素' : '未找到'}`)

      if (element) {
        const linkCount = element.querySelectorAll('a[href]').length
        console.log(`[GetAllPages] 元素包含 ${linkCount} 个链接`)

        if (isValidSidebar(element)) {
          console.log(`[GetAllPages] 找到有效侧边栏: ${selector}`)
          return element
        }
        else {
          console.log(`[GetAllPages] 侧边栏无效 (链接数量不足): ${selector}`)
        }
      }
    }

    console.log(`[GetAllPages] 未找到有效的侧边栏`)
    return null
  }

  /**
   * 查找主要内容区域
   */
  private findMainContent(): Element | null {
    for (const selector of this.contentSelectors) {
      const element = document.querySelector(selector)
      if (element && isValidContent(element)) {
        return element
      }
    }
    return null
  }
}
