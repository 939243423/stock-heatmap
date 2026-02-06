<script setup>
import StockHeatmap from './components/StockHeatmap.vue'
import { ref } from 'vue';

const searchQuery = ref('');
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[#0b1121] text-white overflow-hidden font-sans selection:bg-red-500/30">
    <!-- Header -->
    <header class="flex-none h-16 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex items-center px-4 sm:px-6 z-20 absolute top-0 left-0 right-0">
      <div class="flex items-center gap-2 sm:gap-3 mr-4 sm:mr-8">
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        </div>
        <h1 class="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
          A股云图 <span class="hidden md:inline text-xs text-slate-400 font-medium ml-2 px-2 py-0.5 rounded-full bg-slate-800/50 border border-white/5">实时大盘</span>
        </h1>
      </div>
      
      <!-- Search Bar -->
      <div class="relative max-w-sm w-full group">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-4 w-4 text-slate-500 group-focus-within:text-red-400 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索 股票代码 / 名称..." 
          class="block w-full pl-10 pr-3 py-2 border border-slate-700/50 rounded-xl leading-5 bg-slate-800/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 sm:text-sm transition-all duration-200"
        />
      </div>

      <div class="ml-auto text-xs text-slate-500 hidden sm:flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        数据来源: 东方财富
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 relative pt-16">
      <StockHeatmap :searchQuery="searchQuery" />
    </main>
  </div>
</template>

<style scoped>
</style>
