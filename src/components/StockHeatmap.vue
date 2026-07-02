<script setup>
import { onMounted, ref, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { fetchStockData } from '../services/stockApi';

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  marketFilter: {
    type: String,
    default: 'all'
  },
  selectedTime: {
    type: String,
    default: '15:00'
  },
  showAllPercent: {
    type: Boolean,
    default: false
  },
  changeMode: {
    type: String,
    default: 'day'
  },
  showDanmaku: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select-stock', 'data-loaded']);

const chartRef = ref(null);
let myChart = null;
const lastUpdated = ref('');
let refreshTimer = null;
const allData = ref([]); // Store full data

// Danmaku System
const danmakus = ref([]);
let danmakuTimer = null;
const mockComments = [
  "主力资金在流入...", "抄底创业板！", "茅台又新高了？", "宁王大跌，发生肾么事了", 
  "国家队又拉权重了", "券商涨停潮，牛市要来了吗", "垃圾行情，销户了销户了", 
  "今天又是关灯吃面的一天", "兄弟们冲啊，梭哈半导体！", "主力洗盘而已，拿稳了",
  "科创板今天真强", "稳住，我们能赢", "新能源赛道复苏了？", "这波反弹我站3000点",
  "工商银行稳如老狗", "比亚迪销量爆表啊", "红彤彤的一片，舒服了", "主力在诱多，快跑！",
  "半导体冲鸭！", "今天又吃大肉了", "军工板块有大动作？", "光伏又拉起来了", "信创走强"
];

const startDanmakuSimulation = () => {
  if (danmakuTimer) clearInterval(danmakuTimer);
  danmakuTimer = setInterval(() => {
    if (!props.showDanmaku) return;
    
    // 30% chance to send a danmaku every second
    if (Math.random() < 0.35) {
      const text = mockComments[Math.floor(Math.random() * mockComments.length)];
      const colors = ['#ffffff', '#fef08a', '#fca5a5', '#86efac', '#60a5fa', '#f472b6', '#fed7aa'];
      danmakus.value.push({
        id: Date.now() + Math.random(),
        text,
        top: 8 + Math.random() * 75, // 8% to 83%
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 8 + Math.random() * 8
      });
    }
  }, 1000);
};

const sendDanmaku = (text) => {
  if (!text) return;
  danmakus.value.push({
    id: Date.now() + Math.random(),
    text,
    top: 15 + Math.random() * 60, // 15% to 75%
    color: '#fef08a', // Custom user danmaku gets a bright yellow color
    speed: 8 + Math.random() * 3
  });
};

const removeDanmaku = (id) => {
  danmakus.value = danmakus.value.filter(d => d.id !== id);
};

const initChart = async () => {
  if (!chartRef.value) return;
  
  if (!myChart) {
    myChart = echarts.init(chartRef.value);
    myChart.showLoading({
      text: '正在加载实时数据...',
      color: '#ef4444',
      textColor: '#ffffff',
      maskColor: 'rgba(15, 23, 42, 0.8)'
    });

    // Bind click and mousedown event to emit selected stock immediately on all devices
    let lastSelectTime = 0;
    const handleSelectStock = (params) => {
      const now = Date.now();
      if (now - lastSelectTime < 300) return; // Prevent double trigger
      if (params.data && params.data.code) {
        lastSelectTime = now;
        // Immediately hide the tooltip so it doesn't overlap the details drawer
        myChart.dispatchAction({ type: 'hideTip' });
        emit('select-stock', {
          name: params.name,
          code: params.data.code,
          change: params.data.value[1],
          price: params.data.value[2],
          marketCap: params.data.value[0] * 100000000 // Convert scale back
        });
      }
    };
    myChart.on('click', handleSelectStock);
    myChart.on('mousedown', handleSelectStock);
  }

  await loadData();
  startAutoRefresh();
  startDanmakuSimulation();
};

const loadData = async (forceRefresh = false) => {
  try {
    const data = await fetchStockData(props.marketFilter, props.changeMode, forceRefresh);
    allData.value = data;
    updateChart(data);
    lastUpdated.value = new Date().toLocaleTimeString();
    emit('data-loaded', lastUpdated.value);
  } catch (error) {
    console.error("Failed to load data:", error);
    myChart && myChart.hideLoading();
  }
};

const isMobile = ref(window.innerWidth < 768);

const updateChart = (data) => {
  if (!myChart) return;
  
  // Scale factor based on simulated time
  const scaleFactorMap = {
    '9:30': 0.02,
    '10:00': 0.35,
    '10:30': 0.55,
    '11:00': 0.75,
    '11:30': 0.85,
    '13:30': 0.88,
    '14:00': 0.92,
    '14:30': 0.96,
    '15:00': 1.00
  };
  
  const scale = scaleFactorMap[props.selectedTime] !== undefined ? scaleFactorMap[props.selectedTime] : 1.00;
  
  const seedRandomLocal = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 1000) / 1000;
  };
  
  // Deep clone data to modify changes for replay simulation
  let displayData = JSON.parse(JSON.stringify(data));
  
  // Recursive tree processing to color all leaves (stocks) and update averages
  const processNode = (node, scale) => {
    const isLeaf = !node.children;
    
    if (isLeaf) {
      const originalChange = node.value[1];
      const scaleVal = node.value[0];
      const priceVal = node.value[2];
      
      let simulatedChange = originalChange * scale;
      if (scale < 1.0) {
        const seedVal = seedRandomLocal(node.code || node.name);
        const variance = (seedVal - 0.5) * 0.4 * (1 - scale);
        simulatedChange += variance;
      }
      
      return {
        ...node,
        value: [scaleVal, parseFloat(simulatedChange.toFixed(2)), priceVal],
        itemStyle: {
          color: generateHSLColor(simulatedChange)
        }
      };
    }
    
    // Node has children (sector / subsector)
    const updatedChildren = node.children.map(child => processNode(child, scale));
    
    // Re-calculate weighted average change
    let totalScale = 0;
    let weightedChangeSum = 0;
    
    updatedChildren.forEach(child => {
      const childIsLeaf = !child.children;
      const childScale = childIsLeaf ? child.value[0] : child.value[1];
      const childChange = childIsLeaf ? child.value[1] : child.value[0];
      
      totalScale += childScale;
      weightedChangeSum += childChange * childScale;
    });
    
    const avgChange = totalScale > 0 ? (weightedChangeSum / totalScale) : 0;
    
    return {
      ...node,
      value: [parseFloat(avgChange.toFixed(2)), totalScale],
      children: updatedChildren
    };
  };

  // Recursive tree filter
  const filterTree = (node, query) => {
    const isLeaf = !node.children;
    if (isLeaf) {
      const nameMatch = node.name && node.name.toLowerCase().includes(query);
      const codeMatch = node.code && node.code.toLowerCase().includes(query);
      return (nameMatch || codeMatch) ? node : null;
    }
    
    const filteredChildren = node.children
      .map(child => filterTree(child, query))
      .filter(Boolean);
      
    if (filteredChildren.length > 0) {
      let totalScale = 0;
      let weightedChangeSum = 0;
      
      filteredChildren.forEach(child => {
        const childIsLeaf = !child.children;
        const childScale = childIsLeaf ? child.value[0] : child.value[1];
        const childChange = childIsLeaf ? child.value[1] : child.value[0];
        
        totalScale += childScale;
        weightedChangeSum += childChange * childScale;
      });
      
      const avgChange = totalScale > 0 ? (weightedChangeSum / totalScale) : 0;
      
      return {
        ...node,
        value: [parseFloat(avgChange.toFixed(2)), totalScale],
        children: filteredChildren
      };
    }
    
    return null;
  };

  // Process coloring first
  displayData = displayData.map(sector => processNode(sector, scale));

  // Apply search query filter recursively if active
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    displayData = displayData.map(sector => filterTree(sector, query)).filter(Boolean);
  }

  const options = {
    tooltip: {
      show: true,
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#f8fafc', fontSize: 13 },
      extraCssText: 'backdrop-filter: blur(8px); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); z-index: 25;',
      formatter: function (info) {
        if (!info || !info.value) return '';
        const value = info.value; 
        const pathInfo = info.treePathInfo;
        
        const isStock = Array.isArray(value) && value.length === 3;
        const change = isStock ? value[1] : value[0];
        const cap = isStock ? value[0] : value[1];
        const price = isStock ? value[2] : 0;
        const name = info.name;
        
        const sectorName = pathInfo && pathInfo[1] ? pathInfo[1].name : '';
        
        const changeClass = change > 0 
          ? 'color: #ef4444; font-weight: bold;' 
          : (change < 0 ? 'color: #22c55e; font-weight: bold;' : 'color: #94a3b8; font-weight: bold;');
        const changeSign = change > 0 ? '+' : '';
        
        if (isStock) {
          return `
            <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 140px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">${sectorName}</div>
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #fff;">${echarts.format.encodeHTML(name)}</div>
              <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">最新价</span>
                  <span style="color: #fff; font-weight: 500;">${price > 0 ? price.toFixed(2) + ' 元' : '--'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">涨跌幅</span>
                  <span style="${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">权重比</span>
                  <span style="color: #f1f5f9; font-weight: 500;">${cap.toFixed(0)}</span>
                </div>
                <div style="font-size: 9px; color: #ef4444; margin-top: 4px; text-align: center; background: rgba(239, 68, 68, 0.08); padding: 2px 4px; border-radius: 4px; font-weight: 500;">点击查看分时/日K线</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 140px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">行业板块</div>
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #fff;">${echarts.format.encodeHTML(name)}</div>
              <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">板块均幅</span>
                  <span style="${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">行业总重</span>
                  <span style="color: #f1f5f9; font-weight: 500;">${cap.toFixed(0)}</span>
                </div>
              </div>
            </div>
          `;
        }
      }
    },
    series: [
      {
        name: 'A股全景',
        type: 'treemap',
        visibleMin: isMobile.value ? 1200 : 0, 
        roam: true, 
        nodeClick: 'zoomToNode', 
        zoomToNodeRatio: 0.1,
        width: 'auto', 
        top: 20, 
        bottom: 30, 
        left: '1%',
        right: '1%',
        squareRatio: 0.5 * (1 + Math.sqrt(5)),
        label: {
          show: true,
          formatter: function(params) {
            if (params.data && params.data.value) {
              const change = params.data.value[1];
              if (props.showAllPercent) {
                return `${params.name}\n${change > 0 ? '+' : ''}${change}%`;
              }
              const type = params.data.labelShowType || 'none';
              if (type === 'full') {
                return `${params.name}\n${change > 0 ? '+' : ''}${change}%`;
              } else {
                return params.name;
              }
            }
            return params.name;
          },
          fontSize: isMobile.value ? 9 : 11,
          lineHeight: isMobile.value ? 11 : 14,
          color: '#fff',
          textShadowColor: 'rgba(0,0,0,0.85)',
          textShadowBlur: 3
        },
        itemStyle: {
          borderColor: '#080d1a',
          borderWidth: 1.5
        },
        color: ['#1e293b'], 
        breadcrumb: {
          show: true,
          bottom: 4, 
          left: 'center',
          height: 20,
          emptyItemWidth: 25,
          itemStyle: {
            color: 'rgba(15, 23, 42, 0.7)', 
            borderColor: 'rgba(255, 255, 255, 0.06)',
            borderWidth: 1,
            borderRadius: 6,
            shadowBlur: 0
          },
          textStyle: {
            color: '#94a3b8',
            fontSize: 9,
            fontWeight: 'bold',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }
        },
        levels: [
          {
            itemStyle: {
              borderWidth: 0,
              gapWidth: 1
            }
          },
          {
            // Level 1: Sectors
            itemStyle: {
              borderWidth: 3, // Thicker isolation borders
              borderColor: '#080d1a',
              gapWidth: 3,
              color: '#0f172a'
            },
            upperLabel: {
              show: true,
              height: isMobile.value ? 16 : 20,
              color: '#94a3b8',
              fontWeight: '600',
              fontSize: isMobile.value ? 9 : 11,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              formatter: '{b}' 
            }
          },
          {
            // Level 2: Leaves (Stocks)
            itemStyle: {
              borderWidth: 0.5,
              gapWidth: 0,
              borderColor: 'rgba(8, 13, 26, 0.4)' 
            }
          }
        ],
        data: displayData
      }
    ]
  };

  myChart.hideLoading();
  myChart.setOption(options, { notMerge: true });
};

const startAutoRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    loadData();
  }, 35000); // refresh every 35 seconds
};

// Re-fetch data on market filter or changeMode changes
watch([() => props.marketFilter, () => props.changeMode], () => {
  myChart && myChart.showLoading({
    text: '正在加载数据...',
    color: '#ef4444',
    textColor: '#ffffff',
    maskColor: 'rgba(15, 23, 42, 0.8)'
  });
  loadData();
});

// Fast local update on query, time-steps, or percentage toggles
watch([() => props.searchQuery, () => props.selectedTime, () => props.showAllPercent], () => {
  updateChart(allData.value);
});

const resetZoom = () => {
  if (!myChart) return;
  myChart.dispatchAction({
    type: 'restore' 
  });
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  myChart && myChart.resize();
  if (allData.value.length > 0) {
    updateChart(allData.value);
  }
};

const triggerManualRefresh = () => {
  myChart && myChart.showLoading({
    text: '正在加载实时数据...',
    color: '#ef4444',
    textColor: '#ffffff',
    maskColor: 'rgba(15, 23, 42, 0.8)'
  });
  loadData(true); // forceRefresh = true, bypass cache
};

// Helper HSL color function local copy
function generateHSLColor(changePercent) {
  if (changePercent === 0 || isNaN(changePercent)) {
    return 'hsl(215, 25%, 27%)'; // Slate-700 / dark slate gray for flat
  }
  
  const absVal = Math.abs(changePercent);
  const ratio = Math.min(absVal / 8, 1); // Clamp maximum intensity at 8% change
  
  if (changePercent > 0) {
    // Red HSL: Hue = 356 (vibrant crimson red)
    const s = Math.round(60 + 30 * ratio);
    const l = Math.round(15 + 27 * ratio);
    return `hsl(356, ${s}%, ${l}%)`;
  } else {
    // Green HSL: Hue = 142 (emerald green)
    const s = Math.round(55 + 30 * ratio);
    const l = Math.round(13 + 23 * ratio);
    return `hsl(142, ${s}%, ${l}%)`;
  }
}

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (refreshTimer) clearInterval(refreshTimer);
  if (danmakuTimer) clearInterval(danmakuTimer);
  myChart && myChart.dispose();
});

defineExpose({
  triggerManualRefresh,
  sendDanmaku,
  getChartDataURL: () => myChart ? myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#080d1a' }) : null
});
</script>

<template>
  <div class="relative w-full h-full">
    <!-- ECharts Container -->
    <div ref="chartRef" class="w-full h-full bg-[#080d1a]"></div>
    
    <!-- Danmaku Overlay -->
    <div v-if="showDanmaku" class="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <div 
        v-for="d in danmakus" 
        :key="d.id"
        class="absolute whitespace-nowrap text-[11px] font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-danmaku select-none"
        :style="{
          top: d.top + '%',
          color: d.color,
          animationDuration: d.speed + 's'
        }"
        @animationend="removeDanmaku(d.id)"
      >
        {{ d.text }}
      </div>
    </div>
    
    <!-- Reset Zoom Button -->
    <button 
      @click="resetZoom"
      class="absolute top-2 right-4 z-10 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/80 transition-all shadow-xl flex items-center gap-1.5 backdrop-blur-md hover:scale-105 active:scale-95"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
      </svg>
      重置视图
    </button>
  </div>
</template>

<style scoped>
@keyframes danmaku-run {
  from {
    transform: translateX(100vw);
  }
  to {
    transform: translateX(-100%);
  }
}
.animate-danmaku {
  animation-name: danmaku-run;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
</style>
