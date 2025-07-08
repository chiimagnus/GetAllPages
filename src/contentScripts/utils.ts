/* eslint-disable no-console */
/**
 * 通用工具函数模块
 */

/**
 * 验证是否为有效的文档链接
 */
export function isValidDocumentLink(href: string): boolean {
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

/**
 * 解析相对URL为绝对URL
 */
export function resolveUrl(href: string): string {
  if (href.startsWith('http')) {
    return href
  }
  return new URL(href, window.location.href).href
}

/**
 * 获取基础URL
 */
export function getBaseUrl(): string {
  return `${window.location.protocol}//${window.location.host}`
}

/**
 * 获取层级级别
 */
export function getHierarchyLevel(linkElement: Element): number {
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

/**
 * 从元素中提取URL
 */
export function extractUrlFromElement(element: HTMLElement): string | null {
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

/**
 * 从元素中提取文本
 */
export function extractTextFromElement(element: HTMLElement): string | null {
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

/**
 * 获取链接的描述信息
 */
export function getLinkDescription(linkElement: Element): string {
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

/**
 * 获取链接的上下文信息
 */
export function getLinkContext(linkElement: Element): string {
  // 获取链接周围的文本内容作为上下文
  const parent = linkElement.parentElement
  if (parent) {
    const context = parent.textContent?.trim() || ''
    // 限制上下文长度
    return context.length > 200 ? `${context.substring(0, 200)}...` : context
  }
  return ''
}

/**
 * 查找所有类型的链接元素
 */
export function findAllLinkElements(element: Element): HTMLElement[] {
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

/**
 * 验证侧边栏是否有效
 */
export function isValidSidebar(element: Element): boolean {
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

/**
 * 验证内容区域是否有效
 */
export function isValidContent(element: Element): boolean {
  const textContent = element.textContent?.trim() || ''
  return textContent.length > 100 // 内容长度大于100字符
}
