/* eslint-disable no-console */
import { onMessage } from 'webext-bridge/content-script'

// GetAllPages 文档分析器
class DocumentAnalyzer {
  private sidebarSelectors: string[] = []
  private contentSelectors: string[] = []
  private isSelectionMode = false
  private selectedElements: Element[] = []
  private highlightOverlay: HTMLDivElement | null = null

  // DOM观察器相关
  private domObserver: MutationObserver | null = null
  private observedElement: Element | null = null
  private linkChangeCallbacks: ((newLinks: HTMLElement[]) => void)[] = []

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

      // 停止之前的DOM观察器
      this.stopDOMObserver()

      this.sidebarSelectors = sidebarSelectors
      this.contentSelectors = contentSelectors

      const sidebar = this.findSidebar()
      const mainContent = this.findMainContent()

      const sidebarLinks = sidebar ? await this.extractLinksFromElement(sidebar, 'sidebar') : []
      const contentLinks = mainContent ? await this.extractLinksFromElement(mainContent, 'content') : []

      // 分析完成后停止DOM观察器
      this.stopDOMObserver()

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
      // 确保在错误情况下也停止观察器
      this.stopDOMObserver()
      return { success: false, error: (error as Error).message }
    }
  }

  // 从指定元素中提取链接 - 增强版本
  private async extractLinksFromElement(element: Element, source: string) {
    console.log(`[GetAllPages] 开始从 ${source} 提取链接...`)

    // 清除之前的标记
    this.clearExtractionIndicators()

    // 等待动态内容加载
    await this.waitForDynamicContent(element)

    // 多轮检测以捕获所有链接
    const links: any[] = []
    const processedUrls = new Map<string, number>()
    let detectionRound = 0
    let previousLinkCount = 0

    while (detectionRound < 3) { // 最多进行3轮检测
      detectionRound++
      console.log(`[GetAllPages] 第${detectionRound}轮链接检测...`)

      // 获取所有链接元素 - 使用更全面的选择器
      const linkElements = this.findAllLinkElements(element)
      const currentLinkCount = linkElements.length

      console.log(`[GetAllPages] 第${detectionRound}轮发现 ${currentLinkCount} 个链接元素 (上轮: ${previousLinkCount})`)

      // 如果链接数量没有增长，停止检测
      if (detectionRound > 1 && currentLinkCount <= previousLinkCount) {
        console.log(`[GetAllPages] 链接数量稳定，停止检测`)
        break
      }

      // 处理新发现的链接
      const newLinksFound = await this.processLinkElements(linkElements, source, processedUrls, links)

      if (newLinksFound === 0 && detectionRound > 1) {
        console.log(`[GetAllPages] 没有发现新的有效链接，停止检测`)
        break
      }

      previousLinkCount = currentLinkCount

      // 如果不是最后一轮，等待一段时间再进行下一轮检测
      if (detectionRound < 3) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // 输出最终统计信息
    console.log(`[GetAllPages] ${source} 提取完成:`)
    console.log(`  - 总检测轮数: ${detectionRound}`)
    console.log(`  - 最终扫描链接: ${this.findAllLinkElements(element).length}`)
    console.log(`  - 有效链接: ${links.length}`)
    console.log(`  - 重复链接: ${processedUrls.size - links.length}`)

    return links
  }

  // 查找所有类型的链接元素
  private findAllLinkElements(element: Element): HTMLElement[] {
    const selectors = [
      'a[href]', // 标准链接
      '[onclick*="location"]', // JavaScript跳转
      '[onclick*="href"]', // JavaScript链接
      '[data-href]', // 数据链接
      '[data-url]', // 数据URL
      '[data-link]', // 数据链接
      'span[onclick]', // 可点击span
      'div[onclick]', // 可点击div
      'li[onclick]', // 可点击列表项
      '.link', // 链接类
      '.nav-link', // 导航链接类
      '[role="link"]', // ARIA链接
      '[class*="link"]', // 包含link的类名
      '[class*="nav"]', // 包含nav的类名
      'button[onclick*="location"]', // 按钮跳转
    ]

    const allElements: HTMLElement[] = []
    const seenElements = new Set<HTMLElement>()

    for (const selector of selectors) {
      try {
        const elements = element.querySelectorAll(selector)
        for (const elem of Array.from(elements)) {
          if (elem instanceof HTMLElement && !seenElements.has(elem)) {
            seenElements.add(elem)
            allElements.push(elem)
          }
        }
      }
      catch (error) {
        console.warn(`[GetAllPages] 选择器错误: ${selector}`, error)
      }
    }

    return allElements
  }

  // 处理链接元素并提取有效链接
  private async processLinkElements(
    linkElements: HTMLElement[],
    source: string,
    processedUrls: Map<string, number>,
    links: any[],
  ): Promise<number> {
    let newLinksCount = 0

    for (let index = 0; index < linkElements.length; index++) {
      const linkElement = linkElements[index]

      // 提取URL
      const url = this.extractUrlFromElement(linkElement)
      if (!url)
        continue

      // 获取链接文本
      const text = this.extractTextFromElement(linkElement)
      if (!text)
        continue

      // 解析为绝对URL
      const absoluteUrl = this.resolveUrl(url)

      // 验证链接有效性
      if (!this.isValidDocumentLink(url)) {
        continue
      }

      // 检查是否重复
      const isDuplicate = processedUrls.has(absoluteUrl)

      if (!isDuplicate) {
        // 第一次遇到这个URL，添加到结果中
        processedUrls.set(absoluteUrl, index)

        const linkInfo = {
          id: `${source}_link_${links.length}`,
          title: text,
          url: absoluteUrl,
          source,
          level: source === 'sidebar' ? this.getHierarchyLevel(linkElement) : 0,
          description: this.getLinkDescription(linkElement),
          context: this.getLinkContext(linkElement),
        }

        links.push(linkInfo)
        newLinksCount++
        console.log(`[GetAllPages] [${links.length}] 新增链接: ${text.substring(0, 50)}... -> ${absoluteUrl}`)
      }

      // 无论是否重复，都添加✅标记（因为它是有效链接）
      this.addExtractionIndicator(linkElement, isDuplicate)
    }

    return newLinksCount
  }

  // 从元素中提取URL
  private extractUrlFromElement(element: HTMLElement): string | null {
    // 标准href属性
    let url = element.getAttribute('href')
    if (url)
      return url

    // 数据属性
    const dataAttrs = ['data-href', 'data-url', 'data-link', 'data-src']
    for (const attr of dataAttrs) {
      url = element.getAttribute(attr)
      if (url)
        return url
    }

    // onclick事件中的URL
    const onclick = element.getAttribute('onclick')
    if (onclick) {
      // 匹配location.href = 'url' 或 window.open('url') 等
      const urlMatches = onclick.match(/(?:location\.href|window\.open|href)\s*=\s*['"`]([^'"`]+)['"`]/)
      if (urlMatches)
        return urlMatches[1]

      // 匹配其他跳转模式
      const jumpMatches = onclick.match(/['"`]([^'"`]+\.(?:html|php|jsp|asp)|[^"'/`]*\/[^"'`]*)['"`]/)
      if (jumpMatches)
        return jumpMatches[1]
    }

    return null
  }

  // 从元素中提取文本
  private extractTextFromElement(element: HTMLElement): string | null {
    // 优先使用aria-label
    let text = element.getAttribute('aria-label')
    if (text && text.trim())
      return text.trim()

    // 使用title属性
    text = element.getAttribute('title')
    if (text && text.trim())
      return text.trim()

    // 使用文本内容，但清理✅标记
    text = element.textContent?.trim() || null
    if (text) {
      // 移除可能的提取标记
      text = text.replace(/^✅🔄\s+|^✅\s+/, '')
      if (text.length > 0)
        return text
    }

    // 如果是图片链接，使用alt属性
    const img = element.querySelector('img')
    if (img) {
      text = img.getAttribute('alt')
      if (text && text.trim())
        return text.trim()
    }

    // 如果包含图标，尝试获取相邻的文本
    const iconElement = element.querySelector('i, .icon, svg')
    if (iconElement) {
      const parent = element.parentElement
      if (parent) {
        text = parent.textContent?.replace(element.textContent || '', '').trim() || null
        if (text && text.length > 0)
          return text
      }
    }

    return null
  }

  // 等待动态内容加载 - 增强版本
  private async waitForDynamicContent(element: Element): Promise<void> {
    console.log('[GetAllPages] 开始触发动态内容加载...')

    // 记录初始链接数量
    const initialLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 初始链接数量: ${initialLinkCount}`)

    // 1. 启动DOM观察器
    this.startDOMObserver(element, (newLinks) => {
      console.log(`[GetAllPages] DOM观察器发现 ${newLinks.length} 个新链接`)
    })

    // 2. Apple文档专用优化（优先执行）
    await this.optimizeForAppleDocs(element)

    // 3. 创建DOM变化监听器用于检测稳定性
    let isLoadingComplete = false
    let lastChangeTime = Date.now()
    const stabilityObserver = new MutationObserver(() => {
      lastChangeTime = Date.now()
    })

    stabilityObserver.observe(element, {
      childList: true,
      subtree: true,
      attributes: false,
    })

    try {
      // 4. 多轮滚动和交互触发
      await this.triggerLazyLoading(element)

      // 5. 等待DOM稳定 - 等待至少2秒内没有变化
      const maxWaitTime = 15000 // 增加最大等待时间到15秒
      const stableTime = 2000 // DOM稳定时间增加到2秒
      const startTime = Date.now()

      console.log('[GetAllPages] 等待DOM稳定...')

      while (Date.now() - startTime < maxWaitTime && !isLoadingComplete) {
        await new Promise(resolve => setTimeout(resolve, 300))

        // 检查是否已经稳定
        if (Date.now() - lastChangeTime > stableTime) {
          isLoadingComplete = true
          console.log('[GetAllPages] DOM已稳定')
          break
        }
      }

      // 6. 最后一次强化触发（针对顽固的懒加载）
      if (window.location.hostname.includes('apple.com')) {
        console.log('[GetAllPages] 执行最后一轮Apple文档强化触发...')
        await this.finalAppleTrigger(element)
      }

      // 7. 记录最终链接数量
      const finalLinkCount = element.querySelectorAll('a[href]').length
      console.log(`[GetAllPages] 动态加载完成，最终链接数量: ${finalLinkCount} (增加: ${finalLinkCount - initialLinkCount})`)
    }
    finally {
      stabilityObserver.disconnect()
      // 保持DOM观察器继续运行，不在这里停止
    }
  }

  // 最后一轮Apple文档强化触发
  private async finalAppleTrigger(element: Element): Promise<void> {
    // 1. 再次尝试滚动到所有可能的容器底部
    const allScrollable = element.querySelectorAll('.navigator-content, .hierarchy-item, [class*="scroll"]')
    for (const container of Array.from(allScrollable)) {
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTop = container.scrollHeight
        await new Promise(resolve => setTimeout(resolve, 200))
        container.scrollTop = 0
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // 2. 触发所有可能的展开操作
    const expandTriggers = element.querySelectorAll('[aria-expanded="false"], .collapsed, .closed, .folded')
    console.log(`[GetAllPages] 最后一轮展开 ${expandTriggers.length} 个项目`)

    for (const trigger of Array.from(expandTriggers)) {
      try {
        if (trigger instanceof HTMLElement) {
          trigger.click()
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      catch {
        // 忽略错误
      }
    }

    // 3. 等待最后的加载
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // 触发懒加载的具体策略
  private async triggerLazyLoading(element: Element): Promise<void> {
    console.log('[GetAllPages] 执行懒加载触发策略...')

    // 策略1: 识别并滚动所有可滚动容器
    const scrollableContainers = this.findScrollableContainers(element)
    console.log(`[GetAllPages] 找到 ${scrollableContainers.length} 个可滚动容器`)

    for (const container of scrollableContainers) {
      await this.scrollContainerThoroughly(container)
    }

    // 策略2: 展开所有折叠项
    await this.expandAllCollapsedItems(element)

    // 策略3: 触发悬停事件（某些网站的懒加载需要）
    await this.triggerHoverEvents(element)

    // 策略4: 模拟用户滚动行为
    await this.simulateUserScrolling(element)
  }

  // 查找所有可滚动容器
  private findScrollableContainers(element: Element): Element[] {
    const containers: Element[] = []

    // 检查主元素本身
    if (element.scrollHeight > element.clientHeight) {
      containers.push(element)
    }

    // 查找子容器
    const candidates = [
      ...Array.from(element.querySelectorAll('.navigator-content, .hierarchy-item, [class*="nav"], [class*="scroll"], [class*="list"]')),
      ...Array.from(element.querySelectorAll('div, ul, ol')).filter(el =>
        el.scrollHeight > el.clientHeight && el.clientHeight > 50,
      ),
    ]

    for (const candidate of candidates) {
      if (candidate.scrollHeight > candidate.clientHeight) {
        containers.push(candidate)
      }
    }

    return containers
  }

  // 彻底滚动容器
  private async scrollContainerThoroughly(container: Element): Promise<void> {
    console.log(`[GetAllPages] 彻底滚动容器: ${container.className || 'unnamed'}`)

    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    const steps = Math.max(5, Math.ceil(scrollHeight / clientHeight))

    // 分步滚动到底部
    for (let i = 0; i <= steps; i++) {
      const scrollTop = (scrollHeight / steps) * i
      container.scrollTop = scrollTop
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    // 回到顶部
    container.scrollTop = 0
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // 展开所有折叠项
  private async expandAllCollapsedItems(element: Element): Promise<void> {
    const selectors = [
      '[aria-expanded="false"]',
      '.collapsed',
      '[class*="closed"]',
      '[class*="fold"]',
      'details:not([open])',
      '.expandable:not(.expanded)',
    ]

    for (const selector of selectors) {
      const items = element.querySelectorAll(selector)
      if (items.length > 0) {
        console.log(`[GetAllPages] 展开 ${items.length} 个 ${selector} 项`)

        for (const item of Array.from(items)) {
          try {
            if (item instanceof HTMLElement) {
              // 尝试点击展开
              item.click()
              await new Promise(resolve => setTimeout(resolve, 50))

              // 如果是details元素，直接设置open属性
              if (item.tagName === 'DETAILS') {
                (item as HTMLDetailsElement).open = true
              }
            }
          }
          catch {
            // 忽略点击错误
          }
        }

        // 等待展开动画完成
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  }

  // 触发悬停事件
  private async triggerHoverEvents(element: Element): Promise<void> {
    const hoverTargets = element.querySelectorAll('a, .nav-item, .menu-item, [class*="hover"]')

    if (hoverTargets.length > 0) {
      console.log(`[GetAllPages] 触发 ${Math.min(20, hoverTargets.length)} 个悬停事件`)

      // 只触发前20个，避免过度延迟
      for (let i = 0; i < Math.min(20, hoverTargets.length); i++) {
        const target = hoverTargets[i]
        try {
          target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
          await new Promise(resolve => setTimeout(resolve, 50))
          target.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
        }
        catch {
          // 忽略事件错误
        }
      }
    }
  }

  // 模拟用户滚动行为
  private async simulateUserScrolling(_element: Element): Promise<void> {
    console.log('[GetAllPages] 模拟用户滚动行为')

    // 模拟页面级滚动
    const originalScrollY = window.scrollY
    const documentHeight = document.documentElement.scrollHeight
    const viewportHeight = window.innerHeight

    if (documentHeight > viewportHeight) {
      // 缓慢滚动到页面底部
      const scrollSteps = Math.min(10, Math.ceil(documentHeight / viewportHeight))

      for (let i = 0; i <= scrollSteps; i++) {
        const scrollY = (documentHeight / scrollSteps) * i
        window.scrollTo(0, scrollY)
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // 恢复原始滚动位置
      window.scrollTo(0, originalScrollY)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
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

  // 在链接前面添加固定的提取成功标记 - 使用CSS伪元素
  private addExtractionIndicator(linkElement: HTMLElement, isDuplicate: boolean = false) {
    // 避免重复添加标记
    if (linkElement.classList.contains('getallpages-extracted-link')) {
      return
    }

    // 添加样式类用于标识
    if (isDuplicate) {
      linkElement.classList.add('getallpages-extracted-link', 'getallpages-duplicate-link')
      linkElement.title = '有效链接（重复）'
    }
    else {
      linkElement.classList.add('getallpages-extracted-link')
      linkElement.title = '有效链接（已提取）'
    }

    // 添加CSS样式（如果还没有添加）
    if (!document.getElementById('getallpages-indicator-style')) {
      const style = document.createElement('style')
      style.id = 'getallpages-indicator-style'
      style.textContent = `
        /* 为提取的链接添加固定的✅标记 */
        .getallpages-extracted-link {
          position: relative;
          background-color: rgba(34, 197, 94, 0.08) !important;
          border-radius: 3px;
          padding: 2px 4px 2px 20px !important; /* 左侧留出空间给✅ */
          transition: all 0.2s ease;
          border-left: 2px solid rgba(34, 197, 94, 0.3);
          display: inline-block !important;
          margin-left: 4px; /* 给伪元素留出位置 */
        }

        /* 使用伪元素添加✅标记，固定在链接前面 */
        .getallpages-extracted-link::before {
          content: '✅';
          position: absolute;
          left: -18px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          line-height: 1;
          z-index: 1000;
          background: white;
          padding: 1px 2px;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        /* 重复链接使用不同的标记 */
        .getallpages-duplicate-link::before {
          content: '✅🔄';
          left: -22px;
        }

        .getallpages-extracted-link:hover {
          background-color: rgba(34, 197, 94, 0.12) !important;
          border-left-color: rgba(34, 197, 94, 0.5);
          transform: translateX(1px);
        }

        .getallpages-extracted-link:hover::before {
          background: rgba(34, 197, 94, 0.1);
        }

        /* 为Apple Developer Documentation特殊优化 */
        .navigator-content .getallpages-extracted-link,
        .hierarchy-item .getallpages-extracted-link {
          margin: 1px 4px 1px 20px; /* 确保有足够的左边距 */
          width: auto;
          max-width: calc(100% - 24px); /* 减去标记的宽度 */
        }

        /* 确保在不同的容器中都能正确显示 */
        .sidebar .getallpages-extracted-link,
        .nav-sidebar .getallpages-extracted-link,
        .toc .getallpages-extracted-link {
          margin-left: 20px;
        }

        /* 处理嵌套链接的情况 */
        .getallpages-extracted-link .getallpages-extracted-link::before {
          display: none; /* 避免嵌套时重复显示标记 */
        }

        /* 确保标记在列表项中正确显示 */
        li .getallpages-extracted-link::before {
          left: -18px;
          margin-left: 0;
        }

        /* 响应式设计 - 在小屏幕上调整 */
        @media (max-width: 768px) {
          .getallpages-extracted-link {
            padding-left: 16px !important;
          }
          
          .getallpages-extracted-link::before {
            left: -14px;
            font-size: 10px;
          }
          
          .getallpages-duplicate-link::before {
            left: -18px;
          }
        }
      `
      document.head.appendChild(style)
    }
  }

  // 清除所有提取标记 - 更新为CSS类清理
  private clearExtractionIndicators() {
    // 清除带有标记类的链接
    const extractedLinks = document.querySelectorAll('.getallpages-extracted-link')
    extractedLinks.forEach((link) => {
      // 移除所有相关的类
      link.classList.remove('getallpages-extracted-link', 'getallpages-duplicate-link')

      // 清除title属性
      if (link.getAttribute('title')?.includes('有效链接')) {
        link.removeAttribute('title')
      }

      // 移除可能的内联样式
      if (link instanceof HTMLElement) {
        link.style.removeProperty('margin-left')
        link.style.removeProperty('padding-left')
      }
    })

    // 清除旧版本的文本标记（向后兼容）
    const linksWithTextIndicators = document.querySelectorAll('a[href]')
    linksWithTextIndicators.forEach((link) => {
      const currentText = link.textContent || ''
      if (currentText.includes('✅')) {
        // 移除✅和🔄标记以及后面的空格
        const cleanText = currentText.replace(/^✅🔄\s+|^✅\s+/, '')
        link.textContent = cleanText
      }
    })

    // 也清除旧版本的indicator元素（向后兼容）
    const oldIndicators = document.querySelectorAll('.getallpages-extracted-indicator')
    oldIndicators.forEach(indicator => indicator.remove())

    console.log('[GetAllPages] 已清除所有提取标记')
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

  // 启动区域选择模式
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

  // 启动DOM变化监听
  startDOMObserver(element: Element, onLinksChanged?: (newLinks: HTMLElement[]) => void) {
    console.log('[GetAllPages] 启动DOM变化监听器...')

    // 停止之前的观察器
    this.stopDOMObserver()

    this.observedElement = element

    if (onLinksChanged) {
      this.linkChangeCallbacks.push(onLinksChanged)
    }

    // 记录初始链接
    let previousLinks = this.findAllLinkElements(element)

    // 创建观察器
    this.domObserver = new MutationObserver((mutations) => {
      let hasStructuralChanges = false

      for (const mutation of mutations) {
        // 检查是否有新增的节点包含链接
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof Element) {
              const nodeLinks = this.findAllLinkElements(node)
              if (nodeLinks.length > 0) {
                hasStructuralChanges = true
                break
              }
            }
          }
        }

        if (hasStructuralChanges)
          break
      }

      // 如果检测到结构变化，重新检查链接
      if (hasStructuralChanges) {
        const currentLinks = this.findAllLinkElements(element)
        const newLinksCount = currentLinks.length - previousLinks.length

        if (newLinksCount > 0) {
          console.log(`[GetAllPages] DOM变化检测到 ${newLinksCount} 个新链接`)

          // 找出新增的链接
          const newLinks = currentLinks.filter(link => !previousLinks.includes(link))

          // 通知回调函数
          this.linkChangeCallbacks.forEach((callback) => {
            try {
              callback(newLinks)
            }
            catch (error) {
              console.warn('[GetAllPages] 链接变化回调执行失败:', error)
            }
          })

          previousLinks = currentLinks
        }
      }
    })

    // 开始观察
    this.domObserver.observe(element, {
      childList: true,
      subtree: true,
      attributes: false, // 我们主要关心结构变化，不是属性变化
    })

    console.log('[GetAllPages] DOM观察器已启动')
  }

  // 停止DOM变化监听
  stopDOMObserver() {
    if (this.domObserver) {
      this.domObserver.disconnect()
      this.domObserver = null
      this.observedElement = null
      this.linkChangeCallbacks = []
      console.log('[GetAllPages] DOM观察器已停止')
    }
  }

  // 添加链接变化回调
  addLinkChangeCallback(callback: (newLinks: HTMLElement[]) => void) {
    this.linkChangeCallbacks.push(callback)
  }

  // Apple文档专用优化处理
  private async optimizeForAppleDocs(element: Element): Promise<void> {
    if (!window.location.hostname.includes('apple.com')) {
      return
    }

    console.log('[GetAllPages] 开始Apple文档专用优化...')

    // 1. 特殊处理navigator展开
    await this.expandAppleNavigator(element)

    // 2. 触发Apple特有的懒加载
    await this.triggerAppleLazyLoad(element)

    // 3. 处理Apple的动态路由加载
    await this.handleAppleDynamicRoutes(element)

    console.log('[GetAllPages] Apple文档优化完成')
  }

  // 展开Apple导航器
  private async expandAppleNavigator(element: Element): Promise<void> {
    console.log('[GetAllPages] 展开Apple导航器...')

    // 查找所有可展开的导航项
    const expandableSelectors = [
      '.navigator-content [aria-expanded="false"]',
      '.hierarchy-item.closed',
      '.nav-tree-item.collapsed',
      '.documentation-topic-section.collapsed',
    ]

    for (const selector of expandableSelectors) {
      const items = element.querySelectorAll(selector)
      console.log(`[GetAllPages] 找到 ${items.length} 个 ${selector} 项`)

      for (const item of Array.from(items)) {
        try {
          if (item instanceof HTMLElement) {
            // 点击展开按钮
            const expandButton = item.querySelector('[aria-expanded="false"], .toggle, .expand-button')
            if (expandButton instanceof HTMLElement) {
              expandButton.click()
            }
            else {
              // 直接点击项目本身
              item.click()
            }

            // 等待展开动画
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
        catch {
          console.warn('[GetAllPages] 展开导航项失败')
        }
      }
    }
  }

  // 触发Apple的懒加载机制
  private async triggerAppleLazyLoad(element: Element): Promise<void> {
    console.log('[GetAllPages] 触发Apple懒加载机制...')

    // Apple文档可能使用IntersectionObserver进行懒加载
    // 我们需要让所有元素都进入视图
    const lazyElements = element.querySelectorAll('[data-lazy], [class*="lazy"], .not-loaded')

    for (const lazyElement of Array.from(lazyElements)) {
      try {
        // 滚动到元素位置以触发IntersectionObserver
        lazyElement.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      catch {
        console.warn('[GetAllPages] 触发懒加载失败')
      }
    }

    // 恢复到顶部
    element.scrollTop = 0
  }

  // 处理Apple的动态路由加载
  private async handleAppleDynamicRoutes(_element: Element): Promise<void> {
    console.log('[GetAllPages] 处理Apple动态路由...')

    // Apple文档可能通过Ajax加载内容
    // 我们监听网络请求并等待加载完成

    const initialLinkCount = _element.querySelectorAll('a[href]').length

    // 触发可能的Ajax加载
    const triggerElements = _element.querySelectorAll('[data-href], [onclick*="load"], [onclick*="fetch"]')

    for (const trigger of Array.from(triggerElements)) {
      try {
        if (trigger instanceof HTMLElement) {
          // 悬停触发
          trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
          await new Promise(resolve => setTimeout(resolve, 300))
          trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
        }
      }
      catch {
        console.warn('[GetAllPages] 动态路由触发失败')
      }
    }

    // 检查是否有新内容加载
    await new Promise(resolve => setTimeout(resolve, 1000))
    const finalLinkCount = _element.querySelectorAll('a[href]').length

    if (finalLinkCount > initialLinkCount) {
      console.log(`[GetAllPages] 动态路由加载了 ${finalLinkCount - initialLinkCount} 个新链接`)
    }
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
