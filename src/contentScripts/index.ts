/* eslint-disable no-console */
import { onMessage } from 'webext-bridge/content-script'

// GetAllPages 文档分析器
class DocumentAnalyzer {
  private sidebarSelectors: string[] = []
  private contentSelectors: string[] = []

  // 检查页面是否支持解析
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

  // 查找侧边栏元素
  private findSidebar(): Element | null {
    for (const selector of this.sidebarSelectors) {
      const element = document.querySelector(selector)
      if (element && this.isValidSidebar(element)) {
        return element
      }
    }
    return null
  }

  // 验证侧边栏是否有效
  private isValidSidebar(element: Element): boolean {
    const links = element.querySelectorAll('a[href]')
    return links.length >= 3 // 至少包含3个链接才认为是有效的侧边栏
  }

  // 查找主要内容区域
  private findMainContent(): Element | null {
    for (const selector of this.contentSelectors) {
      const element = document.querySelector(selector)
      if (element && this.isValidContent(element)) {
        return element
      }
    }
    return null
  }

  // 验证内容区域是否有效
  private isValidContent(element: Element): boolean {
    const textContent = element.textContent?.trim() || ''
    return textContent.length > 100 // 内容长度大于100字符
  }

  // 分析页面链接结构
  analyzeStructure(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? this.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? this.extractLinksFromElement(mainContent, 'content') : []

      return {
        success: true,
        structure: {
          baseUrl: this.getBaseUrl(),
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
      return { success: false, error: (error as Error).message }
    }
  }

  // 从指定元素中提取链接
  private extractLinksFromElement(element: Element, source: 'sidebar' | 'content') {
    const links: any[] = []
    const linkElements = element.querySelectorAll('a[href]')

    linkElements.forEach((link, index) => {
      const href = link.getAttribute('href')
      const text = link.textContent?.trim()

      if (href && text && this.isValidDocumentLink(href)) {
        const absoluteUrl = this.resolveUrl(href)
        const level = source === 'sidebar' ? this.getHierarchyLevel(link) : 0

        const linkInfo = {
          id: `${source}_link_${index}`,
          title: text,
          url: absoluteUrl,
          source,
          level,
          description: this.getLinkDescription(link),
          context: this.getLinkContext(link),
        }

        links.push(linkInfo)
      }
    })

    return links
  }

  // 获取链接的描述信息
  private getLinkDescription(linkElement: Element): string {
    // 尝试从父元素或兄弟元素获取描述
    const parent = linkElement.parentElement
    if (parent) {
      const description = parent.querySelector('.description, .summary, .excerpt')
      if (description) {
        return description.textContent?.trim() || ''
      }
    }
    return ''
  }

  // 获取链接的上下文信息
  private getLinkContext(linkElement: Element): string {
    // 获取链接周围的文本内容作为上下文
    const parent = linkElement.parentElement
    if (parent) {
      const context = parent.textContent?.trim() || ''
      // 限制上下文长度
      return context.length > 200 ? `${context.substring(0, 200)}...` : context
    }
    return ''
  }

  // 验证是否为有效的文档链接
  private isValidDocumentLink(href: string): boolean {
    // 排除外部链接、锚点链接等
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      return false
    }
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false
    }
    return true
  }

  // 解析相对URL为绝对URL
  private resolveUrl(href: string): string {
    if (href.startsWith('http')) {
      return href
    }
    return new URL(href, window.location.href).href
  }

  // 获取层级级别
  private getHierarchyLevel(linkElement: Element): number {
    let level = 0
    let parent = linkElement.parentElement

    while (parent) {
      if (parent.tagName === 'UL' || parent.tagName === 'OL') {
        level++
      }
      parent = parent.parentElement
    }

    return Math.max(0, level - 1)
  }

  // 提取当前页面的链接信息
  extractPageLinks(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? this.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? this.extractLinksFromElement(mainContent, 'content') : []

      return {
        success: true,
        data: {
          currentPage: {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
          },
          sidebarLinks,
          contentLinks,
          summary: {
            totalLinks: sidebarLinks.length + contentLinks.length,
            sidebarLinksCount: sidebarLinks.length,
            contentLinksCount: contentLinks.length,
          },
        },
      }
    }
    catch (error) {
      console.error('提取链接失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 获取基础URL
  private getBaseUrl(): string {
    return `${window.location.protocol}//${window.location.host}`
  }
}

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

onMessage('analyzeStructure', ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any
  return analyzer.analyzeStructure(sidebarSelectors, contentSelectors)
})

onMessage('extractPageLinks', ({ data }) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: '无效的数据' }
  }
  const { sidebarSelectors, contentSelectors } = data as any
  return analyzer.extractPageLinks(sidebarSelectors, contentSelectors)
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => {
  console.info('[GetAllPages] Content script loaded')
})()
