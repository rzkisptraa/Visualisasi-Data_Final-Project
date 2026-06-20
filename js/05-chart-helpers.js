// ============================================================================
// 05-chart-helpers.js — Chart Utility & Helper Functions
// ============================================================================

// Helper to find index range of visible data points using binary search for performance
function findVisibleRange(dataArray, xMin, xMax, isTimeScale) {
    let start = 0;
    let end = dataArray.length - 1;

    if (isTimeScale) {
        // Binary search for first index >= xMin
        let low = 0, high = dataArray.length - 1;
        while (low <= high) {
            let mid = (low + high) >> 1;
            let val = dataArray[mid] ? dataArray[mid].x : 0;
            if (val >= xMin) {
                start = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        // Binary search for last index <= xMax
        low = start;
        high = dataArray.length - 1;
        while (low <= high) {
            let mid = (low + high) >> 1;
            let val = dataArray[mid] ? dataArray[mid].x : 0;
            if (val <= xMax) {
                end = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
    } else {
        // Category scale is index-based
        start = Math.max(0, Math.floor(xMin));
        end = Math.min(dataArray.length - 1, Math.ceil(xMax));
    }

    return { start, end };
}

// Helper to determine min and max values of visible data arrays for vertical scaling
// Handles both plain numbers (index-based axis) and OHLC/line objects ({x, o, h, l, c} or {x, y})
function autoScaleY(chart) {
    if (!chart) return;

    // Safely ensure chart.options.scales structures exist to avoid errors
    if (!chart.options) chart.options = {};
    if (!chart.options.scales) chart.options.scales = {};
    if (!chart.options.scales.x) chart.options.scales.x = {};
    if (!chart.options.scales.y) chart.options.scales.y = {};

    // Prioritize options (target range for update) over current scales (rendered range of previous frame)
    let xMin = chart.options.scales.x.min !== undefined ? chart.options.scales.x.min : (chart.scales && chart.scales.x ? chart.scales.x.min : undefined);
    let xMax = chart.options.scales.x.max !== undefined ? chart.options.scales.x.max : (chart.scales && chart.scales.x ? chart.scales.x.max : undefined);

    const hasRange = xMin !== undefined && xMax !== undefined && xMin !== null && xMax !== null;

    // Track min/max values dynamically by Y-axis ID (default is 'y')
    const boundsByAxis = {};

    const isTimeScale = chart.options.scales.x && (chart.options.scales.x.type === 'time' || chart.options.scales.x.type === 'timeseries');

    if (chart.data && chart.data.datasets) {
        chart.data.datasets.forEach((dataset, dsIndex) => {
            // Safely check dataset visibility without requiring scales to be fully rendered
            let isVisible = true;
            if (chart.isDatasetVisible && typeof chart.isDatasetVisible === 'function' && chart.scales && chart.scales.y) {
                isVisible = chart.isDatasetVisible(dsIndex);
            } else {
                isVisible = dataset.hidden !== true;
            }
            if (!isVisible) return;

            const axisID = dataset.yAxisID || 'y';
            if (!boundsByAxis[axisID]) {
                boundsByAxis[axisID] = { min: Infinity, max: -Infinity };
            }
            const bounds = boundsByAxis[axisID];

            const dataArray = dataset.data || [];
            if (dataArray.length === 0) return;

            let start = 0;
            let end = dataArray.length - 1;
            if (hasRange) {
                const range = findVisibleRange(dataArray, xMin, xMax, isTimeScale);
                start = range.start;
                end = range.end;
            }

            for (let idx = start; idx <= end; idx++) {
                const item = dataArray[idx];
                if (item === null || item === undefined) continue;

                let valMin, valMax;

                if (isTimeScale) {
                    if (item.o !== undefined && item.h !== undefined && item.l !== undefined && item.c !== undefined) {
                        valMin = item.l;
                        valMax = item.h;
                    } else if (item.y !== undefined) {
                        valMin = item.y;
                        valMax = item.y;
                    } else {
                        continue;
                    }
                } else {
                    const val = (typeof item === 'object' && item.y !== undefined) ? item.y : item;
                    if (typeof val !== 'number' || isNaN(val)) continue;
                    valMin = val;
                    valMax = val;
                }

                if (valMin === null || valMin === undefined || isNaN(valMin)) continue;
                if (valMax === null || valMax === undefined || isNaN(valMax)) continue;

                if (valMin < bounds.min) bounds.min = valMin;
                if (valMax > bounds.max) bounds.max = valMax;
            }
        });
    }

    // Apply Y-axis range limits to each axis config
    Object.keys(boundsByAxis).forEach(axisID => {
        const bounds = boundsByAxis[axisID];
        if (bounds.min !== Infinity && bounds.max !== -Infinity) {
            if (!chart.options.scales[axisID]) {
                chart.options.scales[axisID] = {};
            }

            if (chart.canvas && chart.canvas.id === 'volumeChart') {
                const maxAbs = Math.max(Math.abs(bounds.min), Math.abs(bounds.max));
                const finalMax = maxAbs || 1.0;
                chart.options.scales[axisID].min = -finalMax * 1.15; // 15% headroom
                chart.options.scales[axisID].max = finalMax * 1.15;
            } else {
                const range = bounds.max - bounds.min;
                const padding = range * 0.05 || 1.0;
                chart.options.scales[axisID].min = bounds.min - padding;
                chart.options.scales[axisID].max = bounds.max + padding;
            }
        }
    });
}

// ── Chart Transition Helpers ─────────────────────────────────────────────────
// Fades out Chart 2 (trendChart) + Chart 3 (volumeChart), rebuilds them,
// then plays a slide-up fade-in entrance on each container.
function transitionDetailCharts(updateFn) {
    const trendCanvas = document.getElementById('trendChart');
    const volumeCanvas = document.getElementById('volumeChart');
    const trendWrapper = trendCanvas ? trendCanvas.closest('.chart-container') : null;
    const volumeWrapper = volumeCanvas ? volumeCanvas.closest('.chart-container') : null;

    // Step 1 — fade out
    [trendWrapper, volumeWrapper].forEach(el => {
        if (el) { el.classList.remove('chart-tf-enter'); el.classList.add('chart-tf-exit'); }
    });

    // Step 2 — after fade-out (≈180ms), rebuild and fade in
    setTimeout(() => {
        updateFn();

        [trendWrapper, volumeWrapper].forEach(el => {
            if (el) {
                el.classList.remove('chart-tf-exit');
                // Force reflow so animation restarts
                void el.offsetWidth;
                el.classList.add('chart-tf-enter');
            }
        });

        // Clean up class after animation completes
        setTimeout(() => {
            [trendWrapper, volumeWrapper].forEach(el => {
                if (el) el.classList.remove('chart-tf-enter');
            });
        }, 380);
    }, 190);
}

// Same transition for the Relative Performance chart (Chart 1).
function transitionRelativeChart(updateFn) {
    const canvas = document.getElementById('relativePerformanceChart');
    const wrapper = canvas ? canvas.closest('.chart-container') : null;

    if (wrapper) { wrapper.classList.remove('chart-tf-enter'); wrapper.classList.add('chart-tf-exit'); }

    setTimeout(() => {
        updateFn();
        if (wrapper) {
            wrapper.classList.remove('chart-tf-exit');
            void wrapper.offsetWidth;
            wrapper.classList.add('chart-tf-enter');
        }
        setTimeout(() => { if (wrapper) wrapper.classList.remove('chart-tf-enter'); }, 380);
    }, 190);
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
function getDefaultZoom(N, timeframe) {
    const tf = timeframe || currentTimeframe;
    if (tf === 'daily') return Math.min(N, 22);
    if (tf === 'weekly') return Math.min(N, 12);
    if (tf === 'monthly') return Math.min(N, 36);
    if (tf === 'yearly') return Math.min(N, 10);
    return N;
}

// Returns the appropriate Chart.js time unit for the current timeframe
function getTimeUnit() {
    if (currentTimeframe === 'daily') return 'day';
    if (currentTimeframe === 'weekly') return 'week';
    if (currentTimeframe === 'monthly') return 'month';
    if (currentTimeframe === 'yearly') return 'year';
    return 'day';
}

// Extract the visible data range from resampled stock data
function getVisibleStockData(chart, resampledData) {
    if (!chart || !chart.scales || !chart.scales.x) {
        const N = resampledData.length;
        let tf = currentTimeframe;
        if (chart === relativeChart) tf = relativeTimeframe;
        if (chart === ihsgTrendChart) tf = heatmapTimeframe;
        return resampledData.slice(Math.max(0, N - getDefaultZoom(N, tf)));
    }

    const isTimeScale = chart.options.scales.x.type === 'timeseries' || chart.options.scales.x.type === 'time';

    if (isTimeScale) {
        const xMin = chart.scales.x.min;
        const xMax = chart.scales.x.max;

        let start = 0;
        let end = resampledData.length - 1;

        // Binary search for first index >= xMin
        let low = 0, high = resampledData.length - 1;
        while (low <= high) {
            let mid = (low + high) >> 1;
            let itemDate = resampledData[mid] ? resampledData[mid].date : null;
            let val = itemDate ? new Date(itemDate).getTime() : 0;
            if (val >= xMin) {
                start = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        // Binary search for last index <= xMax
        low = start;
        high = resampledData.length - 1;
        while (low <= high) {
            let mid = (low + high) >> 1;
            let itemDate = resampledData[mid] ? resampledData[mid].date : null;
            let val = itemDate ? new Date(itemDate).getTime() : 0;
            if (val <= xMax) {
                end = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return resampledData.slice(start, end + 1);
    } else {
        const minIndex = Math.max(0, Math.floor(chart.scales.x.min));
        const maxIndex = Math.min(resampledData.length - 1, Math.ceil(chart.scales.x.max));
        return resampledData.slice(minIndex, maxIndex + 1);
    }
}

// Update insights box dynamically based on the current chart view range
function updateInsightsFromChart() {
    const ticker = document.getElementById('stock-select').value;
    if (!currentResampledData) return;
    const visibleData = getVisibleStockData(trendChart, currentResampledData);
    generateInsights(ticker, visibleData, currentResampledData);
}

// Handle double click reset interaction
function handleChartReset(chart) {
    if (!chart) return;

    const isTimeScale = chart.options.scales.x.type === 'timeseries' || chart.options.scales.x.type === 'time';
    let tf = currentTimeframe;
    if (chart === relativeChart) tf = relativeTimeframe;
    if (chart === ihsgTrendChart) tf = heatmapTimeframe;

    if (isTimeScale) {
        const dataset = chart.data.datasets[0];
        if (dataset && dataset.data && dataset.data.length > 0) {
            const data = dataset.data;
            const N = data.length;
            const defaultZoom = getDefaultZoom(N, tf);

            const minIndex = Math.max(0, N - defaultZoom);
            const maxIndex = N - 1;

            chart.options.scales.x.min = data[minIndex].x;
            chart.options.scales.x.max = data[maxIndex].x;
        }
    } else {
        const N = chart.data.labels ? chart.data.labels.length : 0;
        const defaultZoom = getDefaultZoom(N, tf);
        chart.options.scales.x.min = Math.max(0, N - defaultZoom);
        chart.options.scales.x.max = N - 1;
    }

    autoScaleY(chart);
    chart.update('none');
}

// Helper to parse hex/rgba to rgba with custom opacity
function hexToRgba(colorStr, alpha) {
    if (!colorStr) return `rgba(255,255,255,${alpha})`;
    if (colorStr.startsWith('rgba')) {
        return colorStr.replace(/[\d\.]+\)$/, alpha + ')');
    }
    let c = colorStr.substring(1);
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
