/* eslint-disable no-console */
/**
 * 通用工具函数模块
 */

/**
 * 验证是否为有效的文档链接 - 优化版本（更宽松）
 */
export function isValidDocumentLink(href: string): boolean {
  // 排除明显无效的链接
  if (!href || href.trim() === '') {
    console.log(`[GetAllPages] 链接验证失败: 空链接`)
    return false
  }

  // 只排除明显无用的链接类型
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    console.log(`[GetAllPages] 链接验证失败: 特殊协议链接 - ${href}`)
    return false
  }

  // 排除纯锚点链接（但允许带路径的锚点）
  if (href === '#' || (href.startsWith('#') && href.length < 3)) {
    console.log(`[GetAllPages] 链接验证失败: 纯锚点链接 - ${href}`)
    return false
  }

  // 排除明显的资源文件（但保留可能的文档文件）
  const resourceExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf']
  const lowerHref = href.toLowerCase()
  if (resourceExtensions.some(ext => lowerHref.endsWith(ext))) {
    console.log(`[GetAllPages] 链接验证失败: 资源文件 - ${href}`)
    return false
  }

  // 对于Apple Developer Documentation，采用非常宽松的策略
  if (window.location.hostname.includes('apple.com')) {
    console.log(`[GetAllPages] 链接验证通过: Apple文档链接 - ${href}`)
    return true // 几乎接受所有链接
  }

  // 对于其他网站，也采用宽松策略
  if (href.startsWith('http')) {
    // 检查是否为同域名或子域名
    try {
      const linkUrl = new URL(href)
      const currentUrl = new URL(window.location.href)
      // 允许同域名和子域名
      const isValid = linkUrl.hostname === currentUrl.hostname
        || linkUrl.hostname.endsWith(`.${currentUrl.hostname}`)
        || currentUrl.hostname.endsWith(`.${linkUrl.hostname}`)

      if (isValid) {
        console.log(`[GetAllPages] 链接验证通过: 同域名链接 - ${href}`)
      }
      else {
        console.log(`[GetAllPages] 链接验证失败: 跨域名链接 - ${href}`)
      }
      return isValid
    }
    catch {
      console.log(`[GetAllPages] 链接验证失败: URL解析错误 - ${href}`)
      return false
    }
  }

  // 相对链接和锚点链接都认为是有效的
  console.log(`[GetAllPages] 链接验证通过: 相对链接 - ${href}`)
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
 * 从元素中提取URL - 优化版本
 */
export function extractUrlFromElement(element: HTMLElement): string | null {
  // 1. 标准href属性（最常见）
  let url = element.getAttribute('href')
  if (url && url.trim()) {
    return url.trim()
  }

  // 2. 检查是否是a标签但没有href（可能通过JS动态添加）
  if (element.tagName === 'A') {
    // 检查是否有文本内容看起来像URL
    const text = element.textContent?.trim()
    if (text && (text.startsWith('http') || text.startsWith('/') || text.includes('.'))) {
      return text
    }
  }

  // 3. 数据属性
  const dataAttrs = ['data-href', 'data-url', 'data-link', 'data-src', 'data-target']
  for (const attr of dataAttrs) {
    url = element.getAttribute(attr)
    if (url && url.trim()) {
      return url.trim()
    }
  }

  // 4. onclick事件中的URL
  const onclick = element.getAttribute('onclick')
  if (onclick) {
    // 匹配各种JavaScript跳转模式
    const patterns = [
      /(?:location\.href|window\.location)\s*=\s*['"`]([^'"`]+)['"`]/,
      /window\.open\s*\(\s*['"`]([^'"`]+)['"`]/,
      /href\s*=\s*['"`]([^'"`]+)['"`]/,
      /['"`]((?:https?:)?\/\/[^'"`\s]+)['"`]/,
      /['"`]([^'"`]+\.(?:html|htm|php|jsp|asp|aspx)[^'"`]*)['"`]/,
    ]

    for (const pattern of patterns) {
      const match = onclick.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  }

  // 5. 检查父元素是否是链接
  const parentLink = element.closest('a[href]')
  if (parentLink) {
    const parentHref = parentLink.getAttribute('href')
    if (parentHref && parentHref.trim()) {
      return parentHref.trim()
    }
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
 * 查找所有类型的链接元素 - 优化版本
 */
export function findAllLinkElements(element: Element): HTMLElement[] {
  // 优先使用最常见和最可靠的选择器
  const primarySelectors = [
    'a[href]', // 标准链接 - 最重要
    'a', // 所有a标签（可能有href通过JS添加）
  ]

  // 次要选择器（可能包含链接的元素）
  const secondarySelectors = [
    '[data-href]', // 数据链接
    '[data-url]', // 数据URL
    '[role="link"]', // ARIA链接
    '.nav-link', // 导航链接类
    '[onclick*="location"]', // JavaScript跳转
    '[onclick*="href"]', // JavaScript链接
  ]

  const allElements: HTMLElement[] = []
  const seenElements = new Set<HTMLElement>()

  // 首先处理主要选择器
  for (const selector of primarySelectors) {
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
      console.warn(`[GetAllPages] 主选择器错误: ${selector}`, error)
    }
  }

  // 然后处理次要选择器
  for (const selector of secondarySelectors) {
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
      console.warn(`[GetAllPages] 次选择器错误: ${selector}`, error)
    }
  }

  console.log(`[GetAllPages] 找到 ${allElements.length} 个潜在链接元素`)
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
