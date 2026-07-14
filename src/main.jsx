// SEBELUM DIUBAH (Contoh struktur umum main.jsx)
import React from 'react'
import ReactDOM from 'react-dom/client'
import KasirApp from './App.jsx' // <--- Mengarah langsung ke App asli

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KasirApp /> 
  </React.StrictMode>,
)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.error("Gagal daftar service worker:", err);
    });
  });
}
