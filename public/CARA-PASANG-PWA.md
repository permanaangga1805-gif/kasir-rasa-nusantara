# Cara Pasang PWA (Offline) di Proyek Kasir Anda

File-file ini supaya aplikasi Anda bisa **di-install ke layar HP** dan **dibuka tanpa internet** seperti aplikasi pada umumnya.

## 1. Taruh semua file ini di folder `public/` proyek Anda
(Folder `public/` ada baik di proyek Vite maupun Create React App — sejajar dengan `index.html`)

```
public/
 ├─ manifest.json
 ├─ service-worker.js
 ├─ icon-192.png
 ├─ icon-512.png
 ├─ icon-192-maskable.png
 └─ icon-512-maskable.png
```

## 2. Tambahkan ini di dalam tag `<head>` pada `index.html`

```html
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#1a365d" />
<link rel="apple-touch-icon" href="icon-192.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

## 3. Daftarkan service worker

Buka file entry utama React Anda — biasanya **`src/main.jsx`** (kalau pakai Vite) atau **`src/index.js`** (kalau pakai Create React App) — lalu tambahkan kode ini **di baris paling bawah**:

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.error("Gagal daftar service worker:", err);
    });
  });
}
```

## 4. Build & deploy seperti biasa

```
npm run build
```
lalu deploy hasil build ke GitHub Pages seperti biasa.

## 5. Cara pakai offline

1. Buka aplikasi seperti biasa **selagi ada internet** (sekali saja, supaya semua file ke-cache).
2. Di Chrome HP, tap menu (⋮) → **"Add to Home screen" / "Install app"**. Ikon "Rp" akan muncul di layar HP, dan aplikasi terbuka tanpa address bar — persis seperti aplikasi asli.
3. Setelah itu, aplikasi bisa dibuka **walau HP dalam mode pesawat / tanpa sinyal sama sekali.**
4. Setiap kali Anda online lagi, aplikasi otomatis memperbarui cache di belakang layar — jadi kalau Anda update kode lagi nanti, tinggal deploy ulang, dan versi terbaru otomatis ter-cache saat pengguna online berikutnya.

## ⚠️ Catatan penting

- **Wajib diakses lewat HTTPS** (GitHub Pages sudah otomatis HTTPS, jadi aman) — service worker tidak akan jalan di HTTP biasa.
- Fitur **"Kamera HP"** untuk scan barcode tetap butuh kamera fisik aktif saat itu juga — itu bukan soal internet, jadi tetap berfungsi normal baik online maupun offline.
- Kalau nanti Anda update kode aplikasi dan re-deploy, naikkan angka di baris `CACHE_NAME = "kasirku-cache-v1"` di `service-worker.js` (misal jadi `v2`) — supaya pengguna lama otomatis ambil versi terbaru, bukan versi cache lawas.
