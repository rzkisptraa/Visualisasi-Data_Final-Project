// ============================================================================
// 11-indicators.js — MACD Technical Indicator Calculations
// ============================================================================

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
