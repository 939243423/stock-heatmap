<script setup>
import { ref, onMounted } from 'vue';
import { fetchMarketWidthData } from '../services/stockApi';

const dates = ref([]);
const widthData = ref([]);
const isLoading = ref(true);

const showAiHelper = ref(false);
const isScrolling = ref(false);
let scrollInterval = null;
const tableContainerRef = ref(null);

const loadData = () => {
  isLoading.value = true;
  setTimeout(() => {
    const { dates: fetchedDates, data: fetchedData } = fetchMarketWidthData();
    dates.value = fetchedDates;
    widthData.value = fetchedData;
    isLoading.value = false;
  }, 400);
};

const handleBackToToday = () => {
  if (tableContainerRef.value) {
    // Scroll all the way to the right (latest date)
    tableContainerRef.value.scrollLeft = tableContainerRef.value.scrollWidth;
  }
};

const toggleAutoScroll = () => {
  isScrolling.value = !isScrolling.value;
  if (isScrolling.value) {
    scrollInterval = setInterval(() => {
      if (tableContainerRef.value) {
        const c = tableContainerRef.value;
        // Scroll slightly left then reset if at start
        if (c.scrollLeft <= 0) {
          c.scrollLeft = c.scrollWidth - c.clientWidth;
        } else {
          c.scrollLeft -= 2;
        }
      }
    }, 50);
  } else {
    if (scrollInterval) clearInterval(scrollInterval);
  }
};

const getCellBgColor = (val) => {
  if (val === undefined || isNaN(val)) return 'rgba(30, 41, 59, 0.4)';
  
  if (val <= 30) {
    // Low value: Green (Oversold / Bottoming)
    const ratio = (30 - val) / 30; // 0 to 1
    const s = Math.round(50 + 35 * ratio);
    const l = Math.round(25 - 12 * ratio);
    return `hsl(142, ${s}%, ${l}%)`; // Dark green to vibrant forest green
  } else if (val <= 60) {
    // Medium value: Neutral Grayish / Pinkish
    const ratio = (val - 30) / 30; // 0 to 1
    const s = Math.round(10 + 20 * ratio);
    const l = Math.round(35 + 5 * ratio);
    return `hsl(356, ${s}%, ${l}%)`;
  } else {
    // High value: Red (Overbought / Peaking)
    const ratio = (val - 60) / 40; // 0 to 1
    const s = Math.round(60 + 35 * ratio);
    const l = Math.round(20 + 15 * ratio);
    return `hsl(356, ${s}%, ${l}%)`; // Dark crimson to vibrant red
  }
};

const getCellTextColor = (val) => {
  if (val <= 15 || val >= 85) return '#ffffff';
  return 'rgba(255, 255, 255, 0.85)';
};

onMounted(() => {
  loadData();
  // Auto-scroll to latest dates after loading
  setTimeout(handleBackToToday, 600);
});
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#080d1a] text-slate-200 overflow-hidden select-none">
    
    <!-- Top Sub-Header Control Bar -->
    <div class="flex-none h-12 border-b border-slate-800/60 bg-[#0b1224] flex items-center justify-between px-4">
      <!-- Title & Explanation -->
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold text-slate-400">
          市场宽度指标：行业中收盘价高于 MA20 的个股占比（百分比）。越趋于 0% 越超卖（绿），越趋于 100% 越超买（红）。
        </span>
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/80">
          <span>0%</span>
          <div class="w-16 h-1.5 rounded bg-gradient-to-r from-emerald-700 via-slate-700 to-red-700"></div>
          <span>100%</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button 
          @click="handleBackToToday" 
          class="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-slate-300"
        >
          回到今天
        </button>
        <button 
          @click="toggleAutoScroll" 
          class="px-2.5 py-1 border text-[10px] rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
          :class="isScrolling 
            ? 'bg-red-500/10 border-red-500/30 text-red-400 font-bold' 
            : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'"
        >
          <span class="w-1 h-1 rounded-full" :class="isScrolling ? 'bg-red-400 animate-ping' : 'bg-slate-500'"></span>
          {{ isScrolling ? '停止滚动' : '自动滚动' }}
        </button>
        <button 
          @click="loadData" 
          class="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 text-slate-300"
        >
          刷新
        </button>
        <button 
          @click="showAiHelper = !showAiHelper" 
          class="px-2.5 py-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-orange-500/30 hover:from-red-500/30 hover:to-orange-500/30 text-[10px] text-orange-300 font-semibold rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          AI 分析助手
        </button>
      </div>
    </div>

    <!-- Heatmap Grid Container -->
    <div class="flex-1 overflow-hidden relative">
      <div v-if="isLoading" class="absolute inset-0 bg-[#080d1a]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
        <div class="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-slate-400">正在计算并生成市场宽度热力图...</span>
      </div>

      <div 
        ref="tableContainerRef"
        class="w-full h-full overflow-auto scrollbar-none"
      >
        <table class="min-w-full border-collapse table-fixed text-center select-none">
          <!-- Table Header (Dates) -->
          <thead class="sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/80 shadow-md">
            <tr>
              <th class="w-28 min-w-[112px] bg-[#0b1224] sticky left-0 z-30 px-3 py-2 text-[10px] font-bold text-slate-400 text-left border-r border-slate-800">
                行业分类
              </th>
              <th 
                v-for="date in dates" 
                :key="date"
                class="w-12 min-w-[48px] px-1 py-2 text-[9px] font-mono font-bold text-slate-400"
              >
                {{ date }}
              </th>
            </tr>
          </thead>

          <!-- Table Body (Industries & Values) -->
          <tbody class="divide-y divide-slate-800/30">
            <tr 
              v-for="row in widthData" 
              :key="row.industry"
              class="hover:bg-slate-900/40 transition-colors"
            >
              <!-- Sticky Industry Column -->
              <td class="bg-[#0b1224]/95 backdrop-blur-sm sticky left-0 z-10 px-3 py-1.5 text-left text-[10px] font-bold text-slate-300 border-r border-slate-800 shadow-sm truncate">
                {{ row.industry }}
              </td>
              <!-- Width Cells -->
              <td 
                v-for="(val, valIdx) in row.values" 
                :key="valIdx"
                class="p-0.5 text-[9px] font-mono font-semibold"
              >
                <div 
                  class="w-full h-7 rounded-sm flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg cursor-default select-none border border-slate-950/20"
                  :style="{ 
                    backgroundColor: getCellBgColor(val),
                    color: getCellTextColor(val) 
                  }"
                  :title="`${row.industry} (${dates[valIdx]}): ${val}%`"
                >
                  {{ val }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- AI Diagnostic Panel -->
    <div 
      v-if="showAiHelper" 
      class="fixed bottom-14 right-6 w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-5 z-50 flex flex-col transform transition-all duration-300"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
          <h3 class="text-xs font-bold text-white tracking-wider">AI 市场宽度智能诊断</h3>
        </div>
        <button 
          @click="showAiHelper = false" 
          class="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1 rounded-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- Dialogue Content -->
      <div class="text-[11px] text-slate-300 space-y-3 leading-relaxed max-h-72 overflow-y-auto scrollbar-none pr-1">
        <div class="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40">
          <p class="font-bold text-orange-400 mb-1">🤖 AI 看盘助手：</p>
          <p>您好！根据今日的 **市场宽度数据 (收盘价高于MA20个股占比)**，我为您整理了如下市场情绪诊断报告：</p>
        </div>

        <div class="space-y-2">
          <p class="font-bold text-white flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            1. 极度超卖行业 (筑底区间 宽度 &lt; 25%)
          </p>
          <p class="text-slate-400 pl-3">
            **医药生物、银行板块、有色金属**。这些板块当前大部分个股已经跌破MA20均线，市场成交量萎缩，宽度指标达到极端低值（低于20%）。历史回测表明该区域属于高安全边际的**筑底抄底区间**，适合中长期资金分批建仓。
          </p>
        </div>

        <div class="space-y-2">
          <p class="font-bold text-white flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            2. 极度超买行业 (过热回调风险 &gt; 80%)
          </p>
          <p class="text-slate-400 pl-3">
            **半导体、光伏设备、通信**。在近期题材炒作的带动下，板块内超过85%的股票站在MA20上方，出现明显的拥挤度上升和**超买信号**。建议短线投资者切勿盲目追高，警惕随时可能到来的获利盘抛压和均线回归修正。
          </p>
        </div>

        <div class="space-y-2">
          <p class="font-bold text-white flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            3. 大盘情绪展望
          </p>
          <p class="text-slate-400 pl-3">
            目前全市场中位数宽度维持在 **42%** 左右，相较上周有轻微下滑，表明主力资金正在从高位题材向防御型蓝筹切换。大盘短期将在中枢线附近进行宽幅震荡，注意规避绩差垃圾股，拥抱有坚实基本面支撑的细分子行业。
          </p>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800/60 text-right">
        <span class="text-[9px] text-slate-500 font-mono">报告更新时点: 每天下午 16:00 (盘后静态分析)</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Hidden scrollbars */
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
