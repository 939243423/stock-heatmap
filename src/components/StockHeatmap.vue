<script setup>
import { onMounted, ref, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { fetchStockData } from '../services/stockApi';

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select-stock']);

const chartRef = ref(null);
let myChart = null;
const lastUpdated = ref('');
let refreshTimer = null;
const allData = ref([]); // Store full data

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

      // Bind click event to emit selected stock
      myChart.on('click', (params) => {
        // Check if the clicked node is a leaf (stock node has 'code')
        if (params.data && params.data.code) {
          emit('select-stock', {
            name: params.name,
            code: params.data.code,
            change: params.data.value[1],
            marketCap: params.data.value[0]
          });
        }
      });
  }

  await loadData();
  
  // Start auto-refresh
  startAutoRefresh();
};

const loadData = async () => {
    try {
        const data = await fetchStockData();
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
    
    let displayData = data;
    if (props.searchQuery) {
         const query = props.searchQuery.toLowerCase();
        // Deep filter
        displayData = data.map(sector => {
            const matchingStocks = sector.children.filter(stock => 
                stock.name.toLowerCase().includes(query) ||
                (stock.code && stock.code.includes(query))
            );
            if (matchingStocks.length > 0) {
                return {
                    ...sector,
                    children: matchingStocks,
                    value: [sector.value[0], sector.value[1]] 
                };
            }
            return null;
        }).filter(Boolean);
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
        extraCssText: 'backdrop-filter: blur(8px); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3); z-index: 99;',
        formatter: function (info) {
          if (!info || !info.value) return '';
          const value = info.value; // [MarketCap, Change]
          const pathInfo = info.treePathInfo;
          
          // A node is a stock if it is a leaf (depth level 3)
          const isStock = Array.isArray(value) && value.length === 2 && pathInfo && pathInfo.length > 2;
          const change = value[1] !== undefined ? value[1] : 0;
          const cap = value[0];
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
                    <span style="color: #94a3b8;">涨跌幅</span>
                    <span style="${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; gap: 12px;">
                    <span style="color: #94a3b8;">总市值</span>
                    <span style="color: #f1f5f9; font-weight: 500;">${(cap / 100000000).toFixed(2)} 亿</span>
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
                    <span style="color: #94a3b8;">总市值</span>
                    <span style="color: #f1f5f9; font-weight: 500;">${(cap / 100000000).toFixed(2)} 亿</span>
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
          visibleMin: isMobile.value ? 1200 : 0, // Hide tiny blocks on mobile to reduce clutter
          roam: true, // Enable Zoom and Pan
          nodeClick: 'zoomToNode', 
          zoomToNodeRatio: 0.1,
          width: 'auto', 
          top: 30, // Margin to clear Header/Index Bar
          bottom: 35, // Margin to clear Breadcrumb
          left: '1.5%',
          right: '1.5%',
          squareRatio: 0.5 * (1 + Math.sqrt(5)),
          label: {
            show: true,
            formatter: function(params) {
                if (params.data && params.data.value) {
                   const change = params.data.value[1];
                   const type = params.data.labelShowType || 'none';
                   
                   if (type === 'full') {
                       if (isMobile.value) {
                           return `${params.name}\n${Math.round(change)}%`;
                       }
                       return `${params.name}\n${change > 0 ? '+' : ''}${change}%`;
                   } else {
                       return params.name;
                   }
                }
                return params.name;
            },
            fontSize: isMobile.value ? 10 : 12,
            lineHeight: isMobile.value ? 12 : 15,
            color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowBlur: 3
          },
          itemStyle: {
            borderColor: '#080d1a',
            borderWidth: 1.5
          },
          color: ['#1e293b'], // Neutral fallback
          breadcrumb: {
              show: true,
              bottom: 4, 
              left: 'center',
              height: 24,
              emptyItemWidth: 25,
              itemStyle: {
                  color: 'rgba(30, 41, 59, 0.9)', 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: 1,
                  shadowBlur: 2
              },
              textStyle: {
                  color: '#cbd5e1',
                  fontSize: 11
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
                borderWidth: 1.5,
                borderColor: '#080d1a',
                gapWidth: 1.5,
                color: '#0f172a'
              },
              upperLabel: {
                show: true,
                height: isMobile.value ? 18 : 22,
                color: '#94a3b8',
                fontWeight: '600',
                fontSize: isMobile.value ? 10 : 12,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                formatter: '{b}' 
              }
            },
            {
              // Level 2: Leaves (Stocks)
              itemStyle: {
                borderWidth: 0.5,
                gapWidth: 0,
                borderColor: 'rgba(8, 13, 26, 0.5)' 
              }
            }
          ],
          data: displayData
        }
      ]
    };

    myChart.hideLoading();
    myChart.setOption(options);
};

const startAutoRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
        loadData();
    }, 60000); // 1 minute
};

watch(() => props.searchQuery, () => {
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
  loadData();
};

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (refreshTimer) clearInterval(refreshTimer);
  myChart && myChart.dispose();
});

defineExpose({
  triggerManualRefresh
});
</script>

<template>
  <div class="relative w-full h-full">
      <div ref="chartRef" class="w-full h-full bg-[#080d1a]"></div>
      
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
</style>

