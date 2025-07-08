/* eslint-disable no-console */
/**
 * 滚动链接提取器
 * 实现边滚动边提取链接的功能，适用于懒加载页面
 */

import {
  extractTextFromElement,
  extractUrlFromElement,
  findAllLinkElements,
  getHierarchyLevel,
  getLinkContext,
  getLinkDescription,
  isValidDocumentLink,
  resolveUrl,
} from './utils'

export interface ScrollingExtractorOptions {
  /** 滚动间隔时间（毫秒） */
  scrollInterval?: number
  /** 每次滚动的距离（像素） */
  scrollStep?: number
  /** 滚动后等待时间（毫秒） */
  waitAfterScroll?: number
  /** 最大滚动次数 */
  maxScrolls?: number
  /** 检测到底部后的额外等待时间（毫秒） */
  bottomWaitTime?: number
  /** 进度回调函数 */
  onProgress?: (progress: ScrollingProgress) => void
}

export interface ScrollingProgress {
  /** 当前滚动位置 */
  currentScroll: number
  /** 总滚动高度 */
  totalHeight: number
  /** 已提取的链接数量 */
  extractedLinks: number
  /** 新增的链接数量 */
  newLinks: number
  /** 是否到达底部 */
  reachedBottom: boolean
  /** 滚动进度百分比 */
  progressPercent: number
}

export interface ExtractedLink {
  id: string
  title: string
  url: string
  source: string
  level: number
  description: string
  context: string
  extractedAt: number
}

export class ScrollingLinkExtractor {
  private isExtracting = false
  private extractedUrls = new Map<string, ExtractedLink>()
  private options: Required<ScrollingExtractorOptions>
  private abortController: AbortController | null = null

  constructor(options: ScrollingExtractorOptions = {}) {
    this.options = {
      scrollInterval: 500,
      scrollStep: 300,
      waitAfterScroll: 800,
      maxScrolls: 100,
      bottomWaitTime: 2000,
      onProgress: () => {},
      ...options,
    }
  }

  /**
   * 开始滚动提取链接
   */
  async startScrollingExtraction(element: Element, source: string): Promise<ExtractedLink[]> {
    if (this.isExtracting) {
      throw new Error('正在进行滚动提取，请等待完成')
    }

    this.isExtracting = true
    this.extractedUrls.clear()
    this.abortController = new AbortController()

    console.log(`[ScrollingExtractor] 开始滚动提取链接: ${source}`)

    try {
      // 首先提取当前可见的链接
      await this.extractCurrentLinks(element, source)

      // 开始滚动提取
      await this.performScrollingExtraction(element, source)

      // 返回所有提取的链接
      const allLinks = Array.from(this.extractedUrls.values())
      console.log(`[ScrollingExtractor] 滚动提取完成，总共提取 ${allLinks.length} 个链接`)

      return allLinks
    }
    catch (error) {
      console.error('[ScrollingExtractor] 滚动提取失败:', error)
      throw error
    }
    finally {
      this.isExtracting = false
      this.abortController = null
    }
  }

  /**
   * 停止滚动提取
   */
  stopExtraction() {
    if (this.abortController) {
      this.abortController.abort()
      console.log('[ScrollingExtractor] 滚动提取已停止')
    }
  }

  /**
   * 获取当前提取的链接数量
   */
  getExtractedCount(): number {
    return this.extractedUrls.size
  }

  /**
   * 提取当前可见的链接
   */
  private async extractCurrentLinks(element: Element, source: string): Promise<void> {
    console.log('[ScrollingExtractor] 提取当前可见链接...')

    const linkElements = findAllLinkElements(element)
    const newLinksCount = await this.processLinkElements(linkElements, source)

    console.log(`[ScrollingExtractor] 初始提取完成，发现 ${newLinksCount} 个新链接`)
  }

  /**
   * 执行滚动提取
   */
  private async performScrollingExtraction(element: Element, source: string): Promise<void> {
    const scrollableElement = this.findScrollableElement(element)
    if (!scrollableElement) {
      console.log('[ScrollingExtractor] 未找到可滚动元素，跳过滚动提取')
      return
    }

    console.log('[ScrollingExtractor] 开始滚动提取...')

    let scrollCount = 0
    let lastScrollTop = scrollableElement.scrollTop
    let stableScrollCount = 0
    const maxStableScrolls = 3 // 连续3次滚动位置不变则认为到底

    while (scrollCount < this.options.maxScrolls && !this.abortController?.signal.aborted) {
      // 滚动到下一个位置
      const targetScroll = scrollableElement.scrollTop + this.options.scrollStep
      scrollableElement.scrollTop = targetScroll

      // 等待内容加载
      await this.sleep(this.options.waitAfterScroll)

      // 检查是否到达底部
      const currentScrollTop = scrollableElement.scrollTop
      const isAtBottom = currentScrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 10

      // 检查滚动位置是否变化
      if (Math.abs(currentScrollTop - lastScrollTop) < 5) {
        stableScrollCount++
        if (stableScrollCount >= maxStableScrolls || isAtBottom) {
          console.log('[ScrollingExtractor] 到达底部或无法继续滚动')
          break
        }
      }
      else {
        stableScrollCount = 0
      }

      lastScrollTop = currentScrollTop
      scrollCount++

      // 提取新出现的链接
      const linkElements = findAllLinkElements(element)
      const newLinksCount = await this.processLinkElements(linkElements, source)

      // 报告进度
      const progress: ScrollingProgress = {
        currentScroll: currentScrollTop,
        totalHeight: scrollableElement.scrollHeight,
        extractedLinks: this.extractedUrls.size,
        newLinks: newLinksCount,
        reachedBottom: isAtBottom,
        progressPercent: Math.min(100, (currentScrollTop / (scrollableElement.scrollHeight - scrollableElement.clientHeight)) * 100),
      }

      this.options.onProgress(progress)

      if (newLinksCount > 0) {
        console.log(`[ScrollingExtractor] 滚动 ${scrollCount}: 新增 ${newLinksCount} 个链接，总计 ${this.extractedUrls.size} 个`)
      }

      // 等待下次滚动
      await this.sleep(this.options.scrollInterval)
    }

    // 到达底部后额外等待，确保所有内容加载完成
    if (scrollCount > 0) {
      console.log('[ScrollingExtractor] 到达底部，等待最终内容加载...')
      await this.sleep(this.options.bottomWaitTime)

      // 最后一次提取
      const linkElements = findAllLinkElements(element)
      const finalNewLinks = await this.processLinkElements(linkElements, source)
      if (finalNewLinks > 0) {
        console.log(`[ScrollingExtractor] 最终提取: 新增 ${finalNewLinks} 个链接`)
      }
    }
  }

  /**
   * 查找可滚动元素
   */
  private findScrollableElement(element: Element): Element | null {
    // 首先检查元素本身是否可滚动
    if (element.scrollHeight > element.clientHeight) {
      return element
    }

    // 查找子元素中的可滚动容器
    const scrollableSelectors = [
      '.navigator-content',
      '[class*="scroll"]',
      '[style*="overflow"]',
      '.sidebar-content',
      '.nav-content',
    ]

    for (const selector of scrollableSelectors) {
      const scrollableElement = element.querySelector(selector)
      if (scrollableElement && scrollableElement.scrollHeight > scrollableElement.clientHeight) {
        return scrollableElement
      }
    }

    // 如果都没找到，尝试查找任何有滚动条的元素
    const allElements = element.querySelectorAll('*')
    for (const el of Array.from(allElements)) {
      if (el.scrollHeight > el.clientHeight) {
        return el
      }
    }

    return null
  }

  /**
   * 处理链接元素并提取有效链接
   */
  private async processLinkElements(linkElements: HTMLElement[], source: string): Promise<number> {
    let newLinksCount = 0

    for (let index = 0; index < linkElements.length; index++) {
      const linkElement = linkElements[index]

      // 提取URL
      const url = extractUrlFromElement(linkElement)
      if (!url)
        continue

      // 获取链接文本
      const text = extractTextFromElement(linkElement)
      if (!text)
        continue

      // 解析为绝对URL
      const absoluteUrl = resolveUrl(url)

      // 验证链接有效性
      if (!isValidDocumentLink(url))
        continue

      // 检查是否重复
      if (this.extractedUrls.has(absoluteUrl))
        continue

      // 创建链接信息
      const linkInfo: ExtractedLink = {
        id: `${source}_link_${this.extractedUrls.size}`,
        title: text,
        url: absoluteUrl,
        source,
        level: source === 'sidebar' ? getHierarchyLevel(linkElement) : 0,
        description: getLinkDescription(linkElement),
        context: getLinkContext(linkElement),
        extractedAt: Date.now(),
      }

      this.extractedUrls.set(absoluteUrl, linkInfo)
      newLinksCount++
    }

    return newLinksCount
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取所有已提取的链接
   */
  getAllExtractedLinks(): ExtractedLink[] {
    return Array.from(this.extractedUrls.values())
  }

  /**
   * 清除已提取的链接
   */
  clearExtractedLinks(): void {
    this.extractedUrls.clear()
  }

  /**
   * 检查是否正在提取
   */
  isCurrentlyExtracting(): boolean {
    return this.isExtracting
  }
}
