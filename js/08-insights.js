// ============================================================================
// 08-insights.js — Generate Insights Automatically
// ============================================================================

// Generate Insights Automatically
function generateInsights(ticker, stockData, fullResampled) {
    if (stockData.length === 0) return;

    const latest = stockData[stockData.length - 1];
    const prev = stockData[stockData.length - 2] || latest;
    const first = stockData[0];

    const close = latest.close;
    const ma20 = latest.ma20;
    const ma50 = latest.ma50;

    // Calculate returns
    const stockReturn = ((close - first.close) / first.close * 100).toFixed(1);

    // Calculate IHSG return in same period
    const rawIHSG = pricesData["IHSG"];
    const resampledIHSG = resampleDataset(rawIHSG, currentTimeframe);
    // Find matching date in IHSG
    const matchingFirstIHSG = resampledIHSG.find(item => item.date === first.date) || resampledIHSG[0];
    const matchingLatestIHSG = resampledIHSG.find(item => item.date === latest.date) || resampledIHSG[resampledIHSG.length - 1];
    const ihsgReturn = ((matchingLatestIHSG.close - matchingFirstIHSG.close) / matchingFirstIHSG.close * 100).toFixed(1);

    // Update Timeframe Note beside the badges
    const noteEl = document.getElementById('insights-timeframe-note');
    if (noteEl) {
        let tfText = "";
        if (currentTimeframe === 'daily') tfText = "DAILY";
        else if (currentTimeframe === 'weekly') tfText = "WEEKLY";
        else if (currentTimeframe === 'monthly') tfText = "MONTHLY";
        else if (currentTimeframe === 'yearly') tfText = "YEARLY";
        noteEl.textContent = tfText;
    }

    // 1. Determine Trend Badge & Text
    let trendBadge = "Neutral";
    let trendBadgeClass = "badge-neutral";
    let trendInsightText = "";

    if (close > ma50) {
        trendBadge = "Bullish";
        trendBadgeClass = "badge-bullish";
        trendInsightText = `<span class="text-success">bullish</span>. Harga penutupan terbaru (Rp ${close.toLocaleString('id-ID')}) berada di atas MA50 (Rp ${ma50.toLocaleString('id-ID')}), yang menunjukkan pergerakan tren jangka menengah yang kuat.`;
    } else {
        trendBadge = "Bearish";
        trendBadgeClass = "badge-bearish";
        trendInsightText = `<span class="text-danger">bearish</span>. Harga penutupan terbaru (Rp ${close.toLocaleString('id-ID')}) berada di bawah MA50 (Rp ${ma50.toLocaleString('id-ID')}), yang mengindikasikan tekanan jual jangka menengah.`;
    }

    // Add short-term MA20 reference
    let shortTermTrend = "";
    if (close > ma20) {
        shortTermTrend = `Di jangka pendek, harga juga diperdagangkan di atas MA20 (Rp ${ma20.toLocaleString('id-ID')}), mengonfirmasi kekuatan momentum beli saat ini.`;
    } else {
        shortTermTrend = `Di jangka pendek, harga tertekan di bawah MA20 (Rp ${ma20.toLocaleString('id-ID')}), menunjukkan adanya pelemahan tren jangka pendek.`;
    }

    // Update Trend Badge
    const trBadgeEl = document.getElementById('stock-trend-badge');
    if (trBadgeEl) {
        trBadgeEl.textContent = trendBadge;
        trBadgeEl.className = `badge ${trendBadgeClass}`;
    }

    // 2. Determine MACD Momentum Badge & Text
    const macdData = calculateMACD(fullResampled || stockData);
    const latestDate = latest.date;
    const fullDataset = fullResampled || stockData;
    const latestIdx = fullDataset.findIndex(item => item.date === latestDate);

    const latestMacd = latestIdx !== -1 ? macdData.macdLine[latestIdx] : macdData.macdLine[macdData.macdLine.length - 1];
    const latestSignal = latestIdx !== -1 ? macdData.signalLine[latestIdx] : macdData.signalLine[macdData.signalLine.length - 1];
    const latestHist = latestIdx !== -1 ? macdData.histogram[latestIdx] : macdData.histogram[macdData.histogram.length - 1];

    const prevIdx = latestIdx > 0 ? latestIdx - 1 : latestIdx;
    const prevHist = latestIdx !== -1 ? macdData.histogram[prevIdx] : (macdData.histogram[macdData.histogram.length - 2] || latestHist);

    let momentumBadge = "Momentum Neutral";
    let momentumBadgeClass = "badge-neutral";
    let momentumInsightText = "";

    if (latestMacd > latestSignal) {
        momentumBadge = "Momentum Bullish";
        momentumBadgeClass = "badge-bullish";
        momentumInsightText = `Indikator MACD menunjukkan momentum <span class="text-success">bullish</span>. MACD Line (Rp ${latestMacd.toLocaleString('id-ID', { maximumFractionDigits: 2 })}) berada di atas Signal Line (Rp ${latestSignal.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), yang mengindikasikan kekuatan tren naik. `;
    } else {
        momentumBadge = "Momentum Bearish";
        momentumBadgeClass = "badge-bearish";
        momentumInsightText = `Indikator MACD menunjukkan momentum <span class="text-danger">bearish</span>. MACD Line (Rp ${latestMacd.toLocaleString('id-ID', { maximumFractionDigits: 2 })}) berada di bawah Signal Line (Rp ${latestSignal.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), yang mengindikasikan tekanan turun. `;
    }

    // Add Histogram description
    if (latestHist > 0) {
        if (latestHist > prevHist) {
            momentumInsightText += `Histogram MACD bernilai positif dan menguat (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), menunjukkan akselerasi kekuatan beli.`;
        } else {
            momentumInsightText += `Histogram MACD bernilai positif namun mulai melemah (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), mengindikasikan perlambatan momentum beli.`;
        }
    } else {
        if (latestHist < prevHist) {
            momentumInsightText += `Histogram MACD bernilai negatif dan memburuk (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), menunjukkan akselerasi kekuatan jual.`;
        } else {
            momentumInsightText += `Histogram MACD bernilai negatif namun mulai mengecil/membaik (Rp ${latestHist.toLocaleString('id-ID', { maximumFractionDigits: 2 })}), mengindikasikan pelemahan momentum jual (potensi pembalikan arah naik).`;
        }
    }

    const momBadgeEl = document.getElementById('stock-volume-badge');
    if (momBadgeEl) {
        momBadgeEl.textContent = momentumBadge;
        momBadgeEl.className = `badge ${momentumBadgeClass}`;
    }

    // 3. Performance vs IHSG Text
    let relativePerformanceText = "";
    const isOutperformer = parseFloat(stockReturn) > parseFloat(ihsgReturn);

    if (isOutperformer) {
        relativePerformanceText = `Saham <strong>${ticker}</strong> berhasil <span class="text-success">mengungguli</span> indeks IHSG (Outperformer) selama rentang waktu visualisasi ini, dengan total imbal hasil sebesar <strong>${stockReturn}%</strong> dibandingkan IHSG yang sebesar <strong>${ihsgReturn}%</strong>.`;
    } else {
        relativePerformanceText = `Saham <strong>${ticker}</strong> bergerak <span class="text-danger">tertinggal</span> dibandingkan indeks IHSG (Underperformer) selama rentang waktu visualisasi ini, dengan imbal hasil total sebesar <strong>${stockReturn}%</strong> dibandingkan IHSG yang sebesar <strong>${ihsgReturn}%</strong>.`;
    }

    // 4. Determine Confirmation Text
    let confirmationText = "";
    const isPriceBullish = close > ma50;
    const isMacdBullish = latestMacd > latestSignal;

    if (isPriceBullish && isMacdBullish) {
        confirmationText = `Pergerakan harga yang berada di atas MA50 terkonfirmasi oleh MACD Crossover Bullish. Ini menunjukkan tren kenaikan harga jangka menengah didukung oleh momentum beli yang solid, memberikan indikasi kelanjutan tren naik.`;
    } else if (isPriceBullish && !isMacdBullish) {
        confirmationText = `Meskipun harga saham masih berada di atas MA50 (tren naik), indikator MACD menunjukkan crossover bearish. Hal ini mengindikasikan adanya perlambatan momentum atau potensi divergensi negatif, memperingatkan pelaku pasar akan kemungkinan terjadinya koreksi harga jangka pendek.`;
    } else if (!isPriceBullish && !isMacdBullish) {
        confirmationText = `Pergerakan harga yang berada di bawah MA50 terkonfirmasi oleh MACD Crossover Bearish. Ini menunjukkan tren penurunan harga jangka menengah didukung oleh momentum jual yang solid, memberikan indikasi kelanjutan tren turun.`;
    } else {
        confirmationText = `Meskipun harga saham berada di bawah MA50 (tren turun), indikator MACD menunjukkan crossover bullish. Hal ini mengindikasikan adanya pelemahan tekanan jual atau potensi pembalikan arah tren (rebound) jangka pendek.`;
    }

    // Assemble final bullet points
    let htmlContent = `
        <p>Berdasarkan analisis data penutupan historis dan momentum MACD untuk saham <strong>${TICKER_NAMES[ticker]} (${ticker})</strong> dalam rentang waktu yang ditampilkan, berikut rangkuman analisis tren dan momentumnya:</p>
        <ul>
            <li><strong>Tren:</strong> Saham ${ticker} saat ini menunjukkan tren ${trendInsightText} ${shortTermTrend}</li>
            <li><strong>Momentum:</strong> ${momentumInsightText}</li>
            <li><strong>Konfirmasi:</strong> ${confirmationText}</li>
        </ul>
    `;

    document.getElementById('analysis-insights-box').innerHTML = htmlContent;
}
