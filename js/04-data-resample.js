// ============================================================================
// 04-data-resample.js — Data Resampling & View Update Helpers
// ============================================================================

// Helper to trigger update for all views
function updateAllViews() {
    updateRelativeChart();
    updateOverviewSection();
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
        const lastItem = group[group.length - 1];

        // Aggregate OHLC and volume properly across the period
        const periodHigh = Math.max(...group.map(g => g.high));
        const periodLow = Math.min(...group.map(g => g.low));
        const periodVolume = group.reduce((sum, g) => sum + g.volume, 0);

        // Determine warna_volume based on period close vs period open
        const warnaVolume = (lastItem.close >= firstItem.open) ? '#12C286' : '#FF5555';

        resampled.push({
            ...lastItem,
            open: firstItem.open,
            high: periodHigh,
            low: periodLow,
            close: lastItem.close,
            volume: periodVolume,
            warna_volume: warnaVolume
        });
    });

    // Calculate rolling SMA20 and SMA50 of resampled closing prices
    for (let i = 0; i < resampled.length; i++) {
        // MA20
        if (i >= 19) {
            let sum20 = 0;
            for (let j = i - 19; j <= i; j++) {
                sum20 += resampled[j].close;
            }
            resampled[i].ma20 = sum20 / 20;
        } else {
            resampled[i].ma20 = null;
        }

        // MA50
        if (i >= 49) {
            let sum50 = 0;
            for (let j = i - 49; j <= i; j++) {
                sum50 += resampled[j].close;
            }
            resampled[i].ma50 = sum50 / 50;
        } else {
            resampled[i].ma50 = null;
        }
    }

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
