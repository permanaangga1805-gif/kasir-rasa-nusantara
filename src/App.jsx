import React, { useState, useEffect } from "react";
import ScannerSistem from "./components/ScannerSistem"; 

// Data produk awal bawaan sistem
const INITIAL_PRODUCTS = [
  { id: 1, name: "Kopi Hitam", price: 5000, stock: 25, minStock: 5, barcode: "8992761131112", icon: "☕" },
  { id: 2, name: "Teh Manis", price: 4000, stock: 3, minStock: 5, barcode: "8996001311144", icon: "🍵" },
  { id: 3, name: "Roti Cokelat", price: 7000, stock: 0, minStock: 5, barcode: "8992345678901", icon: "🍞" }
];

export default function KasirApp() {
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("kk_products");
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  
  const [cart, setCart] = useState([]);
  const [tab, setTab] = useState("kasir"); 
  const [search, setSearch] = useState("");
  const [user, setUser] = useState({ name: "Kasir Rasa Nusantara", role: "kasir" }); 
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // State Form Input Produk Baru / Edit (Hanya Admin)
  const [newProduct, setNewProduct] = useState({ name: "", price: "", stock: "", minStock: "5", barcode: "", icon: "🛒" });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    localStorage.setItem("kk_products", JSON.stringify(products));
  }, [products]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 2500);
  };

  // Suara Beep Kamera HP
  const playBeep = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav");
    audio.play().catch((err) => console.log("Audio ditangguhkan browser sebelum ada klik user.", err));
  };

  // ✅ SCANNER KAMERA HP: Akurat, Auto-Tab, & Bypass Audio Block
  const handleBarcodeScannedFromSystem = (barcodeText) => {
    if (!barcodeText) return;
    const cleanBarcode = barcodeText.trim();
    playBeep();

    if (user.role === "admin") {
      setTab("produk");
      setNewProduct((prev) => ({
        ...prev,
        barcode: cleanBarcode,
        name: prev.name || `Produk Baru - ${cleanBarcode}`,
        price: prev.price || "15000",
        stock: prev.stock || "10"
      }));
      showToast(`📝 Barcode [${cleanBarcode}] masuk ke form input admin!`);
    } else {
      setTab("kasir");
      const foundProduct = products.find((p) => p.barcode && p.barcode.trim() === cleanBarcode);

      if (foundProduct) {
        addToCart(foundProduct);
        showToast(`🛒 ${foundProduct.name} masuk keranjang!`);
      } else {
        setSearch(cleanBarcode);
        showToast(`⚠️ Barcode [${cleanBarcode}] belum terdaftar!`, "error");
      }
    }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return showToast("❌ Stok produk ini habis!", "error");
    setCart((prev) => {
      const ex = prev.find((item) => item.id === product.id);
      if (ex) {
        if (ex.qty >= product.stock) { showToast("❌ Batas stok tercapai!", "error"); return prev; }
        return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  // Simpan / Edit Produk (Admin Only)
  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.barcode) {
      return showToast("❌ Mohon lengkapi data produk!", "error");
    }

    if (editId) {
      setProducts(prev => prev.map(p => p.id === editId ? {
        ...p,
        name: newProduct.name,
        price: parseInt(newProduct.price),
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock || 0),
        barcode: newProduct.barcode.trim(),
        icon: newProduct.icon
      } : p));
      setEditId(null);
      showToast("💾 Perubahan produk berhasil disimpan!");
    } else {
      const added = {
        id: Date.now(),
        name: newProduct.name,
        price: parseInt(newProduct.price),
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock || 5),
        barcode: newProduct.barcode.trim(),
        icon: newProduct.icon
      };
      setProducts([...products, added]);
      showToast("💾 Produk baru berhasil didaftarkan!");
    }
    setNewProduct({ name: "", price: "", stock: "", minStock: "5", barcode: "", icon: "🛒" });
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setNewProduct({ name: p.name, price: p.price, stock: p.stock, minStock: p.minStock || 5, barcode: p.barcode, icon: p.icon || "🛒" });
  };

  // Fungsi Indikator Status Stok Gudang (Aman/Menipis/Habis)
  const getStockStatus = (p) => {
    const s = p.stock || 0;
    const m = p.minStock || 0;
    if (s === 0) return { label: "Habis ❌", color: "#742a2a", bg: "#fed7d7" };
    if (s <= m) return { label: "Menipis ⚠️", color: "#7b341e", bg: "#fffff0" };
    return { label: "Aman ✅", color: "#22543d", bg: "#c6f6d5" };
  };

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif", maxWidth: "900px", margin: "0 auto", color: "#2d3748" }}>
      
      {/* Toast Alert */}
      {toast.show && (
        <div style={{ position: "fixed", top: 20, right: 20, padding: "12px 24px", borderRadius: "8px", zIndex: 9999, fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", backgroundColor: toast.type === "success" ? "#c6f6d5" : "#fed7d7", color: toast.type === "success" ? "#22543d" : "#742a2a" }}>
          {toast.message}
        </div>
      )}

      {/* Header Aplikasi */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#1a365d" }}>🏪 Rasa Nusantara POS</h2>
          <span style={{ fontSize: "12px", color: "#718096" }}>Sistem Kasir Pintar Berbasis Barcode Kamera</span>
        </div>
        <div style={{ background: "#edf2f7", padding: "8px 12px", borderRadius: "8px", fontSize: "14px" }}>
          <span>Hak Akses: <b>{user.role.toUpperCase()}</b></span>
          <button onClick={() => { setUser({ name: user.role === "kasir" ? "Administrator" : "Kasir Utama", role: user.role === "kasir" ? "admin" : "kasir" }); setCart([]); }} style={{ marginLeft: "10px", padding: "3px 8px", cursor: "pointer" }}>
            Switch ke {user.role === "kasir" ? "Admin" : "Kasir"}
          </button>
        </div>
      </div>

      {/* Menu Navigasi Tab */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button onClick={() => setTab("kasir")} style={{ padding: "10px 16px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "kasir" ? "#2b6cb0" : "#e2e8f0", color: tab === "kasir" ? "#fff" : "#4a5568", fontWeight: "bold" }}>🛒 Menu Kasir</button>
        <button onClick={() => setTab("produk")} style={{ padding: "10px 16px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "produk" ? "#2b6cb0" : "#e2e8f0", color: tab === "produk" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📦 Data Produk {user.role !== "admin" && "🔒"}</button>
        <button onClick={() => setTab("stok")} style={{ padding: "10px 16px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "stok" ? "#2b6cb0" : "#e2e8f0", color: tab === "stok" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📊 Pantau Stok Gudang</button>
      </div>

      {/* 📷 MODULE SCANNER KAMERA HP */}
      <details style={{ background: "#ebf8ff", padding: "14px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #bee3f8" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2b6cb0" }} onClick={() => playBeep()}>
          📷 Aktifkan Kamera Barcode Scanner (Klik di sini untuk mengaktifkan Suara Beep)
        </summary>
        <div style={{ marginTop: "12px", maxWidth: "400px", margin: "12px auto" }}>
          <ScannerSistem onScanSuccess={handleBarcodeScannedFromSystem} />
        </div>
      </details>

      {/* AREA UTAMA PANEL KONTEN */}

      {/* 1. KASIR PANEL */}
      {tab === "kasir" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px" }}>
          <div>
            <input type="text" placeholder="Masukkan Nama Produk / Scan Barcode..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e0", marginBottom: "15px", boxSizing: "border-box" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px", background: "#fff", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <span style={{ fontSize: "24px" }}>{p.icon || "🛒"}</span>
                  <h4 style={{ margin: "6px 0 2px 0" }}>{p.name}</h4>
                  <small style={{ color: "#a0aec0", display: "block" }}>{p.barcode}</small>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <b style={{ color: "#2b6cb0" }}>Rp {p.price.toLocaleString("id-ID")}</b>
                    <span style={{ fontSize: "11px", color: p.stock <= p.minStock ? "red" : "#718096" }}>Stok: {p.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Ringkasan Keranjang */}
          <div style={{ background: "#fff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", height: "fit-content" }}>
            <h3 style={{ margin: "0 0 12px 0" }}>🛒 Keranjang</h3>
            {cart.length === 0 ? <p style={{ color: "#a0aec0", fontSize: "13px" }}>Belum ada item.</p> : (
              <div>
                {cart.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px", borderBottom: "1px dashed #edf2f7", paddingBottom: "6px" }}>
                    <span>{item.name} (x{item.qty})</span>
                    <b>Rp {(item.price * item.qty).toLocaleString("id-ID")}</b>
                  </div>
                ))}
                <hr style={{ border: "none", borderTop: "2px solid #edf2f7", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span>Total:</span>
                  <b style={{ color: "#2b6cb0", fontSize: "16px" }}>Rp {cart.reduce((s, i) => s + (i.price * i.qty), 0).toLocaleString("id-ID")}</b>
                </div>
                <button onClick={() => { setCart([]); showToast("Transaksi Berhasil Diproses!"); }} style={{ width: "100%", padding: "10px", background: "#276749", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Bayar & Cetak Nota</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ADMIN PANEL (MANAGE PRODUK & UBAH STOK RESMI) */}
      {tab === "produk" && (
        <div>
          <h3>📦 Pengelolaan Data Master & Jumlah Stok</h3>
          {user.role !== "admin" ? (
            <div style={{ background: "#fff5f5", color: "#c53030", padding: "15px", borderRadius: "8px", border: "1px solid #fed7d7" }}>
              🛑 <b>Akses Ditolak:</b> Halaman ini dikunci. Silakan pindah ke akun <b>Admin</b> di pojok kanan atas jika ingin menambah produk atau memperbarui jumlah stok barang toko.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px" }}>
              <form onSubmit={handleSaveProduct} style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f7fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", height: "fit-content" }}>
                <h4>{editId ? "✏️ Edit Produk" : "➕ Tambah Produk"}</h4>
                <input type="text" placeholder="Barcode Barang" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} style={{ padding: "6px" }} />
                <input type="text" placeholder="Nama Produk" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} style={{ padding: "6px" }} />
                <input type="number" placeholder="Harga Jual (Rp)" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: "6px" }} />
                <input type="number" placeholder="Jumlah Stok Gudang" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} style={{ padding: "6px" }} />
                <input type="number" placeholder="Batas Stok Menipis" value={newProduct.minStock} onChange={e => setNewProduct({...newProduct, minStock: e.target.value})} style={{ padding: "6px" }} />
                <button type="submit" style={{ background: "#276749", color: "#fff", padding: "8px", fontWeight: "bold", border: "none", borderRadius: "4px", cursor: "pointer" }}>💾 Simpan Produk</button>
                {editId && <button type="button" onClick={() => { setEditId(null); setNewProduct({ name: "", price: "", stock: "", minStock: "5", barcode: "", icon: "🛒" }); }} style={{ background: "#718096", color: "#fff", padding: "6px", border: "none", borderRadius: "4px" }}>Batal</button>}
              </form>

              <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderColor: "#e2e8f0" }}>
                <thead>
                  <tr style={{ background: "#edf2f7" }}>
                    <th>Barcode</th>
                    <th>Nama</th>
                    <th>Harga</th>
                    <th>Stok Aktif</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><code>{p.barcode}</code></td>
                      <td>{p.icon} {p.name}</td>
                      <td>Rp {p.price.toLocaleString("id-ID")}</td>
                      <td style={{ fontWeight: "bold" }}>{p.stock} <small style={{ color: "#718096" }}>(min: {p.minStock})</small></td>
                      <td>
                        <button onClick={() => startEdit(p)} style={{ padding: "4px 8px", background: "#3182ce", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Ubah Data / Stok</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. MONITORING STOK PANEL (SAFE READ-ONLY FOR SECURITY) */}
      {tab === "stok" && (
        <div style={{ background: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ borderLeft: "4px solid #2b6cb0", paddingLeft: "10px", marginBottom: "15px" }}>
            <h3 style={{ margin: 0 }}>📊 Laporan Pemantauan Ketersediaan Barang</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#718096" }}>
              Halaman ini bersifat <b>Aman (Read-Only)</b> untuk mencegah manipulasi data. Perubahan jumlah stok hanya diizinkan melalui menu Admin.
            </p>
          </div>

          <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse", borderColor: "#e2e8f0", marginTop: "15px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f7fafc", textAlign: "left" }}>
                <th>Kode Barcode</th>
                <th>Nama Barang Toko</th>
                <th style={{ textAlign: "center" }}>Sisa Stok Fisik</th>
                <th style={{ textAlign: "center" }}>Status Keamanan</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const status = getStockStatus(p);
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                    <td><code style={{ fontSize: "13px", fontWeight: "bold" }}>{p.barcode}</code></td>
                    <td>{p.icon} {p.name}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "15px" }}>{p.stock}</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", backgroundColor: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}