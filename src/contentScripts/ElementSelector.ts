/**
 * 元素选择器模块
 * 处理页面元素选择和高亮功能
 */

import { StyleManager } from './StyleManager'

export class ElementSelector {
  private isSelectionMode = false
  private selectedElements: Element[] = []
  private styleManager: StyleManager

  constructor() {
    this.styleManager = StyleManager.getInstance()
  }

  /**
   * 启动区域选择模式
   */
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

  /**
   * 停止区域选择模式
   */
  stopSelectionMode() {
    this.isSelectionMode = false
    this.removeSelectionListeners()
    this.removeSelectionOverlay()

    return {
      success: true,
      selectedCount: this.selectedElements.length,
    }
  }

  /**
   * 获取选中的元素
   */
  getSelectedElements(): Element[] {
    return this.selectedElements
  }

  /**
   * 创建选择覆盖层
   */
  private createSelectionOverlay() {
    this.styleManager.createSelectionOverlay()
  }

  /**
   * 移除选择覆盖层
   */
  private removeSelectionOverlay() {
    this.styleManager.removeSelectionOverlay()
  }

  /**
   * 添加选择事件监听器
   */
  private addSelectionListeners() {
    document.addEventListener('mouseover', this.handleMouseOver)
    document.addEventListener('click', this.handleClick)
    document.addEventListener('keydown', this.handleKeyDown)

    // 添加样式
    this.styleManager.addSelectionStyles()
  }

  /**
   * 移除选择事件监听器
   */
  private removeSelectionListeners() {
    document.removeEventListener('mouseover', this.handleMouseOver)
    document.removeEventListener('click', this.handleClick)
    document.removeEventListener('keydown', this.handleKeyDown)

    // 移除样式
    this.styleManager.removeSelectionStyles()
  }

  /**
   * 鼠标悬停处理
   */
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

  /**
   * 点击处理
   */
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

  /**
   * 键盘处理
   */
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
}
