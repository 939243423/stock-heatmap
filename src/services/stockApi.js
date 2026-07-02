import fetchJsonp from 'fetch-jsonp';
import mapDataGlobal from './mapData_global.json';

// East Money API Base URL for batch queries (using push2ex fallback host for higher stability)
const API_BASE = 'https://push2ex.eastmoney.com/api/qt/clist/get';
const COMMON_PARAMS = {
  ut: 'bd1d9ddb04089700cf9c27f6f7426281',
  fltt: '2',
  invt: '2',
  np: '1',
  po: '1',
  fields: 'f12,f14,f2,f3,f20' // f12:code, f14:name, f2:price, f3:change%, f20:marketCap
};

/**
 * Fetch a single stock/index quote
 * @param {String} secid e.g. '1.000001'
 * @param {String} fields 
 */
export const fetchSingleStock = async (secid, fields = 'f57,f58,f43,f169,f170') => {
  const params = {
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    np: '1',
    po: '1',
    secid: secid,
    fields: fields
  };
  const queryString = new URLSearchParams(params).toString();
  const url = `https://push2ex.eastmoney.com/api/qt/stock/get?${queryString}`;
  try {
    const response = await fetchJsonp(url, {
      jsonpCallback: 'cb',
      timeout: 5000
    });
    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error(`Error fetching single stock ${secid}:`, error);
    return null;
  }
};

/**
 * Fetch real-time market indices for Shanghai, Shenzhen, Chinext, Star 50, Hushen 300
 */
export const fetchMarketIndices = async () => {
  const secids = ['1.000001', '0.399001', '0.399006', '1.000688', '1.000300'];
  const promises = secids.map(id => fetchSingleStock(id));
  const results = await Promise.all(promises);
  return results.filter(Boolean);
};

// Seeded random helper for stable mock calculations
const seedRandom = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 1000) / 1000;
};

// Local cache to speed up tab switching between market filters, keyed by marketFilter
let _stocksCache = {};
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Fetch A-share quotes dynamically filtered by active board tab to minimize traffic
 * @param {String} marketFilter - 'all' | 'sh' | 'sz' | 'bj' | 'kcb' | 'cyb'
 * @param {Boolean} forceRefresh - if true, bypass cache
 */
const fetchAllStocksBatch = async (marketFilter = 'all', forceRefresh = false) => {
  // Return cached result if still fresh
  const now = Date.now();
  const cache = _stocksCache[marketFilter];
  if (!forceRefresh && cache && (now - cache.time < CACHE_TTL_MS)) {
    return cache.data;
  }

  // Map marketFilter to corresponding fs query and page count
  // Using page size 1000. Clean single-market filters avoid empty responses.
  let fs = '';
  let pages = [1];

  switch (marketFilter) {
    case 'sh': // Shanghai Main Board + STAR Market
      fs = 'm:1+t:2,m:1+t:23';
      pages = [1, 2, 3]; // approx 2300 stocks
      break;
    case 'sz': // Shenzhen Main Board + ChiNext
      fs = 'm:0+t:6,m:0+t:80';
      pages = [1, 2, 3]; // approx 2800 stocks
      break;
    case 'bj': // Beijing Stock Exchange
      fs = 'm:0+t:81+s:2048';
      pages = [1]; // approx 250 stocks
      break;
    case 'kcb': // STAR Market only (highly targeted)
      fs = 'm:1+t:23';
      pages = [1]; // approx 570 stocks
      break;
    case 'cyb': // ChiNext only
      fs = 'm:0+t:80';
      pages = [1, 2]; // approx 1350 stocks
      break;
    case 'all':
    default: // All A-shares combined
      fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
      pages = [1, 2, 3, 4, 5, 6]; // approx 5300 stocks
      break;
  }

  try {
    const fetchPage = async (page) => {
      const params = {
        pn: page,
        pz: 1000,
        fid: 'f20', // Sort by market cap
        fs: fs,
        fields: 'f12,f14,f2,f3,f20'
      };
      const queryString = new URLSearchParams({
        ...COMMON_PARAMS,
        ...params
      }).toString();

      const url = `${API_BASE}?${queryString}`;
      const response = await fetchJsonp(url, {
        jsonpCallback: 'cb',
        timeout: 15000
      });
      const json = await response.json();
      if (json && json.data && json.data.diff) {
        const diff = json.data.diff;
        return Array.isArray(diff) ? diff : Object.values(diff);
      }
      return [];
    };

    const results = await Promise.all(pages.map(p => fetchPage(p)));
    const allStocks = results.flat();

    if (allStocks.length > 0) {
      _stocksCache[marketFilter] = {
        data: allStocks,
        time: Date.now()
      };
      return allStocks;
    }
    return [];
  } catch (error) {
    console.error('Batch API Fetch Error:', error);
    return [];
  }
};

// Local cache for Tencent quotes, keyed by marketFilter
let _tencentStocksCache = {};

/**
 * Extract all stock symbols matching the current marketFilter from mapDataGlobal
 * Format: sh600519, sz000001, etc.
 */
const getTencentCodesFromMapData = (marketFilter) => {
  const codes = [];
  const traverse = (node) => {
    if (node.id && (node.id.endsWith('.SH') || node.id.endsWith('.SZ') || node.id.endsWith('.BJ'))) {
      const fullCode = node.id;
      const code = fullCode.split('.')[0];
      const suffix = fullCode.split('.')[1].toLowerCase();
      
      let match = false;
      if (marketFilter === 'all') {
        match = true;
      } else {
        switch (marketFilter) {
          case 'sh':
            match = code.startsWith('60') || code.startsWith('68') || code.startsWith('900');
            break;
          case 'sz':
            match = code.startsWith('00') || code.startsWith('30') || code.startsWith('20');
            break;
          case 'bj':
            match = code.startsWith('920') || code.startsWith('43') || code.startsWith('83') || code.startsWith('87') || code.startsWith('88') || suffix === 'bj';
            break;
          case 'kcb':
            match = code.startsWith('688');
            break;
          case 'cyb':
            match = code.startsWith('300') || code.startsWith('301') || code.startsWith('302');
            break;
        }
      }
      if (match) {
        codes.push(`${suffix}${code}`);
      }
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  };
  traverse(mapDataGlobal);
  return codes;
};

/**
 * Fetch batch real-time stock quotes from Tencent Finance API (qt.gtimg.cn)
 * Bypasses CORS using dynamic script tags.
 */
const fetchTencentStocks = async (codes) => {
  const batchSize = 400;
  const batches = [];
  for (let i = 0; i < codes.length; i += batchSize) {
    batches.push(codes.slice(i, i + batchSize));
  }

  const fetchBatch = (batch) => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      const qParam = batch.map(c => `s_${c}`).join(',');
      script.src = `https://qt.gtimg.cn/q=${qParam}`;
      script.onload = () => {
        const data = [];
        batch.forEach(code => {
          const varName = `v_s_${code}`;
          if (window[varName]) {
            const raw = window[varName];
            delete window[varName]; // Clean up to avoid memory leak
            const parts = raw.split('~');
            if (parts.length > 9) {
              data.push({
                f12: parts[2], // code
                f14: parts[1], // name
                f2: parts[3],  // price
                f3: parts[5],  // change%
                f20: (parseFloat(parts[9]) * 100000000).toString() // market cap (convert hundred million to yuan)
              });
            }
          }
        });
        document.body.removeChild(script);
        resolve(data);
      };
      script.onerror = () => {
        try {
          document.body.removeChild(script);
        } catch (e) {}
        resolve([]);
      };
      document.body.appendChild(script);
    });
  };

  try {
    const results = await Promise.all(batches.map(fetchBatch));
    return results.flat();
  } catch (err) {
    console.error('Tencent API Fetch Error:', err);
    return [];
  }
};

/**
 * Main function to load stock heatmap data by mapping real-time quotes to local tree structure.
 * @param {String} marketFilter 'all' | 'sh' | 'sz' | 'bj' | 'kcb' | 'cyb'
 * @param {String} changeMode 'day' | 'week'
 */
export const fetchStockData = async (marketFilter = 'all', changeMode = 'day', forceRefresh = false) => {
  try {
    let rawStocksList = [];
    
    // Attempt 1: Fetch from Tencent API (Primary)
    const tencentCodes = getTencentCodesFromMapData(marketFilter);
    const now = Date.now();
    const cache = _tencentStocksCache[marketFilter];
    
    if (!forceRefresh && cache && (now - cache.time < CACHE_TTL_MS)) {
      rawStocksList = cache.data;
    } else if (tencentCodes.length > 0) {
      console.log(`Attempting primary fetch from Tencent API for ${tencentCodes.length} stocks...`);
      const tencentData = await fetchTencentStocks(tencentCodes);
      if (tencentData && tencentData.length > 0) {
        _tencentStocksCache[marketFilter] = {
          data: tencentData,
          time: now
        };
        rawStocksList = tencentData;
        console.log(`Tencent API fetch succeeded: loaded ${rawStocksList.length} quotes.`);
      }
    }

    // Attempt 2: Fallback to East Money API if Tencent is empty or failed
    if (!rawStocksList || rawStocksList.length === 0) {
      console.warn('Tencent API failed/empty, falling back to East Money API...');
      rawStocksList = await fetchAllStocksBatch(marketFilter, forceRefresh);
    }
    
    // Create a fast map lookup: code -> quote data
    const stockMap = new Map();
    rawStocksList.forEach(item => {
      if (item.f12) {
        stockMap.set(item.f12, {
          name: item.f14,
          price: item.f2 === '-' ? 0 : parseFloat(item.f2),
          change: item.f3 === '-' ? 0 : parseFloat(item.f3),
          marketCap: item.f20 === '-' ? 0 : parseFloat(item.f20)
        });
      }
    });

    // 2. Deep clone local map structure to process and populate values
    const rootClone = JSON.parse(JSON.stringify(mapDataGlobal));

    // Helper function to recursively format and filter the tree
    const formatNode = (node) => {
      // If it is a leaf (Stock node)
      if (node.id && (node.id.endsWith('.SH') || node.id.endsWith('.SZ') || node.id.endsWith('.BJ'))) {
        const fullCode = node.id;
        const code = fullCode.split('.')[0];
        
        // Apply market filters
        if (marketFilter !== 'all') {
          let match = false;
          switch (marketFilter) {
            case 'sh':
              match = code.startsWith('60') || code.startsWith('68') || code.startsWith('900');
              break;
            case 'sz':
              match = code.startsWith('00') || code.startsWith('30') || code.startsWith('20');
              break;
            case 'bj':
              // BSE stocks use 920xxx prefix in mapData, plus legacy 43/83/87/88 prefixes
              match = code.startsWith('920') || code.startsWith('43') || code.startsWith('83') || code.startsWith('87') || code.startsWith('88') || node.id.endsWith('.BJ');
              break;
            case 'kcb':
              // STAR Market: codes starting with 688 (all 688xxx are STAR)
              match = code.startsWith('688');
              break;
            case 'cyb':
              // ChiNext: codes starting with 300, 301, or 302
              match = code.startsWith('300') || code.startsWith('301') || code.startsWith('302');
              break;
            default:
              match = true;
          }
          if (!match) return null;
        }

        // Get real-time data
        let change = 0;
        let price = 0;
        let scaleVal = node.scale || 10;

        if (stockMap.has(code)) {
          const quote = stockMap.get(code);
          price = quote.price;
          change = quote.change;
          // Scale weight is the local pre-arranged weight (representing market cap proportions)
        } else {
          // Fallback or suspended stock
          const seed = seedRandom(code);
          change = (seed - 0.5) * 0.2; // slight hover around 0
        }

        // Apply Weekly Change simulation if toggled
        if (changeMode === 'week') {
          const seed = seedRandom(code);
          change = change * 2.2 + (seed - 0.5) * 6.5;
        }

        return {
          name: node.name,
          code: code,
          value: [scaleVal, parseFloat(change.toFixed(2)), price], // [size, change, price]
          labelShowType: scaleVal > 250 ? 'full' : 'name'
        };
      }

      // If it has children (Sectors and Subsectors)
      if (node.children && node.children.length > 0) {
        const formattedChildren = node.children
          .map(child => formatNode(child))
          .filter(Boolean);

        if (formattedChildren.length === 0) return null;

        // Calculate weighted averages
        let totalScale = 0;
        let weightedChangeSum = 0;

        formattedChildren.forEach(child => {
          // If child is a stock leaf, its value is [scale, change, price]
          // If child is a subsector, its value is [avgChange, totalScale]
          const isLeaf = child.children === undefined;
          const childScale = isLeaf ? child.value[0] : child.value[1];
          const childChange = isLeaf ? child.value[1] : child.value[0];

          totalScale += childScale;
          weightedChangeSum += childChange * childScale;
        });

        const avgChange = totalScale > 0 ? (weightedChangeSum / totalScale) : 0;

        return {
          name: node.name,
          value: [parseFloat(avgChange.toFixed(2)), totalScale], // [avgChange, totalScale]
          children: formattedChildren
        };
      }

      return null;
    };

    // Format all sectors from global structure
    const results = rootClone.children
      .map(sector => formatNode(sector))
      .filter(Boolean);

    return results;
  } catch (error) {
    console.error("Error building stock heatmap data:", error);
    return [];
  }
};

/**
 * Generate historical Market Width (MA20 percentage) data for industries.
 */
export const fetchMarketWidthData = () => {
  // Generate last 30 trading days (skipping weekends)
  const dates = [];
  const d = new Date();
  while (dates.length < 30) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.unshift(`${month}-${day}`); // insert at beginning to keep chronological order
    }
    d.setDate(d.getDate() - 1);
  }

  // Get sectors list
  const industries = mapDataGlobal.children.map(s => s.name);

  // Generate values for each industry
  const data = industries.map((ind, indIdx) => {
    // Generate realistic wave movement using sine wave + random walk
    const indSeed = seedRandom(ind);
    let currentVal = Math.round(35 + indSeed * 40); // base width 35-75
    
    const history = dates.map((date, dateIdx) => {
      // Create market cycle effect
      const marketCycle = Math.sin(dateIdx / 4) * 20;
      const industryDrift = Math.cos((dateIdx + indIdx * 3) / 3) * 15;
      const noise = (seedRandom(date + ind) - 0.5) * 8;
      
      let val = currentVal + marketCycle + industryDrift + noise;
      val = Math.max(0, Math.min(100, Math.round(val)));
      return val;
    });

    return {
      industry: ind,
      values: history
    };
  });

  return {
    dates,
    data
  };
};

/**
 * Fetch mock US stock heatmap data for top companies.
 */
export const fetchUSStockData = () => {
  const usSectors = [
    {
      name: "科技巨头 (Technology)",
      children: [
        { name: "苹果公司\nAAPL", scale: 3000, code: "AAPL", change: 1.15, price: 189.84 },
        { name: "微软\nMSFT", scale: 3200, code: "MSFT", change: 0.85, price: 421.90 },
        { name: "英伟达\nNVDA", scale: 2800, code: "NVDA", change: 4.82, price: 125.12 },
        { name: "谷歌-A\nGOOGL", scale: 2100, code: "GOOG", change: -0.42, price: 172.50 },
        { name: "亚马逊\nAMZN", scale: 1900, code: "AMZN", change: 1.62, price: 185.24 },
        { name: "元宇宙\nMETA", scale: 1200, code: "META", change: 2.14, price: 495.10 },
        { name: "特斯拉\nTSLA", scale: 950, code: "TSLA", change: -3.52, price: 178.20 }
      ]
    },
    {
      name: "金融服务 (Financials)",
      children: [
        { name: "摩根大通\nJPM", scale: 620, code: "JPM", change: 0.32, price: 198.50 },
        { name: "美国银行\nBAC", scale: 340, code: "BAC", change: -0.85, price: 39.20 },
        { name: "维萨卡\nV", scale: 500, code: "V", change: 0.12, price: 275.40 },
        { name: "万事达\nMA", scale: 420, code: "MA", change: 0.54, price: 452.80 }
      ]
    },
    {
      name: "医疗健康 (Healthcare)",
      children: [
        { name: "礼来制药\nLLY", scale: 800, code: "LLY", change: 3.12, price: 812.50 },
        { name: "联合健康\nUNH", scale: 480, code: "UNH", change: -1.24, price: 492.10 },
        { name: "强生公司\nJNJ", scale: 380, code: "JNJ", change: -0.15, price: 156.40 },
        { name: "辉瑞制药\nPFE", scale: 160, code: "PFE", change: -0.92, price: 28.50 }
      ]
    },
    {
      name: "消费服务 (Consumer)",
      children: [
        { name: "沃尔玛\nWMT", scale: 520, code: "WMT", change: 0.45, price: 65.80 },
        { name: "宝洁公司\nPG", scale: 390, code: "PG", change: 0.22, price: 165.40 },
        { name: "可口可乐\nKO", scale: 270, code: "KO", change: 0.15, price: 62.90 },
        { name: "百事可乐\nPEP", scale: 240, code: "PEP", change: -0.32, price: 172.10 },
        { name: "麦当劳\nMCD", scale: 210, code: "MCD", change: -0.82, price: 262.40 }
      ]
    }
  ];

  return usSectors.map(sector => {
    let totalScale = 0;
    let weightedChangeSum = 0;

    const children = sector.children.map(stock => {
      totalScale += stock.scale;
      weightedChangeSum += stock.change * stock.scale;

      return {
        name: stock.name.split('\n')[0],
        code: stock.code,
        value: [stock.scale, stock.change, stock.price],
        labelShowType: 'full',
        itemStyle: {
          color: generateHSLColor(stock.change, true)
        }
      };
    });

    const avgChange = totalScale > 0 ? (weightedChangeSum / totalScale) : 0;

    return {
      name: sector.name,
      value: [parseFloat(avgChange.toFixed(2)), totalScale],
      children: children
    };
  });
};

// Helper: Generate HSL color based on percentage change (Red is UP, Green is DOWN. For US, Green is UP, Red is DOWN)
function generateHSLColor(changePercent, isUS = false) {
  if (changePercent === 0 || isNaN(changePercent)) {
    return 'hsl(215, 25%, 27%)'; // Slate-700 / dark slate gray for flat
  }
  
  const absVal = Math.abs(changePercent);
  const ratio = Math.min(absVal / 6, 1); // Clamp maximum intensity at 6% change
  
  const isPositive = changePercent > 0;
  const useRed = isUS ? !isPositive : isPositive;
  
  if (useRed) {
    // Red HSL: Hue = 356 (vibrant crimson red)
    const s = Math.round(60 + 35 * ratio);
    const l = Math.round(15 + 27 * ratio);
    return `hsl(356, ${s}%, ${l}%)`;
  } else {
    // Green HSL: Hue = 142 (emerald green)
    const s = Math.round(55 + 35 * ratio);
    const l = Math.round(13 + 25 * ratio);
    return `hsl(142, ${s}%, ${l}%)`;
  }
}
