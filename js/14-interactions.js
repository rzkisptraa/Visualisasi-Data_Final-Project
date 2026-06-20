// ============================================================================
// 14-interactions.js — Global Interaction Handlers & Chart Export Utilities
// ============================================================================

// Global timeline scaling drag handlers for premium user interaction (TradingView Style)
window.addEventListener('mousemove', (e) => {
    if (!activeScalingChart) return;

    const chart = activeScalingChart;
    const dx = e.clientX - chart._scaleStartX;
    const width = chart.width || 300;

    // Drag left = zoom out (show more history), drag right = zoom in (show less history)
    const factor = Math.exp(-dx / width * 1.5);
    let newRange = chart._scaleStartRange * factor;

    const datasets = chart.data.datasets;
    if (datasets && datasets[0] && datasets[0].data && datasets[0].data.length > 0) {
        const data = datasets[0].data;
        const totalN = data.length;
        const isTimeScale = chart.options.scales.x.type === 'timeseries' || chart.options.scales.x.type === 'time';

        let targetMin, targetMax;

        if (isTimeScale) {
            const latestTime = (data[data.length - 1] && data[data.length - 1].x) || (chart.data.labels && chart.data.labels[chart.data.labels.length - 1]);
            const firstTime = (data[0] && data[0].x) || (chart.data.labels && chart.data.labels[0]);
            if (latestTime && firstTime) {
                const totalDuration = latestTime - firstTime;
                const avgPointDuration = totalDuration / totalN;

                const minRange = avgPointDuration * 5; // minimum 5 bars
                const maxRange = totalDuration;
                newRange = Math.max(minRange, Math.min(maxRange, newRange));

                targetMax = latestTime;
                targetMin = latestTime - newRange;
            }
        } else {
            const minRange = 5;
            const maxRange = totalN - 1;
            newRange = Math.max(minRange, Math.min(maxRange, newRange));

            const latestIdx = totalN - 1;
            targetMax = latestIdx;
            targetMin = Math.max(0, latestIdx - Math.round(newRange));
        }

        // Throttle scaling updates to screen refresh rate via requestAnimationFrame
        if (_scalingRafId) cancelAnimationFrame(_scalingRafId);
        _scalingRafId = requestAnimationFrame(() => {
            _scalingRafId = null;

            chart.options.scales.x.min = targetMin;
            chart.options.scales.x.max = targetMax;

            autoScaleY(chart);
            chart.update('none');

            // Synchronize scale shifts across linked detail charts (Trend & MACD/Volume)
            if (chart === trendChart && volumeChart) {
                syncXAxis(trendChart, volumeChart);
                autoScaleY(volumeChart);
                volumeChart.update('none');
                debouncedUpdateInsights();
            } else if (chart === volumeChart && trendChart) {
                syncXAxis(volumeChart, trendChart);
                autoScaleY(trendChart);
                trendChart.update('none');
                debouncedUpdateInsights();
            }
        });
    }
});

window.addEventListener('mouseup', () => {
    if (activeScalingChart) {
        const chart = activeScalingChart;
        activeScalingChart = null;
        if (chart.options.plugins.zoom && chart._panWasEnabled !== undefined) {
            chart.options.plugins.zoom.pan.enabled = chart._panWasEnabled;
        }
    }
});

// Attach mouse listeners to chart's X-axis area to capture scaling drags
function setupXAxisDrag(chart) {
    if (!chart || !chart.canvas) return;
    const canvas = chart.canvas;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Detect if click occurred inside bottom timeline labels/ticks region
        if (chart.chartArea && y > chart.chartArea.bottom && x >= chart.chartArea.left && x <= chart.chartArea.right) {
            activeScalingChart = chart;
            chart._scaleStartX = e.clientX;

            const xScale = chart.scales.x;
            chart._scaleStartRange = xScale.max - xScale.min;

            // Temporarily disable the panning plugin to prevent default drag-pan behavior
            if (chart.options.plugins.zoom) {
                chart._panWasEnabled = chart.options.plugins.zoom.pan.enabled;
                chart.options.plugins.zoom.pan.enabled = false;
            }
            e.preventDefault();
        }
    });

    // Explicitly hide tooltip and active hover elements when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        try {
            if (chart.tooltip) {
                chart.tooltip.setActiveElements([], { x: 0, y: 0 });
            }
            chart.setActiveElements([]);
            chart.update('none');
        } catch (e) { }
    });
}

// Interactive Chart Controls & Export Utilities (PNG / CSV)
function setupChartActions() {
    // 1. Export PNG Event Listeners
    document.querySelectorAll('.export-png').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const chartId = btnEl.dataset.chart;
            const activeStock = document.getElementById('stock-select').value;
            const filename = chartId === 'relativePerformanceChart' ? 'relative_performance' : `${activeStock}_${chartId}`;
            exportChartToPNG(chartId, filename);
        });
    });
}

// Capture canvas rendering onto a temporary canvas filled with card background color to ensure readability
function exportChartToPNG(chartId, filename) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');

    // Fill solid card background matching #0B0F14
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw chart canvas content on top
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = tempCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Convert active dataset series into CSV strings for tabular downloads
function exportChartToCSV(chart, filename) {
    if (!chart || !chart.data || !chart.data.datasets) return;

    let csvContent = "\uFEFF"; // Add UTF-8 Byte Order Mark (BOM) to force proper Excel rendering

    if (chart === relativeChart) {
        const labels = chart.data.labels || [];
        const datasets = chart.data.datasets;

        const headers = ["Date", ...datasets.map(ds => ds.label)];
        csvContent += headers.join(",") + "\n";

        for (let i = 0; i < labels.length; i++) {
            const dateStr = labels[i];
            const row = [dateStr];
            datasets.forEach(ds => {
                const val = ds.data[i];
                row.push(val !== null && val !== undefined ? val.toFixed(4) : "");
            });
            csvContent += row.join(",") + "\n";
        }
    }
    else if (chart === trendChart) {
        const ohlcDataset = chart.data.datasets[0];
        const ma20Dataset = chart.data.datasets[1];
        const ma50Dataset = chart.data.datasets[2];

        const data = ohlcDataset ? ohlcDataset.data : [];

        csvContent += "Date,Open,High,Low,Close,MA20,MA50\n";

        data.forEach((item, idx) => {
            const dateStr = new Date(item.x).toISOString().split('T')[0];
            const ma20 = ma20Dataset && ma20Dataset.data[idx] ? ma20Dataset.data[idx].y : "";
            const ma50 = ma50Dataset && ma50Dataset.data[idx] ? ma50Dataset.data[idx].y : "";

            const row = [
                dateStr,
                item.o.toFixed(2),
                item.h.toFixed(2),
                item.l.toFixed(2),
                item.c.toFixed(2),
                ma20 !== "" && ma20 !== null ? ma20.toFixed(2) : "",
                ma50 !== "" && ma50 !== null ? ma50.toFixed(2) : ""
            ];
            csvContent += row.join(",") + "\n";
        });
    }
    else if (chart === volumeChart) {
        const macdDataset = chart.data.datasets[0];
        const signalDataset = chart.data.datasets[1];
        const histDataset = chart.data.datasets[2];

        const data = macdDataset ? macdDataset.data : [];

        csvContent += "Date,MACD_Line,Signal_Line,Histogram\n";

        data.forEach((item, idx) => {
            const dateStr = new Date(item.x).toISOString().split('T')[0];
            const macd = item.y;
            const signal = signalDataset && signalDataset.data[idx] ? signalDataset.data[idx].y : "";
            const hist = histDataset && histDataset.data[idx] ? histDataset.data[idx].y : "";

            const row = [
                dateStr,
                macd !== null && macd !== undefined ? macd.toFixed(4) : "",
                signal !== "" && signal !== null && signal !== undefined ? signal.toFixed(4) : "",
                hist !== "" && hist !== null && hist !== undefined ? hist.toFixed(4) : ""
            ];
            csvContent += row.join(",") + "\n";
        });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to dynamically align Mulai Tahun dropdown width with Relative Timeframe selector
function alignStartYearDropdown() {
    const tfSelector = document.getElementById('relative-timeframe-selector');
    const startYearWrapper = document.querySelector('.start-year-wrapper');
    if (tfSelector && startYearWrapper) {
        const tfWidth = tfSelector.offsetWidth;
        if (tfWidth > 0) {
            startYearWrapper.style.width = `${tfWidth}px`;
        }
    }
}
