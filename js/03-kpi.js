// ============================================================================
// 03-kpi.js — KPI Animations & Setup
// ============================================================================

/// Easing function: ease-out cubic (fast start, decelerates to final value)
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// Count-up animation using requestAnimationFrame with ease-out easing
function animateValue(target, start, end, duration, decimalPlaces, prefix, suffix) {
    if (decimalPlaces === undefined) decimalPlaces = 0;
    if (prefix === undefined) prefix = "";
    if (suffix === undefined) suffix = "";

    const obj = (typeof target === 'string') ? document.getElementById(target) : target;
    if (!obj) return;

    const isNegative = end < 0;
    const absoluteEnd = Math.abs(end);
    const absoluteStart = Math.abs(start);

    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const rawProgress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(rawProgress);  // fast-start, slow-end
        const currentVal = absoluteStart + easedProgress * (absoluteEnd - absoluteStart);

        const displayVal = currentVal.toLocaleString('id-ID', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });
        const sign = isNegative ? "-" : (suffix.includes("%") && end > 0 ? "+" : "");
        obj.textContent = prefix + sign + displayVal + suffix;

        if (rawProgress < 1) {
            window.requestAnimationFrame(step);
        }
    };

    window.requestAnimationFrame(step);
}

// Force-restart a CSS animation on an element (works on every call, including refresh)
function triggerCountup(el, delayMs) {
    if (!el) return;
    delayMs = delayMs || 0;
    // Remove class, force reflow so browser resets the animation, then re-add
    el.classList.remove('kpi-countup');
    void el.offsetWidth; // <-- forces browser to flush style recalculation
    el.style.animationDelay = delayMs + 'ms';
    el.classList.add('kpi-countup');
}

/// Setup KPIs with count-up animations — restarts on every page load / refresh
function setupKPIs() {
    const COUNT_DURATION = 3750; // ms  (5× slower than original 750ms)
    const CSS_ANIM_MS = 600;  // match .kpi-countup animation duration

    // Stagger delays per card (CSS pop-in start offset)
    const STAGGER = [0, 150, 300, 450];

    // Helper: pop-in CSS then start count-up after the CSS anim is visible
    function popAndCount(elId, targetVal, decimals, prefix, suffix, staggerIdx) {
        prefix = prefix || '';
        suffix = suffix || '';
        const el = document.getElementById(elId);
        const cssDelay = STAGGER[staggerIdx];          // when CSS anim starts
        const countStart = cssDelay + CSS_ANIM_MS;       // count-up starts after anim shows element
        triggerCountup(el, cssDelay);
        setTimeout(function () {
            animateValue(elId, 0, targetVal, COUNT_DURATION, decimals, prefix, suffix);
        }, countStart);
    }

    // Get the weekly resampled IHSG data
    const rawIHSG = pricesData["IHSG"];
    const weeklyIHSG = resampleDataset(rawIHSG, 'weekly');
    const latestIHSG = weeklyIHSG[weeklyIHSG.length - 1];
    const latestIHSGClose = latestIHSG ? latestIHSG.close : metaData.ihsg_current;

    // KPI 1: IHSG Current Close
    popAndCount('kpi-ihsg-val', latestIHSGClose, 2, '', '', 0);

    // KPI 2: Status Pasar Weekly (comparing weekly close vs weekly MA50)
    const statusVal = document.getElementById('kpi-status-val');
    const statusDesc = document.getElementById('kpi-status-desc');
    if (statusVal && latestIHSG) {
        const weeklyClose = latestIHSG.close;
        const weeklyMA50 = latestIHSG.ma50;
        
        const isBullish = weeklyMA50 !== null && weeklyClose > weeklyMA50;
        const statusText = isBullish ? 'Bullish' : 'Bearish';
        
        statusVal.textContent = statusText;
        if (isBullish) {
            statusVal.className = 'kpi-value text-success';
            if (statusDesc) statusDesc.textContent = 'IHSG di atas MA50 (Weekly)';
        } else {
            statusVal.className = 'kpi-value text-danger';
            if (statusDesc) statusDesc.textContent = 'IHSG di bawah MA50 (Weekly)';
        }
        triggerCountup(statusVal, STAGGER[1]);
    }

    // Calculate weekly returns for all stocks (excluding IHSG) based on the latest week's open-to-close return (following TradingView weekly candle logic)
    const stockReturns = {};
    Object.keys(pricesData).forEach(ticker => {
        if (ticker === 'IHSG') return;
        const weeklyData = resampleDataset(pricesData[ticker], 'weekly');
        if (weeklyData && weeklyData.length > 0) {
            const latestItem = weeklyData[weeklyData.length - 1];
            if (latestItem && latestItem.open > 0) {
                stockReturns[ticker] = ((latestItem.close - latestItem.open) / latestItem.open) * 100;
            } else {
                stockReturns[ticker] = 0;
            }
        } else {
            stockReturns[ticker] = 0;
        }
    });

    // Determine top outperformer and top underperformer
    let topOutTicker = null;
    let topOutVal = -Infinity;
    let topUnderTicker = null;
    let topUnderVal = Infinity;

    Object.keys(stockReturns).forEach(ticker => {
        const ret = stockReturns[ticker];
        if (ret > topOutVal) {
            topOutVal = ret;
            topOutTicker = ticker;
        }
        if (ret < topUnderVal) {
            topUnderVal = ret;
            topUnderTicker = ticker;
        }
    });

    // KPI 3: Top Outperformer Weekly
    var topOutEl = document.getElementById('kpi-outperformer-val');
    if (topOutEl && topOutTicker) {
        topOutEl.innerHTML = topOutTicker + ' <span id="top-out-pct">( 0,0%)</span>';
        if (topOutVal >= 0) {
            topOutEl.className = 'kpi-value text-success';
        } else {
            topOutEl.className = 'kpi-value text-danger';
        }
        triggerCountup(topOutEl, STAGGER[2]);
        setTimeout(function () {
            animateValue('top-out-pct', 0, topOutVal, COUNT_DURATION, 1, '(', '%)');
        }, STAGGER[2] + CSS_ANIM_MS);
    }

    // KPI 4: Top Underperformer Weekly
    var topUnderEl = document.getElementById('kpi-underperformer-val');
    if (topUnderEl && topUnderTicker) {
        topUnderEl.innerHTML = topUnderTicker + ' <span id="top-under-pct">( 0,0%)</span>';
        if (topUnderVal >= 0) {
            topUnderEl.className = 'kpi-value text-success';
        } else {
            topUnderEl.className = 'kpi-value text-danger';
        }
        triggerCountup(topUnderEl, STAGGER[3]);
        setTimeout(function () {
            animateValue('top-under-pct', 0, topUnderVal, COUNT_DURATION, 1, '(', '%)');
        }, STAGGER[3] + CSS_ANIM_MS);
    }
}
