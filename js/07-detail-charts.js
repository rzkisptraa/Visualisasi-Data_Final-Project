// ============================================================================
// 07-detail-charts.js — Detail Charts (Trend & MACD)
// ============================================================================

function animateDetailChartsTimeframe(targetMin, targetMax, targetTrendChart, targetVolumeChart) {
    isDetailChartAnimating = true;

    // Clear crosshair state immediately to prevent visual glitches or redraw loops during animation
    crosshairState.xVal = null;
    crosshairState.yValTrend = null;
    crosshairState.yValVolume = null;
    crosshairState.activeChartId = null;

    const duration = 600; // Snapper 600ms rollout
    const startTime = performance.now();

    const windowSize = targetMax - targetMin;
    const startMin = targetMax;
    const startMax = targetMax + windowSize;

    // Temporarily disable tooltips, hover effects, and events to optimize performance during animation
    let originalTrendEvents = undefined;
    let originalVolumeEvents = undefined;

    // Calculate final Y limits by temporarily setting X scales to the target range
    let targetTrendYMin = null;
    let targetTrendYMax = null;
    if (targetTrendChart) {
        // Clear active hover state & tooltip
        try {
            if (targetTrendChart.tooltip) targetTrendChart.tooltip.setActiveElements([], { x: 0, y: 0 });
            targetTrendChart.setActiveElements([]);
        } catch (e) { }

        originalTrendEvents = targetTrendChart.options.events;
        targetTrendChart.options.events = []; // Disable hover/tooltip processing

        targetTrendChart.options.scales.x.min = targetMin;
        targetTrendChart.options.scales.x.max = targetMax;
        autoScaleY(targetTrendChart);
        targetTrendYMin = targetTrendChart.options.scales.y.min;
        targetTrendYMax = targetTrendChart.options.scales.y.max;

        // Lock Y scale during animation
        targetTrendChart.options.scales.y.min = targetTrendYMin;
        targetTrendChart.options.scales.y.max = targetTrendYMax;

        // Disable zoom/pan during animation to prevent user scroll conflicts
        try {
            if (targetTrendChart.options.plugins.zoom && targetTrendChart.options.plugins.zoom.zoom && targetTrendChart.options.plugins.zoom.zoom.wheel) {
                targetTrendChart.options.plugins.zoom.zoom.wheel.enabled = false;
                targetTrendChart.options.plugins.zoom.pan.enabled = false;
            }
        } catch (e) {
            console.warn("Could not temporarily disable zoom for trend chart:", e);
        }

        // Set to start window initially
        targetTrendChart.options.scales.x.min = startMin;
        targetTrendChart.options.scales.x.max = startMax;
        targetTrendChart.update('none');
    }

    let targetVolumeYMin = null;
    let targetVolumeYMax = null;
    if (targetVolumeChart) {
        // Clear active hover state & tooltip
        try {
            if (targetVolumeChart.tooltip) targetVolumeChart.tooltip.setActiveElements([], { x: 0, y: 0 });
            targetVolumeChart.setActiveElements([]);
        } catch (e) { }

        originalVolumeEvents = targetVolumeChart.options.events;
        targetVolumeChart.options.events = []; // Disable hover/tooltip processing

        targetVolumeChart.options.scales.x.min = targetMin;
        targetVolumeChart.options.scales.x.max = targetMax;
        autoScaleY(targetVolumeChart);
        targetVolumeYMin = targetVolumeChart.options.scales.y.min;
        targetVolumeYMax = targetVolumeChart.options.scales.y.max;

        // Lock Y scale during animation
        targetVolumeChart.options.scales.y.min = targetVolumeYMin;
        targetVolumeChart.options.scales.y.max = targetVolumeYMax;

        try {
            if (targetVolumeChart.options.plugins.zoom && targetVolumeChart.options.plugins.zoom.zoom && targetVolumeChart.options.plugins.zoom.zoom.wheel) {
                targetVolumeChart.options.plugins.zoom.zoom.wheel.enabled = false;
                targetVolumeChart.options.plugins.zoom.pan.enabled = false;
            }
        } catch (e) {
            console.warn("Could not temporarily disable zoom for volume chart:", e);
        }

        // Set to start window initially
        targetVolumeChart.options.scales.x.min = startMin;
        targetVolumeChart.options.scales.x.max = startMax;
        targetVolumeChart.update('none');
    }

    function step(now) {
        if (targetTrendChart !== trendChart || targetVolumeChart !== volumeChart) {
            return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Use easeOutQuart (1 - (1-t)^4) for snappier and smoother initial response
        const easedProgress = 1 - Math.pow(1 - progress, 4);

        const currentMin = startMin - easedProgress * (startMin - targetMin);
        const currentMax = startMax - easedProgress * (startMax - targetMax);

        if (trendChart) {
            trendChart.options.scales.x.min = currentMin;
            trendChart.options.scales.x.max = currentMax;
            trendChart.update('none');
        }
        if (volumeChart) {
            volumeChart.options.scales.x.min = currentMin;
            volumeChart.options.scales.x.max = currentMax;
            volumeChart.update('none');
        }

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            isDetailChartAnimating = false;

            // Clear crosshair state one final time to prevent residual drawings
            crosshairState.xVal = null;
            crosshairState.yValTrend = null;
            crosshairState.yValVolume = null;
            crosshairState.activeChartId = null;

            // Unlock Y scales and re-enable zoom/pan and default events
            if (trendChart) {
                trendChart.options.scales.y.min = undefined;
                trendChart.options.scales.y.max = undefined;
                trendChart.options.events = originalTrendEvents; // Restore events
                autoScaleY(trendChart);
                try {
                    if (trendChart.options.plugins.zoom && trendChart.options.plugins.zoom.zoom && trendChart.options.plugins.zoom.zoom.wheel) {
                        trendChart.options.plugins.zoom.zoom.wheel.enabled = true;
                        trendChart.options.plugins.zoom.pan.enabled = true;
                    }
                } catch (e) {
                    console.warn("Could not re-enable zoom for trend chart:", e);
                }
                trendChart.update('none');
            }
            if (volumeChart) {
                volumeChart.options.scales.y.min = undefined;
                volumeChart.options.scales.y.max = undefined;
                volumeChart.options.events = originalVolumeEvents; // Restore events
                autoScaleY(volumeChart);
                try {
                    if (volumeChart.options.plugins.zoom && volumeChart.options.plugins.zoom.zoom && volumeChart.options.plugins.zoom.zoom.wheel) {
                        volumeChart.options.plugins.zoom.zoom.wheel.enabled = true;
                        volumeChart.options.plugins.zoom.pan.enabled = true;
                    }
                } catch (e) {
                    console.warn("Could not re-enable zoom for volume chart:", e);
                }
                volumeChart.update('none');
            }
            updateInsightsFromChart();
        }
    }

    requestAnimationFrame(step);
}

// Update Detail View (Chart 2, Chart 3, and Insights)
function updateSelectedStockView(ticker) {
    document.querySelectorAll('.selected-stock-ticker').forEach(function (el) {
        el.textContent = ticker;
    });
    document.querySelectorAll('.selected-stock-ticker-full').forEach(function (el) {
        el.textContent = ' - ' + TICKER_NAMES[ticker];
    });

    var stockData = pricesData[ticker];
    if (!stockData) return;

    // Filter inactive/pre-IPO rows
    var activeStockData = stockData.filter(function (item) { return item.active !== false; });
    currentResampledData = resampleDataset(activeStockData, currentTimeframe);

    // Compute initial x window BEFORE building charts so they render correctly on first frame
    var N = currentResampledData.length;
    var defaultZoom = getDefaultZoom(N, currentTimeframe);
    var minIndex = Math.max(0, N - defaultZoom);
    var maxIndex = N - 1;

    var initialMin = null;
    var initialMax = null;
    if (N > 0) {
        initialMin = new Date(currentResampledData[minIndex].date).getTime();
        initialMax = new Date(currentResampledData[maxIndex].date).getTime();
    }

    updateTrendChart(currentResampledData, ticker, initialMin, initialMax);
    updateMACDChart(currentResampledData, initialMin, initialMax);

    var visibleData = getVisibleStockData(trendChart, currentResampledData);
    generateInsights(ticker, visibleData, currentResampledData);
}

// Chart 2: Trend Chart (Candlestick + MA lines)
function updateTrendChart(resampled, ticker, initialMin, initialMax) {
    var ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) { trendChart.destroy(); trendChart = null; }

    var timeUnit = getTimeUnit();

    // Force global chartjs-chart-financial colors to match our vibrant KPI colors
    if (Chart.defaults && Chart.defaults.elements && Chart.defaults.elements.candlestick) {
        Chart.defaults.elements.candlestick.color = { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' };
        Chart.defaults.elements.candlestick.borderColor = { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' };
    }

    var candleData = resampled.map(function (item) {
        return { x: new Date(item.date).getTime(), o: item.open, h: item.high, l: item.low, c: item.close };
    });

    // Pre-build sorted timestamps cache for O(log n) snap during mousemove
    _trendTimestamps = candleData.map(function (d) { return d.x; }).sort(function (a, b) { return a - b; });

    var ma20Data = resampled.map(function (item) {
        return { x: new Date(item.date).getTime(), y: item.ma20 != null ? item.ma20 : null };
    });
    var ma50Data = resampled.map(function (item) {
        return { x: new Date(item.date).getTime(), y: item.ma50 != null ? item.ma50 : null };
    });

    // Calculate visible range Y bounds for trendChart
    let trendYMin = undefined;
    let trendYMax = undefined;
    if (resampled.length > 0 && initialMin !== null && initialMax !== null) {
        let visMin = Infinity;
        let visMax = -Infinity;
        const range = findVisibleRange(candleData, initialMin, initialMax, true);
        const start = range.start;
        const end = range.end;
        for (let i = start; i <= end; i++) {
            const item = resampled[i];
            if (item) {
                if (item.low < visMin) visMin = item.low;
                if (item.high > visMax) visMax = item.high;
                if (item.ma20 != null && item.ma20 < visMin) visMin = item.ma20;
                if (item.ma20 != null && item.ma20 > visMax) visMax = item.ma20;
                if (item.ma50 != null && item.ma50 < visMin) visMin = item.ma50;
                if (item.ma50 != null && item.ma50 > visMax) visMax = item.ma50;
            }
        }
        if (visMin !== Infinity && visMax !== -Infinity) {
            const rangeVal = visMax - visMin;
            const padding = rangeVal * 0.05 || 1.0;
            trendYMin = visMin - padding;
            trendYMax = visMax + padding;
        }
    }

    trendChart = new Chart(ctx, {
        type: 'candlestick',
        data: {
            datasets: [
                {
                    type: 'candlestick', label: ticker, data: candleData,
                    color: { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' },
                    borderColor: { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' }
                },
                { type: 'line', label: 'MA20', data: ma20Data, borderColor: '#F59E0B', borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [4, 3], tension: 0.1, spanGaps: true },
                { type: 'line', label: 'MA50', data: ma50Data, borderColor: '#3B82F6', borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [6, 4], tension: 0.1, spanGaps: true }
            ]
        },
        plugins: [trendChartRulerPlugin, crosshairPlugin],
        options: {
            elements: {
                candlestick: {
                    color: { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' },
                    borderColor: { up: '#12C286', down: '#FF5555', unchanged: '#9CA3AF' },
                    borderWidth: 1.5
                }
            },
            normalized: true,
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true, mode: 'x', onPan: function (ref) {
                            var c = ref.chart; syncXAxis(c, volumeChart); autoScaleY(c);
                            if (volumeChart) { autoScaleY(volumeChart); volumeChart.update('none'); }
                            c.update('none'); debouncedUpdateInsights();
                        }
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x', onZoom: function (ref) {
                            var c = ref.chart; syncXAxis(c, volumeChart); autoScaleY(c);
                            if (volumeChart) { autoScaleY(volumeChart); volumeChart.update('none'); }
                            c.update('none'); debouncedUpdateInsights();
                        }
                    }
                },
                legend: {
                    display: true, labels: {
                        color: '#9CA3AF', font: { family: 'Inter', size: 10 },
                        filter: function (item) { return item.text === 'MA20' || item.text === 'MA50'; }
                    }
                },
                tooltip: {
                    backgroundColor: '#0B0F14',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    borderRadius: 6,
                    padding: 12,
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    titleFont: { family: 'Inter', size: 12, weight: '600' },
                    bodyFont: { family: 'Inter', size: 11 },
                    titleSpacing: 6,
                    bodySpacing: 4,
                    callbacks: {
                        label: function (context) {
                            var ds = context.dataset;
                            if (ds.type === 'candlestick') {
                                var d = context.raw;
                                return ['Open : Rp ' + d.o.toLocaleString('id-ID'), 'High : Rp ' + d.h.toLocaleString('id-ID'),
                                'Low  : Rp ' + d.l.toLocaleString('id-ID'), 'Close: Rp ' + d.c.toLocaleString('id-ID')];
                            }
                            var lbl = ds.label || ''; if (lbl) lbl += ': ';
                            lbl += 'Rp ';
                            if (context.parsed.y !== null) lbl += context.parsed.y.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            return lbl;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'timeseries',
                    offset: true,
                    min: initialMin != null ? initialMin : undefined,
                    max: initialMax != null ? initialMax : undefined,
                    time: {
                        unit: timeUnit,
                        tooltipFormat: 'dd MMM yyyy',
                        displayFormats: {
                            day: 'd MMM',
                            week: 'd MMM',
                            month: 'MMM yy',
                            quarter: 'MMM yy',
                            year: 'yyyy'
                        }
                    },
                    adapters: { date: { locale: 'id' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false, offset: false },
                    ticks: { color: '#9CA3AF', font: { family: 'Inter', size: 11, weight: '500' }, maxTicksLimit: 8, align: 'center', padding: 10 }
                },
                y: {
                    min: trendYMin !== undefined ? trendYMin : undefined,
                    max: trendYMax !== undefined ? trendYMax : undefined,
                    grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF', font: { family: 'Inter', size: 11, weight: '500' }, padding: 10,
                        callback: function (value) { return 'Rp ' + value.toLocaleString('id-ID'); }
                    },
                    afterFit: function (scaleInstance) { scaleInstance.width = 95; }
                },
                yRight: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { display: false },
                    afterFit: function (scaleInstance) { scaleInstance.width = 75; }
                }
            }
        }
    });

    // Honor current MA indicator toggles on chart rebuild
    const ma20Visible = document.getElementById('ma20-checkbox') ? document.getElementById('ma20-checkbox').checked : true;
    const ma50Visible = document.getElementById('ma50-checkbox') ? document.getElementById('ma50-checkbox').checked : true;
    trendChart.setDatasetVisibility(1, ma20Visible);
    trendChart.setDatasetVisibility(2, ma50Visible);
    trendChart.update('none');

    setupXAxisDrag(trendChart);
}

// Chart 3: MACD Chart
function updateMACDChart(resampled, initialMin, initialMax) {
    var ctx = document.getElementById('volumeChart').getContext('2d');
    if (volumeChart) { volumeChart.destroy(); volumeChart = null; }

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

    const barColors = macdData.histogram.map(val => val >= 0 ? '#12C286' : '#FF5555');

    // Calculate visible range Y bounds for volumeChart (MACD)
    let macdYMin = undefined;
    let macdYMax = undefined;
    if (resampled.length > 0 && initialMin !== null && initialMax !== null) {
        let visMin = Infinity;
        let visMax = -Infinity;
        const range = findVisibleRange(histogramData, initialMin, initialMax, true);
        const start = range.start;
        const end = range.end;
        for (let i = start; i <= end; i++) {
            const hVal = macdData.histogram[i];
            const mVal = macdData.macdLine[i];
            const sVal = macdData.signalLine[i];
            if (hVal != null) {
                if (hVal < visMin) visMin = hVal;
                if (hVal > visMax) visMax = hVal;
            }
            if (mVal != null) {
                if (mVal < visMin) visMin = mVal;
                if (mVal > visMax) visMax = mVal;
            }
            if (sVal != null) {
                if (sVal < visMin) visMin = sVal;
                if (sVal > visMax) visMax = sVal;
            }
        }
        if (visMin !== Infinity && visMax !== -Infinity) {
            const maxAbs = Math.max(Math.abs(visMin), Math.abs(visMax));
            const finalMax = maxAbs || 1.0;
            macdYMin = -finalMax * 1.15;
            macdYMax = finalMax * 1.15;
        }
    }

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
        type: 'bar',
        data: { datasets: datasets },
        plugins: [crosshairPlugin],
        options: {
            normalized: true,
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
                        onPan: ({ chart }) => {
                            syncXAxis(chart, trendChart);
                            autoScaleY(chart);
                            if (trendChart) {
                                autoScaleY(trendChart);
                                trendChart.update('none');
                            }
                            chart.update('none');
                            debouncedUpdateInsights();
                        }
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.1 },
                        pinch: { enabled: true },
                        mode: 'x',
                        onZoom: ({ chart }) => {
                            syncXAxis(chart, trendChart);
                            autoScaleY(chart);
                            if (trendChart) {
                                autoScaleY(trendChart);
                                trendChart.update('none');
                            }
                            chart.update('none');
                            debouncedUpdateInsights();
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
                    backgroundColor: '#0B0F14',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    borderRadius: 6,
                    padding: 12,
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    titleFont: { family: 'Inter', size: 12, weight: '600' },
                    bodyFont: { family: 'Inter', size: 11 },
                    titleSpacing: 6,
                    bodySpacing: 4,
                    callbacks: {
                        label: function (context) {
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
                    offset: true,
                    min: initialMin != null ? initialMin : undefined,
                    max: initialMax != null ? initialMax : undefined,
                    time: {
                        unit: getTimeUnit(),
                        tooltipFormat: 'dd MMM yyyy',
                        displayFormats: {
                            day: 'd MMM',
                            week: 'd MMM',
                            month: 'MMM yy',
                            quarter: 'MMM yy',
                            year: 'yyyy'
                        }
                    },
                    adapters: { date: { locale: 'id' } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 11, weight: '500' },
                        maxTicksLimit: 8,
                        align: 'inner',
                        padding: 10
                    }
                },
                y: {
                    min: macdYMin !== undefined ? macdYMin : undefined,
                    max: macdYMax !== undefined ? macdYMax : undefined,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 11, weight: '500' },
                        padding: 10,
                        callback: function (value) {
                            if (value > 0) return '+' + value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            if (value < 0) return value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                            return '0';
                        }
                    },
                    afterFit: function (scaleInstance) {
                        scaleInstance.width = 95;
                    }
                },
                yRight: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { display: false },
                    afterFit: function (scaleInstance) {
                        scaleInstance.width = 75;
                    }
                }
            }
        }
    });

    setupXAxisDrag(volumeChart);
}
