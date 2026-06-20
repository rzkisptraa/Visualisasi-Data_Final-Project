// ============================================================================
// 02-init.js — Dashboard Initialization & Metadata Setup
// ============================================================================

async function initDashboard() {
    try {
        // Force high resolution rendering for canvases to prevent blurry text/lines
        if (typeof Chart !== 'undefined' && Chart.defaults) {
            Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        }

        // Fetch JSON files
        const [pricesRes, metaRes] = await Promise.all([
            fetch('data/prices.json?t=' + Date.now()),
            fetch('data/meta.json?t=' + Date.now())
        ]);

        if (!pricesRes.ok || !metaRes.ok) {
            throw new Error('Failed to fetch data files');
        }

        pricesData = await pricesRes.json();
        metaData = await metaRes.json();

        // Pre-calculate rebased return for each stock relative to its first active day (IPO date)
        Object.keys(pricesData).forEach(ticker => {
            const data = pricesData[ticker];
            const firstActiveItem = data.find(item => item.active !== false);
            const firstClose = firstActiveItem ? firstActiveItem.close : null;
            data.forEach(item => {
                if (firstClose !== null && item.active !== false) {
                    item.rebased = firstClose !== 0 ? ((item.close - firstClose) / firstClose) * 100 : 0;
                } else {
                    item.rebased = null;
                }
            });
        });

        // Setup metadata & KPI counters
        setupMetadata();
        setupKPIs();

        // Render Chart 1 (Relative Performance)
        renderRelativeChart();

        // Init Selected Stock detail charts and insights
        const stockSelect = document.getElementById('stock-select');

        // Setup global timeframe button selector (controls trend & volume charts only)
        const tfSelector = document.getElementById('timeframe-selector');
        tfSelector.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tfSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentTimeframe = e.target.dataset.tf;

                const currentStock = document.getElementById('stock-select').value;
                transitionDetailCharts(() => updateSelectedStockView(currentStock));
            });
        });

        // Setup relative performance timeframe button selector (controls relative chart only)
        const relTfSelector = document.getElementById('relative-timeframe-selector');
        relTfSelector.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                relTfSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                relativeTimeframe = e.target.dataset.tf;

                transitionRelativeChart(() => updateRelativeChart());
            });
        });

        // Setup start year select listener
        const startYearSelect = document.getElementById('start-year-select');
        if (startYearSelect) {
            startYearSelect.addEventListener('change', () => {
                transitionRelativeChart(() => updateRelativeChart());
            });
        }

        // Setup heatmap & simple IHSG timeframe button selector (locks them together)
        const heatTfSelector = document.getElementById('heatmap-timeframe-selector');
        if (heatTfSelector) {
            heatTfSelector.querySelectorAll('.tf-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    heatTfSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    heatmapTimeframe = e.target.dataset.tf;
                    updateOverviewSection();
                });
            });
        }

        // Setup initial view
        updateAllViews();

        // Setup interactive chart controls & export utilities
        setupChartActions();

        // Setup ruler measurement tool button and event handlers
        setupRulerToggle();
        setupRulerEvents();

        // Setup crosshair event handlers
        setupCrosshairEvents();

        // Add dropdown change listener — transition detail charts on stock switch
        stockSelect.addEventListener('change', (e) => {
            transitionDetailCharts(() => updateSelectedStockView(e.target.value));
        });

        // Add double-click listeners on canvases for zoom reset
        const relativeCanvas = document.getElementById('relativePerformanceChart');
        const trendCanvas = document.getElementById('trendChart');
        const volumeCanvas = document.getElementById('volumeChart');

        relativeCanvas.addEventListener('dblclick', () => {
            handleChartReset(relativeChart);
        });

        trendCanvas.addEventListener('dblclick', () => {
            handleChartReset(trendChart);
            if (volumeChart) {
                syncXAxis(trendChart, volumeChart);
            }
            updateInsightsFromChart();
        });

        volumeCanvas.addEventListener('dblclick', () => {
            handleChartReset(trendChart);
            if (volumeChart) {
                syncXAxis(trendChart, volumeChart);
            }
            updateInsightsFromChart();
        });

        // Align Mulai Tahun dropdown width with relative timeframe selector
        alignStartYearDropdown();
        window.addEventListener('resize', alignStartYearDropdown);
        setTimeout(alignStartYearDropdown, 100);
        setTimeout(alignStartYearDropdown, 300);
        setTimeout(alignStartYearDropdown, 800);

    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('analysis-insights-box').innerHTML = `
            <div style="color: var(--bearish-color); padding: 10px; border: 1px solid rgba(255,85,85,0.2); background: rgba(255,85,85,0.05); border-radius: 6px;">
                <strong>Gagal memuat data dashboard.</strong> Silakan jalankan <code>python scripts/fetch_data.py</code> untuk membuat file data JSON terlebih dahulu.
            </div>
        `;
    }
}

// Setup static metadata values
function setupMetadata() {
    document.getElementById('last-update-time').textContent = metaData.last_update;
}
