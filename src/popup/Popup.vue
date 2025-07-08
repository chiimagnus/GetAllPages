<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDocumentAnalyzer } from '~/composables/useDocumentAnalyzer'

const {
  isAnalyzing,
  isExtracting,
  currentStructure,
  extractionProgress,
  checkPageStructure,
  analyzeStructure,
  startExtraction,
  stopExtraction,
} = useDocumentAnalyzer()

const currentTab = ref<browser.tabs.Tab | null>(null)
const pageStatus = ref<'checking' | 'ready' | 'unsupported' | 'error'>('checking')
const statusMessage = ref('正在检查页面...')
const showProgress = ref(false)

onMounted(async () => {
  await checkCurrentPage()
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
  catch (error) {
    console.error('检查页面失败:', error)
    pageStatus.value = 'error'
    statusMessage.value = '检查页面失败'
  }
}

async function handleAnalyze() {
  if (!currentTab.value?.id)
    return

  try {
    const structure = await analyzeStructure(currentTab.value.id)
    if (structure) {
      statusMessage.value = `发现 ${structure.totalPages} 个页面`
    }
  }
  catch (error) {
    console.error('分析失败:', error)
    statusMessage.value = '分析失败，请重试'
  }
}

async function handleExtract() {
  if (!currentTab.value?.id || !currentStructure.value)
    return

  showProgress.value = true
  try {
    await startExtraction(currentStructure.value, currentTab.value.id)
    statusMessage.value = '提取完成！文件已下载'
  }
  catch (error) {
    console.error('提取失败:', error)
    statusMessage.value = '提取失败，请重试'
  }
  finally {
    showProgress.value = false
  }
}

function handleStop() {
  stopExtraction()
  showProgress.value = false
  statusMessage.value = '已停止提取'
}

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

function openHelp() {
  browser.tabs.create({
    url: 'https://github.com/your-username/GetAllPages#usage',
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
        文档剪藏工具
      </div>
    </div>

    <!-- Status -->
    <div
      class="p-3 rounded-lg border text-sm mb-4"
      :class="statusClass"
    >
      {{ statusMessage }}
    </div>

    <!-- Actions -->
    <div class="space-y-3 mb-5">
      <button
        class="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="pageStatus !== 'ready' || isAnalyzing"
        @click="handleAnalyze"
      >
        <span v-if="isAnalyzing">🔄 分析中...</span>
        <span v-else-if="currentStructure">🔄 重新分析</span>
        <span v-else>🔍 分析文档结构</span>
      </button>

      <button
        class="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        :disabled="!currentStructure || isExtracting"
        @click="handleExtract"
      >
        <span v-if="isExtracting">⏸️ 提取中...</span>
        <span v-else>📥 开始提取内容</span>
      </button>

      <button
        v-if="isExtracting"
        class="w-full py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        @click="handleStop"
      >
        ⏹️ 停止提取
      </button>

      <button
        class="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        @click="openOptionsPage"
      >
        ⚙️ 设置选项
      </button>
    </div>

    <!-- Progress -->
    <div v-if="showProgress" class="mb-4">
      <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }"
        />
      </div>
      <div class="text-xs text-gray-600 text-center">
        正在处理: {{ extractionProgress.currentPage }} ({{ extractionProgress.current }}/{{ extractionProgress.total }})
      </div>
    </div>

    <!-- Help Link -->
    <div class="text-center">
      <button
        class="text-xs text-gray-500 hover:text-blue-600 transition-colors"
        @click="openHelp"
      >
        使用帮助
      </button>
    </div>
  </main>
</template>
