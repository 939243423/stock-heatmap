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
    // cb: ... // REMOVED: Let fetch-jsonp handle the callback parameter automatically
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
 * Main function to get Heatmap Data
 * Strategy:
 * 1. Get All Sectors
 * 2. Sort sectors by Market Cap (to show significant ones)
 * 3. Fetch stocks for Top N Sectors (e.g., Top 50)
 * 4. Format for ECharts
 */
export const fetchStockData = async () => {
  try {
    // 1. Get Sectors
    const sectors = await getSectors();
    if (!sectors.length) return [];

    // Filter out invalid sectors or too small?
    // Sort by Market Cap (f20) descending to prioritize big sectors
    // INCREASED: Top 50 sectors to reduce empty space and show more market breadth
    const sortedSectors = sectors.sort((a, b) => b.f20 - a.f20).slice(0, 50); 
    
    // 2. Fetch Stocks for these sectors in parallel
    const sectorPromises = sortedSectors.map(async (sector) => {
      // INCREASED limit per sector to 200 to fill gaps
      const stocks = await getStocksInSector(sector.f12);
      
      // Format stocks
      const children = stocks.map(stock => {
        // Handle invalid numbers
        const priceChange = stock.f3 === '-' ? 0 : parseFloat(stock.f3);
        const marketCap = stock.f20 === '-' ? 0 : parseFloat(stock.f20);
        
        return {
          name: stock.f14,
          code: stock.f12, // Add Stock Code
          value: [marketCap, priceChange], // [MarketCap, Change%] - Index 0 determines Area Size
          itemStyle: {
            // Color mapping: Red for Up, Green for Down
            color: priceChange > 0 ? 
                   generateColor('#ef4444', priceChange) : 
                   (priceChange < 0 ? generateColor('#22c55e', priceChange) : '#334155')
          }
        };
      });

      return {
        name: sector.f14,
        value: [sector.f3 === '-' ? 0 : parseFloat(sector.f3), sector.f20],
        children: children
      };
    });

    const results = await Promise.all(sectorPromises);
    return results;

  } catch (error) {
    console.error("Error fetching stock data:", error);
    return [];
  }
};

// Helper: Adjust color intensity based on percentage change
function generateColor(baseHex, changePercent) {
  // Max intensity at 10% change (limit up/down)
  // Ensure changePercent is positive for calculation ratio
  const val = Math.abs(changePercent);
  const ratio = Math.min(val / 10, 1);
  
  // Base colors
  // Red: #ef4444 (239, 68, 68)
  // Green: #22c55e (34, 197, 94)
  // Background: #1e293b (30, 41, 59)
  
  const bg = { r: 30, g: 41, b: 59 };
  let fg = { r: 0, g: 0, b: 0 };
  
  if (baseHex === '#ef4444') {
      fg = { r: 239, g: 68, b: 68 };
  } else {
      fg = { r: 34, g: 197, b: 94 };
  }
  
  // Linear interpolation
  // P3 color space might look better but RGB is standard
  const r = Math.round(bg.r + (fg.r - bg.r) * ratio);
  const g = Math.round(bg.g + (fg.g - bg.g) * ratio);
  const b = Math.round(bg.b + (fg.b - bg.b) * ratio);
  
  return `rgb(${r}, ${g}, ${b})`;
}
