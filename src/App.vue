<script setup>
import StockHeatmap from './components/StockHeatmap.vue'
import { ref, onMounted, onUnmounted } from 'vue';
import { fetchMarketIndices } from './services/stockApi';

const searchQuery = ref('');
const indices = ref([]);
const selectedStock = ref(null);
const showDrawer = ref(false);
const activeTab = ref('min'); // 'min' (分时图) or 'daily' (日K线)
const lastUpdatedTime = ref('--:--:--');
const heatmapRef = ref(null);
const isRefreshing = ref(false);

let indicesTimer = null;

const loadIndices = async () => {
  try {
    const data = await fetchMarketIndices();
    if (data && data.length > 0) {
      indices.value = data;
    }
  } catch (error) {
    console.error('Failed to load indices:', error);
  }
};

const handleDataLoaded = (time) => {
  lastUpdatedTime.value = time;
  isRefreshing.value = false;
};

const triggerManualRefresh = () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  loadIndices();
  if (heatmapRef.value) {
    heatmapRef.value.triggerManualRefresh();
  }
};

const handleSelectStock = (stock) => {
  selectedStock.value = stock;
  showDrawer.value = true;
  activeTab.value = 'min'; // Reset to minutely chart when opening new stock
};

const getMarketPrefix = (code) => {
  if (!code) return '';
  if (code.startsWith('60') || code.startsWith('68') || code.startsWith('90') || code.startsWith('11') || code.startsWith('5')) {
    return 'sh';
  } else if (code.startsWith('00') || code.startsWith('30') || code.startsWith('20') || code.startsWith('12') || code.startsWith('08')) {
    return 'sz';
  } else if (code.startsWith('43') || code.startsWith('83') || code.startsWith('87') || code.startsWith('88')) {
    return 'bj';
  }
  return 'sh'; // Fallback
};

const getChartUrl = (code, type) => {
  if (!code) return '';
  const market = getMarketPrefix(code);
  const path = type === 'min' ? 'min' : 'daily';
  // Use Sina image chart API (adds random query to bypass cache)
  return `https://image.sinajs.cn/newchart/${path}/n/${market}${code}.gif?t=${Date.now()}`;
};

const getQuoteLink = (code, site) => {
  if (!code) return '#';
  const market = getMarketPrefix(code);
  if (site === 'eastmoney') {
    return `https://quote.eastmoney.com/${market}${code}.html`;
  } else if (site === 'xueqiu') {
    return `https://xueqiu.com/S/${market.toUpperCase()}${code}`;
  } else if (site === 'sina') {
    return `https://finance.sina.com.cn/realstock/company/${market}${code}/nc.shtml`;
  }
  return '#';
};

const copyStockCode = (code) => {
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    alert(`股票代码 ${code} 已复制到剪贴板`);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
};

onMounted(() => {
  loadIndices();
  // Refresh indices every 30 seconds
  indicesTimer = setInterval(() => {
    loadIndices();
  }, 30000);
});

onUnmounted(() => {
  if (indicesTimer) clearInterval(indicesTimer);
});
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[#080d1a] text-slate-100 overflow-hidden font-sans selection:bg-red-500/30">
    <!-- Header -->
    <header class="flex-none h-16 bg-[#0f172a]/95 border-b border-slate-800/60 flex items-center px-4 sm:px-6 z-20 absolute top-0 left-0 right-0">
      <div class="flex items-center gap-2 sm:gap-3 mr-4 sm:mr-8">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/10 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        </div>
        <div>
          <h1 class="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap leading-none flex items-center gap-2">
            A股实时大盘云图
            <span class="hidden md:inline text-[10px] text-red-400 font-medium px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">Real-Time</span>
          </h1>
        </div>
      </div>
      
      <!-- Search Bar -->
      <div class="relative max-w-xs sm:max-w-sm w-full group">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-4 w-4 text-slate-500 group-focus-within:text-red-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索 股票代码 / 名称..." 
          class="block w-full pl-9 pr-3 py-1.5 border border-slate-800/80 rounded-xl leading-5 bg-slate-900/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-900 focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 text-xs sm:text-sm transition-all duration-200"
        />
      </div>

      <!-- Actions & Refresh -->
      <div class="ml-auto flex items-center gap-3 sm:gap-4">
        <div class="text-[11px] text-slate-400 hidden lg:flex flex-col items-end">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="font-medium text-slate-300">更新时间: {{ lastUpdatedTime }}</span>
          </div>
          <span class="text-[10px] text-slate-500">自动刷新: 1分钟</span>
        </div>
        
        <button 
          @click="triggerManualRefresh"
          class="bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80 p-2 rounded-xl text-slate-300 hover:text-white transition-all shadow-md flex items-center justify-center"
          :class="{ 'pointer-events-none opacity-50': isRefreshing }"
          title="手动刷新数据"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            class="h-4 w-4" 
            :class="{ 'animate-spin': isRefreshing }"
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Index Bar (上海, 深圳, 创业板) -->
    <div class="absolute top-16 left-0 right-0 h-11 bg-[#0b1224] border-b border-slate-800/50 flex items-center px-4 sm:px-6 overflow-x-auto flex-nowrap scrollbar-none z-10 gap-4 sm:gap-6">
      <div 
        v-for="index in indices" 
        :key="index.f57" 
        class="flex items-center gap-2 whitespace-nowrap text-xs border-r border-slate-800/40 pr-4 sm:pr-6 last:border-0"
      >
        <span class="text-slate-400 font-medium">{{ index.f58 }}</span>
        <span class="font-bold text-slate-100">{{ index.f43?.toFixed(2) }}</span>
        <span 
          class="text-[11px] font-semibold flex items-center"
          :class="index.f170 > 0 ? 'text-red-500' : (index.f170 < 0 ? 'text-emerald-500' : 'text-slate-400')"
        >
          {{ index.f170 > 0 ? '+' : '' }}{{ index.f169?.toFixed(2) }}
        </span>
        <span 
          class="text-[11px] font-bold px-1.5 py-0.5 rounded"
          :class="index.f170 > 0 ? 'text-red-500 bg-red-500/8' : (index.f170 < 0 ? 'text-emerald-500 bg-emerald-500/8' : 'text-slate-400 bg-slate-800')"
        >
          {{ index.f170 > 0 ? '+' : '' }}{{ index.f170?.toFixed(2) }}%
        </span>
      </div>
      <div v-if="indices.length === 0" class="text-xs text-slate-500 flex items-center gap-1.5 animate-pulse">
        <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
        正在加载大盘指数...
      </div>
    </div>

    <!-- Main Content -->
    <main class="flex-1 relative pt-[108px]">
      <StockHeatmap 
        ref="heatmapRef"
        :searchQuery="searchQuery" 
        @select-stock="handleSelectStock"
        @data-loaded="handleDataLoaded"
      />
    </main>

    <!-- Overlay Backdrop for Drawer -->
    <div 
      v-if="showDrawer" 
      @click="showDrawer = false" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-all duration-300"
    ></div>

    <!-- Stock Details Drawer (Right side sliding panel) -->
    <div 
      class="fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-slate-900/95 backdrop-blur-xl border-l border-slate-800/80 z-40 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col"
      :class="showDrawer ? 'translate-x-0' : 'translate-x-full'"
    >
      <div v-if="selectedStock" class="flex flex-col h-full">
        <!-- Drawer Header -->
        <div class="p-5 border-b border-slate-800/60 flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-white leading-none">{{ selectedStock.name }}</h2>
              <button 
                @click="copyStockCode(selectedStock.code)"
                class="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1 font-mono"
                title="点击复制股票代码"
              >
                {{ selectedStock.code }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <div class="text-[10px] text-slate-500 mt-1.5">A股大盘股票实时走势与多维分析</div>
          </div>
          <button 
            @click="showDrawer = false" 
            class="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg border border-slate-700/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Drawer Content -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- Stock Metrics Card -->
          <div class="grid grid-cols-2 gap-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-4">
            <div>
              <div class="text-[10px] text-slate-500">涨跌幅</div>
              <div 
                class="text-xl font-bold mt-1"
                :class="selectedStock.change > 0 ? 'text-red-500' : (selectedStock.change < 0 ? 'text-emerald-500' : 'text-slate-400')"
              >
                {{ selectedStock.change > 0 ? '+' : '' }}{{ selectedStock.change?.toFixed(2) }}%
              </div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500">总市值</div>
              <div class="text-xl font-bold mt-1 text-slate-200">
                {{ (selectedStock.marketCap / 100000000).toFixed(2) }}<span class="text-xs text-slate-400 font-normal ml-0.5">亿</span>
              </div>
            </div>
          </div>

          <!-- Chart Tab Buttons -->
          <div class="flex bg-slate-950/60 border border-slate-800/60 p-1 rounded-xl">
            <button 
              @click="activeTab = 'min'"
              class="flex-1 text-xs py-2 rounded-lg font-semibold transition-all"
              :class="activeTab === 'min' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
            >
              实时分时走势
            </button>
            <button 
              @click="activeTab = 'daily'"
              class="flex-1 text-xs py-2 rounded-lg font-semibold transition-all"
              :class="activeTab === 'daily' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
            >
              日K线历史走势
            </button>
          </div>

          <!-- Live Chart Image Container -->
          <div class="relative bg-slate-950/60 border border-slate-800/60 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center p-2 shadow-inner">
            <img 
              :src="getChartUrl(selectedStock.code, activeTab)" 
              alt="Stock Chart" 
              class="max-w-full max-h-full object-contain filter brightness-95 contrast-105" 
            />
            <div class="absolute bottom-1 right-2 text-[9px] text-slate-600 bg-slate-950/50 px-1.5 py-0.5 rounded">
              来源: 新浪财经
            </div>
          </div>

          <!-- Quick Navigation Links -->
          <div class="space-y-2">
            <div class="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mb-1">行情直达链接</div>
            <div class="grid grid-cols-3 gap-2.5">
              <a 
                :href="getQuoteLink(selectedStock.code, 'eastmoney')" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-red-500/10 border border-slate-800/60 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-red-400">东方财富</span>
                <span class="text-[8px] text-slate-500 mt-0.5">详细报价</span>
              </a>
              <a 
                :href="getQuoteLink(selectedStock.code, 'xueqiu')" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-blue-500/10 border border-slate-800/60 hover:border-blue-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-blue-400">雪球社区</span>
                <span class="text-[8px] text-slate-500 mt-0.5">投资者讨论</span>
              </a>
              <a 
                :href="getQuoteLink(selectedStock.code, 'sina')" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-orange-500/10 border border-slate-800/60 hover:border-orange-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-orange-400">新浪财经</span>
                <span class="text-[8px] text-slate-500 mt-0.5">资讯公告</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="p-4 border-t border-slate-800/60 bg-slate-950/30 text-center text-[10px] text-slate-600">
          温馨提示: 股市有风险, 投资需谨慎。数据仅供学习研究参考。
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Remove standard browser scrollbars for the index list horizontal scrolling */
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

