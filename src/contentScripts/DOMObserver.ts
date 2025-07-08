/* eslint-disable no-console */
/**
 * DOM观察器模块
 * 负责监听DOM变化和动态内容加载
 */

import { findAllLinkElements } from './utils'

export class DOMObserver {
  private domObserver: MutationObserver | null = null
  private linkChangeCallbacks: ((newLinks: HTMLElement[]) => void)[] = []

  /**
   * 启动DOM变化监听
   */
  startDOMObserver(element: Element, onLinksChanged?: (newLinks: HTMLElement[]) => void) {
    console.log('[GetAllPages] 启动DOM变化监听器...')

    // 停止之前的观察器
    this.stopDOMObserver()

    if (onLinksChanged) {
      this.linkChangeCallbacks.push(onLinksChanged)
    }

    // 记录初始链接
    let previousLinks = findAllLinkElements(element)

    // 创建观察器
    this.domObserver = new MutationObserver((mutations) => {
      let hasStructuralChanges = false

      for (const mutation of mutations) {
        // 检查是否有新增的节点包含链接
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof Element) {
              const nodeLinks = findAllLinkElements(node)
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
        const currentLinks = findAllLinkElements(element)
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

  /**
   * 停止DOM变化监听
   */
  stopDOMObserver() {
    if (this.domObserver) {
      this.domObserver.disconnect()
      this.domObserver = null
      this.linkChangeCallbacks = []
      console.log('[GetAllPages] DOM观察器已停止')
    }
  }

  /**
   * 添加链接变化回调
   */
  addLinkChangeCallback(callback: (newLinks: HTMLElement[]) => void) {
    this.linkChangeCallbacks.push(callback)
  }

  /**
   * 等待动态内容加载 - 增强版本
   */
  async waitForDynamicContent(element: Element): Promise<void> {
    console.log('[GetAllPages] 开始触发动态内容加载...')

    // 记录初始链接数量
    const initialLinkCount = element.querySelectorAll('a[href]').length
    console.log(`[GetAllPages] 初始链接数量: ${initialLinkCount}`)

    // 1. 启动DOM观察器
    this.startDOMObserver(element, (newLinks) => {
      console.log(`[GetAllPages] DOM观察器发现 ${newLinks.length} 个新链接`)
    })

    // 2. 创建DOM变化监听器用于检测稳定性
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
      // 3. 多轮滚动和交互触发
      await this.triggerLazyLoading(element)

      // 4. 等待DOM稳定 - 等待至少2秒内没有变化
      const maxWaitTime = 15000 // 增加最大等待时间到15秒
      const stableTime = 2000 // DOM稳定时间增加到2秒
      const startTime = Date.now()

      console.log('[GetAllPages] 等待DOM稳定...')

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 300))

        // 检查是否已经稳定
        if (Date.now() - lastChangeTime > stableTime) {
          console.log('[GetAllPages] DOM已稳定')
          break
        }
      }

      // 5. 记录最终链接数量
      const finalLinkCount = element.querySelectorAll('a[href]').length
      console.log(`[GetAllPages] 动态加载完成，最终链接数量: ${finalLinkCount} (增加: ${finalLinkCount - initialLinkCount})`)
    }
    finally {
      stabilityObserver.disconnect()
      // 保持DOM观察器继续运行，不在这里停止
    }
  }

  /**
   * 触发懒加载的具体策略
   */
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

  /**
   * 查找所有可滚动容器
   */
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

  /**
   * 彻底滚动容器
   */
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

  /**
   * 展开所有折叠项
   */
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

  /**
   * 触发悬停事件
   */
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

  /**
   * 模拟用户滚动行为
   */
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
}
