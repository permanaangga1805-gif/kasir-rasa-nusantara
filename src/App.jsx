import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import ScannerSistem from "./components/ScannerSistem"; 

// ── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const now = () => new Date().toLocaleString("id-ID");

const USERS = [
  { id: 1, username: "admin", password: "admin123", role: "admin", name: "Administrator" },
  { id: 2, username: "kasir", password: "kasir123", role: "kasir", name: "Kasir 1" },
];

const INITIAL_PRODUCTS = [
  { id: 1, name: "Nasi Goreng Spesial", price: 25000, category: "Bumbu & Rempah", icon: "🍳", stock: 50, minStock: 10, barcode: "8992761131112" },
  { id: 2, name: "Mie Ayam Bakso",      price: 20000, category: "Bumbu & Rempah", icon: "🍜", stock: 8,  minStock: 10, barcode: "8996001311144" },
  { id: 3, name: "Soto Ayam",           price: 18000, category: "Bumbu & Rempah", icon: "🥣", stock: 30, minStock: 10, barcode: "8992345678901" },
  { id: 4, name: "Ayam Bakar",          price: 30000, category: "Bumbu & Rempah", icon: "🍗", stock: 5,  minStock: 10, barcode: "8992345678902" },
  { id: 5, name: "Gado-Gado",           price: 15000, category: "Bumbu & Rempah", icon: "🥗", stock: 25, minStock: 10, barcode: "8992345678903" },
  { id: 6, name: "Es Teh Manis",        price: 5000,  category: "Cair",           icon: "🍵", stock: 100,minStock: 10, barcode: "8992345678904" },
  { id: 7, name: "Jus Alpukat",         price: 15000, category: "Cair",           icon: "🥑", stock: 12, minStock: 10, barcode: "8992345678905" },
  { id: 8, name: "Es Jeruk",            price: 8000,  category: "Cair",           icon: "🍊", stock: 3,  minStock: 10, barcode: "8992345678906" },
  { id: 9, name: "Air Mineral",         price: 5000,  category: "Cair",           icon: "💧", stock: 60, minStock: 10, barcode: "8993005111234" },
  { id: 10,name: "Kopi Hitam",          price: 8000,  category: "Cair",           icon: "☕", stock: 40, minStock: 10, barcode: "8992761001231" },
  { id: 11,name: "Kerupuk",             price: 3000,  category: "Kering",         icon: "🥨", stock: 7,  minStock: 10, barcode: "8992345678907" },
  { id: 12,name: "Pisang Goreng",       price: 10000, category: "Kering",         icon: "🍌", stock: 20, minStock: 10, barcode: "8992345678908" },
  { id: 13,name: "Garam",               price: 5000,  category: "Kering",         icon: "🧂", stock: 10, minStock: 10, barcode: "8992007112233" },
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

  const handleSendWhatsApp = () => {
    if (!customerPhone) {
      alert("Silakan masukkan nomor WhatsApp pelanggan terlebih dahulu!");
      return;
    }
    let formattedPhone = customerPhone.replace(/[^0-9]/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "62" + formattedPhone.slice(1);
    }

    let text = `*✨ STRUK BELANJA - ${settings.storeName} ✨*\n`;
    text += `_${settings.storeAddress}_\n`;
    text += `📞 No. Telp: ${settings.storePhone}\n`;
    text += `-------------------------------------------\n`;
    text += `📅 Tanggal : ${order.date}\n`;
    text += `🧾 No. Struk: #${order.customId || String(order.id).slice(-6)}\n`;
    if (order.cashierName) text += `💼 Kasir    : ${order.cashierName}\n`;
    text += `-------------------------------------------\n\n`;

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

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 380, maxHeight: "95vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
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
            <div key={i.id} className="row" style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
              <span>{i.icon || "🛒"} {i.name}<br /><span style={{ color: "#718096", fontSize: 11 }}>{i.qty} × Rp {Math.round(i.price).toLocaleString("id-ID")}</span></span>
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
  const [user, setUser]               = useState(() => load("kk_user", null));
  const [products, setProducts]       = useState(() => load("kk_products", INITIAL_PRODUCTS));
  const [orders, setOrders]           = useState(() => load("kk_orders", []));
  const [expenses, setExpenses]       = useState(() => load("kk_expenses", []));
  const [settings, setSettings]       = useState(() => load("kk_settings", INITIAL_SETTINGS));
  const [cart, setCart]               = useState([]);
  const [category, setCategory]       = useState("Semua");
  const [search, setSearch]           = useState("");
  const [discount, setDiscount]       = useState(0);
  const [payAmount, setPayAmount]     = useState("");
  const [tab, setTab]                 = useState("kasir");
  const [showReceipt, setShowReceipt] = useState(null);
  const [toast, setToast]             = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct]   = useState({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10", barcode: "" });
  const [newExpense, setNewExpense]   = useState({ type: "pengeluaran", desc: "", amount: "", date: "" });
  const [editSettings, setEditSettings] = useState(() => load("kk_settings", INITIAL_SETTINGS));
  const [stockFilter, setStockFilter] = useState("semua");
  const [reportRange, setReportRange] = useState({ from: "", to: "" });

  // Mode pembayaran tambahan (Cash / QRIS Barcode)
  const [paymentMode, setPaymentMode] = useState("cash");

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

  // 🔊 AUDIO BEEP AKURAT BROWSER HP
  const playBeep = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav");
    audio.volume = 1.0;
    audio.play().catch((err) => console.log("Suara beep ditangguhkan sebelum interaksi.", err));
  };

  // 🔥 CORE INTEGRASI SCANNER KAMERA HP (KERANJANG & INPUT FORM)
  const handleBarcodeScannedFromSystem = (barcodeText) => {
    if (!barcodeText) return;
    const cleanBarcode = barcodeText.trim();
    playBeep(); // Bunyikan suara setiap kali berhasil scan barang

    if (tab === "produk") {
      // Skenario Admin: Isikan otomatis hasil scan ke form pendaftaran produk baru
      setNewProduct((prev) => ({
        ...prev,
        barcode: cleanBarcode
      }));
      showToast(`📝 Barcode [${cleanBarcode}] masuk ke form produk!`);
    } else {
      // Skenario Kasir: Masuk otomatis ke keranjang belanja secara real-time
      setTab("kasir");
      const foundProduct = products.find(
        (p) => p.barcode && p.barcode.toString().trim() === cleanBarcode
      );

      if (foundProduct) {
        addToCart(foundProduct);
        showToast(`🛒 ${foundProduct.name} masuk keranjang!`);
      } else {
        setSearch(cleanBarcode);
        showToast(`⚠️ Barcode [${cleanBarcode}] belum terdaftar di master produk!`, "error");
      }
    }
  };

  if (!user) return <LoginPage onLogin={u => { setUser(u); setTab("kasir"); }} />;

  const canAdmin = user.role === "admin";

  const TABS = canAdmin
    ? [["kasir","🛒","Kasir"],["produk","📦","Produk"],["stok","📊","Stok"],["keuangan","💰","Keuangan"],["riwayat","📋","Riwayat"],["laporan","📈","Laporan"],["setting","⚙️","Setting"]]
    : [["kasir","🛒","Kasir"],["riwayat","📋","Riwayat"]];

  // ── KASIR LOGIC ──
  const filtered = products.filter(p => {
    const catOk = category === "Semua" || p.category.toLowerCase() === category.toLowerCase();
    const srchOk = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search));
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
    
    // Validasi bayar tunai biasa
    if (paymentMode === "cash" && Number(payAmount) < total) {
      return showToast("Uang tunai tidak cukup!", "error");
    }
    
    const nextId = orders.length > 0 ? (orders[0].customId || 0) + 1 : 1;
    const finalPay = paymentMode === "qris" ? total : Number(payAmount);
    const finalChange = paymentMode === "qris" ? 0 : kembalian;

    const order = {
      id: Date.now(),
      customId: nextId,
      items: [...cart], subtotal: currentSubtotal, discount, discAmt, taxAmt, total,
      pay: finalPay, change: finalChange, date: now(), cashierName: user.name,
      paymentMode: paymentMode === "qris" ? "Barcode QRIS" : "Tunai"
    };

    setOrders(prev => [order, ...prev]);
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
    }));

    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0); setPaymentMode("cash");
    showToast("Pembayaran Berhasil Diproses! 🎉");
  };

  // ── PRODUK LOGIC ──
  const saveProduct = () => {
    if (!newProduct.name || !newProduct.price) return showToast("Isi nama & harga!", "error");
    if (editProduct) {
      setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock), minStock: Number(newProduct.minStock), barcode: newProduct.barcode } : p));
      showToast("Produk diperbarui!");
    } else {
      setProducts(prev => [...prev, { ...newProduct, id: Date.now(), price: Number(newProduct.price), stock: Number(newProduct.stock || 0), minStock: Number(newProduct.minStock || 10), barcode: newProduct.barcode }]);
      showToast("Produk ditambahkan!");
    }
    setEditProduct(null);
    setNewProduct({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10", barcode: "" });
  };

  const deleteProduct = (id) => { setProducts(prev => prev.filter(p => p.id !== id)); showToast("Produk dihapus!", "error"); };
  const startEdit = (p) => { setEditProduct(p); setNewProduct({ name: p.name, price: String(p.price), category: p.category, icon: p.icon, stock: String(p.stock || 0), minStock: String(p.minStock || 10), barcode: p.barcode || "" }); };

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

  // ── LAPORAN EXCEL ──
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = [
      { "Kategori Keuangan": "Total Pendapatan Penjualan", "Nominal (Rupiah)": orders.reduce((s, o) => s + o.total, 0) },
      { "Kategori Keuangan": "Total Pendapatan Lain", "Nominal (Rupiah)": expenses.filter(e => e.type === "pendapatan").reduce((s, e) => s + e.amount, 0) },
      { "Kategori Keuangan": "Total Seluruh Pendapatan", "Nominal (Rupiah)": totalIncome },
      { "Kategori Keuangan": "Total Pengeluaran Operasional", "Nominal (Rupiah)": totalExpenses },
      { "Kategori Keuangan": "LABA BERSIH", "Nominal (Rupiah)": netProfit },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

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

    const expRows = expenses.map(e => ({
      "Tanggal": e.date, 
      "Jenis Transaksi": e.type === "pengeluaran" ? "Pengeluaran" : "Pendapatan Lain",
      "Deskripsi": e.desc, 
      "Nominal": e.type === "pengeluaran" ? -e.amount : e.amount,
    }));
    const wsExp = XLSX.utils.json_to_sheet(expRows);

    const stockRows = products.map(p => ({
      "Barcode": p.barcode || "-",
      "Nama Produk": p.name, 
      "Kategori": p.category, 
      "Harga Satuan": p.price,
      "Stok Saat Ini": p.stock || 0, 
      "Batas Minimum": p.minStock || 0,
      "Status Stok": (p.stock || 0) <= (p.minStock || 0) ? "⚠️ Menipis" : "✅ Aman",
    }));
    const wsStock = XLSX.utils.json_to_sheet(stockRows);

    const formatAndAutoFit = (ws, rowsData, currencyColumns = []) => {
      if (!rowsData || rowsData.length === 0) return;
      const objectKeys = Object.keys(rowsData[0]);
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        currencyColumns.forEach(colName => {
          const colIdx = objectKeys.indexOf(colName);
          if (colIdx !== -1) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: colIdx });
            if (ws[cellRef] && ws[cellRef].t === 'n') {
              ws[cellRef].z = '"Rp" #,##0;[Red]("-Rp" #,##0);"-"';
            }
          }
        });
      }
      const colsWidth = objectKeys.map(key => {
        let maxLen = key.length;
        rowsData.forEach(row => {
          let value = row[key] != null ? String(row[key]) : "";
          if (currencyColumns.includes(key) && typeof row[key] === 'number') {
            value = "Rp " + Math.round(row[key]).toLocaleString("id-ID");
          }
          if (value.length > maxLen) maxLen = value.length;
        });
        return { wch: maxLen + 4 };
      });
      ws["!cols"] = colsWidth;
    };

    formatAndAutoFit(wsSummary, summaryRows, ["Nominal (Rupiah)"]);
    formatAndAutoFit(wsTx, txRows, ["Subtotal", "Diskon", "Pajak", "Total Akhir"]);
    formatAndAutoFit(wsExp, expRows, ["Nominal"]);
    formatAndAutoFit(wsStock, stockRows, ["Harga Satuan"]);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Keuangan");
    XLSX.utils.book_append_sheet(wb, wsTx, "Daftar Transaksi");
    XLSX.utils.book_append_sheet(wb, wsExp, "Log Keuangan");
    XLSX.utils.book_append_sheet(wb, wsStock, "Stok Barang");

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
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "#fed7d7" : "#c6f6d5", color: toast.type === "error" ? "#c53030" : "#276749", padding: "10px 18px", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 14 }}>
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
          <button onClick={() => { setUser(null); setCart([]); }} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Keluar ↩</button>
        </div>
      </div>

      {/* COMPONENT BARCODE SYSTEM SCANNER AREA */}
      <div style={{ maxWidth: 1200, margin: "16px auto", padding: "0 16px" }}>
        <details style={{ background: "#ebf8ff", padding: 14, borderRadius: 12, border: "1px solid #bee3f8", marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2b6cb0", fontSize: 14 }} onClick={playBeep}>
            📷 KLIK DI SINI: Aktifkan Kamera HP Barcode Scanner Sistem (Ketuk Layar untuk Suara Beep)
          </summary>
          <div style={{ marginTop: 12, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            <ScannerSistem onScanSuccess={handleBarcodeScannedFromSystem} />
          </div>
        </details>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 40px 16px" }}>
        
        {/* TAB 1: KASIR UTAMA */}
        {tab === "kasir" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <input style={{ ...S.inp, flex: 1 }} placeholder="Cari Nama Barang atau Tempel Hasil Scan Barcode..." value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...S.inp, width: 180 }} value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {filtered.map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 4px 6px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", cursor: "pointer" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{p.icon || "🛒"}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                    {p.barcode && <div style={{ fontSize: 11, color: "#a0aec0", fontFamily: "monospace", marginBottom: 6 }}>{p.barcode}</div>}
                    <div style={{ color: "#718096", fontSize: 12, marginBottom: 8 }}>{p.category}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#2b6cb0", fontSize: 14 }}>{fmt(p.price)}</span>
                      <span style={{ fontSize: 11, background: getStockStatus(p).bg, color: getStockStatus(p).color, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Stok: {p.stock || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SISI KERANJANG KASIR */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", height: "fit-content" }}>
              <h3 style={{ margin: "0 0 16px 0", borderBottom: "2px solid #edf2f7", paddingBottom: 10 }}>🛒 Keranjang Belanja</h3>
              {cart.length === 0 ? <p style={{ color: "#a0aec0", textAlign: "center", padding: "20px 0" }}>Keranjang masih kosong.</p> : (
                <div>
                  {cart.map(i => (
                    <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{i.name}</div>
                        <div style={{ color: "#718096" }}>{fmt(i.price)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button style={S.qBtn} onClick={() => updateQty(i.id, -1)}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{i.qty}</span>
                        <button style={S.qBtn} onClick={() => updateQty(i.id, 1)}>+</button>
                        <button style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e", marginLeft: 4 }} onClick={() => removeFromCart(i.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: "2px dashed #edf2f7", marginTop: 16, paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 6 }}><span>Subtotal</span><span>{fmt(currentSubtotal)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4a5568", marginBottom: 12, alignItems: "center" }}>
                      <span>Diskon (%)</span>
                      <input type="number" min="0" max="100" style={{ ...S.inp, width: 70, padding: "4px 8px" }} value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))} />
                    </div>
                    {settings.taxRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 12 }}><span>Pajak ({settings.taxRate}%)</span><span>{fmt(taxAmt)}</span></div>}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, color: "#1a365d", marginBottom: 16 }}><span>TOTAL</span><span>{fmt(total)}</span></div>
                    
                    {/* 🔥 METODE PEMBAYARAN BARCODE QRIS BARU */}
                    <div style={{ marginBottom: 14, background: "#f7fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Metode Transaksi:</label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input type="radio" name="paymode" checked={paymentMode === "cash"} onChange={() => setPaymentMode("cash")} /> 💵 Cash / Tunai
                        </label>
                        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input type="radio" name="paymode" checked={paymentMode === "qris"} onChange={() => setPaymentMode("qris")} /> 📱 Barcode / QRIS
                        </label>
                      </div>
                    </div>

                    {paymentMode === "cash" ? (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Jumlah Bayar Tunai:</label>
                        <input type="number" style={S.inp} placeholder="Masukkan uang tunai..." value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                        {Number(payAmount) >= total && <div style={{ fontSize: 12, color: "#276749", fontWeight: 600, marginTop: 6, display: "flex", justifyContent: "space-between" }}><span>Kembalian:</span><span>{fmt(kembalian)}</span></div>}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: 10, background: "#ebf8ff", borderRadius: 8, border: "1px solid #bee3f8", marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#2b6cb0" }}>SCAN BARCODE QRIS TOKO ANDA</div>
                        <div style={{ fontSize: 24, margin: "6px 0" }}>📱📲📱</div>
                        <div style={{ fontSize: 11, color: "#4a5568" }}>Total Otomatis Terkunci Pas: <b>{fmt(total)}</b></div>
                      </div>
                    )}

                    <button onClick={handlePay} style={{ ...S.btn, width: "100%", background: "#276749", color: "#fff", fontSize: 15 }}>🛒 Proses Bayar & Cetak Nota</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MASTER PRODUK */}
        {tab === "produk" && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", height: "fit-content" }}>
              <h3 style={{ margin: "0 0 16px 0" }}>{editProduct ? "✏️ Edit Produk SKU" : "➕ Registrasi Barang"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Kode Barcode Barang:</label>
                  <input style={S.inp} placeholder="Scan barang via kamera HP..." value={newProduct.barcode} onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Nama Barang:</label>
                  <input style={S.inp} placeholder="Misal: Es Kopi Susu" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Harga Satuan:</label>
                  <input type="number" style={S.inp} placeholder="Rp" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Jumlah Stok:</label>
                  <input type="number" style={S.inp} placeholder="0" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Stok Minimum:</label>
                  <input type="number" style={S.inp} placeholder="10" value={newProduct.minStock} onChange={e => setNewProduct({ ...newProduct, minStock: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Kategori Rak:</label>
                  <select style={S.inp} value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}>
                    {CATEGORIES.filter(c => c !== "Semua").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={saveProduct} style={{ ...S.btn, background: "#2b6cb0", color: "#fff", flex: 1 }}>💾 Simpan SKU</button>
                  {editProduct && <button onClick={() => { setEditProduct(null); setNewProduct({ name: "", price: "", category: "Bumbu & Rempah", icon: "🛒", stock: "", minStock: "10", barcode: "" }); }} style={{ ...S.btn, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>}
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", overflowX: "auto" }}>
              <h3 style={{ margin: "0 0 16px 0" }}>📦 Master SKU Toko Anda</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: 10 }}>Barcode</th>
                    <th style={{ padding: 10 }}>Produk</th>
                    <th style={{ padding: 10 }}>Kategori</th>
                    <th style={{ padding: 10 }}>Harga</th>
                    <th style={{ padding: 10 }}>Sisa Stok</th>
                    <th style={{ padding: 10 }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: 10 }}><code style={{ color: "#2c5282", fontWeight: "bold" }}>{p.barcode || "-"}</code></td>
                      <td style={{ padding: 10, fontWeight: 600 }}>{p.icon || "🛒"} {p.name}</td>
                      <td style={{ padding: 10 }}>{p.category}</td>
                      <td style={{ padding: 10 }}>{fmt(p.price)}</td>
                      <td style={{ padding: 10 }}>{p.stock || 0} SKU</td>
                      <td style={{ padding: 10 }}>
                        <button style={{ ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0", marginRight: 6 }} onClick={() => startEdit(p)}>Edit</button>
                        <button style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }} onClick={() => deleteProduct(p.id)}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: STOK MONITORING */}
        {tab === "stok" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0" }}>📊 Pemantau Status Stok Opname</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#718096" }}>Gudang mendeteksi ada {lowStockProducts.length} produk menipis atau kritis.</p>
              </div>
              <select style={{ ...S.inp, width: 160 }} value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                <option value="semua">Semua Produk</option>
                <option value="menipis">⚠️ Menipis / Habis</option>
              </select>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f7fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: 12 }}>Barcode</th>
                  <th style={{ padding: 12 }}>Nama Produk</th>
                  <th style={{ padding: 12 }}>Kategori</th>
                  <th style={{ padding: 12 }}>Sisa Stok Gudang</th>
                  <th style={{ padding: 12 }}>Status Gudang</th>
                </tr>
              </thead>
              <tbody>
                {products.filter(p => stockFilter === "semua" || (p.stock || 0) <= (p.minStock || 0)).map(p => {
                  const st = getStockStatus(p);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: 12 }}><code>{p.barcode || "-"}</code></td>
                      <td style={{ padding: 12, fontWeight: 600 }}>{p.icon || "🛒"} {p.name}</td>
                      <td style={{ padding: 12 }}>{p.category}</td>
                      <td style={{ padding: 12, fontWeight: 700 }}>{p.stock || 0}</td>
                      <td style={{ padding: 12 }}><span style={{ background: st.bg, color: st.color, padding: "4px 10px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: PANEL ANALISIS KEARSIPAN KEUANGAN */}
        {tab === "keuangan" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#e6fffa", color: "#234e52", padding: 16, borderRadius: 12, border: "1px solid #b2f5ea" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>Total Seluruh Pendapatan</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmt(totalIncome)}</div>
                </div>
                <div style={{ background: "#fff5f5", color: "#742a2a", padding: 16, borderRadius: 12, border: "1px solid #fed7d7" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>Operasional / Pengeluaran</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmt(totalExpenses)}</div>
                </div>
                <div style={{ background: netProfit >= 0 ? "#ebf8ff" : "#fff5f5", color: netProfit >= 0 ? "#2b6cb0" : "#e53e3e", padding: 16, borderRadius: 12, border: netProfit >= 0 ? "1px solid #bee3f8" : "1px solid #fed7d7" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>Laba Bersih Toko</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmt(netProfit)}</div>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 16px 0" }}>📋 Log Riwayat Pengeluaran & Pendapatan Lain</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f7fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: 10 }}>Tanggal</th>
                      <th style={{ padding: 10 }}>Jenis</th>
                      <th style={{ padding: 10 }}>Keterangan / Deskripsi</th>
                      <th style={{ padding: 10 }}>Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                        <td style={{ padding: 10 }}>{e.date}</td>
                        <td style={{ padding: 10 }}><span style={{ color: e.type === "pengeluaran" ? "#e53e3e" : "#276749", fontWeight: 700 }}>{e.type === "pengeluaran" ? "Pengeluaran" : "Pendapatan"}</span></td>
                        <td style={{ padding: 10 }}>{e.desc}</td>
                        <td style={{ padding: 10, fontWeight: 600, color: e.type === "pengeluaran" ? "#e53e3e" : "#276749" }}>{e.type === "pengeluaran" ? "-" : "+"}{fmt(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", height: "fit-content" }}>
              <h3 style={{ margin: "0 0 16px 0" }}>💸 Catat Kas Masuk/Keluar</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Tipe Log Transaksi:</label>
                  <select style={S.inp} value={newExpense.type} onChange={e => setNewExpense({ ...newExpense, type: e.target.value })}>
                    <option value="pengeluaran">Pengeluaran Toko</option>
                    <option value="pendapatan">Pendapatan Sampingan Lain</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Keterangan Log:</label>
                  <input style={S.inp} placeholder="Misal: Beli Plastik, Token Listrik" value={newExpense.desc} onChange={e => setNewExpense({ ...newExpense, desc: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Nominal Uang:</label>
                  <input type="number" style={S.inp} placeholder="Rp" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} />
                </div>
                <button onClick={addExpense} style={{ ...S.btn, background: "#1a365d", color: "#fff", marginTop: 4 }}>✍️ Tulis ke Buku Kas</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: RIWAYAT STRUK BELANJA */}
        {tab === "riwayat" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 16px 0" }}>📋 Rekam Jejak Faktur Penjualan</h3>
            {orders.length === 0 ? <p style={{ color: "#a0aec0", textAlign: "center" }}>Belum ada data riwayat kasir.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: 12 }}>No. Struk</th>
                    <th style={{ padding: 12 }}>Waktu Transaksi</th>
                    <th style={{ padding: 12 }}>Petugas Kasir</th>
                    <th style={{ padding: 12 }}>Metode</th>
                    <th style={{ padding: 12 }}>Item Terbeli</th>
                    <th style={{ padding: 12 }}>Total Belanja</th>
                    <th style={{ padding: 12 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>#{o.customId || String(o.id).slice(-6)}</td>
                      <td style={{ padding: 12 }}>{o.date}</td>
                      <td style={{ padding: 12 }}>{o.cashierName || "-"}</td>
                      <td style={{ padding: 12 }}><span style={{ fontSize: 12, fontWeight: "bold", color: o.paymentMode === "Barcode QRIS" ? "#2b6cb0" : "#276749" }}>{o.paymentMode || "Tunai"}</span></td>
                      <td style={{ padding: 12, color: "#4a5568" }}>{o.items.map(i => `${i.name} (x${i.qty})`).join(", ")}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: "#1a365d" }}>{fmt(o.total)}</td>
                      <td style={{ padding: 12 }}><button style={{ ...S.smBtn, background: "#edf2f7", color: "#2d3748" }} onClick={() => setShowReceipt(o)}>🔍 Lihat Struk</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 6: UNDUH LAPORAN EKSEKUTIF */}
        {tab === "laporan" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", maxWidth: 600, margin: "20px auto" }}>
            <h3 style={{ margin: "0 0 8px 0", textAlign: "center" }}>📈 Ekspor & Cetak Laporan Keuangan</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#718096", textAlign: "center" }}>Kelola arsip akuntansi secara rapi ke file Microsoft Excel berformat mata uang Rupiah otomatis.</p>
            <div style={{ background: "#f7fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8 }}>Filter Rentang Tanggal (Untuk Cetak Massal):</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="date" style={S.inp} value={reportRange.from} onChange={e => setReportRange({ ...reportRange, from: e.target.value })} />
                <span style={{ fontSize: 12, color: "#718096" }}>s/d</span>
                <input type="date" style={S.inp} value={reportRange.to} onChange={e => setReportRange({ ...reportRange, to: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={exportExcel} style={{ ...S.btn, background: "#276749", color: "#fff", fontSize: 15, padding: 12 }}>📊 Unduh Laporan Microsoft Excel (.xlsx)</button>
              <button onClick={printAllReceipts} style={{ ...S.btn, background: "#1a365d", color: "#fff", fontSize: 15, padding: 12 }}>🖨️ Cetak Jurnal Transaksi Massal</button>
            </div>
          </div>
        )}

        {/* TAB 7: SETTING PROFIL TOKO */}
        {tab === "setting" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", maxWidth: 550, margin: "20px auto" }}>
            <h3 style={{ margin: "0 0 16px 0" }}>⚙️ Pengaturan Profil Rasa Nusantara</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Nama Toko / UMKM:</label>
                <input style={S.inp} value={editSettings.storeName} onChange={e => setEditSettings({ ...editSettings, storeName: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Alamat Fisik Toko:</label>
                <textarea style={{ ...S.inp, fontFamily: "sans-serif", resize: "vertical", height: 60 }} value={editSettings.storeAddress} onChange={e => setEditSettings({ ...editSettings, storeAddress: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Nomor Telepon Official:</label>
                <input style={S.inp} value={editSettings.storePhone} onChange={e => setEditSettings({ ...editSettings, storePhone: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Pajak Toko PPN (%):</label>
                <input type="number" style={S.inp} value={editSettings.taxRate} onChange={e => setEditSettings({ ...editSettings, taxRate: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Catatan Kaki Struk (Footer Note):</label>
                <input style={S.inp} value={editSettings.footerNote} onChange={e => setEditSettings({ ...editSettings, footerNote: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button onClick={() => { setSettings(editSettings); showToast("Pengaturan berhasil disimpan!"); }} style={{ ...S.btn, background: "#2b6cb0", color: "#fff", flex: 1 }}>💾 Terapkan Konfigurasi</button>
                <button onClick={() => { if (confirm("Apakah Anda yakin ingin mengosongkan seluruh cache data kasir toko?")) { localStorage.clear(); window.location.reload(); } }} style={{ ...S.btn, background: "#e53e3e", color: "#fff" }}>⚠️ Reset Aplikasi</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* STRUK BELANJA MODAL POPUP */}
      {showReceipt && <ReceiptModal order={showReceipt} settings={settings} onClose={() => setShowReceipt(null)} />}
    </div>
  );
}