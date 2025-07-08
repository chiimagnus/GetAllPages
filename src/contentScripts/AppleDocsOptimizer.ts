/* eslint-disable no-console */
/**
 * Apple文档优化模块
 * 专门处理Apple文档的特殊优化逻辑
 */

export class AppleDocsOptimizer {
  /**
   * Apple文档专用优化处理
   */
  async optimizeForAppleDocs(element: Element): Promise<void> {
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

  /**
   * 最后一轮Apple文档强化触发
   */
  async finalAppleTrigger(element: Element): Promise<void> {
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

  /**
   * 展开Apple导航器
   */
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

  /**
   * 触发Apple的懒加载机制
   */
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

  /**
   * 处理Apple的动态路由加载
   */
  private async handleAppleDynamicRoutes(element: Element): Promise<void> {
    console.log('[GetAllPages] 处理Apple动态路由...')

    // Apple文档可能通过Ajax加载内容
    // 我们监听网络请求并等待加载完成

    const initialLinkCount = element.querySelectorAll('a[href]').length

    // 触发可能的Ajax加载
    const triggerElements = element.querySelectorAll('[data-href], [onclick*="load"], [onclick*="fetch"]')

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
    const finalLinkCount = element.querySelectorAll('a[href]').length

    if (finalLinkCount > initialLinkCount) {
      console.log(`[GetAllPages] 动态路由加载了 ${finalLinkCount - initialLinkCount} 个新链接`)
    }
  }
}
