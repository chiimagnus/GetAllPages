/* eslint-disable no-console */
import { onMessage } from 'webext-bridge/content-script'

// GetAllPages 文档分析器
class DocumentAnalyzer {
  private sidebarSelectors: string[] = []
  private contentSelectors: string[] = []
  private isSelectionMode = false
  private selectedElements: Element[] = []
  private highlightOverlay: HTMLDivElement | null = null

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
    console.log(`[GetAllPages] 开始查找侧边栏，共有 ${this.sidebarSelectors.length} 个选择器`)

    for (const selector of this.sidebarSelectors) {
      const element = document.querySelector(selector)
      console.log(`[GetAllPages] 尝试选择器 "${selector}": ${element ? '找到元素' : '未找到'}`)

      if (element) {
        const linkCount = element.querySelectorAll('a[href]').length
        console.log(`[GetAllPages] 元素包含 ${linkCount} 个链接`)

        if (this.isValidSidebar(element)) {
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

  // 验证侧边栏是否有效
  private isValidSidebar(element: Element): boolean {
    const links = element.querySelectorAll('a[href]')

    // 对于Apple Developer Documentation，真正的侧边栏应该有更多链接
    if (window.location.hostname.includes('apple.com')) {
      return links.length >= 20 // Apple文档侧边栏通常有很多链接
    }

    return links.length >= 5 // 其他网站至少5个链接
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
      // 清除之前的提取标记
      this.clearExtractionIndicators()

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
  private extractLinksFromElement(element: Element, source: string) {
    const links: any[] = []
    const linkElements = element.querySelectorAll('a[href]')

    console.log(`[GetAllPages] 在 ${source} 中找到 ${linkElements.length} 个链接元素`)

    linkElements.forEach((link, index) => {
      const href = link.getAttribute('href')
      const text = link.textContent?.trim()

      console.log(`[GetAllPages] 检查链接 ${index + 1}: href="${href}", text="${text}"`)

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
        console.log(`[GetAllPages] 添加有效链接: ${text} -> ${absoluteUrl}`)

        // 在链接旁边添加提取成功标记
        this.addExtractionIndicator(link as HTMLElement)
      }
      else {
        console.log(`[GetAllPages] 跳过无效链接: href="${href}", text="${text}", valid=${this.isValidDocumentLink(href || '')}`)
      }
    })

    console.log(`[GetAllPages] ${source} 最终提取到 ${links.length} 个有效链接`)
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

  // 在链接旁边添加提取成功标记
  private addExtractionIndicator(linkElement: HTMLElement) {
    // 避免重复添加标记
    if (linkElement.querySelector('.getallpages-extracted-indicator')) {
      return
    }

    const indicator = document.createElement('span')
    indicator.className = 'getallpages-extracted-indicator'
    indicator.innerHTML = '✅'
    indicator.style.cssText = `
      margin-left: 4px;
      font-size: 12px;
      opacity: 0.8;
      display: inline-block;
      vertical-align: middle;
      animation: getallpages-fade-in 0.3s ease-in;
    `

    // 添加动画样式
    if (!document.getElementById('getallpages-indicator-style')) {
      const style = document.createElement('style')
      style.id = 'getallpages-indicator-style'
      style.textContent = `
        @keyframes getallpages-fade-in {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 0.8; transform: scale(1); }
        }
        .getallpages-extracted-indicator:hover {
          opacity: 1;
          transform: scale(1.1);
          transition: all 0.2s ease;
        }
      `
      document.head.appendChild(style)
    }

    linkElement.appendChild(indicator)
  }

  // 清除所有提取标记
  private clearExtractionIndicators() {
    const indicators = document.querySelectorAll('.getallpages-extracted-indicator')
    indicators.forEach(indicator => indicator.remove())
  }

  // 验证是否为有效的文档链接
  private isValidDocumentLink(href: string): boolean {
    // 排除明显无效的链接
    if (!href || href.trim() === '') {
      return false
    }

    // 排除锚点链接、邮件和电话链接
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false
    }

    // 排除JavaScript链接
    if (href.startsWith('javascript:')) {
      return false
    }

    // 对于Apple Developer Documentation，允许同域名下的所有链接
    if (window.location.hostname.includes('apple.com')) {
      // 允许相对链接和同域名链接
      if (!href.startsWith('http') || href.includes('apple.com')) {
        return true
      }
    }

    // 对于其他网站，排除外部链接
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
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

  // 开始区域选择模式
  startSelectionMode() {
    this.isSelectionMode = true
    this.selectedElements = []
    this.createSelectionOverlay()
    this.addSelectionListeners()

    return {
      success: true,
      message: '请点击要分析的页面区域，选择后将自动开始分析',
    }
  }

  // 停止区域选择模式
  stopSelectionMode() {
    this.isSelectionMode = false
    this.removeSelectionListeners()
    this.removeSelectionOverlay()

    return {
      success: true,
      selectedCount: this.selectedElements.length,
    }
  }

  // 创建选择覆盖层
  private createSelectionOverlay() {
    this.highlightOverlay = document.createElement('div')
    this.highlightOverlay.id = 'getallpages-selection-overlay'
    this.highlightOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
    `
    document.body.appendChild(this.highlightOverlay)
  }

  // 移除选择覆盖层
  private removeSelectionOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove()
      this.highlightOverlay = null
    }
    // 移除所有高亮
    document.querySelectorAll('.getallpages-highlight').forEach((el) => {
      el.classList.remove('getallpages-highlight')
    })
  }

  // 添加选择事件监听器
  private addSelectionListeners() {
    document.addEventListener('mouseover', this.handleMouseOver)
    document.addEventListener('click', this.handleClick)
    document.addEventListener('keydown', this.handleKeyDown)

    // 添加样式
    const style = document.createElement('style')
    style.id = 'getallpages-selection-style'
    style.textContent = `
      .getallpages-highlight {
        outline: 3px solid #007bff !important;
        background-color: rgba(0, 123, 255, 0.1) !important;
        cursor: pointer !important;
      }
      .getallpages-selected {
        outline: 3px solid #28a745 !important;
        background-color: rgba(40, 167, 69, 0.2) !important;
      }
    `
    document.head.appendChild(style)
  }

  // 移除选择事件监听器
  private removeSelectionListeners() {
    document.removeEventListener('mouseover', this.handleMouseOver)
    document.removeEventListener('click', this.handleClick)
    document.removeEventListener('keydown', this.handleKeyDown)

    // 移除样式
    const style = document.getElementById('getallpages-selection-style')
    if (style) {
      style.remove()
    }
  }

  // 鼠标悬停处理
  private handleMouseOver = (event: MouseEvent) => {
    if (!this.isSelectionMode)
      return

    const target = event.target as Element
    if (target && target !== document.body && target !== document.documentElement) {
      // 移除之前的高亮
      document.querySelectorAll('.getallpages-highlight').forEach((el) => {
        if (!el.classList.contains('getallpages-selected')) {
          el.classList.remove('getallpages-highlight')
        }
      })

      // 添加当前高亮
      if (!target.classList.contains('getallpages-selected')) {
        target.classList.add('getallpages-highlight')
      }
    }
  }

  // 点击处理
  private handleClick = (event: MouseEvent) => {
    if (!this.isSelectionMode)
      return

    event.preventDefault()
    event.stopPropagation()

    const target = event.target as Element
    if (target && target !== document.body && target !== document.documentElement) {
      if (target.classList.contains('getallpages-selected')) {
        // 取消选择
        target.classList.remove('getallpages-selected')
        this.selectedElements = this.selectedElements.filter(el => el !== target)
      }
      else {
        // 添加选择并立即分析
        target.classList.add('getallpages-selected')
        target.classList.remove('getallpages-highlight')
        this.selectedElements.push(target)

        // 立即停止选择模式并通知popup分析
        this.stopSelectionMode()

        // 通知popup自动开始分析
        setTimeout(() => {
          window.postMessage({
            type: 'GETALLPAGES_SELECTION_COMPLETE',
            selectedCount: this.selectedElements.length,
          }, '*')
        }, 100)
      }
    }
  }

  // 键盘处理
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.isSelectionMode)
      return

    if (event.key === 'Escape') {
      this.stopSelectionMode()
      // 通知popup取消选择
      window.postMessage({
        type: 'GETALLPAGES_SELECTION_CANCELLED',
      }, '*')
    }
  }

  // 基于选择的元素提取链接
  extractLinksFromSelectedElements() {
    if (this.selectedElements.length === 0) {
      return {
        success: false,
        error: '请先选择要分析的页面区域',
      }
    }

    try {
      // 清除之前的提取标记
      this.clearExtractionIndicators()

      const allLinks: any[] = []

      this.selectedElements.forEach((element, index) => {
        const links = this.extractLinksFromElement(element, `selected-${index}`)
        allLinks.push(...links)
      })

      return {
        success: true,
        data: {
          currentPage: {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
          },
          selectedAreas: this.selectedElements.length,
          extractedLinks: allLinks,
          summary: {
            totalLinks: allLinks.length,
            selectedAreasCount: this.selectedElements.length,
          },
        },
      }
    }
    catch (error) {
      console.error('提取链接失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  // 提取当前页面的链接信息（保留原有功能）
  extractPageLinks(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      // 清除之前的提取标记
      this.clearExtractionIndicators()

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

onMessage('startSelectionMode', () => {
  return analyzer.startSelectionMode()
})

onMessage('stopSelectionMode', () => {
  return analyzer.stopSelectionMode()
})

onMessage('extractLinksFromSelected', () => {
  return analyzer.extractLinksFromSelectedElements()
})

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
;(() => {
  console.info('[GetAllPages] Content script loaded')
})()
