import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// ── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const now = () => new Date().toLocaleString("id-ID");

const USERS = [
  { id: 1, username: "admin", password: "admin123", role: "admin", name: "Administrator" },
  { id: 2, username: "kasir", password: "kasir123", role: "kasir", name: "Kasir 1" },
];

const INITIAL_PRODUCTS = [
  { id: 1, name: "Nasi Goreng Spesial", price: 25000, category: "Bumbu & Rempah", icon: "🍳", stock: 50, minStock: 10 },
  { id: 2, name: "Mie Ayam Bakso",      price: 20000, category: "Bumbu & Rempah", icon: "🍜", stock: 8,  minStock: 10 },
  { id: 3, name: "Soto Ayam",           price: 18000, category: "Bumbu & Rempah", icon: "🥣", stock: 30, minStock: 10 },
  { id: 4, name: "Ayam Bakar",          price: 30000, category: "Bumbu & Rempah", icon: "🍗", stock: 5,  minStock: 10 },
  { id: 5, name: "Gado-Gado",           price: 15000, category: "Bumbu & Rempah", icon: "🥗", stock: 25, minStock: 10 },
  { id: 6, name: "Es Teh Manis",        price: 5000,  category: "Cair",           icon: "🍵", stock: 100,minStock: 10 },
  { id: 7, name: "Jus Alpukat",         price: 15000, category: "Cair",           icon: "🥑", stock: 12, minStock: 10 },
  { id: 8, name: "Es Jeruk",            price: 8000,  category: "Cair",           icon: "🍊", stock: 3,  minStock: 10 },
  { id: 9, name: "Air Mineral",         price: 5000,  category: "Cair",           icon: "💧", stock: 60, minStock: 10 },
  { id: 10,name: "Kopi Hitam",          price: 8000,  category: "Cair",           icon: "☕", stock: 40, minStock: 10 },
  { id: 11,name: "Kerupuk",             price: 3000,  category: "Kering",         icon: "🥨", stock: 7,  minStock: 10 },
  { id: 12,name: "Pisang Goreng",       price: 10000, category: "Kering",         icon: "🍌", stock: 20, minStock: 10 },
  { id: 13,name: "Garam",               price: 5000,  category: "Kering",         icon: "🧂", stock: 10, minStock: 10 },
];

const INITIAL_SETTINGS = {
  storeName: "Rasa nusantara.co",
  storeAddress: "Jl.Raya Ace Tabrani No.32,Kp.Siranggap Nanggung rt.003 rw.004,Desa Nanggung,Kec.Nanggung, Kab. Bogor 16650,Bogor",
  storePhone: "085892358884",
  taxRate: 0,
  footerNote: "Terima kasih atas kunjungan Anda!",
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  inp: { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  btn: { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  smBtn: { padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12 },
  qBtn: { background: "#edf2f7", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
};

// ── RECEIPT MODAL ────────────────────────────────────────────────────────────
// ── RECEIPT MODAL DENGAN FITUR KIRIM WHATSAPP ──
function ReceiptModal({ order, settings, onClose }) {
  const ref = useRef();
  const [customerPhone, setCustomerPhone] = useState("");

  const handlePrint = () => {
    const content = ref.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(`
      <html><head><title>Struk #${order.customId || String(order.id).slice(-6)}</title>
      <style>
        body { font-family: monospace; font-size: 13px; max-width: 300px; margin: 0 auto; padding: 16px; }
        .center { text-align: center; } .bold { font-weight: bold; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .dashed { border-top: 1px dashed #999; margin: 10px 0; padding-top: 10px; }
        .big { font-size: 16px; font-weight: bold; }
      </style></head><body>${content}<script>window.print();window.close();<\/script></body></html>
    `);
    win.document.close();
  };

  // ── LOGIK FORMAT TEKS UNTUK WHATSAPP ──
  const handleSendWhatsApp = () => {
    if (!customerPhone) {
      alert("Silakan masukkan nomor WhatsApp pelanggan terlebih dahulu!");
      return;
    }

    // Format nomor HP agar diawali dengan 62 (standar Indonesia)
    let formattedPhone = customerPhone.replace(/[^0-9]/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "62" + formattedPhone.slice(1);
    }

    // Susun teks struk belanja memakai format teks WhatsApp (*bold*, _italic_, enter)
    let text = `*✨ STRUK BELANJA - ${settings.storeName} ✨*\n`;
    text += `_${settings.storeAddress}_\n`;
    text += `📞 No. Telp: ${settings.storePhone}\n`;
    text += `-------------------------------------------\n`;
    text += `📅 Tanggal : ${order.date}\n`;
    text += `🧾 No. Struk: #${order.customId || String(order.id).slice(-6)}\n`;
    if (order.cashierName) text += `💼 Kasir    : ${order.cashierName}\n`;
    text += `-------------------------------------------\n\n`;

    // Daftar Item Produk
    order.items.forEach(i => {
      text += `🛍️ *${i.name}*\n`;
      text += `    ${i.qty} x Rp ${Math.round(i.price).toLocaleString("id-ID")}  =  *Rp ${Math.round(i.price * i.qty).toLocaleString("id-ID")}*\n`;
    });

    text += `\n-------------------------------------------\n`;
    text += `💵 *Subtotal:* Rp ${Math.round(order.subtotal).toLocaleString("id-ID")}\n`;
    if (order.discount > 0) text += `❌ *Diskon (${order.discount}%):* -Rp ${Math.round(order.discAmt).toLocaleString("id-ID")}\n`;
    if (settings.taxRate > 0) text += `➕ *Pajak (${settings.taxRate}%):* +Rp ${Math.round(order.taxAmt || 0).toLocaleString("id-ID")}\n`;
    text += `💰 *TOTAL AKHIR: Rp ${Math.round(order.total).toLocaleString("id-ID")}*\n`;
    text += `-------------------------------------------\n`;
    text += `Bayar : Rp ${Math.round(order.pay).toLocaleString("id-ID")}\n`;
    text += `Kembalian : Rp ${Math.round(order.change).toLocaleString("id-ID")}\n\n`;
    text += `🙏 _${settings.footerNote}_\n`;

    // Buat URL wa.me dan buka tab baru
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 380, maxHeight: "95vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        
        {/* Tampilan Struk Fisik (untuk Print) */}
        <div ref={ref}>
          <div className="center" style={{ textAlign: "center", borderBottom: "2px dashed #e2e8f0", paddingBottom: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 28 }}>🏪</div>
            <div className="bold" style={{ fontWeight: 800, fontSize: 18, color: "#1a365d" }}>{settings.storeName}</div>
            <div style={{ fontSize: 11, color: "#718096" }}>{settings.storeAddress}</div>
            <div style={{ fontSize: 11, color: "#718096" }}>📞 {settings.storePhone}</div>
            <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>{order.date}</div>
            <div style={{ fontSize: 11, color: "#a0aec0" }}>No: #{order.customId || String(order.id).slice(-6)}</div>
            {order.cashierName && <div style={{ fontSize: 11, color: "#718096" }}>Kasir: {order.cashierName}</div>}
          </div>
          {order.items.map(i => (
            <div key={i.id} className="row" style={{ display: "flex", justifySpaceBetween: "space-between", fontSize: 13, marginBottom: 5 }}>
              <span>{i.icon} {i.name}<br /><span style={{ color: "#718096", fontSize: 11 }}>{i.qty} × Rp {Math.round(i.price).toLocaleString("id-ID")}</span></span>
              <span style={{ fontWeight: 600 }}>Rp {Math.round(i.price * i.qty).toLocaleString("id-ID")}</span>
            </div>
          ))}
          <div className="dashed" style={{ borderTop: "1px dashed #e2e8f0", marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 4 }}><span>Subtotal</span><span>Rp {Math.round(order.subtotal).toLocaleString("id-ID")}</span></div>
            {order.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e53e3e", marginBottom: 4 }}><span>Diskon {order.discount}%</span><span>−Rp {Math.round(order.discAmt).toLocaleString("id-ID")}</span></div>}
            {settings.taxRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 4 }}><span>Pajak {settings.taxRate}%</span><span>+Rp {Math.round(order.taxAmt || 0).toLocaleString("id-ID")}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, color: "#1a365d", margin: "8px 0" }}><span>TOTAL</span><span>Rp {Math.round(order.total).toLocaleString("id-ID")}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096" }}><span>Bayar</span><span>Rp {Math.round(order.pay).toLocaleString("id-ID")}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#276749", fontWeight: 700 }}><span>Kembalian</span><span>Rp {Math.round(order.change).toLocaleString("id-ID")}</span></div>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#a0aec0", borderTop: "2px dashed #e2e8f0", paddingTop: 12 }}>
            ⭐ {settings.footerNote} ⭐
          </div>
        </div>

        {/* ── INPUT NOMOR WA PELANGGAN (TAMBAHAN BARU) ── */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "2px solid #e2e8f0" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>No. WhatsApp Pelanggan:</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input 
              type="text" 
              placeholder="Contoh: 08589235xxx atau 62858..." 
              value={customerPhone} 
              onChange={e => setCustomerPhone(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #cbd5e0", fontSize: 13, flex: 1, outline: "none" }}
            />
            <button 
              onClick={handleSendWhatsApp} 
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#25D366", color: "#fff", display: "flex", alignItems: "center", gap: 4 }}
            >
              🟢 Kirim WA
            </button>
          </div>
        </div>

        {/* Tombol Kontrol Modal */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={handlePrint} style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, flex: 1, background: "#276749", color: "#fff" }}>🖨️ Cetak Fisik</button>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, flex: 1, background: "#e2e8f0", color: "#4a5568" }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
// ── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleLogin = () => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (!user) { setErr("Username atau password salah!"); return; }
    setErr("");
    onLogin(user);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: 360, boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏪</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: "#1a365d" }}>Rasa nusantara.co</div>
          <div style={{ color: "#718096", fontSize: 13 }}>From Nusantara For You</div>
        </div>
        {err && <div style={{ background: "#fff5f5", color: "#c53030", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, border: "1px solid #fed7d7" }}>❌ {err}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin / kasir"
            style={S.inp} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Password</label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={{ ...S.inp, paddingRight: 40 }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>{showPw ? "🙈" : "👁️"}</button>
          </div>
        </div>
        <button onClick={handleLogin} style={{ ...S.btn, width: "100%", background: "#2b6cb0", color: "#fff", fontSize: 15, padding: 13 }}>
          Masuk →
        </button>
        <div style={{ marginTop: 20, padding: "12px 14px", background: "#ebf8ff", borderRadius: 10, fontSize: 12, color: "#2c5282" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Akun Demo:</div>
          <div>👑 Admin: admin / admin123</div>
          <div>💼 Kasir: kasir / kasir123</div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function KasirApp() {
  const [user, setUser]             = useState(() => load("kk_user", null));
  const [products, setProducts]     = useState(() => load("kk_products", INITIAL_PRODUCTS));
  const [orders, setOrders]         = useState(() => load("kk_orders", []));
  const [expenses, setExpenses]     = useState(() => load("kk_expenses", []));
  const [settings, setSettings]     = useState(() => load("kk_settings", INITIAL_SETTINGS));
  const [cart, setCart]             = useState([]);
  const [category, setCategory]     = useState("Semua");
  const [search, setSearch]         = useState("");
  const [discount, setDiscount]     = useState(0);
  const [payAmount, setPayAmount]   = useState("");
  const [tab, setTab]               = useState("kasir");
  const [showReceipt, setShowReceipt] = useState(null);
  const [toast, setToast]           = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10" });
  const [newExpense, setNewExpense] = useState({ type: "pengeluaran", desc: "", amount: "", date: "" });
  const [editSettings, setEditSettings] = useState(() => load("kk_settings", INITIAL_SETTINGS));
  const [stockFilter, setStockFilter] = useState("semua");
  const [reportRange, setReportRange] = useState({ from: "", to: "" });

  // Persist data
  useEffect(() => { save("kk_user", user); }, [user]);
  useEffect(() => { save("kk_products", products); }, [products]);
  useEffect(() => { save("kk_orders", orders); }, [orders]);
  useEffect(() => { save("kk_expenses", expenses); }, [expenses]);
  useEffect(() => { 
    save("kk_settings", settings);
    setEditSettings(settings);
  }, [settings]);

  const CATEGORIES = ["Semua", "Bumbu & Rempah", "Cair", "Kering", "Lainnya"];

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  if (!user) return <LoginPage onLogin={u => { setUser(u); setTab("kasir"); }} />;

  const canAdmin = user.role === "admin";

  const TABS = canAdmin
    ? [["kasir","🛒","Kasir"],["produk","📦","Produk"],["stok","📊","Stok"],["keuangan","💰","Keuangan"],["riwayat","📋","Riwayat"],["laporan","📈","Laporan"],["setting","⚙️","Setting"]]
    : [["kasir","🛒","Kasir"],["riwayat","📋","Riwayat"]];

  // ── KASIR LOGIC ──
  const filtered = products.filter(p => {
    const catOk = category === "Semua" || p.category.toLowerCase() === category.toLowerCase();
    const srchOk = p.name.toLowerCase().includes(search.toLowerCase());
    return catOk && srchOk;
  });

  const addToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) return showToast("Stok habis!", "error");
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        if (product.stock !== undefined && ex.qty >= product.stock) { showToast("Stok tidak cukup!", "error"); return prev; }
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      if (delta > 0 && i.stock !== undefined && newQty > i.stock) { showToast("Stok tidak cukup!", "error"); return i; }
      return { ...i, qty: newQty };
    }).filter(i => i.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const currentSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt  = Math.round(currentSubtotal * (discount / 100));
  const taxAmt   = Math.round((currentSubtotal - discAmt) * (settings.taxRate / 100));
  const total    = currentSubtotal - discAmt + taxAmt;
  const kembalian = Math.max(0, Number(payAmount) - total);

  const handlePay = () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    if (Number(payAmount) < total) return showToast("Uang tidak cukup!", "error");
    
    const nextId = orders.length > 0 ? (orders[0].customId || 0) + 1 : 1;

    const order = {
      id: Date.now(),
      customId: nextId,
      items: [...cart], subtotal: currentSubtotal, discount, discAmt, taxAmt, total,
      pay: Number(payAmount), change: kembalian, date: now(), cashierName: user.name,
    };
    setOrders(prev => [order, ...prev]);
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
    }));
    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0);
    showToast("Pembayaran berhasil! 🎉");
  };

  // ── PRODUK LOGIC ──
  const saveProduct = () => {
    if (!newProduct.name || !newProduct.price) return showToast("Isi nama & harga!", "error");
    if (editProduct) {
      setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock), minStock: Number(newProduct.minStock) } : p));
      showToast("Produk diperbarui!");
    } else {
      setProducts(prev => [...prev, { ...newProduct, id: Date.now(), price: Number(newProduct.price), stock: Number(newProduct.stock || 0), minStock: Number(newProduct.minStock || 10) }]);
      showToast("Produk ditambahkan!");
    }
    setEditProduct(null);
    setNewProduct({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10" });
  };

  const deleteProduct = (id) => { setProducts(prev => prev.filter(p => p.id !== id)); showToast("Produk dihapus!", "error"); };
  const startEdit = (p) => { setEditProduct(p); setNewProduct({ name: p.name, price: String(p.price), category: p.category, icon: p.icon, stock: String(p.stock || 0), minStock: String(p.minStock || 10) }); };

  // ── KEUANGAN LOGIC ──
  const addExpense = () => {
    if (!newExpense.desc || !newExpense.amount) return showToast("Isi deskripsi & jumlah!", "error");
    setExpenses(prev => [{ ...newExpense, id: Date.now(), amount: Number(newExpense.amount), date: newExpense.date || now() }, ...prev]);
    setNewExpense({ type: "pengeluaran", desc: "", amount: "", date: "" });
    showToast(newExpense.type === "pengeluaran" ? "Pengeluaran dicatat!" : "Pendapatan dicatat!");
  };

  const totalIncome   = orders.reduce((s, o) => s + o.total, 0) + expenses.filter(e => e.type === "pendapatan").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.filter(e => e.type === "pengeluaran").reduce((s, e) => s + e.amount, 0);
  const netProfit     = totalIncome - totalExpenses;

  // ── LAPORAN EXCEL DENGAN FORMAT RUPIAH & DATA PENTING KEUANGAN UTAMA ──
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. DATA PENTING KEUANGAN (Ringkasan Keuangan Utama)
    const summaryRows = [
      { "Kategori Keuangan": "Total Pendapatan Penjualan", "Nominal (Rupiah)": orders.reduce((s, o) => s + o.total, 0) },
      { "Kategori Keuangan": "Total Pendapatan Lain", "Nominal (Rupiah)": expenses.filter(e => e.type === "pendapatan").reduce((s, e) => s + e.amount, 0) },
      { "Kategori Keuangan": "Total Seluruh Pendapatan", "Nominal (Rupiah)": totalIncome },
      { "Kategori Keuangan": "Total Pengeluaran Operasional", "Nominal (Rupiah)": totalExpenses },
      { "Kategori Keuangan": "LABA BERSIH", "Nominal (Rupiah)": netProfit },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

    // 2. Data Transaksi
    const txRows = orders.map(o => ({
      "No. Struk": "#" + (o.customId || String(o.id).slice(-6)), 
      "Tanggal": o.date, 
      "Kasir": o.cashierName || "-",
      "Item Terjual": o.items.map(i => `${i.name}(${i.qty})`).join(", "),
      "Subtotal": o.subtotal, 
      "Diskon": o.discAmt, 
      "Pajak": o.taxAmt || 0, 
      "Total Akhir": o.total,
    }));
    const wsTx = XLSX.utils.json_to_sheet(txRows);

    // 3. Data Keuangan (Detail Log Pengeluaran & Pendapatan Lain)
    const expRows = expenses.map(e => ({
      "Tanggal": e.date, 
      "Jenis Transaksi": e.type === "pengeluaran" ? "Pengeluaran" : "Pendapatan Lain",
      "Deskripsi": e.desc, 
      "Nominal": e.type === "pengeluaran" ? -e.amount : e.amount,
    }));
    const wsExp = XLSX.utils.json_to_sheet(expRows);

    // 4. Data Stok Produk
    const stockRows = products.map(p => ({
      "Nama Produk": p.name, 
      "Kategori": p.category, 
      "Harga Satuan": p.price,
      "Stok Saat Ini": p.stock || 0, 
      "Batas Minimum": p.minStock || 0,
      "Status Stok": (p.stock || 0) <= (p.minStock || 0) ? "⚠️ Menipis" : "✅ Aman",
    }));
    const wsStock = XLSX.utils.json_to_sheet(stockRows);

    // 🔥 LOGIK AUTO-FIT KOLOM & FORMAT CURRENCY RUPIAH AKURAT
    const formatAndAutoFit = (ws, rowsData, currencyColumns = []) => {
      if (!rowsData || rowsData.length === 0) return;
      
      const objectKeys = Object.keys(rowsData[0]);
      
      // 1. Terapkan Format Rupiah khusus untuk kolom finansial / angka nominal
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Memulai dari baris setelah Header
        currencyColumns.forEach(colName => {
          const colIdx = objectKeys.indexOf(colName);
          if (colIdx !== -1) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: colIdx });
            if (ws[cellRef] && ws[cellRef].t === 'n') { // Jika berupa data angka (number)
              ws[cellRef].z = '"Rp" #,##0;[Red]("-Rp" #,##0);"-"'; // Format Rupiah Excel asli
            }
          }
        });
      }

      // 2. Hitung Auto-Fit Lebar Kolom mengikuti isi teks terdalam
      const colsWidth = objectKeys.map(key => {
        let maxLen = key.length; // panjang teks header awal
        
        rowsData.forEach(row => {
          let value = row[key] != null ? String(row[key]) : "";
          // Jika kolom tersebut dikonversi ke format Rupiah, beri estimasi panjang tambahan karakter "Rp .000"
          if (currencyColumns.includes(key) && typeof row[key] === 'number') {
            value = "Rp " + Math.round(row[key]).toLocaleString("id-ID");
          }
          if (value.length > maxLen) {
            maxLen = value.length;
          }
        });
        
        return { wch: maxLen + 4 }; // Tambah sedikit padding ruang aman
      });
      
      ws["!cols"] = colsWidth;
    };

    // Eksekusi pemformatan otomatis pada masing-masing sheet
    formatAndAutoFit(wsSummary, summaryRows, ["Nominal (Rupiah)"]);
    formatAndAutoFit(wsTx, txRows, ["Subtotal", "Diskon", "Pajak", "Total Akhir"]);
    formatAndAutoFit(wsExp, expRows, ["Nominal"]);
    formatAndAutoFit(wsStock, stockRows, ["Harga Satuan"]);

    // Masukkan lembar sheet teratur ke dalam workbook (Ringkasan Keuangan ditaruh paling depan)
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Keuangan");
    XLSX.utils.book_append_sheet(wb, wsTx, "Daftar Transaksi");
    XLSX.utils.book_append_sheet(wb, wsExp, "Log Keuangan");
    XLSX.utils.book_append_sheet(wb, wsStock, "Stok Barang");

    // Unduh File
    XLSX.writeFile(wb, `Laporan_KasirKu_Rapi_${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}.xlsx`);
    showToast("Laporan Excel format Rupiah siap diunduh! 📊");
  };

  // ── PRINT ALL RECEIPTS ──
  const printAllReceipts = () => {
    const filteredOrders = orders.filter(o => {
      if (!reportRange.from && !reportRange.to) return true;
      const d = new Date(o.id);
      const from = reportRange.from ? new Date(reportRange.from + "T00:00:00") : null;
      const to   = reportRange.to   ? new Date(reportRange.to + "T23:59:59") : null;
      return (!from || d >= from) && (!to || d <= to);
    });
    if (filteredOrders.length === 0) return showToast("Tidak ada data untuk dicetak!", "error");
    const rows = filteredOrders.map(o => `
      <tr>
        <td>#${o.customId || String(o.id).slice(-6)}</td>
        <td>${o.date}</td>
        <td>${o.cashierName || "-"}</td>
        <td>${o.items.map(i=>`${i.name}×${i.qty}`).join(", ")}</td>
        <td style="text-align:right">${fmt(o.subtotal)}</td>
        <td style="text-align:right; color: red">${o.discount>0?`-${fmt(o.discAmt)}`:"-"}</td>
        <td style="text-align:right; font-weight:bold">${fmt(o.total)}</td>
      </tr>
    `).join("");
    const totalAll = filteredOrders.reduce((s,o)=>s+o.total,0);
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Laporan Transaksi</title>
      <style>
        body { font-family: Arial; font-size: 12px; padding: 20px; }
        h2 { color: #1a365d; } table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #ebf8ff; color: #2c5282; padding: 8px; text-align: left; border: 1px solid #bee3f8; }
        td { padding: 7px 8px; border: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f7fafc; }
        .total-row td { font-weight: bold; background: #e6fffa; color: #276749; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .store-info { color: #718096; font-size: 11px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="header">
        <div><h2>🏪 ${settings.storeName}</h2><div class="store-info">${settings.storeAddress} | ${settings.storePhone}</div></div>
        <div class="store-info" style="text-align:right">Laporan Transaksi<br>Dicetak: ${now()}<br>${reportRange.from||"Semua"} s/d ${reportRange.to||"Sekarang"}</div>
      </div>
      <table>
        <thead><tr><th>No. Struk</th><th>Tanggal</th><th>Kasir</th><th>Item</th><th style="text-align:right">Subtotal</th><th style="text-align:right">Diskon</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}<tr class="total-row"><td colspan="4">TOTAL (${filteredOrders.length} transaksi)</td><td></td><td></td><td style="text-align:right">${fmt(totalAll)}</td></tr></tbody>
      </table>
      <script>window.print();window.close();<\/script></body></html>
    `);
    win.document.close();
  };

  const getStockStatus = (p) => {
    const s = p.stock || 0, m = p.minStock || 0;
    if (s === 0) return { label: "Habis", color: "#e53e3e", bg: "#fff5f5" };
    if (s <= m)  return { label: "Menipis ⚠️", color: "#c05621", bg: "#fffaf0" };
    return { label: "Aman ✅", color: "#276749", bg: "#f0fff4" };
  };

  const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0));

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "#fed7d7" : "#c6f6d5", color: toast.type === "error" ? "#c53030" : "#276749", padding: "10px 18px", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 14, animation: "fadeIn .2s ease" }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: "#1a365d", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,.2)", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏪</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{settings.storeName}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>From Nusantara For You</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(([key, ic, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: tab === key ? "#4299e1" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: tab === key ? 700 : 400, fontSize: 12, display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
              {ic} {label}
              {key === "stok" && lowStockProducts.length > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, background: "#e53e3e", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{lowStockProducts.length}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{user.role === "admin" ? "👑 Admin" : "💼 Kasir"}</div>
          </div>
          <button onClick={() => { setUser(null); setCart([]); }} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Keluar</button>
        </div>
      </div>

      {/* TAB: KASIR */}
      {tab === "kasir" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, height: "calc(100vh - 62px)" }}>
          <div style={{ padding: 18, overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input placeholder="🔍 Cari produk..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, background: category === c ? "#2b6cb0" : "#e2e8f0", color: category === c ? "#fff" : "#4a5568", fontWeight: category === c ? 700 : 400 }}>{c}</button>
              ))}
            </div>
            <div style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, display: "grid" }}>
              {filtered.map(p => {
                const st = getStockStatus(p);
                const outOfStock = (p.stock || 0) === 0;
                return (
                  <div key={p.id} onClick={() => !outOfStock && addToCart(p)} style={{ background: outOfStock ? "#f7fafc" : "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", cursor: outOfStock ? "not-allowed" : "pointer", border: `1.5px solid ${outOfStock ? "#fed7d7" : "#e2e8f0"}`, opacity: outOfStock ? 0.65 : 1, transition: "transform .15s, box-shadow .15s", position: "relative" }}
                    onMouseEnter={e => { if (!outOfStock) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.1)"; }}}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                  >
                    {(p.stock || 0) <= (p.minStock || 0) && (p.stock || 0) > 0 && <div style={{ position: "absolute", top: 6, right: 6, fontSize: 12 }}>⚠️</div>}
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#2d3748", marginBottom: 3 }}>{p.name}</div>
                    <div style={{ color: "#2b6cb0", fontWeight: 700, fontSize: 13 }}>{fmt(p.price)}</div>
                    <div style={{ fontSize: 10, marginTop: 3, color: st.color, fontWeight: 600 }}>Stok: {p.stock || 0}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keranjang */}
          <div style={{ background: "#fff", borderLeft: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column", height: "calc(100vh - 62px)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 15, color: "#1a365d" }}>
              🛒 Keranjang {cart.length > 0 && <span style={{ background: "#2b6cb0", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 12, marginLeft: 6 }}>{cart.reduce((s,i)=>s+i.qty,0)}</span>}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div><div>Keranjang kosong</div><div style={{ fontSize: 12 }}>Pilih produk di sebelah kiri</div>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid #f7fafc" }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                    <div style={{ color: "#718096", fontSize: 11 }}>{fmt(item.price)} × {item.qty}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#2b6cb0", minWidth: 65, textAlign: "right" }}>{fmt(item.price * item.qty)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <button onClick={() => updateQty(item.id, -1)} style={S.qBtn}> − </button>
                    <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={S.qBtn}> + </button>
                    <button onClick={() => removeFromCart(item.id)} style={{ ...S.qBtn, color: "#e53e3e" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", borderTop: "1.5px solid #e2e8f0", background: "#f7fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13, color: "#4a5568" }}><span>Subtotal</span><span>{fmt(currentSubtotal)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#4a5568" }}>Diskon</span>
                <input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ width: 48, padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <span style={{ fontSize: 12, color: "#e53e3e" }}>% −{fmt(discAmt)}</span>
              </div>
              {settings.taxRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13, color: "#718096" }}><span>Pajak {settings.taxRate}%</span><span>+{fmt(taxAmt)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "#1a365d", marginBottom: 8, paddingTop: 7, borderTop: "1px dashed #e2e8f0" }}><span>TOTAL</span><span>{fmt(total)}</span></div>
              <input type="number" placeholder="Nominal bayar (Rp)" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ ...S.inp, marginBottom: 7, border: "1.5px solid #90cdf4" }} />
              {payAmount && Number(payAmount) >= total && <div style={{ color: "#276749", fontWeight: 600, fontSize: 13, marginBottom: 7 }}>💰 Kembalian: {fmt(kembalian)}</div>}
              <button onClick={handlePay} style={{ width: "100%", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>💳 Proses Pembayaran</button>
              {cart.length > 0 && <button onClick={() => setCart([])} style={{ width: "100%", marginTop: 6, background: "transparent", border: "1px solid #fc8181", color: "#e53e3e", borderRadius: 8, padding: "6px", fontSize: 12, cursor: "pointer" }}>Kosongkan Keranjang</button>}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRODUK */}
      {tab === "produk" && canAdmin && (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: "#1a365d" }}>{editProduct ? "✏️ Edit Produk" : "➕ Tambah Produk"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 100px 100px", gap: 10 }}>
              <input placeholder="Nama produk" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} style={S.inp} />
              <input placeholder="Harga (Rp)" type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} style={S.inp} />
              <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} style={S.inp}>
                {["Bumbu & Rempah","Cair","Kering","Lainnya"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Ikon" value={newProduct.icon} onChange={e => setNewProduct(p => ({ ...p, icon: e.target.value }))} style={{ ...S.inp, textAlign: "center", fontSize: 22 }} />
              <input placeholder="Stok" type="number" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} style={S.inp} />
              <input placeholder="Min. Stok" type="number" value={newProduct.minStock} onChange={e => setNewProduct(p => ({ ...p, minStock: e.target.value }))} style={S.inp} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={saveProduct} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>{editProduct ? "💾 Simpan Perubahan" : "➕ Tambah Produk"}</button>
              {editProduct && <button onClick={() => { setEditProduct(null); setNewProduct({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10" }); }} style={{ ...S.btn, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                  {["Produk","Kategori","Harga","Stok","Min. Stok","Status","Aksi"].map(h => <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const st = getStockStatus(p);
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #f0f4f8", background: i % 2 === 0 ? "#fff" : "#f7fafc" }}>
                      <td style={{ padding: "10px 14px" }}><span style={{ marginRight: 8, fontSize: 17 }}>{p.icon}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span></td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.category}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#2b6cb0", fontSize: 13 }}>{fmt(p.price)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{p.stock || 0}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#718096" }}>{p.minStock || 0}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: st.bg, color: st.color, padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span></td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                        <button onClick={() => startEdit(p)} style={{ ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0" }}>✏️ Edit</button>
                        <button onClick={() => deleteProduct(p.id)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: STOK */}
      {tab === "stok" && canAdmin && (
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              ["📦 Total Produk", products.length, "#ebf8ff", "#2b6cb0"],
              ["⚠️ Stok Menipis", lowStockProducts.length, "#fffaf0", "#c05621"],
              ["✅ Stok Aman", products.filter(p => (p.stock||0) > (p.minStock||0)).length, "#f0fff4", "#276749"],
            ].map(([label, val, bg, color]) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div><div style={{ fontWeight: 700, fontSize: 26, color }}>{val}</div></div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["semua","Semua"],["menipis","⚠️ Menipis"],["habis","🚫 Habis"],["aman","✅ Aman"]].map(([v, l]) => (
              <button key={v} onClick={() => setStockFilter(v)} style={{ ...S.smBtn, background: stockFilter === v ? "#2b6cb0" : "#e2e8f0", color: stockFilter === v ? "#fff" : "#4a5568", padding: "7px 14px" }}>{l}</button>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                  {["Produk","Kategori","Stok Saat Ini","Min. Stok","Status","Tambah Stok","Atur Minimal Stok"].map(h => <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {products.filter(p => {
                  if (stockFilter === "menipis") return (p.stock||0) <= (p.minStock||0) && (p.stock||0) > 0;
                  if (stockFilter === "habis")   return (p.stock||0) === 0;
                  if (stockFilter === "aman")    return (p.stock||0) > (p.minStock||0);
                  return true;
                }).map((p, i) => {
                  const st = getStockStatus(p);
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #f0f4f8", background: st.label === "Habis" ? "#fff5f5" : st.label.includes("Menipis") ? "#fffaf0" : i % 2 === 0 ? "#fff" : "#f7fafc" }}>
                      <td style={{ padding: "10px 14px" }}><span style={{ marginRight: 8, fontSize: 17 }}>{p.icon}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span></td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.category}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 15, color: st.color }}>{p.stock || 0}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#718096" }}>{p.minStock || 0}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{st.label}</span></td>
                      
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input id={`stk-${p.id}`} type="number" placeholder="Jumlah" style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                          <button onClick={() => {
                            const inp = document.getElementById(`stk-${p.id}`);
                            const n = Number(inp.value);
                            if (!n || n <= 0) return showToast("Masukkan jumlah stok!", "error");
                            setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, stock: (pr.stock || 0) + n } : pr));
                            inp.value = "";
                            showToast(`Stok ${p.name} ditambah ${n}!`);
                          }} style={{ ...S.smBtn, background: "#276749", color: "#fff" }}>+ Tambah</button>
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input id={`min-${p.id}`} type="number" placeholder="Batas" defaultValue={p.minStock || 0} style={{ width: 65, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                          <button onClick={() => {
                            const inp = document.getElementById(`min-${p.id}`);
                            const n = Number(inp.value);
                            if (inp.value === "" || n < 0) return showToast("Batas minimal tidak valid!", "error");
                            setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, minStock: n } : pr));
                            showToast(`Minimal stok ${p.name} diubah ke ${n}!`);
                          }} style={{ ...S.smBtn, background: "#4299e1", color: "#fff" }}>💾 Ubah Batas</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: KEUANGAN */}
      {tab === "keuangan" && canAdmin && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              ["💰 Total Pendapatan", fmt(totalIncome),   "#c6f6d5", "#276749"],
              ["💸 Total Pengeluaran", fmt(totalExpenses), "#fed7d7", "#c53030"],
              ["📊 Laba Bersih",      fmt(netProfit),     netProfit >= 0 ? "#ebf8ff" : "#fff5f5", netProfit >= 0 ? "#2b6cb0" : "#c53030"],
            ].map(([label, val, bg, color]) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div><div style={{ fontWeight: 700, fontSize: 22, color }}>{val}</div></div>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1a365d" }}>📝 Catat Transaksi Keuangan</div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 160px 160px", gap: 10, marginBottom: 12 }}>
              <select value={newExpense.type} onChange={e => setNewExpense(p => ({ ...p, type: e.target.value }))} style={S.inp}>
                <option value="pengeluaran">💸 Pengeluaran</option>
                <option value="pendapatan">💰 Pendapatan Lain</option>
              </select>
              <input placeholder="Deskripsi (contoh: beli bahan baku)" value={newExpense.desc} onChange={e => setNewExpense(p => ({ ...p, desc: e.target.value }))} style={S.inp} />
              <input type="number" placeholder="Jumlah (Rp)" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} style={S.inp} />
              <input type="datetime-local" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} style={S.inp} />
            </div>
            <button onClick={addExpense} style={{ ...S.btn, background: newExpense.type === "pengeluaran" ? "#e53e3e" : "#276749", color: "#fff" }}>
              {newExpense.type === "pengeluaran" ? "💸 Catat Pengeluaran" : "💰 Catat Pendapatan Lain"}
            </button>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>📋 Riwayat Catatan Keuangan</div>
            {expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}><div style={{ fontSize: 40 }}>📝</div><div>Belum ada catatan</div></div>
            ) : expenses.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #f7fafc" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.type === "pengeluaran" ? "💸" : "💰"} {e.desc}</div>
                  <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>{e.date}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 700, color: e.type === "pengeluaran" ? "#e53e3e" : "#276749", fontSize: 15 }}>{e.type === "pengeluaran" ? "−" : "+"}{fmt(e.amount)}</div>
                  <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: RIWAYAT */}
      {tab === "riwayat" && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
          {canAdmin && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                ["💰 Total Pendapatan", fmt(orders.reduce((s,o)=>s+o.total,0)), "#c6f6d5", "#276749"],
                ["📋 Total Transaksi", orders.length, "#bee3f8", "#2b6cb0"],
                ["🧾 Rata-rata", orders.length ? fmt(orders.reduce((s,o)=>s+o.total,0)/orders.length) : "Rp 0", "#fefcbf", "#975a16"],
              ].map(([label, val, bg, color]) => (
                <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div><div style={{ fontWeight: 700, fontSize: 22, color }}>{val}</div></div>
              ))}
            </div>
          )}
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#a0aec0", background: "#fff", borderRadius: 14 }}><div style={{ fontSize: 48 }}>📋</div><div>Belum ada transaksi</div></div>
          ) : orders.map(o => (
            <div key={o.id} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 10, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a365d" }}>#{o.customId || String(o.id).slice(-6)}</div>
                <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>{o.date} · {o.items.length} item · Kasir: {o.cashierName || "-"}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: "#4a5568" }}>{o.items.map(i => i.name).join(", ")}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "#276749", fontSize: 15 }}>{fmt(o.total)}</div>
                <button onClick={() => setShowReceipt(o)} style={{ marginTop: 5, ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0" }}>🧾 Struk</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: LAPORAN */}
      {tab === "laporan" && canAdmin && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d", marginBottom: 16 }}>📈 Ekspor & Cetak Laporan</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 13, color: "#718096", display: "block", marginBottom: 4 }}>Dari Tanggal</label>
                <input type="date" value={reportRange.from} onChange={e => setReportRange(p => ({ ...p, from: e.target.value }))} style={{ ...S.inp, width: 160 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#718096", display: "block", marginBottom: 4 }}>Sampai Tanggal</label>
                <input type="date" value={reportRange.to} onChange={e => setReportRange(p => ({ ...p, to: e.target.value }))} style={{ ...S.inp, width: 160 }} />
              </div>
              <div style={{ alignSelf: "flex-end", display: "flex", gap: 10 }}>
                <button onClick={exportExcel} style={{ ...S.btn, background: "#276749", color: "#fff" }}>📊 Unduh Excel</button>
                <button onClick={printAllReceipts} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>🖨️ Cetak Semua Struk</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["💰 Total Penjualan",     fmt(orders.reduce((s,o)=>s+o.total,0)),    "#c6f6d5", "#276749"],
                ["📋 Jumlah Transaksi",    orders.length + " transaksi",               "#bee3f8", "#2b6cb0"],
                ["💸 Total Pengeluaran",   fmt(totalExpenses),                          "#fed7d7", "#c53030"],
                ["📊 Laba Bersih",         fmt(netProfit),                              netProfit>=0?"#ebf8ff":"#fff5f5", netProfit>=0?"#2b6cb0":"#c53030"],
              ].map(([label, val, bg, color]) => (
                <div key={label} style={{ background: bg, borderRadius: 12, padding: "14px 18px" }}><div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div><div style={{ fontWeight: 700, fontSize: 20, color }}>{val}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1a365d", marginBottom: 14 }}>🏆 Produk Terlaris</div>
            {(() => {
              const count = {};
              orders.forEach(o => o.items.forEach(i => { count[i.name] = (count[i.name] || 0) + i.qty; }));
              return Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name, qty], i) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f7fafc" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ background: i<3?"#fefcbf":"#f7fafc", color: i<3?"#975a16":"#718096", width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{i+1}</div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: "#2b6cb0", fontSize: 14 }}>{qty} terjual</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* TAB: SETTING */}
      {tab === "setting" && canAdmin && (
        <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d", marginBottom: 20 }}>⚙️ Pengaturan Toko</div>
            {[
              ["storeName",    "Nama Toko",               "text",   "KasirKu"],
              ["storeAddress", "Alamat Toko",              "text",   "Jl. Contoh No. 1"],
              ["storePhone",   "No. Telepon",              "text",   "08123456789"],
              ["taxRate",      "Pajak (%)",                "number", "0"],
              ["footerNote",   "Catatan di Struk",         "text",   "Terima kasih!"],
            ].map(([key, label, type, ph]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>{label}</label>
                <input type={type} placeholder={ph} value={editSettings[key] || ""} onChange={e => setEditSettings(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} style={S.inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setSettings(editSettings); showToast("Pengaturan disimpan! ✅"); }} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>💾 Simpan Pengaturan</button>
              <button 
                onClick={() => { 
                  if (window.confirm("Hapus semua data? Ini tidak bisa diurungkan!")) { 
                    setOrders([]); 
                    setExpenses([]); 
                    setProducts(INITIAL_PRODUCTS); 
                    showToast("Data direset!", "error"); 
                  }
                }} 
                style={{ ...S.btn, background: "#fff5f5", color: "#e53e3e" }}
              >
                🗑️ Reset Semua Data
              </button>
            </div>
            <div style={{ marginTop: 24, padding: "14px 16px", background: "#f7fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a365d", marginBottom: 8 }}>👥 Daftar Pengguna</div>
              {USERS.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13 }}>
                  <span>{u.role === "admin" ? "👑" : "💼"} <strong>{u.name}</strong> ({u.username})</span>
                  <span style={{ color: "#718096" }}>{u.role}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 8 }}>* Manajemen pengguna lanjutan tersedia di versi premium.</div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK */}
      {showReceipt && <ReceiptModal order={showReceipt} settings={settings} onClose={() => setShowReceipt(null)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}