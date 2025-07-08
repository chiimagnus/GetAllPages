/* eslint-disable no-console */
/**
 * 样式管理模块
 * 负责管理所有CSS样式和视觉指示器
 */

export class StyleManager {
  private static instance: StyleManager | null = null

  private constructor() {}

  static getInstance(): StyleManager {
    if (!StyleManager.instance) {
      StyleManager.instance = new StyleManager()
    }
    return StyleManager.instance
  }

  /**
   * 在链接前面添加固定的提取成功标记 - 使用CSS伪元素
   */
  addExtractionIndicator(linkElement: HTMLElement, isDuplicate: boolean = false) {
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
    this.ensureIndicatorStyles()
  }

  /**
   * 清除所有提取标记 - 更新为CSS类清理
   */
  clearExtractionIndicators() {
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

  /**
   * 确保指示器样式已添加
   */
  private ensureIndicatorStyles() {
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

  /**
   * 添加选择模式样式
   */
  addSelectionStyles() {
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

  /**
   * 移除选择模式样式
   */
  removeSelectionStyles() {
    const style = document.getElementById('getallpages-selection-style')
    if (style) {
      style.remove()
    }
  }

  /**
   * 创建选择覆盖层
   */
  createSelectionOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.id = 'getallpages-selection-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
    `
    document.body.appendChild(overlay)
    return overlay
  }

  /**
   * 移除选择覆盖层
   */
  removeSelectionOverlay() {
    const overlay = document.getElementById('getallpages-selection-overlay')
    if (overlay) {
      overlay.remove()
    }
    // 移除所有高亮
    document.querySelectorAll('.getallpages-highlight').forEach((el) => {
      el.classList.remove('getallpages-highlight')
    })
  }
}
