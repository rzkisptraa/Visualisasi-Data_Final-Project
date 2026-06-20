// ============================================================================
// 12-crosshair.js — Crosshair Plugin & Events
// ============================================================================

// Format date for crosshair label box based on current timeframe
function formatDateForCrosshair(timestamp, timeframe) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";

    if (timeframe === 'monthly') {
        return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    } else if (timeframe === 'yearly') {
        return d.toLocaleDateString('id-ID', { year: 'numeric' });
    } else {
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
}

// Synced crosshair lines & axis labels plugin
const crosshairPlugin = {
    id: 'crosshairPlugin',
    afterDatasetsDraw(chart, args, options) {
        if (crosshairState.xVal === null) return;

        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        const xPixel = xScale.getPixelForValue(crosshairState.xVal);

        ctx.save();

        // 1. Draw synchronized vertical dotted line if inside chartArea
        if (xPixel >= chart.chartArea.left && xPixel <= chart.chartArea.right) {
            ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(xPixel, chart.chartArea.top);
            ctx.lineTo(xPixel, chart.chartArea.bottom);
            ctx.stroke();

            // Only draw X-axis label box if this is the active chart
            if (crosshairState.activeChartId === chart.canvas.id) {
                const text = formatDateForCrosshair(crosshairState.xVal, currentTimeframe);
                ctx.font = '10px Inter';
                const textWidth = ctx.measureText(text).width;
                const boxWidth = textWidth + 12;
                const boxHeight = 18;
                const boxX = xPixel - boxWidth / 2;
                const boxY = chart.chartArea.bottom + 2;

                // Keep box inside chart boundaries
                let finalBoxX = boxX;
                if (finalBoxX < chart.chartArea.left) {
                    finalBoxX = chart.chartArea.left;
                } else if (finalBoxX + boxWidth > chart.chartArea.right) {
                    finalBoxX = chart.chartArea.right - boxWidth;
                }

                ctx.fillStyle = '#2A3441';
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(finalBoxX, boxY, boxWidth, boxHeight, 3);
                } else {
                    ctx.rect(finalBoxX, boxY, boxWidth, boxHeight);
                }
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, finalBoxX + boxWidth / 2, boxY + boxHeight / 2);
            }
        }

        // 2. Draw horizontal dotted line and Y-axis label box if this is the active chart
        if (crosshairState.activeChartId === chart.canvas.id) {
            const yVal = chart.canvas.id === 'trendChart' ? crosshairState.yValTrend : crosshairState.yValVolume;
            if (yVal !== null && yVal !== undefined) {
                const yPixel = yScale.getPixelForValue(yVal);

                if (yPixel >= chart.chartArea.top && yPixel <= chart.chartArea.bottom) {
                    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, yPixel);
                    ctx.lineTo(chart.chartArea.right, yPixel);
                    ctx.stroke();

                    // Format Y value text
                    let formattedY = "";
                    if (chart.canvas.id === 'trendChart') {
                        formattedY = 'Rp ' + yVal.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    } else if (chart.canvas.id === 'volumeChart') {
                        const sign = yVal >= 0 ? '+' : '';
                        formattedY = sign + yVal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }

                    ctx.font = '10px Inter';
                    const textWidth = ctx.measureText(formattedY).width;
                    const boxWidth = textWidth + 12;
                    const boxHeight = 18;
                    const boxX = chart.chartArea.left - boxWidth;
                    const boxY = yPixel - boxHeight / 2;

                    // Constrain box vertically within chartArea
                    let finalBoxY = boxY;
                    if (finalBoxY < chart.chartArea.top) {
                        finalBoxY = chart.chartArea.top;
                    } else if (finalBoxY + boxHeight > chart.chartArea.bottom) {
                        finalBoxY = chart.chartArea.bottom - boxHeight;
                    }

                    ctx.fillStyle = '#2A3441';
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(boxX, finalBoxY, boxWidth, boxHeight, 3);
                    } else {
                        ctx.rect(boxX, finalBoxY, boxWidth, boxHeight);
                    }
                    ctx.fill();

                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(formattedY, boxX + boxWidth / 2, finalBoxY + boxHeight / 2);
                }
            }
        }

        ctx.restore();
    }
};

// Setup mousemove and mouseleave events to synchronize crosshairs
function setupCrosshairEvents() {
    const trendCanvas = document.getElementById('trendChart');
    const volumeCanvas = document.getElementById('volumeChart');

    if (!trendCanvas || !volumeCanvas) return;

    // Binary search: find index of nearest timestamp in sorted array
    function bsSnapTimestamp(ts) {
        var arr = _trendTimestamps;
        if (!arr || arr.length === 0) return ts;
        var lo = 0, hi = arr.length - 1;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (arr[mid] < ts) lo = mid + 1; else hi = mid;
        }
        // lo is first index >= ts; check lo-1 as well
        if (lo > 0 && Math.abs(arr[lo - 1] - ts) <= Math.abs(arr[lo] - ts)) lo--;
        return arr[lo];
    }

    const handleMouseMove = (e, chartId, chart, otherChart) => {
        // Skip crosshair updates during detail chart transition animation to avoid lag/conflicts
        if (isDetailChartAnimating) {
            return;
        }
        // Skip crosshair drawing during active ruler measurement
        if (rulerState && rulerState.active && rulerState.isMeasuring) {
            handleMouseLeave();
            return;
        }

        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Ensure mouse is inside chart Area
        if (x < chart.chartArea.left || x > chart.chartArea.right ||
            y < chart.chartArea.top || y > chart.chartArea.bottom) {
            handleMouseLeave();
            return;
        }

        // Get raw values then snap X to nearest candle (binary search, O(log n))
        const rawXVal = chart.scales.x.getValueForPixel(x);
        const yVal = chart.scales.y.getValueForPixel(y);
        const snappedXVal = bsSnapTimestamp(rawXVal);

        // Only schedule a redraw if something actually changed
        const changed = (crosshairState.xVal !== snappedXVal ||
            crosshairState.activeChartId !== chartId);

        crosshairState.xVal = snappedXVal;
        crosshairState.activeChartId = chartId;
        if (chartId === 'trendChart') {
            crosshairState.yValTrend = yVal;
            crosshairState.yValVolume = null;
        } else {
            crosshairState.yValVolume = yVal;
            crosshairState.yValTrend = null;
        }

        if (!changed) return;   // cursor still on same bar — skip repaint

        // Throttle redraws to one per animation frame (≈16ms @ 60fps)
        if (_crosshairRafId) cancelAnimationFrame(_crosshairRafId);
        _crosshairRafId = requestAnimationFrame(function () {
            _crosshairRafId = null;
            chart.update('none');
            if (otherChart) otherChart.update('none');
        });
    };

    const handleMouseLeave = () => {
        if (crosshairState.xVal === null) return;

        crosshairState.xVal = null;
        crosshairState.yValTrend = null;
        crosshairState.yValVolume = null;
        crosshairState.activeChartId = null;

        if (trendChart) {
            try {
                if (trendChart.tooltip) trendChart.tooltip.setActiveElements([], { x: 0, y: 0 });
                trendChart.setActiveElements([]);
            } catch (e) { }
            trendChart.update('none');
        }
        if (volumeChart) {
            try {
                if (volumeChart.tooltip) volumeChart.tooltip.setActiveElements([], { x: 0, y: 0 });
                volumeChart.setActiveElements([]);
            } catch (e) { }
            volumeChart.update('none');
        }
    };

    trendCanvas.addEventListener('mousemove', (e) => {
        if (trendChart && volumeChart) {
            handleMouseMove(e, 'trendChart', trendChart, volumeChart);
        }
    });

    volumeCanvas.addEventListener('mousemove', (e) => {
        if (volumeChart && trendChart) {
            handleMouseMove(e, 'volumeChart', volumeChart, trendChart);
        }
    });

    trendCanvas.addEventListener('mouseleave', handleMouseLeave);
    volumeCanvas.addEventListener('mouseleave', handleMouseLeave);
}
