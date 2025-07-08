/* eslint-disable no-console */
/**
 * 链接提取器模块
 * 处理链接提取相关的所有逻辑
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
import { DOMObserver } from './DOMObserver'

export class LinkExtractor {
  private domObserver: DOMObserver

  constructor() {
    this.domObserver = new DOMObserver()
  }

  /**
   * 从指定元素中提取链接 - 优化版本
   */
  async extractLinksFromElement(element: Element, source: string) {
    console.log(`[GetAllPages] 开始从 ${source} 提取链接...`)

    // 快速动态内容加载（减少等待时间）
    await this.quickDynamicContentLoad(element)

    // 单轮高效检测
    const links: any[] = []
    const processedUrls = new Map<string, number>()

    console.log(`[GetAllPages] 开始链接检测...`)

    // 获取所有链接元素 - 使用优化的选择器
    const linkElements = findAllLinkElements(element)
    console.log(`[GetAllPages] 发现 ${linkElements.length} 个链接元素`)

    // 处理所有链接
    const validLinksFound = await this.processLinkElements(linkElements, source, processedUrls, links)

    // 输出最终统计信息
    console.log(`[GetAllPages] ${source} 提取完成:`)
    console.log(`  - 扫描链接: ${linkElements.length}`)
    console.log(`  - 有效链接: ${validLinksFound}`)
    console.log(`  - 重复链接: ${processedUrls.size - validLinksFound}`)

    return links
  }

  /**
   * 处理链接元素并提取有效链接
   */
  private async processLinkElements(
    linkElements: HTMLElement[],
    source: string,
    processedUrls: Map<string, number>,
    links: any[],
  ): Promise<number> {
    let newLinksCount = 0
    let processedCount = 0
    let urlFailCount = 0
    let textFailCount = 0
    let validationFailCount = 0

    console.log(`[GetAllPages] 开始处理 ${linkElements.length} 个链接元素...`)

    for (let index = 0; index < linkElements.length; index++) {
      const linkElement = linkElements[index]
      processedCount++

      // 提取URL
      const url = extractUrlFromElement(linkElement)
      if (!url) {
        urlFailCount++
        continue
      }

      // 获取链接文本
      const text = extractTextFromElement(linkElement)
      if (!text) {
        textFailCount++
        continue
      }

      // 解析为绝对URL
      const absoluteUrl = resolveUrl(url)

      // 验证链接有效性
      if (!isValidDocumentLink(url)) {
        validationFailCount++
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
          level: source === 'sidebar' ? getHierarchyLevel(linkElement) : 0,
          description: getLinkDescription(linkElement),
          context: getLinkContext(linkElement),
        }

        links.push(linkInfo)
        newLinksCount++
        console.log(`[GetAllPages] [${links.length}] 新增链接: ${text.substring(0, 50)}... -> ${absoluteUrl}`)
      }
    }

    // 输出详细统计信息
    console.log(`[GetAllPages] 链接处理统计:`)
    console.log(`  - 总处理: ${processedCount}`)
    console.log(`  - URL提取失败: ${urlFailCount}`)
    console.log(`  - 文本提取失败: ${textFailCount}`)
    console.log(`  - 验证失败: ${validationFailCount}`)
    console.log(`  - 有效链接: ${newLinksCount}`)

    return newLinksCount
  }

  /**
   * 快速动态内容加载 - 优化版本
   */
  private async quickDynamicContentLoad(element: Element): Promise<void> {
    console.log('[GetAllPages] 开始快速动态内容加载...')

    // 记录初始链接数量
    const initialLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 初始链接数量: ${initialLinkCount}`)

    // 1. 快速展开折叠项（减少等待时间）
    await this.quickExpandCollapsedItems(element)

    // 2. 简化的Apple文档优化
    if (window.location.hostname.includes('apple.com')) {
      await this.quickAppleOptimization(element)
    }

    // 3. 快速滚动触发懒加载
    await this.quickScrollTrigger(element)

    // 4. 短暂等待DOM稳定
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 5. 记录最终链接数量
    const finalLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 快速加载完成，最终链接数量: ${finalLinkCount} (增加: ${finalLinkCount - initialLinkCount})`)
  }

  /**
   * 快速展开折叠项
   */
  private async quickExpandCollapsedItems(element: Element): Promise<void> {
    const expandableItems = element.querySelectorAll('[aria-expanded="false"], .collapsed, details:not([open])')
    console.log(`[GetAllPages] 快速展开 ${expandableItems.length} 个折叠项`)

    for (const item of Array.from(expandableItems).slice(0, 50)) { // 限制数量，提高速度
      try {
        if (item instanceof HTMLElement) {
          item.click()
          if (item.tagName === 'DETAILS') {
            (item as HTMLDetailsElement).open = true
          }
        }
      }
      catch {
        // 忽略错误
      }
    }

    // 短暂等待
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  /**
   * 快速Apple文档优化
   */
  private async quickAppleOptimization(element: Element): Promise<void> {
    console.log('[GetAllPages] 快速Apple文档优化...')

    // 快速展开Apple导航器
    const appleExpandable = element.querySelectorAll('.navigator-content [aria-expanded="false"], .hierarchy-item.closed')
    for (const item of Array.from(appleExpandable).slice(0, 30)) { // 限制数量
      try {
        if (item instanceof HTMLElement) {
          item.click()
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      catch {
        // 忽略错误
      }
    }
  }

  /**
   * 快速滚动触发
   */
  private async quickScrollTrigger(element: Element): Promise<void> {
    console.log('[GetAllPages] 快速滚动触发...')

    // 快速滚动主要容器
    const scrollableContainers = [element, ...Array.from(element.querySelectorAll('.navigator-content, [class*="scroll"]'))]

    for (const container of scrollableContainers.slice(0, 5)) { // 限制数量
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTop = container.scrollHeight
        await new Promise(resolve => setTimeout(resolve, 100))
        container.scrollTop = 0
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }

  /**
   * 停止DOM观察器
   */
  stopDOMObserver() {
    this.domObserver.stopDOMObserver()
  }
}
