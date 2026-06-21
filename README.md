# Dashboard Analisis Performa Saham Indonesia terhadap IHSG (Magnificent 7)

> Dashboard interaktif untuk menganalisis dan memvisualisasikan performa kumulatif, tren harga, dan momentum 9 saham blue-chip Indonesia terhadap IHSG dengan data historis nyata yang bersumber dari Yahoo Finance.

🌐 Demo: https://indonesia-market-dashboard.vercel.app

## Isi Dashboard

- **Chart 1: Performa Relatif Saham terhadap IHSG** — Menampilkan grafik multiline persentase keuntungan akumulatif seluruh 9 saham dan IHSG (benchmark) yang telah direbase ke 100% untuk perbandingan kinerja yang adil sejak awal periode.
- **Chart 2: Analisis Tren Harga Saham** — Grafik Candlestick harga harian saham terpilih yang dilengkapi dengan garis rata-rata pergerakan MA20 (tren jangka pendek) dan MA50 (tren jangka menengah) untuk membaca tren pasar.
- **Chart 3: Analisis Momentum MACD** — Grafik Moving Average Convergence Divergence (MACD Line, Signal Line, dan MACD Histogram) untuk mendeteksi kekuatan dorongan arah pergerakan harga.
- **Chart 4 (Tambahan): Arah Tren Pasar (IHSG)** — Grafik garis pergerakan indeks IHSG terhadap garis MA50 untuk menentukan status pasar terkini (Bullish/Bearish).
- **Fitur interaktif**:
  - *Tooltip hover interaktif*: Menampilkan data harga penutupan eksak dan indikator secara detail saat disorot.
  - *Ruler Tool*: Pengukur rentang tanggal, persentase selisih harga, jumlah bar, dan volume perdagangan secara dinamis pada grafik tren.
  - *Dropdown Filter Saham*: Memilih dan memuat visualisasi saham tertentu secara instan.
  - *Timeframe Switcher*: Tombol interaktif untuk merubah periode pengelompokan data (Daily, Weekly, Monthly, Yearly).
  - *Sinkronisasi Zoom & Pan*: Geser (drag-pan) dan perbesar (scroll-zoom) sumbu X yang tersinkronisasi otomatis antara grafik tren dan volume/MACD.
- **Animasi**:
  - *Entrance Chart.js*: Visualisasi grafik muncul perlahan dengan transisi ease-out saat halaman selesai dimuat.
  - *Count-up number*: Angka counter pada 4 kartu KPI utama (Nilai IHSG, Status Pasar, Outperformer, Underperformer) terhitung naik secara dinamis dari 0 ke nilai target saat halaman dibuka.
  - *CSS fade-in*: Elemen kartu dashboard dan peta heatmap masuk dengan animasi transisi @keyframes yang halus.

## Sumber Data

- Nama dataset: **Yahoo Finance Historical Stock Market Prices**
- URL sumber: [https://finance.yahoo.com/](https://finance.yahoo.com/)

## Cara Jalankan di Lokal

### Jalur A (static):
Buka `index.html` langsung di browser
(atau pakai Live Server di VS Code)

### Jalur B (server):
```bash
npm install
npm start
```
Buka http://localhost:3000

---

*(Alternatif dengan Server Python jika tidak ingin menginstal npm dependencies)*:
```bash
python -m http.server 8000
```
Buka http://localhost:8000

## Teknologi

- **Chart.js** (visualisasi grafik utama & candlestick)
- **HTML + CSS + JavaScript** (struktur, desain responsif, dan logika modular)
- **Vercel** (deployment platform)
- **Hammer.js & chartjs-plugin-zoom** (interaksi zoom/pan)
- **Luxon & chartjs-adapter-luxon** (adapter tanggal)
- **yfinance & pandas** (python backend data scraper)

## Anggota

- Mentheng Paskahbuana T (103012300128)
- Nama Anggota 2 (NIM)
- Nama Anggota 3 (NIM)
- Nama Anggota 4 (NIM)
- Nama Anggota 5 (NIM)
