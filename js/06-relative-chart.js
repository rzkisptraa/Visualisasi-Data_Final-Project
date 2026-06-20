// ============================================================================
// 06-relative-chart.js — Relative Performance Chart (Chart 1)
// ============================================================================

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
            normalized: true,
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
                        onPan: ({ chart }) => {
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
                        onZoom: ({ chart }) => {
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
                    },
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        const dataset = ci.data.datasets[index];

                        const origColor = dataset._originalBorderColor || dataset.borderColor;
                        dataset._originalBorderColor = origColor;

                        const duration = 280; // Smooth 280ms fade transition
                        const startTime = performance.now();

                        if (ci.isDatasetVisible(index)) {
                            // Smooth Fade Out of the line
                            function fadeOutStep(now) {
                                const elapsed = now - startTime;
                                const progress = Math.min(elapsed / duration, 1);
                                const alpha = 1 - progress;

                                dataset.borderColor = hexToRgba(origColor, alpha);
                                ci.update('none');

                                if (progress < 1) {
                                    requestAnimationFrame(fadeOutStep);
                                } else {
                                    ci.hide(index);
                                    legendItem.hidden = true;
                                    dataset.borderColor = origColor;
                                    autoScaleY(ci);
                                    ci.update('none');
                                }
                            }
                            requestAnimationFrame(fadeOutStep);
                        } else {
                            // Smooth Fade In of the line
                            dataset.borderColor = hexToRgba(origColor, 0);
                            ci.show(index);
                            legendItem.hidden = false;
                            autoScaleY(ci);
                            ci.update('none');

                            function fadeInStep(now) {
                                const elapsed = now - startTime;
                                const progress = Math.min(elapsed / duration, 1);
                                const alpha = progress;

                                dataset.borderColor = hexToRgba(origColor, alpha);
                                ci.update('none');

                                if (progress < 1) {
                                    requestAnimationFrame(fadeInStep);
                                } else {
                                    dataset.borderColor = origColor;
                                    ci.update('none');
                                }
                            }
                            requestAnimationFrame(fadeInStep);
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#0B0F14',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    borderRadius: 6,
                    titleColor: '#FFFFFF',
                    bodyColor: '#E5E7EB',
                    titleFont: { family: 'Inter', size: 12, weight: '600' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 12,
                    titleSpacing: 6,
                    bodySpacing: 4,
                    itemSort: function (a, b) {
                        const valA = (a.parsed && a.parsed.y !== null && a.parsed.y !== undefined) ? a.parsed.y : -Infinity;
                        const valB = (b.parsed && b.parsed.y !== null && b.parsed.y !== undefined) ? b.parsed.y : -Infinity;
                        return valB - valA;
                    },
                    callbacks: {
                        title: function (context) {
                            if (!context || context.length === 0) return "";
                            const dateStr = context[0].label;
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return dateStr;
                            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                        },
                        label: function (context) {
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
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 11, weight: '500' },
                        maxTicksLimit: 12,
                        padding: 10,
                        callback: function (value, index, values) {
                            if (!relativeChart) return "";
                            const dateStr = relativeChart.data.labels[value];
                            if (!dateStr) return "";
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return dateStr;

                            if (relativeTimeframe === 'yearly') {
                                return d.toLocaleDateString('id-ID', { year: 'numeric' });
                            } else if (relativeTimeframe === 'monthly') {
                                return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
                            } else {
                                return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                            }
                        }
                    }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                    ticks: {
                        color: '#9CA3AF',
                        font: { family: 'Inter', size: 11, weight: '500' },
                        padding: 10,
                        callback: function (value) { return value.toFixed(0) + '%'; }
                    }
                }
            }
        }
    });

    setupXAxisDrag(relativeChart);
}

// Helper to map relative timeframe to Chart.js time scale unit
function getRelativeTimeUnit(timeframe) {
    if (timeframe === 'daily') return 'day';
    if (timeframe === 'weekly') return 'week';
    if (timeframe === 'monthly') return 'month';
    if (timeframe === 'yearly') return 'year';
    return 'day';
}

// Update Chart 1 dynamically based on resampled and sliced datasets
function updateRelativeChart() {
    if (!relativeChart || !pricesData) return;

    const startYearSelect = document.getElementById('start-year-select');
    const startYear = startYearSelect ? startYearSelect.value : 'all';

    // Update subtitle text dynamically
    const subtitleEl = document.getElementById('relative-chart-subtitle');
    if (subtitleEl) {
        if (startYear === 'all') {
            subtitleEl.textContent = 'Perbandingan imbal hasil kumulatif saham terhadap IHSG (Skala Persentase, Dimulai dari awal tahun 2016)';
        } else {
            subtitleEl.textContent = `Perbandingan imbal hasil kumulatif saham terhadap IHSG (Skala Persentase, Dimulai dari awal tahun ${startYear})`;
        }
    }

    const rawIHSG = pricesData["IHSG"];
    const resampledIHSG = resampleDataset(rawIHSG, relativeTimeframe);
    
    // Filter labels by chosen starting year if applicable
    let labels = resampledIHSG.map(item => item.date);
    if (startYear !== 'all') {
        const yearInt = parseInt(startYear, 10);
        labels = labels.filter(dateStr => {
            const d = new Date(dateStr);
            return d.getFullYear() >= yearInt;
        });
    }

    const datasets = Object.keys(pricesData).map(ticker => {
        const resampled = resampleDataset(pricesData[ticker], relativeTimeframe);

        const rawData = pricesData[ticker];
        const absoluteFirstActiveItem = rawData.find(item => item.active !== false);
        const absoluteFirstActiveDate = absoluteFirstActiveItem ? absoluteFirstActiveItem.date : null;

        // Find the first active item for this stock within the filtered timeline
        let rangeFirstActiveItem = null;
        for (const dateStr of labels) {
            const match = resampled.find(item => item.date === dateStr);
            if (match && match.active !== false) {
                rangeFirstActiveItem = match;
                break;
            }
        }

        let baseClose = null;
        let isIPOWithinRange = false;
        if (rangeFirstActiveItem) {
            isIPOWithinRange = absoluteFirstActiveDate && (new Date(absoluteFirstActiveDate) >= new Date(labels[0]));
            if (isIPOWithinRange && absoluteFirstActiveItem) {
                baseClose = absoluteFirstActiveItem.close;
            } else {
                baseClose = rangeFirstActiveItem.close;
            }
        }

        const pricesList = [];
        const alignedData = labels.map(dateStr => {
            const match = resampled.find(item => item.date === dateStr);
            if (match && match.active !== false) {
                pricesList.push(match.close);
                if (baseClose !== null && baseClose !== 0) {
                    return ((match.close - baseClose) / baseClose) * 100;
                }
                return 0.0;
            } else {
                pricesList.push(null);
                return null;
            }
        });

        // Ensure that the first active index gets an exact 0.0% rebased start point
        // ONLY if the stock was already active before the selected range started.
        const firstActiveIdx = alignedData.findIndex(val => val !== null);
        if (firstActiveIdx !== -1 && baseClose !== null && !isIPOWithinRange) {
            alignedData[firstActiveIdx] = 0.0;
        }

        return {
            label: ticker === 'IHSG' ? 'IHSG (Benchmark)' : ticker,
            data: alignedData,
            prices: pricesList,
            firstClose: baseClose,
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

    const N = labels.length;
    const defaultZoom = getDefaultZoom(N, relativeTimeframe);
    const minIndex = Math.max(0, N - defaultZoom);
    const maxIndex = N - 1;
    relativeChart.options.scales.x.min = minIndex;
    relativeChart.options.scales.x.max = maxIndex;

    // Assign datasets to calculate target Y scale ranges
    relativeChart.data.datasets = datasets;
    autoScaleY(relativeChart);

    // Set datasets to flat 0% baseline for the initial frame
    const flatDatasets = datasets.map(ds => {
        return {
            ...ds,
            data: ds.data.map(val => val === null ? null : 0.0)
        };
    });
    relativeChart.data.datasets = flatDatasets;

    // Turn off animation temporarily to draw the flat state instantly
    relativeChart.options.animation = false;
    relativeChart.update('none');

    // Animate lines rising up to target values smoothly
    setTimeout(() => {
        if (!relativeChart) return;

        relativeChart.options.animation = {
            duration: 1200,
            easing: 'easeOutCubic'
        };

        relativeChart.data.datasets = datasets;
        relativeChart.update();

        // Reset animation duration back to 0 after completion to keep drag scaling crisp
        setTimeout(() => {
            if (relativeChart && relativeChart.options) {
                relativeChart.options.animation = false;
            }
        }, 1250);
    }, 190);
}
