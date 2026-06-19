import React, { useState, useEffect } from "react";
import ScannerSistem from "./components/ScannerSistem"; 

// Data Produk Awal Bawaan Proyek Anda
const INITIAL_PRODUCTS = [
  { id: 1, name: "Kopi Hitam", price: 5000, stock: 25, minStock: 5, barcode: "8992761131112", icon: "☕", category: "Minuman" },
  { id: 2, name: "Teh Manis", price: 4000, stock: 40, minStock: 5, barcode: "8996001311144", icon: "🍵", category: "Minuman" },
  { id: 3, name: "Roti Cokelat", price: 7000, stock: 15, minStock: 5, barcode: "8992345678901", icon: "🍞", category: "Makanan" }
];

export default function App() {
  // --- STATE UTAMA ---
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("kk_products");
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [cart, setCart] = useState([]);
  const [tab, setTab] = useState("kasir"); 
  const [search, setSearch] = useState("");
  const [user, setUser] = useState({ name: "Administrator", role: "admin" }); 
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Status Login Anda
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // State Keuangan & Riwayat Laporan Toko Anda
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("kk_transactions");
    return saved ? JSON.parse(saved) : [];
  });

  // State Form Admin
  const [newProduct, setNewProduct] = useState({ name: "", price: "", stock: "", minStock: "5", barcode: "", icon: "🛒", category: "Makanan" });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    localStorage.setItem("kk_products", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("kk_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 2500);
  };

  // Suara Beep Aman Browser
  const playBeep = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav");
    audio.play().catch((err) => console.log("Audio ditangguhkan browser sebelum klik user.", err));
  };

  // =========================================================================
  // 🔥 PERBAIKAN INTEGRASI: SCANNER KAMERA HP TANPA MERUSAK FITUR LAIN
  // =========================================================================
  const handleBarcodeScannedFromSystem = (barcodeText) => {
    if (!barcodeText) return;
    const cleanBarcode = barcodeText.trim();
    playBeep();

    if (user.role === "admin") {
      setTab("produk"); // Auto-switch ke tab Produk untuk Admin
      setNewProduct((prev) => ({
        ...prev,
        barcode: cleanBarcode,
        name: prev.name || `Produk Baru - ${cleanBarcode}`
      }));
      showToast(`📝 Barcode [${cleanBarcode}] masuk ke form input admin!`);
    } else {
      setTab("kasir"); // Auto-switch ke tab Kasir untuk Staff
      const foundProduct = products.find((p) => p.barcode && p.barcode.trim() === cleanBarcode);

      if (foundProduct) {
        addToCart(foundProduct);
        showToast(`🛒 ${foundProduct.name} masuk keranjang!`);
      } else {
        setSearch(cleanBarcode);
        showToast(`⚠️ Barcode [${cleanBarcode}] tidak ditemukan. Dicari di input pencarian!`, "error");
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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const newTx = {
      id: `TX-${Date.now()}`,
      date: new Date().toLocaleDateString("id-ID"),
      items: cart,
      total: total
    };

    // Kurangi stok produk asli
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(c => c.id === p.id);
      return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;
    }));

    setTransactions([newTx, ...transactions]);
    setCart([]);
    showToast("🛍️ Transaksi Sukses & Nota Dicetak!");
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.barcode) {
      return showToast("❌ Mohon lengkapi semua data!", "error");
    }

    if (editId) {
      setProducts(prev => prev.map(p => p.id === editId ? {
        ...p,
        name: newProduct.name,
        price: parseInt(newProduct.price),
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock || 0),
        barcode: newProduct.barcode.trim(),
        category: newProduct.category
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
        icon: "🛒",
        category: newProduct.category
      };
      setProducts([...products, added]);
      showToast("💾 Produk baru berhasil terdaftar!");
    }
    setNewProduct({ name: "", price: "", stock: "", minStock: "5", barcode: "", icon: "🛒", category: "Makanan" });
  };

  // Perhitungan total pendapatan untuk Menu Keuangan Anda
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);

  if (!isLoggedIn) {
    return (
      <div style={{ padding: "40px", maxWidth: "360px", margin: "100px auto", border: "1px solid #e2e8f0", borderRadius: "10px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>🔐 Login Rasa Nusantara</h2>
        <button onClick={() => setIsLoggedIn(true)} style={{ width: "100%", padding: "10px", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Masuk Sebagai Admin</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif", maxWidth: "1000px", margin: "0 auto", color: "#2d3748" }}>
      
      {/* Toast Alert */}
      {toast.show && (
        <div style={{ position: "fixed", top: 20, right: 20, padding: "12px 24px", borderRadius: "8px", zIndex: 9999, fontWeight: "bold", backgroundColor: toast.type === "success" ? "#c6f6d5" : "#fed7d7", color: toast.type === "success" ? "#22543d" : "#742a2a" }}>
          {toast.message}
        </div>
      )}

      {/* HEADER UTAMA DENGAN BRAND ANDA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#1a365d" }}>🏪 Rasa Nusantara.co</h2>
          <span style={{ fontSize: "12px", color: "#718096" }}>From Nusantara For You</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px" }}>👤 <b>{user.name} ({user.role.toUpperCase()})</b></span>
          <button onClick={() => setIsLoggedIn(false)} style={{ background: "#e53e3e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer" }}>Keluar ↩</button>
        </div>
      </div>

      {/* NAVIGASI MENU LENGKAP ANDA */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setTab("kasir")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "kasir" ? "#2b6cb0" : "#e2e8f0", color: tab === "kasir" ? "#fff" : "#4a5568", fontWeight: "bold" }}>🛒 Kasir</button>
        <button onClick={() => setTab("produk")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "produk" ? "#2b6cb0" : "#e2e8f0", color: tab === "produk" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📦 Produk</button>
        <button onClick={() => setTab("stok")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "stok" ? "#2b6cb0" : "#e2e8f0", color: tab === "stok" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📊 Stok <span style={{ background: "red", color: "white", padding: "1px 5px", borderRadius: "50%", fontSize: "10px" }}>{products.filter(p => p.stock <= p.minStock).length}</span></button>
        <button onClick={() => setTab("keuangan")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "keuangan" ? "#2b6cb0" : "#e2e8f0", color: tab === "keuangan" ? "#fff" : "#4a5568", fontWeight: "bold" }}>💰 Keuangan</button>
        <button onClick={() => setTab("riwayat")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "riwayat" ? "#2b6cb0" : "#e2e8f0", color: tab === "riwayat" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📋 Riwayat</button>
        <button onClick={() => setTab("laporan")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "laporan" ? "#2b6cb0" : "#e2e8f0", color: tab === "laporan" ? "#fff" : "#4a5568", fontWeight: "bold" }}>📈 Laporan</button>
        <button onClick={() => setTab("setting")} style={{ padding: "8px 14px", borderRadius: "6px", border: "none", cursor: "pointer", background: tab === "setting" ? "#2b6cb0" : "#e2e8f0", color: tab === "setting" ? "#fff" : "#4a5568", fontWeight: "bold" }}>⚙️ Setting</button>
      </div>

      {/* AREA TRIGGER SCANNER KAMERA HP */}
      <details style={{ background: "#ebf8ff", padding: "12px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #bee3f8" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2b6cb0" }} onClick={() => playBeep()}>
          📷 Buka / Tutup Kamera Barcode Scanner Sistem (Klik Di Sini Untuk Suara)
        </summary>
        <div style={{ marginTop: "10px", maxWidth: "420px", margin: "10px auto" }}>
          <ScannerSistem onScanSuccess={handleBarcodeScannedFromSystem} />
        </div>
      </details>

      {/* --- KONTEN SETIAP TAB --- */}

      {/* 1. KASIR */}
      {tab === "kasir" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px" }}>
          <div>
            <input type="text" placeholder="Cari Produk atau Scan Barcode..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e0", marginBottom: "15px", boxSizing: "border-box" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>
                  <span style={{ fontSize: "20px" }}>{p.icon || "🛒"}</span>
                  <h4 style={{ margin: "4px 0 2px 0" }}>{p.name}</h4>
                  <small style={{ color: "#a0aec0" }}>{p.barcode}</small>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", alignItems: "center" }}>
                    <b style={{ color: "#2b6cb0" }}>Rp {p.price.toLocaleString("id-ID")}</b>
                    <span style={{ fontSize: "11px", color: p.stock <= p.minStock ? "red" : "#718096" }}>Stok: {p.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Sisi Keranjang Belanja */}
          <div style={{ background: "#fff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", height: "fit-content" }}>
            <h3 style={{ margin: "0 0 12px 0" }}>🛒 Keranjang Belanja</h3>
            {cart.length === 0 ? <p style={{ color: "#a0aec0", fontSize: "13px" }}>Belum ada produk.</p> : (
              <div>
                {cart.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                    <span>{item.name} (x{item.qty})</span>
                    <b>Rp {(item.price * item.qty).toLocaleString("id-ID")}</b>
                  </div>
                ))}
                <hr style={{ border: "none", borderTop: "2px solid #edf2f7", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span>Total Bayar:</span>
                  <b style={{ color: "#2b6cb0", fontSize: "16px" }}>Rp {cart.reduce((s, i) => s + (i.price * i.qty), 0).toLocaleString("id-ID")}</b>
                </div>
                <button onClick={handleCheckout} style={{ width: "100%", padding: "10px", background: "#276749", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Bayar & Cetak Nota</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PRODUK MASTER */}
      {tab === "produk" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
          <form onSubmit={handleSaveProduct} style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f7fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", height: "fit-content" }}>
            <h4>{editId ? "✏️ Edit Produk" : "➕ Tambah Produk Baru"}</h4>
            <input type="text" placeholder="Barcode Barang" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} style={{ padding: "6px" }} />
            <input type="text" placeholder="Nama Produk" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} style={{ padding: "6px" }} />
            <input type="number" placeholder="Harga" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: "6px" }} />
            <input type="number" placeholder="Stok" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} style={{ padding: "6px" }} />
            <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ padding: "6px" }}>
              <option value="Makanan">Makanan</option>
              <option value="Minuman">Minuman</option>
              <option value="Bumbu & Rempah">Bumbu & Rempah</option>
            </select>
            <button type="submit" style={{ background: "#276749", color: "#fff", padding: "8px", fontWeight: "bold", border: "none", borderRadius: "4px", cursor: "pointer" }}>Simpan Produk</button>
          </form>
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse", borderColor: "#e2e8f0" }}>
            <thead>
              <tr style={{ background: "#edf2f7" }}>
                <th>Barcode</th>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><code>{p.barcode}</code></td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>Rp {p.price.toLocaleString("id-ID")}</td>
                  <td>{p.stock}</td>
                  <td><button onClick={() => { setEditId(p.id); setNewProduct(p); }} style={{ padding: "4px 8px", background: "#3182ce", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. STOK MONITORING (SAFE READ-ONLY) */}
      {tab === "stok" && (
        <div style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3>📊 Stok Opname & Status Gudang</h3>
          <p style={{ fontSize: "13px", color: "#718096", marginBottom: "15px" }}>Fitur stok diamankan otomatis (Read-Only) untuk mencegah manipulasi data kasir di toko.</p>
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse", borderColor: "#e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f7fafc" }}>
                <th>Barcode</th>
                <th>Nama Barang</th>
                <th>Sisa Stok</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.barcode}</td>
                  <td>{p.name}</td>
                  <td style={{ fontWeight: "bold" }}>{p.stock}</td>
                  <td>
                    <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", backgroundColor: p.stock === 0 ? "#fed7d7" : p.stock <= p.minStock ? "#fffff0" : "#c6f6d5", color: p.stock === 0 ? "#742a2a" : p.stock <= p.minStock ? "#7b341e" : "#22543d" }}>
                      {p.stock === 0 ? "Habis ❌" : p.stock <= p.minStock ? "Menipis ⚠️" : "Aman ✅"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. KEUANGAN (FITUR ASLI ANDA) */}
      {tab === "keuangan" && (
        <div style={{ background: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <h3>💰 Panel Analisis Keuangan Toko</h3>
          <div style={{ background: "#ebf8ff", padding: "15px", borderRadius: "8px", marginTop: "10px" }}>
            <span>Total Pendapatan Bersih:</span>
            <h2 style={{ color: "#2b6cb0", margin: "5px 0 0 0" }}>Rp {totalRevenue.toLocaleString("id-ID")}</h2>
          </div>
        </div>
      )}

      {/* 5. RIWAYAT */}
      {tab === "riwayat" && (
        <div>
          <h3>📋 Riwayat Transaksi Penjualan</h3>
          {transactions.length === 0 ? <p style={{ color: "#a0aec0" }}>Belum ada riwayat penjualan.</p> : (
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {transactions.map(tx => (
                <li key={tx.id} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "6px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px" }}>
                    <span>{tx.id} ({tx.date})</span>
                    <span style={{ color: "#2b6cb0" }}>Rp {tx.total.toLocaleString("id-ID")}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#718096", marginTop: "4px" }}>
                    {tx.items.map(i => `${i.name} x${i.qty}`).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 6. LAPORAN */}
      {tab === "laporan" && (
        <div style={{ padding: "15px", background: "#f7fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3>📈 Laporan Statistik Toko</h3>
          <p>Total Transaksi: <b>{transactions.length} Kali Penjualan</b></p>
          <p>Jumlah Jenis Barang Aktif: <b>{products.length} Macam SKU</b></p>
        </div>
      )}

      {/* 7. SETTING */}
      {tab === "setting" && (
        <div style={{ padding: "15px", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3>⚙️ Pengaturan Sistem Kasir</h3>
          <p style={{ fontSize: "14px" }}>Versi Aplikasi: <b>v1.2.0-Production</b></p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: "#e53e3e", color: "white", padding: "8px 12px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Reset Semua Data Aplikasi</button>
        </div>
      )}

    </div>
  );
}