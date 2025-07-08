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
