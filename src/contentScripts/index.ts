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

    // 对于Apple Developer Documentation，采用更宽松的验证
    if (window.location.hostname.includes('apple.com')) {
      console.log(`[GetAllPages] Apple文档侧边栏验证: ${element.className}, 链接数: ${links.length}`)

      // 如果是.navigator容器，应该包含大量链接
      if (element.classList.contains('navigator')) {
        return links.length >= 50 // navigator容器应该有很多链接
      }

      // 其他Apple文档容器，较宽松的要求
      return links.length >= 10
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
  async analyzeStructure(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      // 清除之前的提取标记
      this.clearExtractionIndicators()

      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? await this.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? await this.extractLinksFromElement(mainContent, 'content') : []

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

  // 从指定元素中提取链接 - 简化版本
  private async extractLinksFromElement(element: Element, source: string) {
    console.log(`[GetAllPages] 开始从 ${source} 提取链接...`)

    // 等待动态内容加载
    await this.waitForDynamicContent(element)

    // 获取所有链接元素
    const linkElements = element.querySelectorAll('a[href]')
    console.log(`[GetAllPages] 在 ${source} 中找到 ${linkElements.length} 个链接元素`)

    const links: any[] = []
    const processedUrls = new Map<string, number>() // URL -> 第一次出现的索引

    // 遍历所有链接元素
    for (let index = 0; index < linkElements.length; index++) {
      const link = linkElements[index] as HTMLElement
      const href = link.getAttribute('href')
      const text = link.textContent?.trim()

      // 基本验证
      if (!href || !text) {
        continue
      }

      // 解析为绝对URL
      const absoluteUrl = this.resolveUrl(href)

      // 简单的有效性检查
      if (!this.isValidDocumentLink(href)) {
        continue
      }

      // 检查是否重复
      const isDuplicate = processedUrls.has(absoluteUrl)

      if (!isDuplicate) {
        // 第一次遇到这个URL，添加到结果中
        processedUrls.set(absoluteUrl, index)

        const linkInfo = {
          id: `${source}_link_${index}`,
          title: text,
          url: absoluteUrl,
          source,
          level: source === 'sidebar' ? this.getHierarchyLevel(link) : 0,
          description: this.getLinkDescription(link),
          context: this.getLinkContext(link),
        }

        links.push(linkInfo)
        console.log(`[GetAllPages] [${links.length}] 添加链接: ${text.substring(0, 50)}... -> ${absoluteUrl}`)
      }

      // 无论是否重复，都添加✅标记（因为它是有效链接）
      this.addExtractionIndicator(link, isDuplicate)
    }

    // 输出统计信息
    console.log(`[GetAllPages] ${source} 提取完成:`)
    console.log(`  - 扫描链接: ${linkElements.length}`)
    console.log(`  - 有效链接: ${links.length}`)
    console.log(`  - 重复链接: ${linkElements.length - links.length}`)

    return links
  }

  // 等待动态内容加载 - 简化版本
  private async waitForDynamicContent(element: Element): Promise<void> {
    if (!window.location.hostname.includes('apple.com')) {
      return
    }

    console.log('[GetAllPages] 触发Apple Developer Documentation动态内容加载...')

    // 1. 尝试滚动主要的导航容器
    const navContainers = [
      element.querySelector('.navigator-content'),
      element.querySelector('.hierarchy-item'),
      element.querySelector('[class*="nav"]'),
      element,
    ].filter(Boolean)

    for (const container of navContainers) {
      if (container && container.scrollHeight > container.clientHeight) {
        console.log(`[GetAllPages] 滚动容器以触发懒加载: ${container.className}`)

        // 快速滚动到底部再回到顶部
        container.scrollTop = container.scrollHeight
        await new Promise(resolve => setTimeout(resolve, 100))
        container.scrollTop = 0
        await new Promise(resolve => setTimeout(resolve, 100))
        break // 只处理第一个可滚动的容器
      }
    }

    // 2. 尝试展开所有折叠的项目
    const collapsedItems = element.querySelectorAll('[aria-expanded="false"], .collapsed, [class*="closed"]')
    if (collapsedItems.length > 0) {
      console.log(`[GetAllPages] 尝试展开 ${collapsedItems.length} 个折叠项`)
      collapsedItems.forEach((item) => {
        if (item instanceof HTMLElement) {
          try {
            item.click()
          }
          catch {
            // 忽略点击错误
          }
        }
      })
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    console.log('[GetAllPages] 动态内容加载完成')
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

  // 在链接文本前面添加提取成功标记
  private addExtractionIndicator(linkElement: HTMLElement, isDuplicate: boolean = false) {
    // 避免重复添加标记
    if (linkElement.textContent?.includes('✅')) {
      return
    }

    // 保存原始文本内容
    const originalText = linkElement.textContent?.trim() || ''

    // 确定要添加的标记
    let indicator: string
    let title: string

    if (isDuplicate) {
      indicator = '✅🔄 ' // 重复链接用不同的标记，注意后面有空格
      title = '有效链接（重复）'
    }
    else {
      indicator = '✅ ' // 注意后面有空格
      title = '有效链接（已提取）'
    }

    // 直接修改链接的文本内容，将标记添加到前面
    linkElement.textContent = indicator + originalText
    linkElement.title = title

    // 添加样式类用于标识
    linkElement.classList.add('getallpages-extracted-link')

    // 添加CSS样式（如果还没有添加）
    if (!document.getElementById('getallpages-indicator-style')) {
      const style = document.createElement('style')
      style.id = 'getallpages-indicator-style'
      style.textContent = `
        /* 为提取的链接添加样式 */
        .getallpages-extracted-link {
          position: relative;
          background-color: rgba(34, 197, 94, 0.08) !important;
          border-radius: 3px;
          padding: 2px 4px;
          transition: all 0.2s ease;
          border-left: 2px solid rgba(34, 197, 94, 0.3);
        }

        .getallpages-extracted-link:hover {
          background-color: rgba(34, 197, 94, 0.12) !important;
          border-left-color: rgba(34, 197, 94, 0.5);
          transform: translateX(1px);
        }

        /* 确保✅标记不会被其他样式覆盖 */
        .getallpages-extracted-link::before {
          content: '';
          display: inline;
        }

        /* 为Apple Developer Documentation特殊优化 */
        .navigator-content .getallpages-extracted-link,
        .hierarchy-item .getallpages-extracted-link {
          margin: 1px 0;
          display: inline-block;
          width: auto;
          max-width: 100%;
        }
      `
      document.head.appendChild(style)
    }
  }

  // 清除所有提取标记
  private clearExtractionIndicators() {
    // 清除带有标记类的链接
    const extractedLinks = document.querySelectorAll('.getallpages-extracted-link')
    extractedLinks.forEach((link) => {
      // 移除标记类
      link.classList.remove('getallpages-extracted-link')

      // 恢复原始文本（移除✅标记）
      const currentText = link.textContent || ''
      if (currentText.includes('✅')) {
        // 移除✅和🔄标记以及后面的空格
        const cleanText = currentText.replace(/^✅🔄\s+|^✅\s+/, '')
        link.textContent = cleanText
      }

      // 清除title属性
      if (link.getAttribute('title')?.includes('有效链接')) {
        link.removeAttribute('title')
      }
    })

    // 也清除旧版本的indicator元素（向后兼容）
    const oldIndicators = document.querySelectorAll('.getallpages-extracted-indicator')
    oldIndicators.forEach(indicator => indicator.remove())
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

    // 对于Apple Developer Documentation，采用更宽松的策略
    if (window.location.hostname.includes('apple.com')) {
      // 允许所有相对链接
      if (!href.startsWith('http')) {
        return true
      }
      // 允许所有apple.com域名下的链接
      if (href.includes('apple.com')) {
        return true
      }
      // 排除明显的外部链接
      if (href.startsWith('http') && !href.includes('apple.com')) {
        return false
      }
      return true
    }

    // 对于其他网站，允许同域名链接和相对链接
    if (href.startsWith('http')) {
      // 检查是否为同域名
      try {
        const linkUrl = new URL(href)
        const currentUrl = new URL(window.location.href)
        return linkUrl.hostname === currentUrl.hostname
      }
      catch {
        return false
      }
    }

    // 相对链接默认认为是有效的
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
  async extractLinksFromSelectedElements() {
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

      for (let i = 0; i < this.selectedElements.length; i++) {
        const element = this.selectedElements[i]
        const links = await this.extractLinksFromElement(element, `selected-${i}`)
        allLinks.push(...links)
      }

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
  async extractPageLinks(sidebarSelectors: string[], contentSelectors: string[]) {
    try {
      // 清除之前的提取标记
      this.clearExtractionIndicators()

      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? await this.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? await this.extractLinksFromElement(mainContent, 'content') : []

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
