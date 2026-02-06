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
    } catch (error) {
        console.error("Failed to load data:", error);
        myChart && myChart.hideLoading();
    }
};

const isMobile = ref(window.innerWidth < 768);

const updateChart = (data) => {
    if (!myChart) return;
    
    // ... filtering logic (omitted, stays same) ...
    let displayData = data;
    if (props.searchQuery) {
        // ... (same as before) ...
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
        // ... (same tooltip) ...
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
        formatter: function (info) {
          const value = info.value; // [MarketCap, Change]
          const treePathInfo = info.treePathInfo;
          const treePath = [];
          for (let i = 1; i < treePathInfo.length; i++) {
            treePath.push(treePathInfo[i].name);
          }
          const change = value[1] !== undefined ? value[1] : 0;
          const cap = value[0];
          
          return [
            '<div class="font-bold border-b border-gray-600 pb-1 mb-1">' + echarts.format.encodeHTML(treePath.join(' > ')) + '</div>',
            '涨跌幅: <span class="' + (change >= 0 ? 'text-red-400' : 'text-green-400') + '">' + change + '%</span>',
            '<br/>',
            '市值: ' + (cap / 100000000).toFixed(2) + '亿'
          ].join('');
        }
      },
      series: [
        {
          name: 'A股全景',
          type: 'treemap',
          visibleMin: isMobile.value ? 1000 : 0, // Hide tiny blocks on mobile to reduce clutter
          roam: true, // Enable Zoom and Pan (PC: Wheel/Drag, Mobile: Pinch/Drag)
          nodeClick: isMobile.value ? 'link' : 'zoomToNode', // On mobile, zoom might be tricky, but zoomToNode is ok. Let's keep zoom.
          nodeClick: 'zoomToNode', 
          zoomToNodeRatio: 0.1,
          width: 'auto', 
          // height: 'auto',
          top: 45, // Fixed pixel margin to clear Reset Button
          bottom: 50, // Fixed pixel margin to clear Breadcrumb
          left: '2%',
          right: '2%',
          squareRatio: 0.5 * (1 + Math.sqrt(5)),
          label: {
            show: true,
            formatter: function(params) {
                if (params.data && params.data.value) {
                   const change = params.data.value[1];
                   const type = params.data.labelShowType || 'none';
                   
                   // Dynamic Detail Level
                   if (type === 'full') {
                       if (isMobile.value) {
                           return `${params.name}\n${Math.round(change)}%`;
                       }
                       return `${params.name}\n${change > 0 ? '+' : ''}${change}%`;
                   } else {
                       // Show name for everyone else
                       return params.name;
                   }
                }
                return params.name; // Fallback for sectors
            },
            fontSize: isMobile.value ? 11 : 12, // Slightly larger for readability? No 10 was small.
            lineHeight: isMobile.value ? 13 : 16,
            color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowBlur: 3
          },
          itemStyle: {
            borderColor: '#0b1121' 
          },
          // FIX: Override default rainbow palette with a single neutral color.
          // This ensures Sectors (Level 1) don't get assigned random colors (Purple, Orange etc).
          // Only the Leaves (Level 2) with explicit ItemStyle will show Red/Green.
          color: ['#334155'],
          breadcrumb: {
              show: true,
              bottom: 4, // Hug bottom
              left: 'center',
              height: 24,
              emptyItemWidth: 25,
              itemStyle: {
                  color: 'rgba(51, 65, 85, 0.8)', // Slate-700
                  borderColor: '#475569',
                  borderWidth: 1,
                  shadowBlur: 2
              },
              textStyle: {
                  color: '#e2e8f0',
                  fontSize: 12
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
                borderWidth: 1,
                borderColor: '#0f172a',
                gapWidth: 1,
                color: '#1e293b' // Dark background for sectors, preventing palette leak
              },
              upperLabel: {
                show: true,
                height: isMobile.value ? 16 : 20,
                color: '#e2e8f0',
                fontWeight: 'bold',
                fontSize: isMobile.value ? 10 : 12,
                fontFamily: 'sans-serif',
                formatter: '{b}' 
              }
            },
            {
              // Level 2: Leaves (Stocks)
              itemStyle: {
                borderWidth: 0.5,
                gapWidth: 0,
                borderColor: '#0f172a' 
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
    // Dispatch restore action to reset zoom/pan
    myChart.dispatchAction({
        type: 'restore' 
    });
    // Also re-set option to ensure clean state if needed
    // updateChart(allData.value); 
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  myChart && myChart.resize();
  // We might want to re-set options if mobile state changes to adjust fonts
  if (allData.value.length > 0) {
      updateChart(allData.value);
  }
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
</script>

<template>
  <div class="relative w-full h-full">
      <div ref="chartRef" class="w-full h-full bg-[#0b1121]"></div>
      
      <!-- Reset Zoom Button -->
      <button 
        @click="resetZoom"
        class="absolute top-2 right-4 z-10 bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600 transition-all shadow-lg flex items-center gap-1 backdrop-blur-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
        </svg>
        重置视图
      </button>
  </div>
</template>

<style scoped>
</style>
