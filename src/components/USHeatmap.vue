<script setup>
import { onMounted, ref, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { fetchUSStockData } from '../services/stockApi';

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  showAllPercent: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select-stock']);

const chartRef = ref(null);
let myChart = null;
const allData = ref([]);

const initChart = () => {
  if (!chartRef.value) return;
  
  if (!myChart) {
    myChart = echarts.init(chartRef.value);
    
    // Bind click event with drag detection to prevent mis-triggering on roam panning
    let lastSelectTime = 0;
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    if (chartRef.value) {
      chartRef.value.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        isDragging = false;
      });

      chartRef.value.addEventListener('mouseup', (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          isDragging = true;
        }
      });

      chartRef.value.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          isDragging = false;
        }
      }, { passive: true });

      chartRef.value.addEventListener('touchend', (e) => {
        if (e.changedTouches.length > 0) {
          const dx = e.changedTouches[0].clientX - startX;
          const dy = e.changedTouches[0].clientY - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            isDragging = true;
          }
        }
      }, { passive: true });
    }

    const handleSelectStock = (params) => {
      if (isDragging) {
        isDragging = false;
        return;
      }
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
          marketCap: params.data.value[0] * 100000000, // convert scale back to cap
          isUS: true // flag as US stock
        });
      }
    };
    myChart.on('click', handleSelectStock);

    // Hide tooltip when mouse leaves the ECharts container
    myChart.on('globalout', () => {
      myChart.dispatchAction({ type: 'hideTip' });
    });
  }

  loadData();
};

const loadData = () => {
  const data = fetchUSStockData();
  allData.value = data;
  updateChart(data);
};

const isMobile = ref(window.innerWidth < 768);

const updateChart = (data) => {
  if (!myChart) return;

  let displayData = JSON.parse(JSON.stringify(data));

  // Search filter
  if (props.searchQuery) {
    const query = props.searchQuery.toLowerCase();
    displayData = displayData.map(sector => {
      const matchingStocks = sector.children.filter(stock => 
        stock.name.toLowerCase().includes(query) ||
        stock.code.toLowerCase().includes(query)
      );
      if (matchingStocks.length > 0) {
        const totalCap = matchingStocks.reduce((sum, s) => sum + s.value[0], 0);
        const weightedChange = matchingStocks.reduce((sum, s) => sum + s.value[1] * s.value[0], 0) / totalCap;
        return {
          ...sector,
          children: matchingStocks,
          value: [parseFloat(weightedChange.toFixed(2)), totalCap]
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
      extraCssText: 'backdrop-filter: blur(8px); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); z-index: 25;',
      formatter: function (info) {
        if (!info || !info.value) return '';
        const value = info.value;
        const pathInfo = info.treePathInfo;
        const isStock = Array.isArray(value) && value.length === 3;
        const change = value[1];
        const price = value[2];
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
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #fff;">${echarts.format.encodeHTML(name)} (${info.data.code})</div>
              <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">最新价</span>
                  <span style="color: #fff; font-weight: 500;">$${price.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">涨跌幅</span>
                  <span style="${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">权重比</span>
                  <span style="color: #cbd5e1;">${cap}</span>
                </div>
                <div style="font-size: 9px; color: #ef4444; margin-top: 4px; text-align: center; background: rgba(239, 68, 68, 0.08); padding: 2px 4px; border-radius: 4px; font-weight: 500;">点击查看个股大图</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 140px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">美股板块</div>
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #fff;">${echarts.format.encodeHTML(name)}</div>
              <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 12px;">
                  <span style="color: #94a3b8;">板块均幅</span>
                  <span style="${changeClass}">${changeSign}${change.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          `;
        }
      }
    },
    series: [
      {
        name: '美股权重',
        type: 'treemap',
        visibleMin: 0,
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
              return `${params.name}\n${change > 0 ? '+' : ''}${change}%`;
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
            // Sectors
            itemStyle: {
              borderWidth: 3,
              borderColor: '#080d1a',
              gapWidth: 3,
              color: '#0f172a'
            },
            upperLabel: {
              show: true,
              height: 20,
              color: '#94a3b8',
              fontWeight: '600',
              fontSize: 11,
              formatter: '{b}'
            }
          },
          {
            // Stocks
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

  myChart.setOption(options, { notMerge: true });
};

const resetZoom = () => {
  if (!myChart) return;
  myChart.dispatchAction({ type: 'restore' });
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
  myChart && myChart.resize();
  if (allData.value.length > 0) {
    updateChart(allData.value);
  }
};

watch([() => props.searchQuery, () => props.showAllPercent], () => {
  updateChart(allData.value);
});

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  myChart && myChart.dispose();
});

defineExpose({
  getChartDataURL: () => myChart ? myChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#080d1a' }) : null
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
