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

  // 根据状态显示相应信息
  updateStatusMessage()

  // 监听来自background的消息（现在使用浏览器通知，不再需要这些消息监听）

  // 监听状态更新
  onMessage('stateUpdated', ({ data }) => {
    if (data && typeof data === 'object') {
      // 触发状态恢复以同步最新状态
      restoreGlobalState().then(() => {
        updateStatusMessage()
      })
    }
  })
})

// 更新状态消息的函数
function updateStatusMessage() {
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
  // 如果有完成的数据，显示完成信息
  else if (currentLinkData.value) {
    const { totalLinks } = currentLinkData.value.summary
    statusMessage.value = `✅ 分析完成！发现 ${totalLinks} 个链接并已自动保存为Markdown文件`
  }
}

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
    statusMessage.value = '🔄 智能分析进行中...'
    await extractPageLinksWithScrolling(currentTab.value.id)

    // 更新状态消息
    updateStatusMessage()
  }
  catch (error) {
    console.error('分析失败:', error)
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
    <div class="mb-5 text-center">
      <div class="mb-1 text-xl text-blue-600 font-bold">
        GetAllPages
      </div>
      <div class="text-sm text-gray-500">
        链接提取工具
      </div>
    </div>

    <!-- Status -->
    <div
      class="mb-4 border rounded-lg p-3 text-sm"
      :class="statusClass"
    >
      {{ statusMessage }}
    </div>

    <!-- 分析中的重要提示 -->
    <div v-if="isAnalyzing" class="mb-4 border border-yellow-200 rounded-lg bg-yellow-50 p-3">
      <div class="flex items-start space-x-2">
        <div class="text-lg text-yellow-600">
          ⚠️
        </div>
        <div class="text-sm text-yellow-800">
          <div class="mb-1 font-medium">
            重要提示
          </div>
          <div class="space-y-1">
            <div>• 请保持当前标签页处于活跃状态</div>
            <div>• 不要切换到其他标签页</div>
            <div>• 但可以正常切换到其他应用程序</div>
            <div class="mt-2 text-xs text-yellow-600">
              切换标签页可能导致分析结果不完整
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Link Statistics -->
    <div v-if="currentLinkData" class="mb-4 border border-blue-200 rounded-lg bg-blue-50 p-3">
      <div class="mb-2 text-blue-800 font-medium">
        📊 链接统计
      </div>
      <div class="text-sm text-blue-600 space-y-1">
        <div>侧边栏链接数: <span class="font-medium">{{ currentLinkData.summary.sidebarLinksCount }}</span></div>
        <div class="mt-2 text-xs text-blue-500">
          专注提取侧边栏导航链接，确保高质量结果
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="mb-5 space-y-3">
      <!-- 智能分析按钮 -->
      <button
        class="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium transition-colors disabled:cursor-not-allowed hover:bg-blue-700 disabled:opacity-50"
        :disabled="pageStatus !== 'ready' || isAnalyzing"
        @click="handleAnalyze"
      >
        <span v-if="isAnalyzing">🔄 智能分析中...</span>
        <span v-else>智能滚动分析页面链接</span>
      </button>

      <button
        class="w-full rounded-lg bg-gray-100 px-4 py-2 text-gray-700 font-medium transition-colors hover:bg-gray-200"
        @click="openOptionsPage"
      >
        ⚙️ 设置选项
      </button>
    </div>

    <!-- Help Link -->
    <div class="text-center">
      <button
        class="text-xs text-gray-500 transition-colors hover:text-blue-600"
        @click="openHelp"
      >
        GitHub开源地址
      </button>
    </div>
  </main>
</template>
