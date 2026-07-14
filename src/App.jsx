import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from './supabaseClient'

// ── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const now = () => new Date().toLocaleString("id-ID");

// Bunyi "beep" saat scan berhasil (pakai Web Audio API, tanpa file audio eksternal)
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    osc.onended = () => ctx.close();
  } catch {}
}

// Lebar kolom Excel otomatis mengikuti panjang teks terpanjang di tiap kolom (header & isi)
function autoFitColumns(rows, moneyCols = []) {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k, idx) => {
    let maxLen = String(k).length;
    rows.forEach(row => {
      const val = row[k];
      let len = val === null || val === undefined ? 0 : String(val).length;
      if (moneyCols.includes(idx) && typeof val === "number") len += 6; // ruang ekstra utk "Rp" & pemisah ribuan
      if (len > maxLen) maxLen = len;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
}

// Format angka nominal jadi "Rp" dengan pemisah ribuan rapi (mis. Rp1.500.000), minus berwarna merah
const RP_FORMAT = '"Rp"#,##0;[Red]-"Rp"#,##0';
function applyRupiahFormat(ws, colLetters, firstDataRow, lastDataRow) {
  colLetters.forEach(col => {
    for (let r = firstDataRow; r <= lastDataRow; r++) {
      const ref = `${col}${r}`;
      if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = RP_FORMAT;
    }
  });
}

// Format nomor transaksi 5 digit berurutan (00001, 00002, dst). Untuk transaksi lama yang
// belum punya nomor urut (orderNumber), tampilkan fallback dari id lama agar data lama tetap terbaca.
const orderNo = (o) => (o && o.orderNumber) ? String(o.orderNumber).padStart(5, "0") : String(o.id).slice(-6);

const USERS = [
  { id: 1, username: "admin", password: "admin123", role: "admin", name: "Administrator" },
  { id: 2, username: "kasir", password: "kasir123", role: "kasir", name: "Kasir 1" },
];

const INITIAL_PRODUCTS = [
  { id: 1, name: "Nasi Goreng Spesial", price: 25000, category: "Makanan", icon: "🍳", stock: 50, minStock: 10, barcode: "8990000000011" },
  { id: 2, name: "Mie Ayam Bakso",      price: 20000, category: "Makanan", icon: "🍜", stock: 8,  minStock: 10, barcode: "8990000000028" },
  { id: 3, name: "Soto Ayam",           price: 18000, category: "Makanan", icon: "🥣", stock: 30, minStock: 10, barcode: "8990000000035" },
  { id: 4, name: "Ayam Bakar",          price: 30000, category: "Makanan", icon: "🍗", stock: 5,  minStock: 10, barcode: "8990000000042" },
  { id: 5, name: "Gado-Gado",           price: 15000, category: "Makanan", icon: "🥗", stock: 25, minStock: 10, barcode: "8990000000059" },
  { id: 6, name: "Es Teh Manis",        price: 5000,  category: "Minuman", icon: "🍵", stock: 100,minStock: 20, barcode: "8990000000066" },
  { id: 7, name: "Jus Alpukat",         price: 15000, category: "Minuman", icon: "🥑", stock: 12, minStock: 15, barcode: "8990000000073" },
  { id: 8, name: "Es Jeruk",            price: 8000,  category: "Minuman", icon: "🍊", stock: 3,  minStock: 15, barcode: "8990000000080" },
  { id: 9, name: "Air Mineral",         price: 5000,  category: "Minuman", icon: "💧", stock: 60, minStock: 20, barcode: "8990000000097" },
  { id: 10,name: "Kopi Hitam",          price: 8000,  category: "Minuman", icon: "☕", stock: 40, minStock: 15, barcode: "8990000000103" },
  { id: 11,name: "Kerupuk",             price: 3000,  category: "Snack",   icon: "🥨", stock: 7,  minStock: 10, barcode: "8990000000110" },
  { id: 12,name: "Pisang Goreng",       price: 10000, category: "Snack",   icon: "🍌", stock: 20, minStock: 10, barcode: "8990000000127" },
];

const INITIAL_SETTINGS = {
  storeName: "Rasa nusantara.co",
  storeAddress: "Jl. Ace Tabrani No.39, Kp.Siranggap rt. 003 rw. 004, Desa Nanggung, Kecamatan Nanggung, Kabupaten Bogor 16650, Bogor",
  storePhone: "085892358884",
  taxRate: 0,
  footerNote: "Terima kasih atas kunjungan Anda!",
  qrImage: "",
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

// ── LOGIN PAGE (REAL-TIME SUPABASE AUTH) ──────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { 
      setErr("Email dan password wajib diisi!"); 
      return; 
    }
    setErr("");
    setLoading(true);

    try {
      // 1. Verifikasi Email & Password ke cloud Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error("Email atau password salah!");
      }

      // 2. Ambil data profil (nama, role, outlet) dari tabel profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Data profil pengguna tidak ditemukan di tabel profiles!");
      }

      // 3. Masukkan data user dari cloud ke dalam sistem kasir
      onLogin({
        id: authData.user.id,
        email: authData.user.email,
        name: profile.full_name || email.split('@')[0],
        // Sesuaikan nama role dari database ke format aplikasi Anda
        role: profile.role === 'super_admin' ? 'admin' : profile.role,
        outlet_id: profile.outlet_id
      });

    } catch (error) {
      console.error("Login Error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: 360, boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏪</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: "#1a365d" }}>My Cashier</div>
          <div style={{ color: "#718096", fontSize: 13 }}>Terhubung ke Cloud Database</div>
        </div>
        
        {err && <div style={{ background: "#fff5f5", color: "#c53030", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, border: "1px solid #fed7d7" }}>❌ {err}</div>}
        
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Email</label>
          <input 
            type="email"
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="admin@rasanusantara.co"
            style={S.inp} 
            onKeyDown={e => e.key === "Enter" && !loading && handleLogin()} 
            disabled={loading}
          />
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Password</label>
          <div style={{ position: "relative" }}>
            <input 
              type={showPw ? "text" : "password"} 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" 
              style={{ ...S.inp, paddingRight: 40 }} 
              onKeyDown={e => e.key === "Enter" && !loading && handleLogin()}
              disabled={loading}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>{showPw ? "🙈" : "👁️"}</button>
          </div>
        </div>
        
        <button 
          onClick={handleLogin} 
          disabled={loading}
          style={{ ...S.btn, width: "100%", background: loading ? "#a0aec0" : "#2b6cb0", color: "#fff", fontSize: 15, padding: 13, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "⏳ Memeriksa ke Cloud..." : "Masuk →"}
        </button>
        
        <div style={{ marginTop: 20, padding: "12px 14px", background: "#ebf8ff", borderRadius: 10, fontSize: 12, color: "#2c5282", textAlign: "center" }}>
          <div>🔒 Login diamankan oleh Supabase Auth</div>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Gunakan Email & Password yang terdaftar di cloud</div>
        </div>
      </div>
    </div>
  );
}
// ── RECEIPT MODAL ────────────────────────────────────────────────────────────
function ReceiptModal({ order, settings, onClose }) {
  const ref = useRef();
  const handlePrint = () => {
    const content = ref.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(`
      <html><head><title>Struk #${orderNo(order)}</title>
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 380, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div ref={ref}>
          <div className="center" style={{ textAlign: "center", borderBottom: "2px dashed #e2e8f0", paddingBottom: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 28 }}>🏪</div>
            <div className="bold" style={{ fontWeight: 800, fontSize: 18, color: "#1a365d" }}>{settings.storeName}</div>
            <div style={{ fontSize: 11, color: "#718096" }}>{settings.storeAddress}</div>
            <div style={{ fontSize: 11, color: "#718096" }}>📞 {settings.storePhone}</div>
            <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>{order.date}</div>
            <div style={{ fontSize: 11, color: "#a0aec0" }}>No: #{orderNo(order)}</div>
            {order.cashierName && <div style={{ fontSize: 11, color: "#718096" }}>Kasir: {order.cashierName}</div>}
            {order.paymentMethod && <div style={{ fontSize: 11, color: "#718096" }}>Metode: {order.paymentMethod === "QRIS" ? "📱 QRIS" : "💵 Tunai"}</div>}
          </div>
          {order.items.map(i => (
            <div key={i.id} className="row" style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
              <span>{i.icon} {i.name}<br /><span style={{ color: "#718096", fontSize: 11 }}>{i.qty} × {fmt(i.price)}</span></span>
              <span style={{ fontWeight: 600 }}>{fmt(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="dashed" style={{ borderTop: "1px dashed #e2e8f0", marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 4 }}><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e53e3e", marginBottom: 4 }}><span>Diskon {order.discount}%</span><span>−{fmt(order.discAmt)}</span></div>}
            {settings.taxRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 4 }}><span>Pajak {settings.taxRate}%</span><span>+{fmt(order.taxAmt || 0)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, color: "#1a365d", margin: "8px 0" }}><span>TOTAL</span><span>{fmt(order.total)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096" }}><span>Bayar</span><span>{fmt(order.pay)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#276749", fontWeight: 700 }}><span>Kembalian</span><span>{fmt(order.change)}</span></div>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#a0aec0", borderTop: "2px dashed #e2e8f0", paddingTop: 12 }}>
            ⭐ {settings.footerNote} ⭐
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={handlePrint} style={{ ...S.btn, flex: 1, background: "#276749", color: "#fff" }}>🖨️ Cetak Struk</button>
          <button onClick={onClose} style={{ ...S.btn, flex: 1, background: "#e2e8f0", color: "#4a5568" }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ── SCANNER MODAL (Kamera HP & Scanner Eksternal) ────────────────────────────
// mode: "produk" -> dipakai admin untuk input/cari barang via barcode (auto-close setelah 1 scan)
// mode: "kasir"  -> dipakai kasir/admin untuk menambah produk ke keranjang (tetap terbuka utk scan berulang)
function ScannerModal({ mode, onResult, onClose }) {
  const [scanMode, setScanMode] = useState("camera"); // "camera" | "external"
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [lastScanned, setLastScanned] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const externalInputRef = useRef(null);
  const detectorSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const handleDetected = (code) => {
    if (!code) return;
    playBeep();
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch {} }
    setLastScanned(code);
    onResult(code);
  };

  useEffect(() => {
    if (scanMode !== "camera") return;
    let cancelled = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Perangkat/browser ini tidak mendukung akses kamera.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (detectorSupported) {
          const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] });
          const loop = async () => {
            if (cancelled) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                handleDetected(codes[0].rawValue);
                if (mode === "produk") return; // auto-stop loop, modal akan ditutup oleh parent
              }
            } catch {}
            rafRef.current = requestAnimationFrame(loop);
          };
          rafRef.current = requestAnimationFrame(loop);
        }
      } catch (err) {
        setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan di browser.");
      }
    };
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  useEffect(() => {
    if (scanMode === "external" && externalInputRef.current) externalInputRef.current.focus();
  }, [scanMode]);

  const handleExternalSubmit = () => {
    if (!manualCode.trim()) return;
    handleDetected(manualCode.trim());
    setManualCode("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 420, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#1a365d" }}>
            {mode === "produk" ? "📷 Scan Barcode Produk" : "📷 Scan Produk ke Keranjang"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#a0aec0" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setScanMode("camera")} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: scanMode === "camera" ? "#2b6cb0" : "#e2e8f0", color: scanMode === "camera" ? "#fff" : "#4a5568" }}>📱 Kamera HP</button>
          <button onClick={() => setScanMode("external")} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: scanMode === "external" ? "#2b6cb0" : "#e2e8f0", color: scanMode === "external" ? "#fff" : "#4a5568" }}>🔌 Scanner Eksternal</button>
        </div>

        {scanMode === "camera" && (
          <div>
            <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "4 / 3" }}>
              <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 30, border: "3px solid rgba(66,153,225,0.75)", borderRadius: 10, pointerEvents: "none" }} />
            </div>
            {!detectorSupported && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#c05621", background: "#fffaf0", padding: "8px 10px", borderRadius: 8 }}>
                ⚠️ Browser ini belum mendukung pemindaian otomatis dari kamera. Gunakan Chrome terbaru di Android/Desktop, atau pakai tab "Scanner Eksternal".
              </div>
            )}
            {cameraError && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#c53030", background: "#fff5f5", padding: "8px 10px", borderRadius: 8 }}>⚠️ {cameraError}</div>
            )}
            {lastScanned && mode === "kasir" && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#276749", fontWeight: 600 }}>✅ Terakhir terdeteksi: {lastScanned}</div>
            )}
          </div>
        )}

        {scanMode === "external" && (
          <div>
            <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 10 }}>
              Arahkan scanner barcode eksternal (USB/Bluetooth) ke kolom di bawah ini lalu tembak barcode-nya — kode akan otomatis terbaca. Bisa juga diketik manual.
            </div>
            <input
              ref={externalInputRef}
              autoFocus
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleExternalSubmit(); } }}
              placeholder="Tembak barcode di sini..."
              style={{ ...S.inp, border: "2px solid #4299e1", fontSize: 16, padding: "12px 14px", marginBottom: 10 }}
            />
            <button onClick={handleExternalSubmit} style={{ ...S.btn, width: "100%", background: "#2b6cb0", color: "#fff" }}>✅ Gunakan Kode</button>
            {lastScanned && mode === "kasir" && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#276749", fontWeight: 600 }}>✅ Terakhir ditambahkan: {lastScanned}</div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={onClose} style={{ ...S.btn, width: "100%", background: "#e2e8f0", color: "#4a5568" }}>
            {mode === "kasir" ? "Selesai Scan" : "Tutup"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QRIS PAYMENT MODAL ────────────────────────────────────────────────────────
function QrisModal({ settings, total, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 360, maxWidth: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#1a365d", marginBottom: 4 }}>📱 Pembayaran QRIS</div>
        <div style={{ fontSize: 13, color: "#718096", marginBottom: 16 }}>{settings.storeName}</div>
        {settings.qrImage ? (
          <img src={settings.qrImage} alt="QR Pembayaran" style={{ width: "100%", maxWidth: 260, borderRadius: 12, border: "1.5px solid #e2e8f0", marginBottom: 16 }} />
        ) : (
          <div style={{ padding: "40px 16px", background: "#fffaf0", borderRadius: 12, color: "#c05621", fontSize: 13, marginBottom: 16 }}>
            ⚠️ QR pembayaran belum diatur.<br />Silakan unggah QR Anda di menu Setting.
          </div>
        )}
        <div style={{ fontSize: 13, color: "#718096" }}>Total Tagihan</div>
        <div style={{ fontWeight: 800, fontSize: 26, color: "#1a365d", marginBottom: 18 }}>{fmt(total)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...S.btn, flex: 1, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>
          <button onClick={onConfirm} disabled={!settings.qrImage} style={{ ...S.btn, flex: 1, background: settings.qrImage ? "#276749" : "#cbd5e0", color: "#fff", cursor: settings.qrImage ? "pointer" : "not-allowed" }}>✅ Bayar Diterima</button>
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
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "Makanan", icon: "🛒", stock: "", minStock: "10", barcode: "" });
  const [newExpense, setNewExpense] = useState({ type: "pengeluaran", desc: "", amount: "", date: "" });
  const [editSettings, setEditSettings] = useState(settings);
  const [stockFilter, setStockFilter] = useState("semua");
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const [showAllReceipt, setShowAllReceipt] = useState(false);
  const [showScanner, setShowScanner] = useState(null); // null | "produk" | "kasir"
  const [showQris, setShowQris] = useState(false);
  const [nextOrderNumber, setNextOrderNumber] = useState(() => load("kk_order_counter", 1));

  useEffect(() => {
  supabase.from('outlets').select('*').then(({ data, error }) => {
    console.log('TEST KONEKSI SUPABASE:', data, error)
  })
}, [])

  // persist
  useEffect(() => { save("kk_user", user); }, [user]);
  useEffect(() => { save("kk_products", products); }, [products]);
  useEffect(() => { save("kk_orders", orders); }, [orders]);
  useEffect(() => { save("kk_expenses", expenses); }, [expenses]);
  useEffect(() => { save("kk_settings", settings); }, [settings]);
  useEffect(() => { save("kk_order_counter", nextOrderNumber); }, [nextOrderNumber]);

  const CATEGORIES = ["Semua", "Makanan", "Minuman", "Snack", "Lainnya"];

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
    const catOk = category === "Semua" || p.category === category;
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

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt  = Math.round(subtotal * (discount / 100));
  const taxAmt   = Math.round((subtotal - discAmt) * (settings.taxRate / 100));
  const total    = subtotal - discAmt + taxAmt;
  const kembalian = Math.max(0, Number(payAmount) - total);

  const handlePay = () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    if (Number(payAmount) < total) return showToast("Uang tidak cukup!", "error");
    const order = {
      id: Date.now(), orderNumber: nextOrderNumber, items: [...cart], subtotal, discount, discAmt, taxAmt, total,
      pay: Number(payAmount), change: kembalian, date: now(), cashierName: user.name,
    };
    setOrders(prev => [order, ...prev]);
    setNextOrderNumber(n => n + 1);
    // kurangi stok
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
    }));
    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0);
    showToast("Pembayaran berhasil! 🎉");
  };

  // ── PEMBAYARAN QRIS ──
  const handlePayQris = () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    if (!settings.qrImage) return showToast("QR pembayaran belum diatur di menu Setting!", "error");
    const order = {
      id: Date.now(), orderNumber: nextOrderNumber, items: [...cart], subtotal, discount, discAmt, taxAmt, total,
      pay: total, change: 0, date: now(), cashierName: user.name, paymentMethod: "QRIS",
    };
    setOrders(prev => [order, ...prev]);
    setNextOrderNumber(n => n + 1);
    // kurangi stok
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
    }));
    setShowQris(false);
    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0);
    showToast("Pembayaran QRIS berhasil! 🎉");
  };

  // ── HASIL SCAN BARCODE ──
  // mode "produk": isi/cari form produk (hanya dipanggil dari tab Produk, khusus admin)
  // mode "kasir" : cari produk lalu langsung masukkan ke keranjang
  const handleScanResult = (code) => {
    if (showScanner === "produk") {
      const existing = products.find(p => p.barcode && p.barcode === code);
      if (existing) {
        setEditProduct(existing);
        setNewProduct({ name: existing.name, price: String(existing.price), category: existing.category, icon: existing.icon, stock: String(existing.stock || 0), minStock: String(existing.minStock || 10), barcode: existing.barcode || code });
        showToast(`Produk ditemukan: ${existing.name}. Form diisi otomatis ✏️`);
      } else {
        setEditProduct(null);
        setNewProduct(p => ({ ...p, barcode: code }));
        showToast(`Barcode terdeteksi: ${code}`);
      }
      setShowScanner(null);
    } else if (showScanner === "kasir") {
      const found = products.find(p => p.barcode && p.barcode === code);
      if (found) {
        addToCart(found);
        showToast(`${found.icon} ${found.name} ditambahkan ke keranjang!`);
      } else {
        showToast(`Barcode "${code}" tidak ditemukan di database produk!`, "error");
      }
    }
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
    setNewProduct({ name: "", price: "", category: "Makanan", icon: "🛒", stock: "", minStock: "10", barcode: "" });
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

    // Sheet 1: Transaksi
    const txRows = orders.map(o => ({
      "No. Struk": "#" + orderNo(o), "Tanggal": o.date, "Kasir": o.cashierName || "-",
      "Item": o.items.map(i => `${i.name}(${i.qty})`).join(", "),
      "Subtotal": o.subtotal, "Diskon": o.discAmt, "Pajak": o.taxAmt || 0, "Total": o.total,
      "Bayar": o.pay, "Kembalian": o.change,
    }));
    const wsTransaksi = XLSX.utils.json_to_sheet(txRows);
    wsTransaksi["!cols"] = autoFitColumns(txRows, [4, 5, 6, 7, 8, 9]); // Subtotal, Diskon, Pajak, Total, Bayar, Kembalian
    applyRupiahFormat(wsTransaksi, ["E", "F", "G", "H", "I", "J"], 2, txRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsTransaksi, "Transaksi");

    // Sheet 2: Keuangan
    const expRows = expenses.map(e => ({
      "Tanggal": e.date, "Jenis": e.type === "pengeluaran" ? "Pengeluaran" : "Pendapatan Lain",
      "Deskripsi": e.desc, "Jumlah": e.type === "pengeluaran" ? -e.amount : e.amount,
    }));
    const wsKeuangan = XLSX.utils.json_to_sheet(expRows);
    wsKeuangan["!cols"] = autoFitColumns(expRows, [3]); // Jumlah
    applyRupiahFormat(wsKeuangan, ["D"], 2, expRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsKeuangan, "Keuangan");

    // Sheet 3: Stok
    const stockRows = products.map(p => ({
      "Produk": p.name, "Kategori": p.category, "Harga": p.price,
      "Stok": p.stock || 0, "Min. Stok": p.minStock || 0,
      "Status": (p.stock || 0) <= (p.minStock || 0) ? "⚠️ Menipis" : "✅ Aman",
    }));
    const wsStok = XLSX.utils.json_to_sheet(stockRows);
    wsStok["!cols"] = autoFitColumns(stockRows, [2]); // Harga
    applyRupiahFormat(wsStok, ["C"], 2, stockRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsStok, "Stok");

    // Sheet 4: Ringkasan
    const summary = [
      { "Keterangan": "Total Pendapatan Penjualan", "Jumlah": orders.reduce((s,o)=>s+o.total,0) },
      { "Keterangan": "Total Pendapatan Lain", "Jumlah": expenses.filter(e=>e.type==="pendapatan").reduce((s,e)=>s+e.amount,0) },
      { "Keterangan": "Total Pengeluaran", "Jumlah": totalExpenses },
      { "Keterangan": "Laba Bersih", "Jumlah": netProfit },
      { "Keterangan": "Total Transaksi", "Jumlah": orders.length },
    ];
    const wsRingkasan = XLSX.utils.json_to_sheet(summary);
    wsRingkasan["!cols"] = autoFitColumns(summary, [1]);
    // Kolom Jumlah diformat Rp, KECUALI baris terakhir (Total Transaksi) karena isinya jumlah transaksi, bukan nominal uang
    applyRupiahFormat(wsRingkasan, ["B"], 2, summary.length);
    XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");

    XLSX.writeFile(wb, `Laporan_Rasa nusantara.co_${new Date().toLocaleDateString("id-ID").replace(/\//g,"-")}.xlsx`);
    showToast("Laporan Excel berhasil diunduh! 📊");
  };

  // ── PRINT ALL RECEIPTS ──
  const printAllReceipts = () => {
    const filteredOrders = orders.filter(o => {
      if (!reportRange.from && !reportRange.to) return true;
      const d = new Date(o.id);
      const from = reportRange.from ? new Date(reportRange.from) : null;
      const to   = reportRange.to   ? new Date(reportRange.to + "T23:59:59") : null;
      return (!from || d >= from) && (!to || d <= to);
    });
    if (filteredOrders.length === 0) return showToast("Tidak ada data untuk dicetak!", "error");
    const rows = filteredOrders.map(o => `
      <tr>
        <td>#${orderNo(o)}</td>
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

  // ── STOK STATUS ──
  const getStockStatus = (p) => {
    const s = p.stock || 0, m = p.minStock || 0;
    if (s === 0) return { label: "Habis", color: "#e53e3e", bg: "#fff5f5" };
    if (s <= m)  return { label: "Menipis ⚠️", color: "#c05621", bg: "#fffaf0" };
    return { label: "Aman ✅", color: "#276749", bg: "#f0fff4" };
  };

  const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0));

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" }}>
      {/* TOAST */}
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

      {/* ── TAB: KASIR ── */}
      {tab === "kasir" && (
        <div className="kasir-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, height: "calc(100vh - 62px)" }}>
          {/* PANEL KIRI */}
          <div style={{ padding: 18, overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input placeholder="🔍 Cari produk..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none" }} />
              <button onClick={() => setShowScanner("kasir")} style={{ background: "#1a365d", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>📷 Scan</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, background: category === c ? "#2b6cb0" : "#e2e8f0", color: category === c ? "#fff" : "#4a5568", fontWeight: category === c ? 700 : 400 }}>{c}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {filtered.map(p => {
                const st = getStockStatus(p);
                const outOfStock = (p.stock || 0) === 0;
                return (
                  <div key={p.id} onClick={() => !outOfStock && addToCart(p)} style={{ background: outOfStock ? "#f7fafc" : "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", cursor: outOfStock ? "not-allowed" : "pointer", border: `1.5px solid ${outOfStock ? "#fed7d7" : "#e2e8f0"}`, opacity: outOfStock ? 0.65 : 1, transition: "transform .15s, box-shadow .15s", position: "relative" }}
                    onMouseEnter={e => { if (!outOfStock) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.1)"; }}}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                  >
                    {(p.stock || 0) <= (p.minStock || 0) && (p.stock || 0) > 0 && (
                      <div style={{ position: "absolute", top: 6, right: 6, fontSize: 12 }}>⚠️</div>
                    )}
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#2d3748", marginBottom: 3 }}>{p.name}</div>
                    <div style={{ color: "#2b6cb0", fontWeight: 700, fontSize: 13 }}>{fmt(p.price)}</div>
                    <div style={{ fontSize: 10, marginTop: 3, color: st.color, fontWeight: 600 }}>Stok: {p.stock || 0}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PANEL KANAN — Keranjang */}
          <div id="kasir-cart-section" className="kasir-cart-panel" style={{ background: "#fff", borderLeft: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column", height: "calc(100vh - 62px)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 15, color: "#1a365d" }}>
              🛒 Keranjang {cart.length > 0 && <span style={{ background: "#2b6cb0", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 12, marginLeft: 6 }}>{cart.reduce((s,i)=>s+i.qty,0)}</span>}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#a0aec0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
                  <div>Keranjang kosong</div>
                  <div style={{ fontSize: 12 }}>Pilih produk di sebelah kiri</div>
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
            {/* Bayar Panel */}
            <div className="kasir-pay-panel" style={{ padding: "12px 14px", borderTop: "1.5px solid #e2e8f0", background: "#f7fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13, color: "#4a5568" }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: "#4a5568" }}>Diskon</span>
                <input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))}
                  style={{ width: 48, padding: "3px 6px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <span style={{ fontSize: 12, color: "#e53e3e" }}>% −{fmt(discAmt)}</span>
              </div>
              {settings.taxRate > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13, color: "#718096" }}><span>Pajak {settings.taxRate}%</span><span>+{fmt(taxAmt)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "#1a365d", marginBottom: 8, paddingTop: 7, borderTop: "1px dashed #e2e8f0" }}>
                <span>TOTAL</span><span>{fmt(total)}</span>
              </div>
              <input type="number" placeholder="Nominal bayar (Rp)" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                style={{ ...S.inp, marginBottom: 7, border: "1.5px solid #90cdf4" }} />
              {payAmount && Number(payAmount) >= total && (
                <div style={{ color: "#276749", fontWeight: 600, fontSize: 13, marginBottom: 7 }}>💰 Kembalian: {fmt(kembalian)}</div>
              )}
              <button onClick={handlePay} style={{ width: "100%", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                💳 Proses Pembayaran
              </button>
              <button onClick={() => { if (cart.length === 0) return showToast("Keranjang kosong!", "error"); setShowQris(true); }} style={{ width: "100%", marginTop: 7, background: "#fff", color: "#1a365d", border: "1.5px solid #1a365d", borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                📱 Bayar dengan QRIS
              </button>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} style={{ width: "100%", marginTop: 6, background: "transparent", border: "1px solid #fc8181", color: "#e53e3e", borderRadius: 8, padding: "6px", fontSize: 12, cursor: "pointer" }}>
                  Kosongkan Keranjang
                </button>
              )}
            </div>
          </div>

          {/* Tombol melayang khusus HP — loncat cepat ke Keranjang (otomatis disembunyikan di layar lebar/desktop via CSS) */}
          <button
            className="kasir-mobile-cart-btn"
            onClick={() => document.getElementById("kasir-cart-section")?.scrollIntoView({ behavior: "smooth" })}
            style={{ position: "fixed", right: 16, bottom: 16, zIndex: 60, background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 30, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px rgba(43,108,176,.4)", alignItems: "center", gap: 8 }}
          >
            🛒 Keranjang
            {cart.length > 0 && <span style={{ background: "#fff", color: "#2b6cb0", borderRadius: 20, padding: "1px 8px", fontSize: 12, marginLeft: 4, fontWeight: 800 }}>{cart.reduce((s,i)=>s+i.qty,0)}</span>}
          </button>
        </div>
      )}

      {/* ── TAB: PRODUK (Admin Only) ── */}
      {tab === "produk" && canAdmin && (
        <div className="tab-page-wrap" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: "#1a365d" }}>{editProduct ? "✏️ Edit Produk" : "➕ Tambah Produk"}</div>
            <div className="form-grid-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 100px 100px", gap: 10 }}>
              <input placeholder="Nama produk" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} style={S.inp} />
              <input placeholder="Harga (Rp)" type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} style={S.inp} />
              <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} style={S.inp}>
                {["Makanan","Minuman","Snack","Lainnya"].map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Ikon" value={newProduct.icon} onChange={e => setNewProduct(p => ({ ...p, icon: e.target.value }))} style={{ ...S.inp, textAlign: "center", fontSize: 22 }} />
              <input placeholder="Stok" type="number" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} style={S.inp} />
              <input placeholder="Min. Stok" type="number" value={newProduct.minStock} onChange={e => setNewProduct(p => ({ ...p, minStock: e.target.value }))} style={S.inp} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <input placeholder="Barcode produk (scan otomatis atau ketik manual)" value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} style={{ ...S.inp, flex: 1 }} />
              <button onClick={() => setShowScanner("produk")} style={{ ...S.btn, background: "#1a365d", color: "#fff", whiteSpace: "nowrap" }}>📷 Scan Barcode</button>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={saveProduct} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>{editProduct ? "💾 Simpan Perubahan" : "➕ Tambah Produk"}</button>
              {editProduct && <button onClick={() => { setEditProduct(null); setNewProduct({ name: "", price: "", category: "Makanan", icon: "🛒", stock: "", minStock: "10", barcode: "" }); }} style={{ ...S.btn, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div className="data-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                  {["Produk","Kategori","Harga","Stok","Min. Stok","Status","Aksi"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const st = getStockStatus(p);
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #f0f4f8", background: i % 2 === 0 ? "#fff" : "#f7fafc" }}>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ marginRight: 8, fontSize: 17 }}>{p.icon}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span></td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.category}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#2b6cb0", fontSize: 13, whiteSpace: "nowrap" }}>{fmt(p.price)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{p.stock || 0}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#718096" }}>{p.minStock || 0}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ background: st.bg, color: st.color, padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.label}</span></td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(p)} style={{ ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0" }}>✏️ Edit</button>
                        <button onClick={() => deleteProduct(p.id)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Tampilan kartu khusus HP (otomatis disembunyikan di desktop via CSS) */}
            <div className="data-card-list">
              {products.map(p => {
                const st = getStockStatus(p);
                return (
                  <div key={p.id} style={{ padding: "14px 16px", borderBottom: "1px solid #f0f4f8" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#2d3748", wordBreak: "break-word" }}>{p.name}</div>
                          <span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.category}</span>
                        </div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{st.label}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: "#2b6cb0" }}>{fmt(p.price)}</span>
                      <span style={{ color: "#718096" }}>Stok: <strong style={{ color: "#2d3748" }}>{p.stock || 0}</strong> (min {p.minStock || 0})</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEdit(p)} style={{ ...S.smBtn, flex: 1, background: "#ebf8ff", color: "#2b6cb0", textAlign: "center" }}>✏️ Edit</button>
                      <button onClick={() => deleteProduct(p.id)} style={{ ...S.smBtn, flex: 1, background: "#fff5f5", color: "#e53e3e", textAlign: "center" }}>🗑️ Hapus</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: STOK ── */}
      {tab === "stok" && canAdmin && (
        <div className="tab-page-wrap" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          <div className="stat-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              ["📦 Total Produk", products.length, "#ebf8ff", "#2b6cb0"],
              ["⚠️ Stok Menipis", lowStockProducts.length, "#fffaf0", "#c05621"],
              ["✅ Stok Aman", products.filter(p => (p.stock||0) > (p.minStock||0)).length, "#f0fff4", "#276749"],
            ].map(([label, val, bg, color]) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 26, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["semua","Semua"],["menipis","⚠️ Menipis"],["habis","🚫 Habis"],["aman","✅ Aman"]].map(([v, l]) => (
              <button key={v} onClick={() => setStockFilter(v)} style={{ ...S.smBtn, background: stockFilter === v ? "#2b6cb0" : "#e2e8f0", color: stockFilter === v ? "#fff" : "#4a5568", padding: "7px 14px" }}>{l}</button>
            ))}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div className="data-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                  {["Produk","Kategori","Stok Saat Ini","Min. Stok","Status","Tambah Stok"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
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
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ marginRight: 8, fontSize: 17 }}>{p.icon}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span></td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.category}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 15, color: st.color }}>{p.stock || 0}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#718096" }}>{p.minStock || 0}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{st.label}</span></td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Tampilan kartu khusus HP (otomatis disembunyikan di desktop via CSS) */}
            <div className="data-card-list">
              {products.filter(p => {
                if (stockFilter === "menipis") return (p.stock||0) <= (p.minStock||0) && (p.stock||0) > 0;
                if (stockFilter === "habis")   return (p.stock||0) === 0;
                if (stockFilter === "aman")    return (p.stock||0) > (p.minStock||0);
                return true;
              }).map(p => {
                const st = getStockStatus(p);
                return (
                  <div key={p.id} style={{ padding: "14px 16px", borderBottom: "1px solid #f0f4f8", background: st.label === "Habis" ? "#fff5f5" : st.label.includes("Menipis") ? "#fffaf0" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#2d3748", wordBreak: "break-word" }}>{p.name}</div>
                          <span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.category}</span>
                        </div>
                      </div>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#718096", marginBottom: 10 }}>
                      Stok saat ini: <strong style={{ color: st.color, fontSize: 15 }}>{p.stock || 0}</strong> &nbsp;•&nbsp; Min: {p.minStock || 0}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input id={`stk-m-${p.id}`} type="number" placeholder="Jumlah" style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                      <button onClick={() => {
                        const inp = document.getElementById(`stk-m-${p.id}`);
                        const n = Number(inp.value);
                        if (!n || n <= 0) return showToast("Masukkan jumlah stok!", "error");
                        setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, stock: (pr.stock || 0) + n } : pr));
                        inp.value = "";
                        showToast(`Stok ${p.name} ditambah ${n}!`);
                      }} style={{ ...S.smBtn, background: "#276749", color: "#fff", whiteSpace: "nowrap" }}>+ Tambah</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: KEUANGAN ── */}
      {tab === "keuangan" && canAdmin && (
        <div className="tab-page-wrap" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          <div className="stat-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              ["💰 Total Pendapatan", fmt(totalIncome),   "#c6f6d5", "#276749"],
              ["💸 Total Pengeluaran",fmt(totalExpenses), "#fed7d7", "#c53030"],
              ["📊 Laba Bersih",      fmt(netProfit),     netProfit >= 0 ? "#ebf8ff" : "#fff5f5", netProfit >= 0 ? "#2b6cb0" : "#c53030"],
            ].map(([label, val, bg, color]) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 22, color }}>{val}</div>
              </div>
            ))}
          </div>
          {/* Form Tambah Catatan */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1a365d" }}>📝 Catat Transaksi Keuangan</div>
            <div className="form-grid-stack" style={{ display: "grid", gridTemplateColumns: "140px 1fr 160px 160px", gap: 10, marginBottom: 12 }}>
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
          {/* Daftar Catatan */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>📋 Riwayat Catatan Keuangan</div>
            {expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}><div style={{ fontSize: 40 }}>📝</div><div>Belum ada catatan</div></div>
            ) : expenses.map(e => (
              <div key={e.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid #f7fafc" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, wordBreak: "break-word" }}>{e.type === "pengeluaran" ? "💸" : "💰"} {e.desc}</div>
                  <div style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>{e.date}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: "auto" }}>
                  <div style={{ fontWeight: 700, color: e.type === "pengeluaran" ? "#e53e3e" : "#276749", fontSize: 15 }}>
                    {e.type === "pengeluaran" ? "−" : "+"}{fmt(e.amount)}
                  </div>
                  <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: RIWAYAT ── */}
      {tab === "riwayat" && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
          {canAdmin && (
            <div className="stat-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                ["💰 Total Pendapatan", fmt(orders.reduce((s,o)=>s+o.total,0)), "#c6f6d5", "#276749"],
                ["📋 Total Transaksi", orders.length, "#bee3f8", "#2b6cb0"],
                ["🧾 Rata-rata", orders.length ? fmt(orders.reduce((s,o)=>s+o.total,0)/orders.length) : "Rp 0", "#fefcbf", "#975a16"],
              ].map(([label, val, bg, color]) => (
                <div key={label} style={{ background: bg, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 22, color }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#a0aec0", background: "#fff", borderRadius: 14 }}>
              <div style={{ fontSize: 48 }}>📋</div><div>Belum ada transaksi</div>
            </div>
          ) : orders.map(o => (
            <div key={o.id} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 10, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a365d" }}>#{orderNo(o)}</div>
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

      {/* ── TAB: LAPORAN ── */}
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
                <div key={label} style={{ background: bg, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 12, color, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Top Produk */}
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

      {/* ── TAB: SETTING ── */}
      {tab === "setting" && canAdmin && (
        <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d", marginBottom: 20 }}>⚙️ Pengaturan Toko</div>
            {[
              ["storeName",    "Nama Toko",               "text",   "Rasa nusantara.co"],
              ["storeAddress", "Alamat Toko",              "text",   "Jl. Contoh No. 1"],
              ["storePhone",   "No. Telepon",              "text",   "08123456789"],
              ["taxRate",      "Pajak (%)",                "number", "0"],
              ["footerNote",   "Catatan di Struk",         "text",   "Terima kasih!"],
            ].map(([key, label, type, ph]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>{label}</label>
                <input type={type} placeholder={ph} value={editSettings[key]} onChange={e => setEditSettings(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} style={S.inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => { setSettings(editSettings); showToast("Pengaturan disimpan! ✅"); }} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>💾 Simpan Pengaturan</button>
              <button onClick={() => { if (window.confirm("Hapus semua data? Ini tidak bisa diurungkan!")) { setOrders([]); setExpenses([]); setProducts(INITIAL_PRODUCTS); setNextOrderNumber(1); showToast("Data direset!", "error"); }}} style={{ ...S.btn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Reset Semua Data</button>
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

          {/* QR PEMBAYARAN QRIS */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d", marginBottom: 6 }}>📱 QR Pembayaran (QRIS)</div>
            <div style={{ fontSize: 12, color: "#718096", marginBottom: 16 }}>Unggah gambar QR code milik Anda agar muncul saat pelanggan memilih pembayaran QRIS di kasir.</div>
            {editSettings.qrImage ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
                <img src={editSettings.qrImage} alt="QR Pembayaran" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 10, border: "1.5px solid #e2e8f0" }} />
                <div>
                  <div style={{ fontSize: 13, color: "#276749", fontWeight: 600, marginBottom: 8 }}>✅ QR aktif</div>
                  <button onClick={() => setEditSettings(p => ({ ...p, qrImage: "" }))} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus QR</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "16px 14px", background: "#fffaf0", color: "#c05621", fontSize: 13, borderRadius: 10, marginBottom: 14 }}>⚠️ Belum ada QR yang diunggah.</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setEditSettings(p => ({ ...p, qrImage: reader.result }));
                reader.readAsDataURL(file);
              }}
              style={{ fontSize: 13 }}
            />
            <div style={{ marginTop: 14 }}>
              <button onClick={() => { setSettings(editSettings); showToast("QR pembayaran disimpan! ✅"); }} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>💾 Simpan QR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL STRUK ── */}
      {showReceipt && <ReceiptModal order={showReceipt} settings={settings} onClose={() => setShowReceipt(null)} />}

      {/* ── MODAL SCANNER (Kamera HP / Scanner Eksternal) ── */}
      {showScanner && <ScannerModal mode={showScanner} onResult={handleScanResult} onClose={() => setShowScanner(null)} />}

      {/* ── MODAL QRIS ── */}
      {showQris && <QrisModal settings={settings} total={total} onConfirm={handlePayQris} onClose={() => setShowQris(false)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }

        /* ── Tampilan responsif tab Kasir di HP ── */
        .kasir-mobile-cart-btn { display: none; }
        .data-card-list { display: none; }
        @media (max-width: 860px) {
          .kasir-grid { grid-template-columns: 1fr !important; height: auto !important; }
          .kasir-cart-panel { height: auto !important; border-left: none !important; border-top: 1.5px solid #e2e8f0 !important; }
          .kasir-pay-panel { position: sticky !important; bottom: 0 !important; z-index: 20; box-shadow: 0 -4px 14px rgba(0,0,0,.08); }
          .kasir-mobile-cart-btn { display: flex !important; }
          .form-grid-stack { grid-template-columns: 1fr !important; }
          .stat-grid-3 { grid-template-columns: 1fr !important; }
          .tab-page-wrap { padding: 14px !important; }
          .data-table-wrap { display: none !important; }
          .data-card-list { display: block !important; }
        }
      `}</style>
    </div>
  );
}
