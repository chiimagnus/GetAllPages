<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onMessage } from 'webext-bridge/popup'
import { useDocumentAnalyzer } from '~/composables/useDocumentAnalyzer'

const {
  isAnalyzing,
  isExtracting,
  currentLinkData,
  lastError,
  restoreGlobalState,
  checkPageStructure,
  extractPageLinksWithScrolling,
} = useDocumentAnalyzer()

const currentTab = ref<browser.tabs.Tab | null>(null)
const pageStatus = ref<'checking' | 'ready' | 'unsupported' | 'error'>('checking')
const statusMessage = ref('正在检查页面...')

onMounted(async () => {
  // 首先恢复全局状态
  await restoreGlobalState()

  await checkCurrentPage()

  // 如果有错误状态，显示错误信息
  if (lastError.value) {
    statusMessage.value = `❌ ${lastError.value}`
  }
  // 如果正在分析，显示分析状态
  else if (isAnalyzing.value) {
    statusMessage.value = '🔄 智能分析进行中...'
  }
  // 如果正在提取，显示提取状态
  else if (isExtracting.value) {
    statusMessage.value = '⏸️ 文件生成中...'
  }

  // 监听来自background的消息
  onMessage('operationSuccess', ({ data }) => {
    if (data && typeof data === 'object' && 'message' in data) {
      statusMessage.value = data.message as string
    }
  })

  onMessage('operationError', ({ data }) => {
    if (data && typeof data === 'object' && 'message' in data) {
      statusMessage.value = `错误: ${data.message}`
    }
  })
})

async function checkCurrentPage() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    currentTab.value = tab

    if (!tab.id) {
      pageStatus.value = 'error'
      statusMessage.value = '无法访问当前页面'
      return
    }

    const result = await checkPageStructure(tab.id)

    if (result.supported) {
      pageStatus.value = 'ready'
      statusMessage.value = '准备就绪 - 检测到可解析的文档结构'
    }
    else {
      pageStatus.value = 'unsupported'
      statusMessage.value = '当前页面不支持解析'
    }
  }
  catch {
    pageStatus.value = 'error'
    statusMessage.value = '检查页面失败'
  }
}

async function handleAnalyze() {
  if (!currentTab.value?.id)
    return

  try {
    statusMessage.value = '🔄 开始智能滚动分析...'
    const linkData = await extractPageLinksWithScrolling(currentTab.value.id)
    if (linkData) {
      const { totalLinks } = linkData.summary
      statusMessage.value = `✅ 分析完成！发现 ${totalLinks} 个链接并已自动保存为Markdown文件`
    }
  }
  catch {
    statusMessage.value = '❌ 分析失败，请重试'
  }
}

function openOptionsPage() {
  // 暂时禁用options页面，因为还没有创建
  statusMessage.value = '设置功能即将推出'
}

function openHelp() {
  browser.tabs.create({
    url: 'https://github.com/chiimagnus/GetAllPages',
  })
}

const statusClass = computed(() => {
  switch (pageStatus.value) {
    case 'ready': return 'bg-green-50 text-green-700 border-green-200'
    case 'checking': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'unsupported':
    case 'error': return 'bg-red-50 text-red-700 border-red-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
})
</script>

<template>
  <main class="w-[350px] p-5 text-gray-700">
    <!-- Header -->
    <div class="text-center mb-5">
      <div class="text-xl font-bold text-blue-600 mb-1">
        GetAllPages
      </div>
      <div class="text-sm text-gray-500">
        链接提取工具
      </div>
    </div>

    <!-- Status -->
    <div
      class="p-3 rounded-lg border text-sm mb-4"
      :class="statusClass"
    >
      {{ statusMessage }}
    </div>

    <!-- Link Statistics -->
    <div v-if="currentLinkData" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div class="text-blue-800 font-medium mb-2">
        📊 链接统计
      </div>
      <div class="text-blue-600 text-sm space-y-1">
        <div>侧边栏链接数: <span class="font-medium">{{ currentLinkData.summary.sidebarLinksCount }}</span></div>
        <div class="text-xs text-blue-500 mt-2">
          专注提取侧边栏导航链接，确保高质量结果
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="space-y-3 mb-5">
      <!-- 智能分析按钮 -->
      <button
        class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="pageStatus !== 'ready' || isAnalyzing"
        @click="handleAnalyze"
      >
        <span v-if="isAnalyzing">🔄 智能分析中...</span>
        <span v-else>智能滚动分析页面链接</span>
      </button>

      <button
        class="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        @click="openOptionsPage"
      >
        ⚙️ 设置选项
      </button>
    </div>

    <!-- Help Link -->
    <div class="text-center">
      <button
        class="text-xs text-gray-500 hover:text-blue-600 transition-colors"
        @click="openHelp"
      >
        GitHub开源地址
      </button>
    </div>
  </main>
</template>
