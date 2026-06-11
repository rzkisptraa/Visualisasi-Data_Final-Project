// Global State variables
let pricesData = null;
let metaData = null;

let relativeChart = null;
let trendChart = null;
let volumeChart = null;

// Timeframe state
let currentTimeframe = 'daily'; // controls trendChart & volumeChart
let relativeTimeframe = 'daily'; // controls relativeChart

// Sync lock to prevent recursive updates between linked charts
let isSyncing = false;

// Ruler measurement tool state
let rulerState = {
    active: false,
    startPoint: null,
    endPoint: null,
    currentMousePoint: null,
    isMeasuring: false
};

// Ticker Names Map for display
const TICKER_NAMES = {
    "BBCA": "PT Bank Central Asia Tbk",
    "BBRI": "PT Bank Rakyat Indonesia Tbk",
    "BMRI": "PT Bank Mandiri Tbk",
    "TLKM": "PT Telkom Indonesia Tbk",
    "BREN": "PT Barito Renewables Energy Tbk",
    "AMMN": "PT Amman Mineral Internasional Tbk",
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
    "AMMN": "#06B6D4"  // Cyan
};

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        // Fetch JSON files
        const [pricesRes, metaRes] = await Promise.all([
            fetch('data/prices.json'),
            fetch('data/meta.json')
        ]);
        
        if (!pricesRes.ok || !metaRes.ok) {
            throw new Error('Failed to fetch data files');
        }
        
        pricesData = await pricesRes.json();
        metaData = await metaRes.json();
        
        // Pre-calculate rebased return for each stock relative to its first active day (IPO date)
        Object.keys(pricesData).forEach(ticker => {
            const data = pricesData[ticker];
            const firstActiveItem = data.find(item => item.active !== false);
            const firstClose = firstActiveItem ? firstActiveItem.close : null;
            data.forEach(item => {
                if (firstClose !== null && item.active !== false) {
                    item.rebased = firstClose !== 0 ? ((item.close - firstClose) / firstClose) * 100 : 0;
                } else {
                    item.rebased = null;
                }
            });
        });
        
        // Setup metadata & KPI counters
        setupMetadata();
        setupKPIs();
        
        // Render Chart 1 (Relative Performance)
        renderRelativeChart();
        
        // Init Selected Stock detail charts and insights
        const stockSelect = document.getElementById('stock-select');
        
        // Setup global timeframe button selector (controls trend & volume charts only)
        const tfSelector = document.getElementById('timeframe-selector');
        tfSelector.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tfSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentTimeframe = e.target.dataset.tf;
                
                const currentStock = document.getElementById('stock-select').value;
                updateSelectedStockView(currentStock);
            });
        });

        // Setup relative performance timeframe button selector (controls relative chart only)
        const relTfSelector = document.getElementById('relative-timeframe-selector');
        relTfSelector.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                relTfSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                relativeTimeframe = e.target.dataset.tf;
                
                updateRelativeChart();
            });
        });
        
        // Setup initial view
        updateAllViews();
        
        // Setup ruler measurement tool button and event handlers
        setupRulerToggle();
        setupRulerEvents();
        
        // Add dropdown change listener
        stockSelect.addEventListener('change', (e) => {
            updateSelectedStockView(e.target.value);
        });
        
        // Add double-click listeners on canvases for zoom reset
        const relativeCanvas = document.getElementById('relativePerformanceChart');
        const trendCanvas = document.getElementById('trendChart');
        const volumeCanvas = document.getElementById('volumeChart');
        
        relativeCanvas.addEventListener('dblclick', () => {
            handleChartReset(relativeChart);
        });
        
        trendCanvas.addEventListener('dblclick', () => {
            handleChartReset(trendChart);
            if (volumeChart) {
                syncXAxis(trendChart, volumeChart);
            }
            updateInsightsFromChart();
        });
        
        volumeCanvas.addEventListener('dblclick', () => {
            handleChartReset(trendChart);
            if (volumeChart) {
                syncXAxis(trendChart, volumeChart);
            }
            updateInsightsFromChart();
        });
        
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('analysis-insights-box').innerHTML = `
            <div style="color: var(--bearish-color); padding: 10px; border: 1px solid rgba(255,85,85,0.2); background: rgba(255,85,85,0.05); border-radius: 6px;">
                <strong>Gagal memuat data dashboard.</strong> Silakan jalankan <code>python scripts/fetch_data.py</code> untuk membuat file data JSON terlebih dahulu.
            </div>
        `;
    }
}

// Setup static metadata values
function setupMetadata() {
    document.getElementById('last-update-time').textContent = metaData.last_update;
}

// Helper for count up animation using requestAnimationFrame
function animateValue(elementId, start, end, duration, decimalPlaces = 0, prefix = "", suffix = "") {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    
    let startTimestamp = null;
    const isNegative = end < 0;
    const absoluteEnd = Math.abs(end);
    const absoluteStart = Math.abs(start);
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = progress * (absoluteEnd - absoluteStart) + absoluteStart;
        
        // Apply decimal places and format
        const formattedVal = currentVal.toFixed(decimalPlaces);
        const displayVal = parseFloat(formattedVal).toLocaleString('id-ID', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });
        
        // Re-apply negative sign if needed
        const sign = isNegative ? "-" : (suffix === "%" && end > 0 ? "+" : "");
        obj.textContent = prefix + sign + displayVal + suffix;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    
    window.requestAnimationFrame(step);
}

// Setup KPIs with animations
function setupKPIs() {
    // KPI 1: IHSG Current Close (Format: IDR format with 2 decimals)
    animateValue('kpi-ihsg-val', 0, metaData.ihsg_current, 1000, 2);
    
    // KPI 2: Status Pasar
    const statusVal = document.getElementById('kpi-status-val');
    const statusDesc = document.getElementById('kpi-status-desc');
    statusVal.textContent = metaData.status_pasar;
    
    if (metaData.status_pasar === 'Bullish') {
        statusVal.className = 'kpi-value text-success';
        statusDesc.textContent = 'IHSG di atas MA50';
    } else {
        statusVal.className = 'kpi-value text-danger';
        statusDesc.textContent = 'IHSG di bawah MA50';
    }
    
    // KPI 3: Top Outperformer
    const topOut = metaData.top_outperformer;
    const topOutVal = document.getElementById('kpi-outperformer-val');
    topOutVal.innerHTML = `${topOut.ticker} <span id="top-out-pct"></span>`;
    animateValue('top-out-pct', 0, topOut.return, 1000, 1, "(", "%)");
    
    // KPI 4: Top Underperformer
    const topUnder = metaData.top_underperformer;
    const topUnderVal = document.getElementById('kpi-underperformer-val');
    topUnderVal.innerHTML = `${topUnder.ticker} <span id="top-under-pct"></span>`;
    animateValue('top-under-pct', 0, topUnder.return, 1000, 1, "(", "%)");
}

// Helper to trigger update for all views
function updateAllViews() {
    updateRelativeChart();
    const currentStock = document.getElementById('stock-select').value;
    updateSelectedStockView(currentStock);
}

// Get the length of the resampled series for a ticker
function getResampledLength(ticker) {
    if (!pricesData || !pricesData[ticker]) return 0;
    const resampled = resampleDataset(pricesData[ticker], currentTimeframe);
    return resampled.length;
}

// Resample daily prices data based on timeframe
function resampleDataset(data, timeframe) {
    if (timeframe === 'daily') return data;
    
    const groups = {};
    data.forEach(item => {
        let key;
        if (timeframe === 'weekly') {
            key = getMondayDate(item.date);
        } else if (timeframe === 'monthly') {
            key = item.date.substring(0, 7);
        } else if (timeframe === 'yearly') {
            key = item.date.substring(0, 4);
        }
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });
    
    const resampled = [];
    Object.keys(groups).sort().forEach(key => {
        const group = groups[key];
        const firstItem = group[0];
        const lastItem  = group[group.length - 1];
        
        // Aggregate OHLC and volume properly across the period
        const periodHigh = Math.max(...group.map(g => g.high));
        const periodLow  = Math.min(...group.map(g => g.low));
        const periodVolume = group.reduce((sum, g) => sum + g.volume, 0);
        
        // Determine warna_volume based on period close vs period open
        const warnaVolume = (lastItem.close >= firstItem.open) ? '#12C286' : '#FF5555';
        
        resampled.push({
            ...lastItem,
            open:   firstItem.open,
            high:   periodHigh,
            low:    periodLow,
            close:  lastItem.close,
            volume: periodVolume,
            warna_volume: warnaVolume
        });
    });
    return resampled;
}

// Get the date string for Monday of the given date's week
function getMondayDate(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

// Helper to determine min and max values of visible data arrays for vertical scaling
// Handles both plain numbers (index-based axis) and OHLC/line objects ({x, o, h, l, c} or {x, y})
function autoScaleY(chart) {
    if (!chart || !chart.scales || !chart.scales.x || !chart.scales.y) return;
    
    const xScale = chart.scales.x;
    const xMin = xScale.min;
    const xMax = xScale.max;
    
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    const isTimeScale = xScale.type === 'time' || xScale.type === 'timeseries';
    
    chart.data.datasets.forEach((dataset, dsIndex) => {
        if (!chart.isDatasetVisible(dsIndex)) return;
        
        dataset.data.forEach((item, idx) => {
            if (item === null || item === undefined) return;
            
            let valMin, valMax;
            
            if (isTimeScale) {
                // For time scales, items are objects like {x, o, h, l, c} or {x, y}
                const t = item.x;
                if (t < xMin || t > xMax) return;
                
                if (item.o !== undefined && item.h !== undefined && item.l !== undefined && item.c !== undefined) {
                    // Candlestick data
                    valMin = item.l;
                    valMax = item.h;
                } else if (item.y !== undefined) {
                    // Line data or Bar data (volume)
                    valMin = item.y;
                    valMax = item.y;
                } else {
                    return;
                }
            } else {
                // For category scales, items are plain numbers or {y} objects, and checked by index
                if (idx < xMin || idx > xMax) return;
                
                const val = (typeof item === 'object' && item.y !== undefined) ? item.y : item;
                if (typeof val !== 'number' || isNaN(val)) return;
                valMin = val;
                valMax = val;
            }
            
            if (valMin < minVal) minVal = valMin;
            if (valMax > maxVal) maxVal = valMax;
        });
    });
    
    if (minVal !== Infinity && maxVal !== -Infinity) {
        if (chart.canvas.id === 'volumeChart') {
            chart.options.scales.y.min = 0;
            chart.options.scales.y.max = maxVal * 1.1; // 10% headroom
        } else {
            const range = maxVal - minVal;
            const padding = range * 0.05 || 1.0;
            chart.options.scales.y.min = minVal - padding;
            chart.options.scales.y.max = maxVal + padding;
        }
    }
}

// Sync X-axis zoom/pan between linked charts
function syncXAxis(sourceChart, targetChart) {
    if (!sourceChart || !targetChart || isSyncing) return;
    isSyncing = true;
    
    const sourceMin = sourceChart.scales.x.min;
    const sourceMax = sourceChart.scales.x.max;
    
    targetChart.options.scales.x.min = sourceMin;
    targetChart.options.scales.x.max = sourceMax;
    
    targetChart.update('none');
    isSyncing = false;
}

// Get default zoom size based on the timeframe
function getDefaultZoom(N) {
    if (currentTimeframe === 'daily') return Math.min(N, 22);
    if (currentTimeframe === 'weekly') return Math.min(N, 12);
    if (currentTimeframe === 'monthly') return Math.min(N, 36);
    if (currentTimeframe === 'yearly') return Math.min(N, 10);
    return N;
}

// Extract the visible data range from resampled stock data
function getVisibleStockData(chart, resampledData) {
    if (!chart || !chart.scales || !chart.scales.x) {
        const N = resampledData.length;
        return resampledData.slice(Math.max(0, N - getDefaultZoom(N)));
    }
    
    const isTimeScale = chart.options.scales.x.type === 'timeseries' || chart.options.scales.x.type === 'time';
    
    if (isTimeScale) {
        const xMin = chart.scales.x.min;
        const xMax = chart.scales.x.max;
        return resampledData.filter(item => {
            const t = new Date(item.date).getTime();
            return t >= xMin && t <= xMax;
        });
    } else {
        const minIndex = Math.max(0, Math.floor(chart.scales.x.min));
        const maxIndex = Math.min(resampledData.length - 1, Math.ceil(chart.scales.x.max));
        return resampledData.slice(minIndex, maxIndex + 1);
    }
}

// Update insights box dynamically based on the current chart view range
function updateInsightsFromChart() {
    const ticker = document.getElementById('stock-select').value;
    const stockData = pricesData[ticker];
    if (!stockData) return;
    
    // Filter out pre-IPO/inactive days so insights are correct
    const activeStockData = stockData.filter(item => item.active !== false);
    const resampled = resampleDataset(activeStockData, currentTimeframe);
    const visibleData = getVisibleStockData(trendChart, resampled);
    generateInsights(ticker, visibleData);
}

// Handle double click reset interaction
function handleChartReset(chart) {
    if (!chart) return;
    
    const isTimeScale = chart.options.scales.x.type === 'timeseries' || chart.options.scales.x.type === 'time';
    
    if (isTimeScale) {
        const dataset = chart.data.datasets[0];
        if (dataset && dataset.data && dataset.data.length > 0) {
            const data = dataset.data;
            const N = data.length;
            const defaultZoom = getDefaultZoom(N);
            
            const minIndex = Math.max(0, N - defaultZoom);
            const maxIndex = N - 1;
            
            chart.options.scales.x.min = data[minIndex].x;
            chart.options.scales.x.max = data[maxIndex].x;
        }
    } else {
        const N = chart.data.labels ? chart.data.labels.length : 0;
        const defaultZoom = getDefaultZoom(N);
        chart.options.scales.x.min = Math.max(0, N - defaultZoom);
        chart.options.scales.x.max = N - 1;
    }
    
    autoScaleY(chart);
    chart.update('none');
}

// Chart 1: Performa Relatif
function renderRelativeChart() {
    const ctx = document.getElementById('relativePerformanceChart').getContext('2d');
    
    relativeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    limits: {
                        x: {
                            min: 0,
                            max: 'original',
                            minRange: 10
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        onPan: ({chart}) => {
                            autoScaleY(chart);
                            chart.update('none');
                        }
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        onZoom: ({chart}) => {
                            autoScaleY(chart);
                            chart.update('none');
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 11 },
                        boxWidth: 12,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: '#141A21',
                    borderColor: '#2A3441',
                    borderWidth: 1,
                    titleColor: '#FFFFFF',
                    bodyColor: '#9CA3AF',
                    titleFont: { family: 'Inter', weight: 'bold' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                const val = context.parsed.y;
                                const sign = val > 0 ? '+' : '';
                                label += sign + val.toFixed(2) + '%';
                                
                                // Add actual price validation to tooltip
                                const dataIndex = context.dataIndex;
                                const prices = context.dataset.prices;
                                const firstClose = context.dataset.firstClose;
                                if (prices && prices[dataIndex] !== null && prices[dataIndex] !== undefined) {
                                    const actualPrice = prices[dataIndex];
                                    const ticker = context.dataset.label;
                                    const formattedPrice = actualPrice.toLocaleString('id-ID', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 2
                                    });
                                    if (firstClose !== null && firstClose !== undefined) {
                                        const formattedFirst = firstClose.toLocaleString('id-ID', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2
                                        });
                                        if (ticker.includes('IHSG')) {
                                            label += ` (${formattedFirst} → ${formattedPrice})`;
                                        } else {
                                            label += ` (Rp ${formattedFirst} → Rp ${formattedPrice})`;
                                        }
                                    } else {
                                        if (ticker.includes('IHSG')) {
                                            label += ` (${formattedPrice})`;
                                        } else {
                                            label += ` (Rp ${formattedPrice})`;
                                        }
                                    }
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: { color: '#9CA3AF', font: { family: 'Inter', size: 10 }, maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return value.toFixed(0) + '%'; }
                    }
                }
            }
        }
    });
}

// Update Chart 1 dynamically based on resampled and sliced datasets
function updateRelativeChart() {
    if (!relativeChart || !pricesData) return;
    
    const rawIHSG = pricesData["IHSG"];
    const resampledIHSG = resampleDataset(rawIHSG, relativeTimeframe);
    const labels = resampledIHSG.map(item => item.date);
    
    const datasets = Object.keys(pricesData).map(ticker => {
        const resampled = resampleDataset(pricesData[ticker], relativeTimeframe);
        
        const rawData = pricesData[ticker];
        const firstActiveItem = rawData.find(item => item.active !== false);
        const firstClose = firstActiveItem ? firstActiveItem.close : null;
        
        const rebasedData = resampled.map(item => item.rebased);
        const pricesList = resampled.map(item => item.active !== false ? item.close : null);
        
        return {
            label: ticker === 'IHSG' ? 'IHSG (Benchmark)' : ticker,
            data: rebasedData,
            prices: pricesList,
            firstClose: firstClose,
            borderColor: ASSET_COLORS[ticker] || '#FFF',
            borderWidth: ticker === 'IHSG' ? 3 : 1.8,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            tension: 0.1,
            zIndex: ticker === 'IHSG' ? 10 : 1
        };
    });
    
    datasets.sort((a, b) => (a.label.includes('IHSG') ? 1 : -1));
    
    relativeChart.data.labels = labels;
    relativeChart.data.datasets = datasets;
    
    const N = labels.length;
    const defaultZoom = getDefaultZoom(N);
    
    const minIndex = Math.max(0, N - defaultZoom);
    const maxIndex = N - 1;
    
    relativeChart.options.scales.x.min = minIndex;
    relativeChart.options.scales.x.max = maxIndex;
    
    autoScaleY(relativeChart);
    relativeChart.update('none');
}

// Update Detail View (Chart 2, Chart 3, and Insights)
function updateSelectedStockView(ticker) {
    document.querySelectorAll('.selected-stock-ticker').forEach(el => {
        el.textContent = ticker;
    });
    document.querySelectorAll('.selected-stock-ticker-full').forEach(el => {
        el.textContent = ` - ${TICKER_NAMES[ticker]}`;
    });
    
    const stockData = pricesData[ticker];
    if (!stockData) return;
    
    // Filter out pre-IPO/inactive days so detailed charts start on the listing date
    const activeStockData = stockData.filter(item => item.active !== false);
    const resampled = resampleDataset(activeStockData, currentTimeframe);
    
    updateTrendChart(resampled, ticker);
    updateMACDChart(resampled);
    
    const N = resampled.length;
    const defaultZoom = getDefaultZoom(N);
    
    const minIndex = Math.max(0, N - defaultZoom);
    const maxIndex = N - 1;
    
    if (trendChart && trendChart.data.datasets[0] && trendChart.data.datasets[0].data.length > 0) {
        const data = trendChart.data.datasets[0].data;
        trendChart.options.scales.x.min = data[minIndex].x;
        trendChart.options.scales.x.max = data[maxIndex].x;
        autoScaleY(trendChart);
        trendChart.update('none');
    }
    if (volumeChart && volumeChart.data.datasets[0] && volumeChart.data.datasets[0].data.length > 0) {
        const data = volumeChart.data.datasets[0].data;
        volumeChart.options.scales.x.min = data[minIndex].x;
        volumeChart.options.scales.x.max = data[maxIndex].x;
        autoScaleY(volumeChart);
        volumeChart.update('none');
    }
    
    const visibleData = getVisibleStockData(trendChart, resampled);
    generateInsights(ticker, visibleData);
}

// Chart 2: Trend Chart (Candlestick + MA lines)
function updateTrendChart(resampled, ticker) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }
    
    const candleData = resampled.map(item => ({
        x: new Date(item.date).getTime(),
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        volume: item.volume
    }));
    
    const ma20Data = resampled.map(item => ({
        x: new Date(item.date).getTime(),
        y: item.ma20 != null ? item.ma20 : null
    }));
    const ma50Data = resampled.map(item => ({
        x: new Date(item.date).getTime(),
        y: item.ma50 != null ? item.ma50 : null
    }));
    
    const datasets = [
        {
            type: 'candlestick',
            label: ticker,
            data: candleData,
            color: {
                up:        '#12C286',  // bullish (close >= open)
                down:      '#FF5555',  // bearish (close < open)
                unchanged: '#9CA3AF'   // flat
            },
            borderColor: {
                up:        '#12C286',
                down:      '#FF5555',
                unchanged: '#9CA3AF'
            }
        },
        {
            type: 'line',
            label: 'MA20',
            data: ma20Data,
            borderColor: '#F59E0B',   // yellow
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            borderDash: [4, 3],
            tension: 0.1,
            spanGaps: true
        },
        {
            type: 'line',
            label: 'MA50',
            data: ma50Data,
            borderColor: '#3B82F6',   // blue
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            borderDash: [6, 4],
            tension: 0.1,
            spanGaps: true
        }
    ];
    
    trendChart = new Chart(ctx, {
        type: 'candlestick',
        data: { datasets: datasets },
        plugins: [trendChartRulerPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        onPan: ({chart}) => {
                            syncXAxis(chart, volumeChart);
                            autoScaleY(chart);
                            chart.update('none');
                            updateInsightsFromChart();
                        }
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.1 },
                        pinch: { enabled: true },
                        mode: 'x',
                        onZoom: ({chart}) => {
                            syncXAxis(chart, volumeChart);
                            autoScaleY(chart);
                            chart.update('none');
                            updateInsightsFromChart();
                        }
                    }
                },
                legend: {
                    display: true,
                    labels: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10 },
                        filter: function(item) {
                            return item.text === 'MA20' || item.text === 'MA50';
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#141A21',
                    borderColor: '#2A3441',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const ds = context.dataset;
                            if (ds.type === 'candlestick') {
                                const d = context.raw;
                                return [
                                    `Open : Rp ${d.o.toLocaleString('id-ID')}`,
                                    `High : Rp ${d.h.toLocaleString('id-ID')}`,
                                    `Low  : Rp ${d.l.toLocaleString('id-ID')}`,
                                    `Close: Rp ${d.c.toLocaleString('id-ID')}`
                                ];
                            }
                            let label = ds.label || '';
                            if (label) label += ': Rp ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'timeseries',
                    time: { unit: 'month', tooltipFormat: 'dd MMM yyyy' },
                    adapters: { date: { locale: 'id' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: { color: '#9CA3AF', font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return 'Rp ' + value.toLocaleString('id-ID'); }
                    },
                    afterFit: function(scaleInstance) {
                        scaleInstance.width = 90;
                    }
                }
            }
        }
    });
}

// Chart 3: MACD Chart
function updateMACDChart(resampled) {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    
    if (volumeChart) {
        volumeChart.destroy();
        volumeChart = null;
    }
    
    // Calculate MACD values
    const macdData = calculateMACD(resampled);
    
    const dates = resampled.map(item => new Date(item.date).getTime());
    
    const histogramData = resampled.map((item, idx) => ({
        x: dates[idx],
        y: macdData.histogram[idx]
    }));
    
    const macdLineData = resampled.map((item, idx) => ({
        x: dates[idx],
        y: macdData.macdLine[idx]
    }));
    
    const signalLineData = resampled.map((item, idx) => ({
        x: dates[idx],
        y: macdData.signalLine[idx]
    }));
    
    const barColors = macdData.histogram.map(val => val >= 0 ? '#26A69A' : '#EF5350');
    
    const datasets = [
        {
            type: 'line',
            label: 'MACD Line',
            data: macdLineData,
            borderColor: '#FFFFFF',
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            tension: 0.1,
            order: 1
        },
        {
            type: 'line',
            label: 'Signal Line',
            data: signalLineData,
            borderColor: '#3B82F6',
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            tension: 0.1,
            order: 2
        },
        {
            type: 'bar',
            label: 'MACD Histogram',
            data: histogramData,
            backgroundColor: barColors,
            borderColor: barColors,
            borderWidth: 1,
            barPercentage: 0.85,
            categoryPercentage: 0.95,
            order: 3
        }
    ];
    
    volumeChart = new Chart(ctx, {
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        onPan: ({chart}) => {
                            syncXAxis(chart, trendChart);
                            autoScaleY(trendChart);
                            chart.update('none');
                            updateInsightsFromChart();
                        }
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.1 },
                        pinch: { enabled: true },
                        mode: 'x',
                        onZoom: ({chart}) => {
                            syncXAxis(chart, trendChart);
                            autoScaleY(trendChart);
                            chart.update('none');
                            updateInsightsFromChart();
                        }
                    }
                },
                legend: {
                    display: true,
                    labels: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10 }
                    }
                },
                tooltip: {
                    backgroundColor: '#141A21',
                    borderColor: '#2A3441',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                const val = context.parsed.y;
                                const sign = val >= 0 ? '+' : '';
                                label += sign + val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'timeseries',
                    time: { unit: 'month', tooltipFormat: 'dd MMM yyyy' },
                    adapters: { date: { locale: 'id' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: { color: '#9CA3AF', font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) {
                            return value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                        }
                    },
                    afterFit: function(scaleInstance) {
                        scaleInstance.width = 90;
                    }
                }
            }
        }
    });
}

// Generate Insights Automatically
function generateInsights(ticker, stockData) {
    if (stockData.length === 0) return;
    
    const latest = stockData[stockData.length - 1];
    const prev = stockData[stockData.length - 2] || latest;
    const first = stockData[0];
    
    const close = latest.close;
    const ma20 = latest.ma20;
    const ma50 = latest.ma50;
    const latestVolume = latest.volume;
    
    // Calculate returns
    const stockReturn = ((close - first.close) / first.close * 100).toFixed(1);
    
    // Calculate IHSG return in same period
    const rawIHSG = pricesData["IHSG"];
    const resampledIHSG = resampleDataset(rawIHSG, currentTimeframe);
    // Find matching date in IHSG
    const matchingFirstIHSG = resampledIHSG.find(item => item.date === first.date) || resampledIHSG[0];
    const matchingLatestIHSG = resampledIHSG.find(item => item.date === latest.date) || resampledIHSG[resampledIHSG.length - 1];
    const ihsgReturn = ((matchingLatestIHSG.close - matchingFirstIHSG.close) / matchingFirstIHSG.close * 100).toFixed(1);
    
    // 1. Determine Trend Badge & Text
    let trendBadge = "Neutral";
    let trendBadgeClass = "badge-neutral";
    let trendInsightText = "";
    
    if (close > ma50) {
        trendBadge = "Bullish";
        trendBadgeClass = "badge-bullish";
        trendInsightText = `<span class="text-success">bullish</span>. Harga penutupan terbaru (Rp ${close.toLocaleString('id-ID')}) berada di atas MA50 (Rp ${ma50.toLocaleString('id-ID')}), yang menunjukkan pergerakan tren jangka menengah yang kuat.`;
    } else {
        trendBadge = "Bearish";
        trendBadgeClass = "badge-bearish";
        trendInsightText = `<span class="text-danger">bearish</span>. Harga penutupan terbaru (Rp ${close.toLocaleString('id-ID')}) berada di bawah MA50 (Rp ${ma50.toLocaleString('id-ID')}), yang mengindikasikan tekanan jual jangka menengah.`;
    }
    
    // Add short-term MA20 reference
    let shortTermTrend = "";
    if (close > ma20) {
        shortTermTrend = `Di jangka pendek, harga juga diperdagangkan di atas MA20 (Rp ${ma20.toLocaleString('id-ID')}), mengonfirmasi kekuatan momentum beli saat ini.`;
    } else {
        shortTermTrend = `Di jangka pendek, harga tertekan di bawah MA20 (Rp ${ma20.toLocaleString('id-ID')}), menunjukkan adanya pelemahan tren jangka pendek.`;
    }
    
    // Update Trend Badge
    const trBadgeEl = document.getElementById('stock-trend-badge');
    if (trBadgeEl) {
        trBadgeEl.textContent = trendBadge;
        trBadgeEl.className = `badge ${trendBadgeClass}`;
    }
    
    // 2. Determine MACD Momentum Badge & Text
    const macdData = calculateMACD(stockData);
    const len = stockData.length;
    const latestMacd = macdData.macdLine[len - 1];
    const latestSignal = macdData.signalLine[len - 1];
    const latestHist = macdData.histogram[len - 1];
    
    const prevMacd = macdData.macdLine[len - 2] || latestMacd;
    const prevSignal = macdData.signalLine[len - 2] || latestSignal;
    const prevHist = macdData.histogram[len - 2] || latestHist;
    
    let momentumBadge = "Momentum Neutral";
    let momentumBadgeClass = "badge-neutral";
    let momentumInsightText = "";
    
    if (latestMacd > latestSignal) {
        momentumBadge = "Momentum Bullish";
        momentumBadgeClass = "badge-bullish";
        momentumInsightText = `Indikator MACD menunjukkan momentum <span class="text-success">bullish</span>. MACD Line (Rp ${latestMacd.toLocaleString('id-ID', { maximumFractionDigits: 2 })}) berada di atas Signal Line (Rp ${latestSignal.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), yang mengindikasikan kekuatan tren naik. `;
    } else {
        momentumBadge = "Momentum Bearish";
        momentumBadgeClass = "badge-bearish";
        momentumInsightText = `Indikator MACD menunjukkan momentum <span class="text-danger">bearish</span>. MACD Line (Rp ${latestMacd.toLocaleString('id-ID', { maximumFractionDigits: 2 })}) berada di bawah Signal Line (Rp ${latestSignal.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), yang mengindikasikan tekanan turun. `;
    }
    
    // Add Histogram description
    if (latestHist > 0) {
        if (latestHist > prevHist) {
            momentumInsightText += `Histogram MACD bernilai positif dan menguat (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), menunjukkan akselerasi kekuatan beli.`;
        } else {
            momentumInsightText += `Histogram MACD bernilai positif namun mulai melemah (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), mengindikasikan perlambatan momentum beli.`;
        }
    } else {
        if (latestHist < prevHist) {
            momentumInsightText += `Histogram MACD bernilai negatif dan memburuk (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), menunjukkan akselerasi kekuatan jual.`;
        } else {
            momentumInsightText += `Histogram MACD bernilai negatif namun mulai mengecil/membaik (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), mengindikasikan pelemahan momentum jual (potensi pembalikan arah naik).`;
        }
    }
    
    const momBadgeEl = document.getElementById('stock-volume-badge');
    if (momBadgeEl) {
        momBadgeEl.textContent = momentumBadge;
        momBadgeEl.className = `badge ${momentumBadgeClass}`;
    }
    
    // 3. Performance vs IHSG Text
    let relativePerformanceText = "";
    const isOutperformer = parseFloat(stockReturn) > parseFloat(ihsgReturn);
    
    if (isOutperformer) {
        relativePerformanceText = `Saham <strong>${ticker}</strong> berhasil <span class="text-success">mengungguli</span> indeks IHSG (Outperformer) selama rentang waktu visualisasi ini, dengan total imbal hasil sebesar <strong>${stockReturn}%</strong> dibandingkan IHSG yang sebesar <strong>${ihsgReturn}%</strong>.`;
    } else {
        relativePerformanceText = `Saham <strong>${ticker}</strong> bergerak <span class="text-danger">tertinggal</span> dibandingkan indeks IHSG (Underperformer) selama rentang waktu visualisasi ini, dengan imbal hasil total sebesar <strong>${stockReturn}%</strong> dibandingkan IHSG yang sebesar <strong>${ihsgReturn}%</strong>.`;
    }
    
    // 4. Determine Confirmation Text
    let confirmationText = "";
    const isPriceBullish = close > ma50;
    const isMacdBullish = latestMacd > latestSignal;
    
    if (isPriceBullish && isMacdBullish) {
        confirmationText = `Pergerakan harga yang berada di atas MA50 terkonfirmasi oleh MACD Crossover Bullish. Ini menunjukkan tren kenaikan harga jangka menengah didukung oleh momentum beli yang solid, memberikan indikasi kelanjutan tren naik.`;
    } else if (isPriceBullish && !isMacdBullish) {
        confirmationText = `Meskipun harga saham masih berada di atas MA50 (tren naik), indikator MACD menunjukkan crossover bearish. Hal ini mengindikasikan adanya perlambatan momentum atau potensi divergensi negatif, memperingatkan pelaku pasar akan kemungkinan terjadinya koreksi harga jangka pendek.`;
    } else if (!isPriceBullish && !isMacdBullish) {
        confirmationText = `Pergerakan harga yang berada di bawah MA50 terkonfirmasi oleh MACD Crossover Bearish. Ini menunjukkan tren penurunan harga jangka menengah didukung oleh momentum jual yang solid, memberikan indikasi kelanjutan tren turun.`;
    } else {
        confirmationText = `Meskipun harga saham berada di bawah MA50 (tren turun), indikator MACD menunjukkan crossover bullish. Hal ini mengindikasikan adanya pelemahan tekanan jual atau potensi pembalikan arah tren (rebound) jangka pendek.`;
    }
    
    // Assemble final bullet points
    let htmlContent = `
        <p>Berdasarkan analisis data penutupan historis dan momentum MACD untuk saham <strong>${TICKER_NAMES[ticker]} (${ticker})</strong> dalam rentang waktu yang ditampilkan, berikut rangkuman analisis tren dan momentumnya:</p>
        <ul>
            <li><strong>Performa:</strong> ${relativePerformanceText}</li>
            <li><strong>Tren:</strong> Saham ${ticker} saat ini menunjukkan tren ${trendInsightText} ${shortTermTrend}</li>
            <li><strong>Momentum:</strong> ${momentumInsightText}</li>
            <li><strong>Konfirmasi:</strong> ${confirmationText}</li>
        </ul>
        <p style="margin-top: 16px; font-size: 0.9rem; color: var(--text-secondary); font-style: italic;">
            *Catatan: Analisis ini diperbarui secara otomatis berdasarkan data transaksi penutupan terakhir dan tidak ditujukan sebagai rekomendasi finansial mutlak.
        </p>
    `;
    
    document.getElementById('analysis-insights-box').innerHTML = htmlContent;
}

// Setup premium custom cursor animations and hover state management
function initCustomCursor() {
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;

    let mouseX = -100;
    let mouseY = -100;
    let cursorX = -100;
    let cursorY = -100;
    let currentScale = 1.0;
    let targetScale = 1.0;
    let cursorVisible = false;

    // Track mouse coordinates
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!cursorVisible) {
            cursor.style.opacity = 1;
            cursorVisible = true;
        }
        
        // Dynamically toggle ruler crosshair class on custom cursor
        if (rulerState && rulerState.active && e.target && (e.target.id === 'trendChart' || e.target.closest('#trendChart'))) {
            cursor.classList.add('ruler-mode');
        } else {
            cursor.classList.remove('ruler-mode');
        }
    });

    // Handle mouse leaving and entering browser window
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = 0;
    });
    
    document.addEventListener('mouseenter', () => {
        if (cursorVisible) {
            cursor.style.opacity = 1;
        }
    });

    // Smooth position and scale interpolation (lerping)
    function animateCursor() {
        const easing = 0.15;
        cursorX += (mouseX - cursorX) * easing;
        cursorY += (mouseY - cursorY) * easing;
        currentScale += (targetScale - currentScale) * 0.2;

        // Offset translation to center the 16px wide circle on cursor hotspot
        cursor.style.transform = `translate3d(${cursorX - 8}px, ${cursorY - 8}px, 0) scale(${currentScale})`;
        
        requestAnimationFrame(animateCursor);
    }
    
    // Start animation loop
    requestAnimationFrame(animateCursor);

    // Hover state detection for interactive elements (using event delegation)
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (!target) return;
        
        const isInteractive = 
            target.tagName === 'A' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.classList.contains('tf-btn') ||
            target.classList.contains('styled-select') ||
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.styled-select') ||
            target.closest('.tf-btn');

        if (isInteractive) {
            targetScale = 1.8;
            cursor.classList.add('hovered');
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (!target) return;
        
        const isInteractive = 
            target.tagName === 'A' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'SELECT' ||
            target.classList.contains('tf-btn') ||
            target.classList.contains('styled-select') ||
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.styled-select') ||
            target.closest('.tf-btn');

        if (isInteractive) {
            targetScale = 1.0;
            cursor.classList.remove('hovered');
        }
    });
}

// Initialize the custom cursor
if (matchMedia('(pointer: fine)').matches) {
    initCustomCursor();
}

// Ruler measurement tool helper functions & plugin definitions

const trendChartRulerPlugin = {
    id: 'rulerPlugin',
    afterDatasetsDraw(chart, args, options) {
        if (!rulerState.active || !rulerState.startPoint) return;
        
        const ctx = chart.ctx;
        const start = rulerState.startPoint;
        const end = rulerState.endPoint || rulerState.currentMousePoint;
        if (!end) return;
        
        // Convert data coordinates to pixel coordinates
        const x1 = chart.scales.x.getPixelForValue(start.xVal);
        const y1 = chart.scales.y.getPixelForValue(start.yVal);
        const x2 = chart.scales.x.getPixelForValue(end.xVal);
        const y2 = chart.scales.y.getPixelForValue(end.yVal);
        
        // Draw shaded area
        ctx.save();
        ctx.fillStyle = 'rgba(0, 102, 255, 0.12)';
        ctx.strokeStyle = '#0066FF';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        // Draw bounding box
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        
        // Draw dotted borders
        ctx.beginPath();
        // vertical line at start
        ctx.moveTo(x1, chart.chartArea.top);
        ctx.lineTo(x1, chart.chartArea.bottom);
        // vertical line at end
        ctx.moveTo(x2, chart.chartArea.top);
        ctx.lineTo(x2, chart.chartArea.bottom);
        // horizontal line at start
        ctx.moveTo(chart.chartArea.left, y1);
        ctx.lineTo(chart.chartArea.right, y1);
        // horizontal line at end
        ctx.moveTo(chart.chartArea.left, y2);
        ctx.lineTo(chart.chartArea.right, y2);
        ctx.stroke();
        
        // Draw arrows inside the box
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)';
        ctx.lineWidth = 1.5;
        
        // Draw main lines for arrows
        ctx.beginPath();
        // vertical center arrow
        const centerX = (x1 + x2) / 2;
        ctx.moveTo(centerX, y1);
        ctx.lineTo(centerX, y2);
        // horizontal center arrow
        const centerY = (y1 + y2) / 2;
        ctx.moveTo(x1, centerY);
        ctx.lineTo(x2, centerY);
        ctx.stroke();
        
        // Draw arrowheads
        drawArrowhead(ctx, centerX, y2, y2 > y1 ? 'down' : 'up');
        drawArrowhead(ctx, x2, centerY, x2 > x1 ? 'right' : 'left');
        
        // Draw label box at the center of the box
        const startIdx = getClosestDataPointIndex(chart, start.xVal);
        const endIdx = getClosestDataPointIndex(chart, end.xVal);
        const startItem = chart.data.datasets[0].data[startIdx];
        const endItem = chart.data.datasets[0].data[endIdx];
        
        if (startItem && endItem) {
            // Price info
            const startPrice = start.yVal;
            const endPrice = end.yVal;
            const priceDiff = endPrice - startPrice;
            const pricePct = (priceDiff / startPrice) * 100;
            
            const sign = priceDiff >= 0 ? '+' : '';
            const priceDiffText = `${sign}${priceDiff.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
            const pricePctText = `${sign}${pricePct.toFixed(2)}%`;
            
            // Bars & Days info
            const bars = Math.abs(endIdx - startIdx) + 1;
            const msDiff = Math.abs(new Date(endItem.x) - new Date(startItem.x));
            const days = Math.round(msDiff / (1000 * 60 * 60 * 24));
            
            // Volume sum info
            const minIdx = Math.min(startIdx, endIdx);
            const maxIdx = Math.max(startIdx, endIdx);
            let volSum = 0;
            for (let i = minIdx; i <= maxIdx; i++) {
                const item = chart.data.datasets[0].data[i];
                if (item && item.volume) {
                    volSum += item.volume;
                }
            }
            
            let volText = '';
            if (volSum >= 1e9) volText = (volSum / 1e9).toFixed(2) + ' B';
            else if (volSum >= 1e6) volText = (volSum / 1e6).toFixed(2) + ' M';
            else if (volSum >= 1e3) volText = (volSum / 1e3).toFixed(2) + ' K';
            else volText = volSum.toLocaleString('id-ID');
            
            const textLines = [
                `${priceDiffText} (${pricePctText})`,
                `${bars} bars, ${days}d`,
                `Vol: ${volText}`
            ];
            
            // Draw tooltip box
            const boxWidth = 140;
            const boxHeight = 62;
            const boxX = centerX - boxWidth / 2;
            const boxY = Math.min(y1, y2) - boxHeight - 10; // place above the box
            
            // Keep box inside chartArea
            let finalBoxY = boxY;
            if (finalBoxY < chart.chartArea.top) {
                finalBoxY = Math.max(y1, y2) + 10; // place below the box if it goes above the top
            }
            
            // Draw box background
            ctx.fillStyle = '#0066FF';
            ctx.strokeStyle = '#3385FF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(boxX, finalBoxY, boxWidth, boxHeight, 6);
            } else {
                ctx.rect(boxX, finalBoxY, boxWidth, boxHeight);
            }
            ctx.fill();
            ctx.stroke();
            
            // Draw text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.fillText(textLines[0], centerX, finalBoxY + 15);
            ctx.font = '500 10px Inter';
            ctx.fillText(textLines[1], centerX, finalBoxY + 32);
            ctx.fillText(textLines[2], centerX, finalBoxY + 48);
        }
        
        ctx.restore();
    }
};

function drawArrowhead(ctx, x, y, direction) {
    ctx.save();
    ctx.fillStyle = '#0066FF';
    ctx.beginPath();
    ctx.moveTo(x, y);
    const size = 5;
    if (direction === 'up') {
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
    } else if (direction === 'down') {
        ctx.lineTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
    } else if (direction === 'left') {
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x + size, y + size);
    } else if (direction === 'right') {
        ctx.lineTo(x - size, y - size);
        ctx.lineTo(x - size, y + size);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function getClosestDataPointIndex(chart, xVal) {
    const data = chart.data.datasets[0].data;
    if (!data || data.length === 0) return -1;
    
    let closestIndex = 0;
    let minDiff = Infinity;
    
    for (let i = 0; i < data.length; i++) {
        const diff = Math.abs(data[i].x - xVal);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }
    return closestIndex;
}

function setupRulerToggle() {
    const rulerBtn = document.getElementById('ruler-tool-btn');
    if (!rulerBtn) return;
    
    rulerBtn.addEventListener('click', () => {
        rulerState.active = !rulerState.active;
        const canvas = document.getElementById('trendChart');
        
        if (rulerState.active) {
            rulerBtn.classList.add('active');
            if (canvas) canvas.classList.add('ruler-cursor');
            
            // Disable chart zoom & pan
            if (trendChart && trendChart.options.plugins.zoom) {
                trendChart.options.plugins.zoom.zoom.wheel.enabled = false;
                trendChart.options.plugins.zoom.zoom.pinch.enabled = false;
                trendChart.options.plugins.zoom.pan.enabled = false;
                trendChart.update('none');
            }
            if (volumeChart && volumeChart.options.plugins.zoom) {
                volumeChart.options.plugins.zoom.zoom.wheel.enabled = false;
                volumeChart.options.plugins.zoom.zoom.pinch.enabled = false;
                volumeChart.options.plugins.zoom.pan.enabled = false;
                volumeChart.update('none');
            }
        } else {
            rulerBtn.classList.remove('active');
            if (canvas) canvas.classList.remove('ruler-cursor');
            clearRuler();
            
            // Enable chart zoom & pan
            if (trendChart && trendChart.options.plugins.zoom) {
                trendChart.options.plugins.zoom.zoom.wheel.enabled = true;
                trendChart.options.plugins.zoom.zoom.pinch.enabled = true;
                trendChart.options.plugins.zoom.pan.enabled = true;
                trendChart.update('none');
            }
            if (volumeChart && volumeChart.options.plugins.zoom) {
                volumeChart.options.plugins.zoom.zoom.wheel.enabled = true;
                volumeChart.options.plugins.zoom.zoom.pinch.enabled = true;
                volumeChart.options.plugins.zoom.pan.enabled = true;
                volumeChart.update('none');
            }
        }
    });
}

function setupRulerEvents() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', (e) => {
        if (!rulerState.active) return;
        
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xVal = trendChart.scales.x.getValueForPixel(x);
        const yVal = trendChart.scales.y.getValueForPixel(y);
        
        rulerState.startPoint = { xVal, yVal };
        rulerState.endPoint = null;
        rulerState.currentMousePoint = { xVal, yVal };
        rulerState.isMeasuring = true;
        
        trendChart.update('none');
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!rulerState.active) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xVal = trendChart.scales.x.getValueForPixel(x);
        const yVal = trendChart.scales.y.getValueForPixel(y);
        
        if (rulerState.isMeasuring) {
            rulerState.currentMousePoint = { xVal, yVal };
            trendChart.update('none');
        } else if (rulerState.startPoint && !rulerState.endPoint) {
            rulerState.currentMousePoint = { xVal, yVal };
            trendChart.update('none');
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (!rulerState.active || !rulerState.isMeasuring) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xVal = trendChart.scales.x.getValueForPixel(x);
        const yVal = trendChart.scales.y.getValueForPixel(y);
        
        rulerState.endPoint = { xVal, yVal };
        rulerState.isMeasuring = false;
        
        trendChart.update('none');
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rulerState.active) {
            clearRuler();
        }
    });
}

function clearRuler() {
    rulerState.startPoint = null;
    rulerState.endPoint = null;
    rulerState.currentMousePoint = null;
    rulerState.isMeasuring = false;
    if (trendChart) {
        trendChart.update('none');
    }
}

// MACD Technical Indicator Calculations
function calculateEMA(values, period) {
    const ema = [];
    if (values.length === 0) return ema;
    
    const k = 2 / (period + 1);
    let currentEma = values[0];
    ema.push(currentEma);
    
    for (let i = 1; i < values.length; i++) {
        currentEma = (values[i] * k) + (currentEma * (1 - k));
        ema.push(currentEma);
    }
    return ema;
}

function calculateMACD(resampled) {
    const closes = resampled.map(item => item.close);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        macdLine.push(ema12[i] - ema26[i]);
    }
    
    const signalLine = calculateEMA(macdLine, 9);
    
    const histogram = [];
    for (let i = 0; i < closes.length; i++) {
        histogram.push(macdLine[i] - signalLine[i]);
    }
    
    return {
        macdLine,
        signalLine,
        histogram
    };
}

