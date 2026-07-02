<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import html2canvas from 'html2canvas';
import StockHeatmap from './components/StockHeatmap.vue';
import MarketWidth from './components/MarketWidth.vue';
import USHeatmap from './components/USHeatmap.vue';
import { fetchMarketIndices } from './services/stockApi';

// Navigation Views
const activeView = ref('stock'); // 'stock' | 'width' | 'us'
const changeMode = ref('day'); // 'day' | 'week'

const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimer = null;

watch(searchQuery, (newVal) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newVal;
  }, 300);
});

watch(activeView, () => {
  showDrawer.value = false;
  selectedStock.value = null;
});
const indices = ref([]);
const selectedStock = ref(null);
const showDrawer = ref(false);
const showScreenshotModal = ref(false);
const screenshotImgUrl = ref('');
const captureChartImg = ref('');

const activeViewName = computed(() => {
  if (activeView.value === 'stock') return 'A股全景';
  if (activeView.value === 'us') return '美股全景';
  if (activeView.value === 'width') return '全市场宽度';
  return '行情看板';
});
const activeTab = ref('min'); 
const lastUpdatedTime = ref('--:--:--');
const heatmapRef = ref(null);
const isRefreshing = ref(false);

// Ref references for filters matching dapanyuntu.com
const activeMarket = ref('all'); // 'all' | 'sh' | 'sz' | 'bj' | 'kcb' | 'cyb'
const selectedTime = ref('15:00'); // '9:30' to '15:00'
const showAllPercent = ref(false); // Toggle to show all percentages
const currentDate = ref('');
const currentTime = ref('');

// Danmaku System
const showDanmaku = ref(false);
const userDanmakuInput = ref('');

// Modals
const showSponsorModal = ref(false);
const showGuideModal = ref(false);

const marketTabs = [
  { name: 'A股全图', value: 'all' },
  { name: '上证A股', value: 'sh' },
  { name: '深证A股', value: 'sz' },
  { name: '北交所A股', value: 'bj' },
  { name: '科创板', value: 'kcb' },
  { name: '创业板', value: 'cyb' }
];

const timeSteps = [
  '9:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00'
];

let indicesTimer = null;
let clockTimer = null;

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

const updateDateTime = () => {
  const d = new Date();
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const week = weeks[d.getDay()];
  currentDate.value = `${year}年${month}月${day}日 ${week}`;
  
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  currentTime.value = `${hours}:${mins}:${secs}`;
};

const handleDataLoaded = (time) => {
  lastUpdatedTime.value = time;
  isRefreshing.value = false;
};

const triggerManualRefresh = () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  loadIndices();
  if (heatmapRef.value && activeView.value === 'stock') {
    heatmapRef.value.triggerManualRefresh();
  } else {
    setTimeout(() => {
      isRefreshing.value = false;
      lastUpdatedTime.value = new Date().toLocaleTimeString();
    }, 600);
  }
};

const handleSelectStock = (stock) => {
  selectedStock.value = stock;
  showDrawer.value = true;
  activeTab.value = 'min'; 
};

const getMarketPrefix = (code) => {
  if (!code) return '';
  if (code.startsWith('60') || code.startsWith('68') || code.startsWith('900') || code.startsWith('11') || code.startsWith('5')) {
    return 'sh';
  } else if (code.startsWith('00') || code.startsWith('30') || code.startsWith('20') || code.startsWith('12') || code.startsWith('08')) {
    return 'sz';
  } else if (code.startsWith('43') || code.startsWith('83') || code.startsWith('87') || code.startsWith('88')) {
    return 'bj';
  }
  return 'sh'; 
};

const getChartUrl = (code, type) => {
  if (!code) return '';
  const market = getMarketPrefix(code);
  const path = type === 'min' ? 'min' : 'daily';
  return `https://image.sinajs.cn/newchart/${path}/n/${market}${code}.gif?t=${Date.now()}`;
};

const getQuoteLink = (code, site, isUS = false) => {
  if (!code) return '#';
  if (isUS) {
    if (site === 'xueqiu') return `https://xueqiu.com/S/${code}`;
    return `https://finance.yahoo.com/quote/${code}`;
  }
  
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

const handleSendDanmaku = () => {
  if (!userDanmakuInput.value.trim()) return;
  if (heatmapRef.value && activeView.value === 'stock') {
    heatmapRef.value.sendDanmaku(userDanmakuInput.value.trim());
  }
  userDanmakuInput.value = '';
};

// HTML5 Screenshot Share
const shareScreenshot = () => {
  if (activeView.value === 'stock' || activeView.value === 'us') {
    // 1. Get high-resolution ECharts base64 image data
    if (heatmapRef.value && typeof heatmapRef.value.getChartDataURL === 'function') {
      const dataURL = heatmapRef.value.getChartDataURL();
      if (dataURL) {
        captureChartImg.value = dataURL;
        isRefreshing.value = true;
        
        // 2. Let Vue render the updated offscreen template, then capture it
        setTimeout(() => {
          const exportCard = document.getElementById('screenshot-export-card');
          if (!exportCard) {
            isRefreshing.value = false;
            return;
          }
          
          // Apply getComputedStyle patch just in case
          const originalGetComputedStyle = window.getComputedStyle;
          window.getComputedStyle = function (el, pseudoElt) {
            const styles = originalGetComputedStyle(el, pseudoElt);
            return new Proxy(styles, {
              get(target, prop) {
                if (prop === 'getPropertyValue') {
                  return function(propertyName) {
                    const value = target.getPropertyValue(propertyName);
                    if (typeof value === 'string' && value.includes('oklch')) {
                      return value.replace(/oklch\([^)]+\)/g, 'rgba(0,0,0,0)');
                    }
                    return value;
                  };
                }
                const value = Reflect.get(target, prop);
                if (typeof value === 'function') {
                  return value.bind(target);
                }
                if (typeof value === 'string' && value.includes('oklch')) {
                  return value.replace(/oklch\([^)]+\)/g, 'rgba(0,0,0,0)');
                }
                return value;
              }
            });
          };
          
          html2canvas(exportCard, {
            useCORS: true,
            backgroundColor: '#080d1a',
            scale: 2
          }).then(canvas => {
            window.getComputedStyle = originalGetComputedStyle;
            
            const imgUrl = canvas.toDataURL('image/png');
            screenshotImgUrl.value = imgUrl;
            showScreenshotModal.value = true;

            const link = document.createElement('a');
            const d = new Date();
            const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
            link.download = `大盘云图-${activeViewName.value}-${dateStr}.png`;
            link.href = imgUrl;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            isRefreshing.value = false;
          }).catch(err => {
            window.getComputedStyle = originalGetComputedStyle;
            console.error('Screenshot capturing failed:', err);
            isRefreshing.value = false;
            alert('截图生成失败，请稍后重试！');
          });
        }, 150);
        return;
      }
    }
  }

  // Fallback / Market Width capturing (direct container capture)
  const target = document.getElementById('heatmap-capture-area');
  if (!target) return;
  
  isRefreshing.value = true;
  
  // Hide UI overlays for clean capture
  const buttonsToHide = document.querySelectorAll('.screenshot-hide');
  buttonsToHide.forEach(btn => btn.style.display = 'none');
  
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (el, pseudoElt) {
    const styles = originalGetComputedStyle(el, pseudoElt);
    return new Proxy(styles, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(propertyName) {
            const value = target.getPropertyValue(propertyName);
            if (typeof value === 'string' && value.includes('oklch')) {
              return value.replace(/oklch\([^)]+\)/g, 'rgba(0,0,0,0)');
            }
            return value;
          };
        }
        const value = Reflect.get(target, prop);
        if (typeof value === 'function') {
          return value.bind(target);
        }
        if (typeof value === 'string' && value.includes('oklch')) {
          return value.replace(/oklch\([^)]+\)/g, 'rgba(0,0,0,0)');
        }
        return value;
      }
    });
  };
  
  setTimeout(() => {
    // Explicit sizing for html2canvas to prevent viewport offset and cropping issues
    html2canvas(target, {
      useCORS: true,
      backgroundColor: '#080d1a',
      scale: 2,
      width: target.offsetWidth,
      height: target.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: target.offsetWidth,
      windowHeight: target.offsetHeight
    }).then(canvas => {
      window.getComputedStyle = originalGetComputedStyle;
      
      const imgUrl = canvas.toDataURL('image/png');
      screenshotImgUrl.value = imgUrl;
      showScreenshotModal.value = true;

      const link = document.createElement('a');
      const d = new Date();
      const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      link.download = `大盘云图-${activeViewName.value}-${dateStr}.png`;
      link.href = imgUrl;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      buttonsToHide.forEach(btn => btn.style.display = '');
      isRefreshing.value = false;
    }).catch(err => {
      window.getComputedStyle = originalGetComputedStyle;
      console.error('Screenshot capturing failed:', err);
      buttonsToHide.forEach(btn => btn.style.display = '');
      isRefreshing.value = false;
      alert('截图生成失败，请稍后重试！');
    });
  }, 300);
};

onMounted(() => {
  loadIndices();
  updateDateTime();
  
  clockTimer = setInterval(updateDateTime, 1000);
  indicesTimer = setInterval(loadIndices, 30000);
});

onUnmounted(() => {
  if (indicesTimer) clearInterval(indicesTimer);
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<template>
  <div class="h-screen w-screen flex flex-row bg-[#080d1a] text-slate-100 overflow-hidden font-sans selection:bg-red-500/30">
    
    <!-- LEFT SIDEBAR PANEL -->
    <aside class="w-48 bg-[#0b1224] border-r border-slate-800/80 flex flex-col shrink-0 z-30 select-none">
      
      <!-- Logo -->
      <div class="p-4 border-b border-slate-800/60">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-6 bg-[#ef4444] rounded"></div>
          <div>
            <h1 class="text-base font-black tracking-widest text-white leading-none">大盘云图</h1>
            <p class="text-[9px] text-slate-500 mt-1 font-semibold">dapanyuntu.com</p>
          </div>
        </div>
      </div>

      <!-- Domain Info Box -->
      <div class="px-3 pt-3">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-[9px] space-y-1">
          <div class="flex justify-between text-slate-400">
            <span>收藏网址</span>
            <span class="text-red-400 font-semibold cursor-pointer hover:underline">dpyt.com</span>
          </div>
          <div class="flex justify-between text-slate-400">
            <span>防丢网址</span>
            <span class="text-orange-400 font-semibold cursor-pointer hover:underline">dpyt.cc</span>
          </div>
        </div>
      </div>

      <!-- Live Date Box -->
      <div class="px-3 pt-3">
        <div class="w-full bg-slate-950/40 border border-slate-900/80 text-center py-1.5 rounded-lg text-[10px] font-bold text-slate-400 font-mono shadow-sm">
          {{ currentDate }}
        </div>
      </div>

      <!-- View Selector (Side Menus) -->
      <div class="px-3 pt-4 space-y-1">
        <div class="text-[9px] text-slate-500 font-bold uppercase px-2 mb-1 tracking-widest">产品矩阵</div>
        
        <!-- A-Share Heatmap -->
        <button 
          @click="activeView = 'stock'"
          class="w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2 border font-semibold"
          :class="activeView === 'stock'
            ? 'bg-red-500/10 border-red-500/30 text-red-400' 
            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="activeView === 'stock' ? 'bg-red-400' : 'bg-slate-600'"></span>
          A股行情云图
        </button>

        <!-- Market Width -->
        <button 
          @click="activeView = 'width'"
          class="w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2 border font-semibold"
          :class="activeView === 'width'
            ? 'bg-red-500/10 border-red-500/30 text-red-400' 
            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="activeView === 'width' ? 'bg-red-400' : 'bg-slate-600'"></span>
          全市场宽度
        </button>

        <!-- US Stock Heatmap -->
        <button 
          @click="activeView = 'us'"
          class="w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2 border font-semibold"
          :class="activeView === 'us'
            ? 'bg-red-500/10 border-red-500/30 text-red-400' 
            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="activeView === 'us' ? 'bg-red-400' : 'bg-slate-600'"></span>
          美股成分云图
        </button>
      </div>

      <!-- Main Sidebar Scroller for Stock Toggles -->
      <div class="flex-1 py-4 space-y-3 px-3 overflow-y-auto scrollbar-none border-t border-slate-800/40 mt-3">
        
        <!-- Board categories (only shown for stock view) -->
        <div v-if="activeView === 'stock'" class="space-y-1">
          <div class="text-[9px] text-slate-500 font-bold uppercase px-2 mb-1 tracking-widest">市场板块</div>
          <button 
            v-for="tab in marketTabs" 
            :key="tab.value"
            @click="activeMarket = tab.value"
            class="w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-all flex items-center justify-between group border"
            :class="activeMarket === tab.value 
              ? 'bg-slate-900 border-slate-800 text-slate-200 font-bold' 
              : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'"
          >
            <span>{{ tab.name }}</span>
            <span class="w-1 h-1 rounded-full" :class="activeMarket === tab.value ? 'bg-red-400' : 'bg-transparent'"></span>
          </button>
        </div>

        <!-- Toggles Section (only shown for stock view) -->
        <div v-if="activeView === 'stock'" class="space-y-1.5 pt-2">
          <div class="text-[9px] text-slate-500 font-bold uppercase px-2 mb-1.5 tracking-widest">图表选项</div>
          
          <!-- Period Toggle -->
          <div class="px-2 pb-1">
            <span class="text-[10px] text-slate-500 block mb-1">指标维度</span>
            <div class="flex bg-slate-950/60 p-0.5 rounded border border-slate-850">
              <button 
                @click="changeMode = 'day'"
                class="flex-1 text-[9px] py-1 rounded font-bold transition-all"
                :class="changeMode === 'day' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'"
              >
                涨跌幅
              </button>
              <button 
                @click="changeMode = 'week'"
                class="flex-1 text-[9px] py-1 rounded font-bold transition-all"
                :class="changeMode === 'week' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'"
              >
                1周涨跌幅
              </button>
            </div>
          </div>

          <!-- Label Toggle -->
          <label class="flex items-center gap-2 px-2 py-1 cursor-pointer group select-none">
            <input 
              v-model="showAllPercent"
              type="checkbox" 
              class="rounded border-slate-800 bg-slate-900 text-red-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 transition-colors cursor-pointer"
            />
            <span class="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">显示涨跌幅数值</span>
          </label>
        </div>

        <!-- Danmaku Control Widget (Only A-Share Heatmap supports) -->
        <div v-if="activeView === 'stock'" class="border-t border-slate-800/40 pt-3 mt-2">
          <div class="flex items-center justify-between mb-2 px-2">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">实时股友弹幕</span>
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input type="checkbox" v-model="showDanmaku" class="sr-only peer">
              <div class="w-6 h-3 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-slate-450 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
          <div v-if="showDanmaku" class="flex gap-1 px-1">
            <input 
              v-model="userDanmakuInput" 
              @keyup.enter="handleSendDanmaku"
              type="text" 
              placeholder="说点什么..." 
              class="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[9px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
            />
            <button 
              @click="handleSendDanmaku"
              class="bg-red-500 hover:bg-red-600 text-white text-[9px] px-2 py-1 rounded font-bold transition-colors active:scale-95 shrink-0"
            >
              发
            </button>
          </div>
        </div>

      </div>

      <!-- Bottom Actions -->
      <div class="p-3 border-t border-slate-800/60 bg-slate-950/20 text-center space-y-1.5">
        <button 
          @click="showGuideModal = true" 
          class="w-full text-[10px] text-slate-400 hover:text-white bg-slate-900 border border-slate-800/80 py-1 rounded-lg transition-all"
        >
          查看使用指南
        </button>
        <div class="grid grid-cols-2 gap-1.5">
          <button 
            @click="showSponsorModal = true" 
            class="text-[9px] font-bold text-orange-400 hover:text-white bg-orange-500/10 hover:bg-orange-500 border border-orange-500/20 hover:border-orange-500 py-1 rounded-lg transition-all"
          >
            友情赞助
          </button>
          <button 
            @click="shareScreenshot" 
            class="text-[9px] font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 py-1 rounded-lg transition-all"
          >
            截图分享
          </button>
        </div>
      </div>
    </aside>

    <!-- RIGHT MAIN AREA -->
    <div id="heatmap-capture-area" class="flex-1 flex flex-col h-full overflow-hidden relative">
      
      <!-- TOP INDEXES ROW -->
      <header class="flex-none h-12 bg-[#0f172a]/95 border-b border-slate-800/60 flex items-center justify-between px-4 sm:px-6 z-20 gap-4 overflow-x-auto flex-nowrap scrollbar-none shadow-md">
        
        <!-- Market Tickers -->
        <div class="flex items-center gap-4 md:gap-5 flex-1 min-w-0">
          <div 
            v-for="index in indices" 
            :key="index.f57" 
            class="flex items-center gap-1.5 whitespace-nowrap text-xs shrink-0"
          >
            <span class="text-slate-400 font-semibold text-[11px]">{{ index.f58 }}</span>
            <span class="font-bold text-slate-200 text-[11px]">{{ index.f43?.toFixed(2) }}</span>
            <span 
              class="text-[10px] font-bold"
              :class="index.f170 > 0 ? 'text-red-500' : (index.f170 < 0 ? 'text-emerald-500' : 'text-slate-400')"
            >
              {{ index.f170 > 0 ? '+' : '' }}{{ index.f170?.toFixed(2) }}%
            </span>
          </div>
          <div v-if="indices.length === 0" class="text-xs text-slate-500 flex items-center gap-1.5 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            正在加载大盘指数...
          </div>
        </div>

        <!-- Search Bar, Clock & Action Controls -->
        <div class="flex items-center gap-3 shrink-0">
          
          <!-- Search Bar (Only shown for heatmap views) -->
          <div v-if="activeView !== 'width'" class="relative max-w-xs w-44 sm:w-48 group screenshot-hide">
            <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <svg class="h-3 w-3 text-slate-500 group-focus-within:text-red-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="搜索股票代码/名称..." 
              class="block w-full pl-8 pr-2.5 py-1 border border-slate-800/80 rounded-lg leading-5 bg-slate-900/60 text-slate-200 placeholder-slate-600 focus:outline-none focus:bg-slate-900 focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 text-[10px] transition-all"
            />
          </div>

          <div class="w-px h-4 bg-slate-800 screenshot-hide"></div>

          <!-- Refresh Button -->
          <button 
            @click="triggerManualRefresh"
            class="bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700/80 p-1.5 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center shrink-0 screenshot-hide"
            :class="{ 'pointer-events-none opacity-50': isRefreshing }"
            title="点击刷新实时行情"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-3.5 w-3.5" 
              :class="{ 'animate-spin': isRefreshing }"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18v3" />
            </svg>
          </button>

          <!-- Ticking Clock -->
          <span class="text-[11px] font-bold text-slate-400 font-mono bg-slate-900 border border-slate-800/60 px-2 py-0.5 rounded shadow-sm">
            {{ currentTime }}
          </span>

          <!-- Login / Register mockup -->
          <button class="bg-[#ef4444] hover:bg-red-650 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10 screenshot-hide">
            登录 / 注册
          </button>
        </div>
      </header>

      <!-- CONTENT DISPLAY (Switched based on activeView) -->
      <main class="flex-1 relative bg-[#080d1a] overflow-hidden">
        
        <!-- A-Share Heatmap -->
        <StockHeatmap 
          v-if="activeView === 'stock'"
          ref="heatmapRef"
          :searchQuery="debouncedSearchQuery" 
          :marketFilter="activeMarket"
          :selectedTime="selectedTime"
          :showAllPercent="showAllPercent"
          :changeMode="changeMode"
          :showDanmaku="showDanmaku"
          @select-stock="handleSelectStock"
          @data-loaded="handleDataLoaded"
        />

        <!-- Market Width Grid -->
        <MarketWidth 
          v-else-if="activeView === 'width'"
        />

        <!-- US Stocks Heatmap -->
        <USHeatmap 
          v-else-if="activeView === 'us'"
          ref="heatmapRef"
          :searchQuery="debouncedSearchQuery" 
          :showAllPercent="showAllPercent"
          @select-stock="handleSelectStock"
        />

      </main>

      <!-- BOTTOM REPLAY BAR (Shown only for A-share heatmap view) -->
      <footer 
        v-if="activeView === 'stock'"
        class="flex-none h-12 bg-[#0b1224] border-t border-slate-800/60 flex items-center justify-between px-4 sm:px-6 z-20 select-none shadow-md"
      >
        <!-- Time slots timeline -->
        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 py-1">
          <span class="text-slate-500 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
            本日复盘
          </span>
          <button 
            v-for="time in timeSteps" 
            :key="time"
            @click="selectedTime = time"
            class="px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all shrink-0 border"
            :class="selectedTime === time 
              ? 'bg-red-500/10 text-red-400 border-red-500/30' 
              : 'bg-slate-900/60 border-slate-800/80 text-slate-500 hover:text-slate-300'"
          >
            {{ time }}
          </button>
        </div>

        <!-- Color Legend Scale -->
        <div class="hidden md:flex items-center gap-1.5 text-[9px] text-slate-400 shrink-0 font-medium pl-4">
          <span>-8%</span>
          <div class="flex h-2.5 rounded overflow-hidden w-36 border border-slate-800 shadow-inner">
            <div class="flex-1 bg-[hsl(142,85%,13%)]"></div>
            <div class="flex-1 bg-[hsl(142,75%,18%)]"></div>
            <div class="flex-1 bg-[hsl(142,60%,23%)]"></div>
            <div class="flex-1 bg-[hsl(215,25%,27%)]"></div>
            <div class="flex-1 bg-[hsl(356,60%,22%)]"></div>
            <div class="flex-1 bg-[hsl(356,75%,28%)]"></div>
            <div class="flex-1 bg-[hsl(356,90%,36%)]"></div>
          </div>
          <span>+8%</span>
        </div>
      </footer>
    </div>

    <!-- Details Overlay Backdrop -->
    <div 
      v-if="showDrawer" 
      @click="showDrawer = false" 
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-all duration-300"
    ></div>

    <!-- Details Drawer -->
    <div 
      class="fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-[#0b1224]/95 backdrop-blur-xl border-l border-slate-850 z-40 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col"
      :class="showDrawer ? 'translate-x-0' : 'translate-x-full'"
    >
      <div v-if="selectedStock" class="flex flex-col h-full select-none text-slate-200">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-800/60 flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-extrabold text-white leading-none">{{ selectedStock.name }}</h2>
              <button 
                @click="copyStockCode(selectedStock.code)"
                class="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono transition-colors"
                title="点击复制代码"
              >
                {{ selectedStock.code }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <div class="text-[10px] text-slate-500 mt-1.5">
              {{ selectedStock.isUS ? '美股标普成分股实时行情与分析' : 'A股大盘权重股实时走势与多维分析' }}
            </div>
          </div>
          <button 
            @click="showDrawer = false" 
            class="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg border border-slate-700/40 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="flex-1 overflow-y-auto p-5 space-y-5">
          <!-- Metrics -->
          <div class="grid grid-cols-2 gap-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-4">
            <div>
              <div class="text-[10px] text-slate-500">最新涨跌幅</div>
              <div 
                class="text-xl font-black mt-1"
                :class="selectedStock.change > 0 ? 'text-red-500' : (selectedStock.change < 0 ? 'text-emerald-500' : 'text-slate-400')"
              >
                {{ selectedStock.change > 0 ? '+' : '' }}{{ selectedStock.change?.toFixed(2) }}%
              </div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500">板块市值权重</div>
              <div class="text-xl font-black mt-1 text-slate-200 font-mono">
                {{ (selectedStock.marketCap / 100000000).toFixed(0) }}<span class="text-xs text-slate-400 font-normal ml-0.5">点</span>
              </div>
            </div>
          </div>

          <!-- Chart Display (Only for A-Shares) -->
          <template v-if="!selectedStock.isUS">
            <!-- Tabs -->
            <div class="flex bg-slate-950/60 border border-slate-800/60 p-1 rounded-xl">
              <button 
                @click="activeTab = 'min'"
                class="flex-1 text-xs py-2 rounded-lg font-semibold transition-all"
                :class="activeTab === 'min' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
              >
                分时图
              </button>
              <button 
                @click="activeTab = 'daily'"
                class="flex-1 text-xs py-2 rounded-lg font-semibold transition-all"
                :class="activeTab === 'daily' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
              >
                日K线图
              </button>
            </div>

            <!-- Sina Chart Image -->
            <div class="relative bg-slate-950/60 border border-slate-800/60 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center p-2 shadow-inner">
              <img 
                :src="getChartUrl(selectedStock.code, activeTab)" 
                alt="Stock Chart" 
                class="max-w-full max-h-full object-contain filter brightness-95 contrast-105" 
              />
              <div class="absolute bottom-1 right-2 text-[8px] text-slate-600 bg-slate-950/50 px-1.5 py-0.5 rounded">
                数据来源: 新浪财经
              </div>
            </div>
          </template>

          <!-- Mock Stats Panel (Only for US Stocks) -->
          <template v-else>
            <div class="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">美股盘口透视</h3>
              <div class="grid grid-cols-2 gap-y-3 text-[11px] font-semibold">
                <div class="flex justify-between pr-4 border-r border-slate-800/50">
                  <span class="text-slate-500">52周最高</span>
                  <span class="text-slate-300 font-mono">$242.80</span>
                </div>
                <div class="flex justify-between pl-4">
                  <span class="text-slate-500">52周最低</span>
                  <span class="text-slate-300 font-mono">$152.10</span>
                </div>
                <div class="flex justify-between pr-4 border-r border-slate-800/50">
                  <span class="text-slate-500">日成交量</span>
                  <span class="text-slate-300 font-mono">4854万股</span>
                </div>
                <div class="flex justify-between pl-4">
                  <span class="text-slate-500">波动振幅</span>
                  <span class="text-slate-300 font-mono">2.85%</span>
                </div>
                <div class="flex justify-between pr-4 border-r border-slate-800/50">
                  <span class="text-slate-500">市盈率 (PE)</span>
                  <span class="text-slate-300 font-mono">32.4</span>
                </div>
                <div class="flex justify-between pl-4">
                  <span class="text-slate-500">股息率</span>
                  <span class="text-slate-300 font-mono">0.68%</span>
                </div>
              </div>
            </div>
          </template>

          <!-- External Links -->
          <div class="space-y-2">
            <div class="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mb-1">行情直达链接</div>
            <div class="grid grid-cols-3 gap-2.5">
              <a 
                v-if="!selectedStock.isUS"
                :href="getQuoteLink(selectedStock.code, 'eastmoney')" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-red-500/10 border border-slate-800/60 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-red-400">东方财富</span>
                <span class="text-[8px] text-slate-500 mt-0.5">详细行情</span>
              </a>
              
              <a 
                :href="getQuoteLink(selectedStock.code, 'xueqiu', selectedStock.isUS)" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-blue-500/10 border border-slate-800/60 hover:border-blue-500/30 rounded-xl transition-all group"
                :class="selectedStock.isUS ? 'col-span-2' : ''"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-blue-400">雪球社区</span>
                <span class="text-[8px] text-slate-500 mt-0.5">股友讨论</span>
              </a>

              <a 
                v-if="!selectedStock.isUS"
                :href="getQuoteLink(selectedStock.code, 'sina')" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-orange-500/10 border border-slate-800/60 hover:border-orange-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-orange-400">新浪财经</span>
                <span class="text-[8px] text-slate-500 mt-0.5">研报公告</span>
              </a>

              <a 
                v-if="selectedStock.isUS"
                :href="getQuoteLink(selectedStock.code, 'yahoo', true)" 
                target="_blank" 
                class="flex flex-col items-center justify-center py-2.5 bg-slate-950/40 hover:bg-red-500/10 border border-slate-800/60 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <span class="text-xs font-semibold text-slate-300 group-hover:text-red-400">Yahoo Finance</span>
                <span class="text-[8px] text-slate-500 mt-0.5">英文报价</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-800/60 bg-slate-950/30 text-center text-[10px] text-slate-650">
          温馨提示: 股市有风险, 投资需谨慎。数据仅供学习研究参考。
        </div>
      </div>
    </div>

    <!-- Sponsor Modal -->
    <div 
      v-if="showSponsorModal" 
      class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 transition-opacity"
      @click.self="showSponsorModal = false"
    >
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center text-center relative">
        <!-- Close Button -->
        <button 
          @click="showSponsorModal = false"
          class="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg border border-slate-750"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-sm font-black text-white tracking-widest uppercase mb-1">友情赞助大盘云图</h3>
        <p class="text-[10px] text-slate-500 mb-5 leading-normal">
          感谢您对大盘云图的支持！您的每笔赞助将用于支付服务器与数据接口费用，帮助云图做得更好。
        </p>

        <!-- QR Codes Grid -->
        <div class="grid grid-cols-2 gap-4 w-full mb-4">
          <!-- WeChat -->
          <div class="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex flex-col items-center">
            <div class="w-24 h-24 bg-slate-800/50 rounded-lg flex items-center justify-center border border-dashed border-slate-700/60 relative mb-2 overflow-hidden">
              <!-- Custom mock QR visualizer -->
              <div class="absolute inset-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-1.061-1.285-1.533-.3-.466-.466-.957-.504-1.45a1 1 0 00-.384-.822z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="text-[8px] text-emerald-500 font-bold uppercase mt-12 z-10">微信扫码</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400">微信赞助</span>
          </div>

          <!-- Alipay -->
          <div class="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex flex-col items-center">
            <div class="w-24 h-24 bg-slate-800/50 rounded-lg flex items-center justify-center border border-dashed border-slate-700/60 relative mb-2 overflow-hidden">
              <!-- Custom mock QR visualizer -->
              <div class="absolute inset-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h3a1 1 0 100-2H9z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="text-[8px] text-blue-500 font-bold uppercase mt-12 z-10">支付宝扫码</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400">支付宝赞助</span>
          </div>
        </div>

        <p class="text-[9px] text-slate-600 mt-2">点击弹窗外部或右上角按钮即可关闭</p>
      </div>
    </div>

    <!-- Guide Modal -->
    <div 
      v-if="showGuideModal" 
      class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 transition-opacity"
      @click.self="showGuideModal = false"
    >
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4 relative flex flex-col max-h-[80vh]">
        <!-- Close Button -->
        <button 
          @click="showGuideModal = false"
          class="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg border border-slate-750"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-sm font-black text-white tracking-widest uppercase mb-3 text-center">大盘云图使用指南</h3>
        
        <!-- Scrolling content -->
        <div class="flex-1 overflow-y-auto text-[11px] text-slate-400 space-y-4 pr-1 scrollbar-none leading-relaxed">
          <div>
            <h4 class="font-bold text-white mb-1">1. 行情云图怎么看？</h4>
            <p>云图采用树形图 (Treemap) 结构表示，板块划分大框（加粗隔离线），个股为其中小框。框的面积代表个股市值所占的权重，面积越大代表市值或仓位越高；框的颜色代表涨跌幅，**红色代表上涨，绿色代表下跌，灰色代表平盘**。颜色亮度越高说明涨幅或跌幅越大。</p>
          </div>
          <div>
            <h4 class="font-bold text-white mb-1">2. 探索不同产品视图</h4>
            <p>点击左侧的**“A股行情云图”**、**“全市场宽度”**以及**“美股成分云图”**可自由切换看盘面板。其中美股全景热力图精选标普500核心权重股，宽度热力图提供了盘后量化视角。</p>
          </div>
          <div>
            <h4 class="font-bold text-white mb-1">3. 市场宽度指标的意义</h4>
            <p>市场宽度 (Market Width) 展示了个股收盘价高于20日均线 (MA20) 的比例。这是判断行业牛熊转换、短期超买（高安全风险，应减仓）和超卖（筑底区域，适合抄底）的重要量化工具。数值靠近 0% 说明个股多处于底部超卖，靠近 100% 说明过热超买。</p>
          </div>
          <div>
            <h4 class="font-bold text-white mb-1">4. 极速截图与分享</h4>
            <p>点击左下角的**“截图分享”**按钮，系统将自动去除界面控制按钮，将完整的热力图、指数行情以高清图片形式渲染并下载。您可以直接保存并分享到微信群、朋友圈，或作为复盘笔记保存。</p>
          </div>
          <div>
            <h4 class="font-bold text-white mb-1">5. 动态复盘与重播</h4>
            <p>在行情云图页面的下方，提供了 **9:30 至 15:00** 的交易时间轴滑块。点击不同时间节点可以一键复现当天不同时点盘面个股的拉升与回落走势，有助于回溯全天资金板块轮动的完整痕迹。</p>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/60 text-center">
          <button 
            @click="showGuideModal = false" 
            class="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] px-6 py-1.5 rounded-lg transition-all"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>

    <!-- Hidden Capture Template for clean exports -->
    <div class="fixed top-[-9999px] left-[-9999px] pointer-events-none select-none">
      <div id="screenshot-export-card" class="w-[960px] bg-[#080d1a] border-4 border-slate-800/60 p-8 rounded-3xl flex flex-col text-slate-100 font-sans">
        <!-- Header Brand -->
        <div class="flex justify-between items-end border-b border-slate-800/60 pb-5 mb-5">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-2.5 h-7 bg-red-500 rounded"></div>
              <h2 class="text-2xl font-black tracking-widest text-white">大盘云图 · {{ activeViewName }}</h2>
            </div>
            <p class="text-[11px] text-slate-400 mt-2 font-semibold tracking-wider">实时行情监控与智能情绪诊断系统</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">更新时间 (GMT+8)</p>
            <p class="text-xs font-bold text-slate-300 mt-1 font-mono">{{ currentDate }} {{ currentTime }}</p>
          </div>
        </div>

        <!-- Market Index Row (Only for A-share view to prevent layout mismatches) -->
        <div v-if="activeView === 'stock'" class="grid grid-cols-3 gap-4 mb-6">
          <div 
            v-for="index in indices.slice(0, 3)" 
            :key="index.f57" 
            class="bg-[#0b1224] border border-slate-800/60 rounded-2xl p-4 flex flex-col shadow-inner"
          >
            <span class="text-xs font-semibold text-slate-400">{{ index.f58 }}</span>
            <span 
              class="text-xl font-black mt-2 font-mono"
              :class="index.f170 > 0 ? 'text-red-500' : (index.f170 < 0 ? 'text-emerald-500' : 'text-slate-400')"
            >
              {{ index.f43?.toFixed(2) }}
            </span>
            <span 
              class="text-xs font-bold mt-1 font-mono"
              :class="index.f170 > 0 ? 'text-red-500' : (index.f170 < 0 ? 'text-emerald-500' : 'text-slate-400')"
            >
              {{ index.f170 > 0 ? '+' : '' }}{{ index.f170?.toFixed(2) }}%
            </span>
          </div>
        </div>

        <!-- Main Heatmap Body Container -->
        <div class="w-full bg-[#080d1a] border border-slate-800/60 rounded-2xl p-1 shadow-2xl relative">
          <img :src="captureChartImg" class="w-full h-auto object-contain rounded-xl" alt="Heatmap Snapshot" />
        </div>

        <!-- Footer signature -->
        <div class="mt-6 pt-4 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
          <span>官网防丢地址：dpyt.com / dpyt.cc</span>
          <span>仅供参考，不作为投资决策建议。大盘云图拥有最终解释权。</span>
        </div>
      </div>
    </div>

    <!-- Screenshot Modal -->
    <div 
      v-if="showScreenshotModal" 
      class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      @click.self="showScreenshotModal = false"
    >
      <div class="bg-[#0b1224] border border-slate-800/80 p-5 rounded-2xl max-w-2xl w-full flex flex-col items-center shadow-2xl relative transition-transform duration-300 scale-100">
        <!-- Close Button -->
        <button 
          @click="showScreenshotModal = false" 
          class="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h3 class="text-sm font-bold text-white tracking-widest mb-3 text-center">📸 截图生成成功</h3>
        
        <!-- Image Container -->
        <div class="w-full overflow-auto max-h-[60vh] border border-slate-800/60 rounded-xl bg-slate-950 flex justify-center items-center p-2 mb-4">
          <img :src="screenshotImgUrl" class="max-w-full h-auto object-contain rounded" alt="大盘云图截图" />
        </div>
        
        <!-- Tips -->
        <div class="text-[11px] text-slate-400 space-y-1 mb-4 w-full text-center leading-relaxed">
          <p class="text-emerald-400 font-medium">已为您自动触发本地下载！</p>
          <p>若下载未启动，电脑端用户可**右键图片另存为/复制**，移动端用户可**长按图片进行保存/分享**。</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-3">
          <button 
            @click="showScreenshotModal = false" 
            class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] px-6 py-2 rounded-lg transition-all"
          >
            关闭预览
          </button>
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
