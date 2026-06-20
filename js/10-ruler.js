// ============================================================================
// 10-ruler.js — Ruler Measurement Tool Plugin & Helpers
// ============================================================================

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
            ctx.fillStyle = 'rgba(0, 102, 255, 0.55)';
            ctx.strokeStyle = 'rgba(51, 133, 255, 0.8)';
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
