// ============================================================================
// 01-state.js — Global State Variables & Constants
// ============================================================================

// Global State variables
let pricesData = null;
let metaData = null;

let relativeChart = null;
let trendChart = null;
let volumeChart = null;
let ihsgTrendChart = null; // simple IHSG MA50 chart
let activeScalingChart = null; // track the chart being dragged/scaled on x-axis
let currentResampledData = null; // cached resampled dataset for the current ticker and timeframe

// Timeframe state
let currentTimeframe = 'daily'; // controls trendChart & volumeChart
let relativeTimeframe = 'daily'; // controls relativeChart
let heatmapTimeframe = 'daily'; // controls simple IHSG & stock heatmap

// Debouncing for insights updates to prevent layout thrashing
let _insightsDebounceTimeout = null;
function debouncedUpdateInsights() {
    if (_insightsDebounceTimeout) clearTimeout(_insightsDebounceTimeout);
    _insightsDebounceTimeout = setTimeout(() => {
        _insightsDebounceTimeout = null;
        updateInsightsFromChart();
    }, 100);
}

// Sync lock to prevent recursive updates between linked charts
let isSyncing = false;
let isDetailChartAnimating = false;

// Ruler measurement tool state
let rulerState = {
    active: false,
    startPoint: null,
    endPoint: null,
    currentMousePoint: null,
    isMeasuring: false
};

// Crosshair state for synchronized charts
let crosshairState = {
    xVal: null,
    yValTrend: null,
    yValVolume: null,
    activeChartId: null
};

// Pre-cached sorted timestamps for O(log n) snap — filled by updateTrendChart
let _trendTimestamps = [];

// RAF handle to throttle crosshair redraws to 60fps
let _crosshairRafId = null;

// RAF handle to throttle timeline scaling drag updates to 60fps
let _scalingRafId = null;


// Ticker Names Map for display
const TICKER_NAMES = {
    "BBCA": "PT Bank Central Asia Tbk",
    "BBRI": "PT Bank Rakyat Indonesia Tbk",
    "BMRI": "PT Bank Mandiri Tbk",
    "TLKM": "PT Telkom Indonesia Tbk",
    "BREN": "PT Barito Renewables Energy Tbk",
    "AMMN": "PT Amman Mineral Internasional Tbk",
    "ASII": "PT Astra International Tbk",
    "ANTM": "PT Aneka Tambang Tbk",
    "UNVR": "PT Unilever Indonesia Tbk",
    "IHSG": "Indeks Harga Saham Gabungan (IHSG)"
};

// Colors for Chart 1
const ASSET_COLORS = {
    "IHSG": "#9CA3AF", // Light Gray (Benchmark)
    "BBCA": "#F59E0B", // Amber
    "BBRI": "#3B82F6", // Blue
    "BMRI": "#F97316", // Orange
    "TLKM": "#EF4444", // Red
    "BREN": "#10B981", // Green
    "AMMN": "#06B6D4", // Cyan
    "ASII": "#8B5CF6", // Purple
    "ANTM": "#EC4899", // Pink
    "UNVR": "#84CC16"  // Lime
};
