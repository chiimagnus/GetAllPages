# ContentScripts 模块说明

本目录包含了重构后的内容脚本模块，将原来1376行的单一文件拆分为多个功能模块，确保每个文件职责单一化、组件化。

## 文件结构

### 主入口文件
- **`index.ts`** - 主入口文件，负责初始化和消息监听

### 核心模块
- **`DocumentAnalyzer.ts`** - 文档分析器主类，协调各个模块的功能，提供统一的API接口
- **`LinkExtractor.ts`** - 链接提取器模块，处理链接提取相关的所有逻辑
- **`ElementSelector.ts`** - 元素选择器模块，处理页面元素选择和高亮功能
- **`DOMObserver.ts`** - DOM观察器模块，负责监听DOM变化和动态内容加载
- **`AppleDocsOptimizer.ts`** - Apple文档优化模块，专门处理Apple文档的特殊优化逻辑
- **`StyleManager.ts`** - 样式管理模块，负责管理所有CSS样式和视觉指示器
- **`utils.ts`** - 工具函数模块，包含所有通用的工具函数

## 模块职责

### DocumentAnalyzer (主协调器)
- 协调各个子模块的功能
- 提供统一的API接口
- 处理页面结构检查和分析
- 管理侧边栏和内容区域的查找

### LinkExtractor (链接提取)
- 从指定元素中提取链接
- 处理多轮检测以捕获动态加载的链接
- 管理链接去重和验证
- 协调DOM观察器和Apple优化器

### ElementSelector (元素选择)
- 处理用户交互式选择页面区域
- 管理选择模式的开启和关闭
- 处理鼠标悬停和点击事件
- 管理选择状态的视觉反馈

### DOMObserver (DOM监听)
- 监听DOM变化
- 触发懒加载策略
- 处理动态内容加载
- 管理滚动和交互事件

### AppleDocsOptimizer (Apple优化)
- 专门针对Apple文档的优化
- 处理Apple特有的导航展开
- 触发Apple的懒加载机制
- 处理动态路由加载

### StyleManager (样式管理)
- 管理所有CSS样式
- 处理链接提取标记的添加和清除
- 管理选择模式的视觉样式
- 提供统一的样式接口

### utils (工具函数)
- 提供通用的工具函数
- URL处理和验证
- 文本提取和处理
- 元素查找和验证

## 设计原则

1. **单一职责原则** - 每个模块只负责一个特定的功能领域
2. **依赖注入** - 通过构造函数注入依赖，便于测试和维护
3. **接口统一** - 通过DocumentAnalyzer提供统一的对外接口
4. **模块化** - 每个模块可以独立开发和测试
5. **可扩展性** - 新功能可以通过添加新模块或扩展现有模块实现

## 使用方式

```typescript
// 在index.ts中初始化
const analyzer = new DocumentAnalyzer()

// 通过analyzer调用各种功能
analyzer.checkPageStructure(sidebarSelectors, contentSelectors)
analyzer.analyzeStructure(sidebarSelectors, contentSelectors)
analyzer.extractPageLinks(sidebarSelectors, contentSelectors)
analyzer.startSelectionMode()
analyzer.extractLinksFromSelectedElements()
```

## 优势

1. **可维护性** - 代码结构清晰，易于理解和修改
2. **可测试性** - 每个模块可以独立测试
3. **可复用性** - 工具函数和独立模块可以在其他地方复用
4. **可扩展性** - 新功能可以通过添加新模块实现
5. **性能** - 按需加载和模块化设计提高了性能
