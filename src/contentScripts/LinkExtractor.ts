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
import { StyleManager } from './StyleManager'
import { DOMObserver } from './DOMObserver'
import { AppleDocsOptimizer } from './AppleDocsOptimizer'

export class LinkExtractor {
  private styleManager: StyleManager
  private domObserver: DOMObserver
  private appleOptimizer: AppleDocsOptimizer

  constructor() {
    this.styleManager = StyleManager.getInstance()
    this.domObserver = new DOMObserver()
    this.appleOptimizer = new AppleDocsOptimizer()
  }

  /**
   * 从指定元素中提取链接 - 增强版本
   */
  async extractLinksFromElement(element: Element, source: string) {
    console.log(`[GetAllPages] 开始从 ${source} 提取链接...`)

    // 清除之前的标记
    this.styleManager.clearExtractionIndicators()

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
      const linkElements = findAllLinkElements(element)
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
    console.log(`  - 最终扫描链接: ${findAllLinkElements(element).length}`)
    console.log(`  - 有效链接: ${links.length}`)
    console.log(`  - 重复链接: ${processedUrls.size - links.length}`)

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
      if (!isValidDocumentLink(url)) {
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

      // 无论是否重复，都添加✅标记（因为它是有效链接）
      this.styleManager.addExtractionIndicator(linkElement, isDuplicate)
    }

    return newLinksCount
  }

  /**
   * 等待动态内容加载 - 增强版本
   */
  private async waitForDynamicContent(element: Element): Promise<void> {
    console.log('[GetAllPages] 开始触发动态内容加载...')

    // 记录初始链接数量
    const initialLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 初始链接数量: ${initialLinkCount}`)

    // 1. 启动DOM观察器
    this.domObserver.startDOMObserver(element, (newLinks) => {
      console.log(`[GetAllPages] DOM观察器发现 ${newLinks.length} 个新链接`)
    })

    // 2. Apple文档专用优化（优先执行）
    await this.appleOptimizer.optimizeForAppleDocs(element)

    // 3. 等待DOM稳定
    await this.domObserver.waitForDynamicContent(element)

    // 4. 最后一次强化触发（针对顽固的懒加载）
    if (window.location.hostname.includes('apple.com')) {
      console.log('[GetAllPages] 执行最后一轮Apple文档强化触发...')
      await this.appleOptimizer.finalAppleTrigger(element)
    }

    // 5. 记录最终链接数量
    const finalLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 动态加载完成，最终链接数量: ${finalLinkCount} (增加: ${finalLinkCount - initialLinkCount})`)
  }

  /**
   * 停止DOM观察器
   */
  stopDOMObserver() {
    this.domObserver.stopDOMObserver()
  }

  /**
   * 清除提取标记
   */
  clearExtractionIndicators() {
    this.styleManager.clearExtractionIndicators()
  }
}
