// ============================================================================
// 13-overview-heatmap.js — Overview Section (IHSG Trend Chart & Stock Heatmap)
// ============================================================================

// Get heatmap block background color based on percentage change (TradingView style)
function getHeatmapColor(val) {
    if (val === null || val === undefined || Math.abs(val) < 0.01) {
        return 'rgba(42, 52, 65, 0.4)'; // neutral translucent grey
    }
    const maxVal = 5.0; // color scales up to 5% change
    const pct = Math.min(Math.abs(val) / maxVal, 1.0);
    const opacity = 0.15 + pct * 0.70; // opacity between 0.15 and 0.85

    if (val > 0) {
        return `rgba(38, 166, 154, ${opacity})`; // #26A69A green
    } else {
        return `rgba(239, 83, 80, ${opacity})`; // #EF5350 red
    }
}

// Controller function to update overview section (Locks timeframe for both)
function updateOverviewSection() {
    updateIHSGTrendChart();
    updateStockHeatmap();
}

// Simple IHSG line chart vs MA50
function updateIHSGTrendChart() {
    const rawIHSG = pricesData["IHSG"];
    if (!rawIHSG) return;

    const resampled = resampleDataset(rawIHSG, heatmapTimeframe);

    const N = resampled.length;
    const defaultZoom = getDefaultZoom(N, heatmapTimeframe);
    const minIndex = Math.max(0, N - defaultZoom);
    const sliced = resampled.slice(minIndex);

    const dates = sliced.map(item => new Date(item.date).getTime());
    const closeData = sliced.map(item => item.close);
    const ma50Data = sliced.map(item => item.ma50 != null ? item.ma50 : null);

    const ctx = document.getElementById('ihsgTrendChart').getContext('2d');

    if (ihsgTrendChart) {
        ihsgTrendChart.destroy();
        ihsgTrendChart = null;
    }

    // Find minimum value to use as the bottom baseline for the animation
    const allValues = [...closeData, ...ma50Data].filter(val => val !== null && val !== undefined);
    const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;

    // First, render the chart with flat data at the minimum value
    const flatCloseData = closeData.map(() => minVal);
    const flatMa50Data = ma50Data.map(val => val === null ? null : minVal);

    ihsgTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'IHSG',
                    data: flatCloseData,
                    borderColor: '#FFFFFF',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'MA50',
                    data: flatMa50Data,
                    borderColor: '#3B82F6',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    borderDash: [6, 4],
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: {
            normalized: true,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
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
                    padding: 10,
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    titleFont: { family: 'Inter', size: 11, weight: '600' },
                    bodyFont: { family: 'Inter', size: 10 },
                    titleSpacing: 5,
                    bodySpacing: 4,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
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
                    grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10, weight: '500' },
                        maxTicksLimit: 3,
                        align: 'inner',
                        padding: 6
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 10, weight: '500' },
                        padding: 6,
                        callback: function (value) { return value.toLocaleString('id-ID'); }
                    }
                }
            }
        }
    });

    // Assign full datasets to calculate target Y scale ranges
    ihsgTrendChart.data.datasets[0].data = closeData;
    ihsgTrendChart.data.datasets[1].data = ma50Data;
    autoScaleY(ihsgTrendChart);

    // Revert to flat data for the initial frame to draw the flat state instantly
    ihsgTrendChart.data.datasets[0].data = flatCloseData;
    ihsgTrendChart.data.datasets[1].data = flatMa50Data;
    ihsgTrendChart.options.animation = false;
    ihsgTrendChart.update('none');

    // Setup drag logic on the initial instance
    setupXAxisDrag(ihsgTrendChart);

    // Animate lines rising up to target values smoothly
    setTimeout(() => {
        if (!ihsgTrendChart) return;

        ihsgTrendChart.options.animation = {
            duration: 1200,
            easing: 'easeOutCubic'
        };

        ihsgTrendChart.data.datasets[0].data = closeData;
        ihsgTrendChart.data.datasets[1].data = ma50Data;
        ihsgTrendChart.update();

        // Reset animation duration back to false after completion to keep drag scaling crisp
        setTimeout(() => {
            if (ihsgTrendChart && ihsgTrendChart.options) {
                ihsgTrendChart.options.animation = false;
            }
        }, 1250);
    }, 190);
}

// Render stock heatmap grid — columns sorted ascending by |returnPct| (smallest left -> largest right)
function updateStockHeatmap() {
    const container = document.getElementById('stock-heatmap');
    if (!container) return;
    container.innerHTML = '';

        const tickers = ["BBCA", "BBRI", "BMRI", "TLKM", "BREN", "AMMN", "ASII", "ANTM", "UNVR", "IHSG"];

    // Step 1: Collect return percentages
    const returns = {};
    tickers.forEach(function (ticker) {
        const rawData = pricesData[ticker];
        if (!rawData) { returns[ticker] = 0; return; }
        const activeData = rawData.filter(function (item) { return item.active !== false; });
        const resampled = resampleDataset(activeData, heatmapTimeframe);
        let returnPct = 0;
        if (resampled.length > 0) {
            const latestItem = resampled[resampled.length - 1];
            const prevItem = resampled[resampled.length - 2] || latestItem;

            // Pembaruan formula per timeframe secara terpisah (Mengikuti Logic TradingView Open-to-Close)
            if (latestItem && latestItem.open !== 0) {
                returnPct = ((latestItem.close - latestItem.open) / latestItem.open) * 100;
            }
        }
        returns[ticker] = returnPct;
    });

    // Step 2: Define the 6 column groups dynamically
    // Sort all 10 tickers based on actual return value (ascending: from negative to positive)
    const sortedTickers = tickers.slice().sort(function (a, b) {
        return returns[a] - returns[b];
    });

    const MIN_WEIGHT = 0.12;
    // We want 6 columns. With 10 stocks:
    // Column 1 (far left, most negative): Solo
    // Column 2 (negative): Pair
    // Column 3 (near zero, negative): Pair
    // Column 4 (near zero, positive): Pair
    // Column 5 (positive): Pair
    // Column 6 (far right, most positive): Solo
    // Total: 1 + 2 + 2 + 2 + 2 + 1 = 10 stocks.
    const groups = [
        { id: sortedTickers[0], type: 'solo', stocks: [sortedTickers[0]] },
        { id: sortedTickers[1] + '_' + sortedTickers[2], type: 'pair', stocks: [sortedTickers[1], sortedTickers[2]] },
        { id: sortedTickers[3] + '_' + sortedTickers[4], type: 'pair', stocks: [sortedTickers[3], sortedTickers[4]] },
        { id: sortedTickers[5] + '_' + sortedTickers[6], type: 'pair', stocks: [sortedTickers[5], sortedTickers[6]] },
        { id: sortedTickers[7] + '_' + sortedTickers[8], type: 'pair', stocks: [sortedTickers[7], sortedTickers[8]] },
        { id: sortedTickers[9], type: 'solo', stocks: [sortedTickers[9]] }
    ];

    // Compute weights for each group
    groups.forEach(function (g) {
        if (g.type === 'solo') {
            g.weight = Math.max(MIN_WEIGHT, Math.abs(returns[g.stocks[0]]));
        } else {
            g.weight = Math.max(MIN_WEIGHT, Math.max(Math.abs(returns[g.stocks[0]]), Math.abs(returns[g.stocks[1]])));
        }
    });

    // Step 3: Keep the predefined sorted order (minus to plus) and do not sort by weight

    // Step 4: Build grid-template-columns proportional to each column weight
    const totalWeight = groups.reduce(function (sum, g) { return sum + g.weight; }, 0);
    const colFr = groups.map(function (g) { return ((g.weight / totalWeight) * 100).toFixed(2) + 'fr'; }).join(' ');
    container.style.gridTemplateColumns = colFr;

    // Step 5: Build grid-template-rows — clamp pair row split to [25%, 75%]
    // Prevents a small-move stock (AMMN +0.3%) from becoming an invisible sliver
    // next to a large-move partner (BREN +27%).
    const MIN_ROW_PCT = 25;
    const MAX_ROW_PCT = 75;
    let topFrSum = 0, botFrSum = 0, pairCount = 0;
    groups.forEach(function (g) {
        if (g.type === 'pair') {
            const wTop = Math.max(MIN_WEIGHT, Math.abs(returns[g.stocks[0]]));
            const wBot = Math.max(MIN_WEIGHT, Math.abs(returns[g.stocks[1]]));
            const rawTop = (wTop / (wTop + wBot)) * 100;
            const clampedTop = Math.min(MAX_ROW_PCT, Math.max(MIN_ROW_PCT, rawTop));
            topFrSum += clampedTop;
            botFrSum += (100 - clampedTop);
            pairCount++;
        }
    });
    const avgTopFr = pairCount > 0 ? topFrSum / pairCount : 50;
    const avgBotFr = pairCount > 0 ? botFrSum / pairCount : 50;
    container.style.gridTemplateRows = avgTopFr.toFixed(2) + 'fr ' + avgBotFr.toFixed(2) + 'fr';

    // Step 6: Assign grid areas from sorted column positions
    const gridAreas = {};
    groups.forEach(function (g, colIdx) {
        const col = colIdx + 1;
        if (g.type === 'solo') {
            gridAreas[g.stocks[0]] = '1 / ' + col + ' / 3 / ' + (col + 1);
        } else {
            gridAreas[g.stocks[0]] = '1 / ' + col + ' / 2 / ' + (col + 1);
            gridAreas[g.stocks[1]] = '2 / ' + col + ' / 3 / ' + (col + 1);
        }
    });

    // Step 7: Render blocks
    tickers.forEach(function (ticker, index) {
        const returnPct = returns[ticker];
        const color = getHeatmapColor(returnPct);
        const sign = returnPct >= 0 ? '+' : '';
        const pctText = sign + returnPct.toFixed(2) + '%';
        const absVal = Math.abs(returnPct);
        const fontScale = Math.min(1.4, 0.9 + (absVal / 5) * 0.5);
        const pctScale = Math.min(1.25, 0.8 + (absVal / 5) * 0.45);

        const block = document.createElement('div');
        block.className = 'heatmap-block heatmap-block-anim';
        block.style.gridArea = gridAreas[ticker];
        block.style.backgroundColor = color;

        // Ensure perfect sorting order in mobile/tablet grids where grid-area is overridden
        block.style.order = sortedTickers.indexOf(ticker);

        // Stagger the CSS pop-in animation delay
        block.style.animationDelay = (index * 60) + 'ms';

        const tickerDiv = document.createElement('div');
        tickerDiv.className = 'heatmap-ticker';
        tickerDiv.style.fontSize = fontScale.toFixed(2) + 'rem';
        tickerDiv.textContent = ticker;

        const pctDiv = document.createElement('div');
        pctDiv.className = 'heatmap-pct';
        pctDiv.style.fontSize = pctScale.toFixed(2) + 'rem';
        pctDiv.textContent = '0,00%'; // Initial text before count-up starts

        block.appendChild(tickerDiv);
        block.appendChild(pctDiv);
        block.title = ticker + ': ' + pctText;

        block.addEventListener('click', function () {
            if (ticker === 'IHSG') return;
            const stockSelect = document.getElementById('stock-select');
            if (stockSelect) {
                stockSelect.value = ticker;
                updateSelectedStockView(ticker);
                const analyticsSection = document.querySelector('.analytics-section');
                if (analyticsSection) {
                    analyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });

        container.appendChild(block);

        // Start count-up animation stagger after the grid columns transition (600ms) completes
        setTimeout(function () {
            animateValue(pctDiv, 0, returnPct, 1500, 2, '', '%');
        }, 600 + (index * 60));
    });
}
