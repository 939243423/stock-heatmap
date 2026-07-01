import fetchJsonp from 'fetch-jsonp';

// East Money API Base URL
const API_BASE = 'https://push2.eastmoney.com/api/qt/clist/get';
const COMMON_PARAMS = {
  ut: 'bd1d9ddb04089700cf9c27f6f7426281',
  fltt: '2',
  invt: '2',
  np: '1',
  po: '1',
  fields: 'f12,f14,f2,f3,f20,f62,f100,f20' // f12:code, f14:name, f2:price, f3:change%, f20:marketCap
};

/**
 * Fetch data using JSONP
 * @param {Object} params 
 */
const fetchData = async (params) => {
  const queryString = new URLSearchParams({
    ...COMMON_PARAMS,
    ...params
  }).toString();

  const url = `${API_BASE}?${queryString}`;

  try {
    const response = await fetchJsonp(url, {
        jsonpCallback: 'cb', // Tell the library the param name is 'cb'
        timeout: 10000 
    });
    const json = await response.json();
    if (json && json.data && json.data.diff) {
      return json.data.diff;
    }
    return [];
  } catch (error) {
    console.error('API Fetch Error:', error);
    return [];
  }
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
  const url = `https://push2.eastmoney.com/api/qt/stock/get?${queryString}`;
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
 * Fetch real-time market indices for Shanghai, Shenzhen, Chinext
 */
export const fetchMarketIndices = async () => {
  const secids = ['1.000001', '0.399001', '0.399006'];
  const promises = secids.map(id => fetchSingleStock(id));
  const results = await Promise.all(promises);
  return results.filter(Boolean);
};

/**
 * Get all sectors (Industry Blocks)
 */
export const getSectors = async () => {
  // fs=m:90+t:2+f:!50 represents Industry Plates
  const params = {
    pn: 1,
    pz: 200, // Get top 200 sectors (should cover all)
    fid: 'f3', // Sort by change % default
    fs: 'm:90+t:2+f:!50',
    fields: 'f12,f14,f2,f3,f20,f62' 
  };
  return await fetchData(params);
};

/**
 * Get stocks for a specific sector
 * @param {String} sectorCode e.g., 'BK0420'
 */
export const getStocksInSector = async (sectorCode) => {
  const params = {
    pn: 1,
    pz: 200, // Top 200 stocks in sector (Increased density)
    fid: 'f20', // Sort by market cap
    fs: `b:${sectorCode}`,
    fields: 'f12,f14,f2,f3,f20'
  };
  return await fetchData(params);
};

/**
 * Main function to get Heatmap Data with dynamic deduplication
 */
export const fetchStockData = async () => {
  try {
    // 1. Get Sectors
    const sectors = await getSectors();
    if (!sectors.length) return [];

    // Filter out Roman numeral III sectors first (to avoid double-listing Level 2 and Level 3)
    const filteredSectors = sectors.filter(s => s.f14 && !s.f14.includes('Ⅲ'));

    // Sort by Market Cap descending, and take the top 80 candidate sectors
    const candidateSectors = filteredSectors.sort((a, b) => b.f20 - a.f20).slice(0, 80); 
    
    // 2. Fetch Stocks for these sectors in parallel
    const sectorPromises = candidateSectors.map(async (sector) => {
      const stocks = await getStocksInSector(sector.f12);
      return {
        code: sector.f12,
        rawName: sector.f14,
        name: sector.f14.replace('Ⅱ', ''), // Strip Roman II suffix from display name
        marketCap: sector.f20 === '-' ? 0 : parseFloat(sector.f20),
        change: sector.f3 === '-' ? 0 : parseFloat(sector.f3),
        stocks: stocks
      };
    });

    const sectorsWithStocks = await Promise.all(sectorPromises);

    // 3. Dynamic Deduplication Algorithm based on Stock Overlap
    // Sort sectors by stock count ascending (most specific first)
    const sortedByCount = [...sectorsWithStocks].sort((a, b) => a.stocks.length - b.stocks.length);
    
    const keptSectors = [];
    const coveredStockCodes = new Set();
    const OVERLAP_THRESHOLD = 0.45; // Discard sector if >45% of its stocks are already covered

    for (const sector of sortedByCount) {
      if (sector.stocks.length === 0) continue;
      
      let coveredCount = 0;
      for (const stock of sector.stocks) {
        if (coveredStockCodes.has(stock.f12)) {
          coveredCount++;
        }
      }
      
      const overlapRatio = coveredCount / sector.stocks.length;
      
      // Keep sector only if it is sufficiently unique
      if (overlapRatio <= OVERLAP_THRESHOLD) {
        keptSectors.push(sector);
        for (const stock of sector.stocks) {
          coveredStockCodes.add(stock.f12);
        }
      }
    }

    // 4. Format the final kept sectors and stocks for ECharts
    // Sort final kept sectors by market cap descending to display larger sectors first
    const finalSectors = keptSectors.sort((a, b) => b.marketCap - a.marketCap);

    const results = finalSectors.map(sector => {
      const children = sector.stocks.map((stock, index) => {
        const priceChange = stock.f3 === '-' ? 0 : parseFloat(stock.f3);
        const marketCap = stock.f20 === '-' ? 0 : parseFloat(stock.f20);
        
        // Smart Labeling: Top 15 display name + change%, others display name only
        let labelShowType = 'name';
        if (index < 15) labelShowType = 'full';
        
        return {
          name: stock.f14,
          code: stock.f12,
          value: [marketCap, priceChange], // [MarketCap, Change%] - Index 0 determines Area Size
          labelShowType: labelShowType,
          itemStyle: {
            color: generateHSLColor(priceChange)
          }
        };
      });

      return {
        name: sector.name,
        value: [sector.change, sector.marketCap],
        children: children
      };
    });

    return results;

  } catch (error) {
    console.error("Error fetching stock data:", error);
    return [];
  }
};

// Helper: Generate HSL color based on percentage change
function generateHSLColor(changePercent) {
  if (changePercent === 0 || isNaN(changePercent)) {
    return 'hsl(215, 25%, 27%)'; // Slate-700 / dark slate gray for flat
  }
  
  const absVal = Math.abs(changePercent);
  const ratio = Math.min(absVal / 8, 1); // Clamp maximum intensity at 8% change
  
  if (changePercent > 0) {
    // Red HSL: Hue = 356 (vibrant crimson red)
    // Saturation ranges 60% -> 90%, Lightness ranges 15% -> 42%
    const s = Math.round(60 + 30 * ratio);
    const l = Math.round(15 + 27 * ratio);
    return `hsl(356, ${s}%, ${l}%)`;
  } else {
    // Green HSL: Hue = 142 (emerald green)
    // Saturation ranges 55% -> 85%, Lightness ranges 13% -> 36%
    const s = Math.round(55 + 30 * ratio);
    const l = Math.round(13 + 23 * ratio);
    return `hsl(142, ${s}%, ${l}%)`;
  }
}

