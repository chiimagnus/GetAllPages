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

  // 分析文档结构
  analyzeStructure(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      if (!sidebar) {
        return { success: false, error: '未找到侧边栏' }
      }

      const structure = this.extractNavigationStructure(sidebar)

      return {
        success: true,
        structure: {
          baseUrl: this.getBaseUrl(),
          totalPages: structure.pages.length,
          pages: structure.pages,
          hierarchy: structure.hierarchy,
        },
      }
    }
    catch (error) {
      console.error('分析结构失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 提取导航结构
  private extractNavigationStructure(sidebar: Element) {
    const pages: any[] = []
    const hierarchy: any[] = []

    // 查找所有链接
    const links = sidebar.querySelectorAll('a[href]')

    links.forEach((link, index) => {
      const href = link.getAttribute('href')
      const text = link.textContent?.trim()

      if (href && text && this.isValidDocumentLink(href)) {
        const absoluteUrl = this.resolveUrl(href)
        const level = this.getHierarchyLevel(link)

        const pageInfo = {
          id: `page_${index}`,
          title: text,
          url: absoluteUrl,
          level,
          parent: this.findParentPage(link, pages),
        }

        pages.push(pageInfo)

        // 构建层级结构
        if (level === 0) {
          hierarchy.push(pageInfo)
        }
      }
    })

    return { pages, hierarchy }
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

  // 查找父级页面
  private findParentPage(linkElement: Element, existingPages: any[]): string | null {
    // 简化实现：根据DOM结构查找父级
    let parent = linkElement.parentElement
    while (parent) {
      const parentLink = parent.querySelector('a[href]')
      if (parentLink && parentLink !== linkElement) {
        const parentHref = this.resolveUrl(parentLink.getAttribute('href') || '')
        const parentPage = existingPages.find(page => page.url === parentHref)
        if (parentPage) {
          return parentPage.id
        }
      }
      parent = parent.parentElement
    }
    return null
  }

  // 获取基础URL
  private getBaseUrl(): string {
    return `${window.location.protocol}//${window.location.host}`
  }

  // 提取当前页面内容
  extractContent(contentSelectors: string[]) {
    this.contentSelectors = contentSelectors
    const content = this.findMainContent()
    if (!content) {
      return { success: false, error: '未找到主要内容区域' }
    }

    // 清理内容
    const cleanedContent = this.cleanContent(content.cloneNode(true) as Element)

    return {
      success: true,
      content: {
        html: cleanedContent.innerHTML,
        text: cleanedContent.textContent,
        title: document.title,
        url: window.location.href,
      },
    }
  }

  // 清理内容
  private cleanContent(element: Element): Element {
    // 移除不需要的元素
    const unwantedSelectors = [
      '.advertisement',
      '.ads',
      '.social-share',
      '.comments',
      '.footer',
      '.header',
      '.navigation',
      '.sidebar',
      'script',
      'style',
      'noscript',
    ]

    unwantedSelectors.forEach((selector) => {
      const elements = element.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    return element
  }
}

// 初始化分析器
const analyzer = new DocumentAnalyzer()

// 监听来自popup和background的消息
onMessage('checkPageStructure', ({ data }) => {
  return analyzer.checkPageStructure(data.sidebarSelectors, data.contentSelectors)
})

onMessage('analyzeStructure', ({ data }) => {
  return analyzer.analyzeStructure(data.sidebarSelectors, data.contentSelectors)
})

onMessage('extractContent', ({ data }) => {
  return analyzer.extractContent(data.contentSelectors)
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => {
  console.info('[GetAllPages] Content script loaded')
})()
