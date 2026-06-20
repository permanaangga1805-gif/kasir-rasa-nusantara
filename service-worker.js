// ── SERVICE WORKER KASIR APP ─────────────────────────────────────────────────
// Membuat aplikasi bisa dibuka & dipakai sepenuhnya OFFLINE setelah pertama
// kali diakses (dan internet tersedia minimal sekali untuk memuat halaman).
//
// Strategi: "cache falling back to network, lalu update cache di background".
// - Saat online: ambil dari internet seperti biasa, sambil diam-diam menyimpan
//   salinannya ke cache supaya siap dipakai saat offline nanti.
// - Saat offline: langsung disajikan dari cache (termasuk file JS/CSS/gambar
//   hasil build, yang nama filenya otomatis berbeda-beda tiap kali di-build).

const CACHE_NAME = "kasirku-cache-v1"; // naikkan angka versi ini tiap kali ingin memaksa pengguna ambil ulang cache baru
const APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // kalau salah satu file shell gagal di-cache (mis. path beda), jangan gagalkan install
      })
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // hanya tangani GET dari origin sendiri (file aplikasi); biarkan request lain (mis. ke domain lain) berjalan normal
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // offline & tidak ada di cache -> untuk halaman, jatuhkan ke index.html (app shell)
          if (request.mode === "navigate") return caches.match("./index.html");
          return cached;
        });

      // kalau sudah ada di cache, tampilkan langsung (cepat & jalan walau offline),
      // sambil tetap fetch ke jaringan di background untuk memperbarui cache
      return cached || networkFetch;
    })
  );
});
