import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from './supabaseClient'

// ── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const now = () => new Date().toLocaleString("id-ID");

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

function autoFitColumns(rows, moneyCols = []) {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k, idx) => {
    let maxLen = String(k).length;
    rows.forEach(row => {
      const val = row[k];
      let len = val === null || val === undefined ? 0 : String(val).length;
      if (moneyCols.includes(idx) && typeof val === "number") len += 6;
      if (len > maxLen) maxLen = len;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
}

const RP_FORMAT = '"Rp"#,##0;[Red]-"Rp"#,##0';
function applyRupiahFormat(ws, colLetters, firstDataRow, lastDataRow) {
  colLetters.forEach(col => {
    for (let r = firstDataRow; r <= lastDataRow; r++) {
      const ref = `${col}${r}`;
      if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = RP_FORMAT;
    }
  });
}

const orderNo = (o) => (o && o.orderNumber) ? String(o.orderNumber).padStart(5, "0") : String(o.id).slice(-6);

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
  const [mode, setMode] = useState("login"); // "login" | "daftar"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setErr("Email dan password wajib diisi!");
      return;
    }
    setErr(""); setInfo("");
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error("Email atau password salah!");
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Data profil pengguna tidak ditemukan di tabel profiles!");
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error("Akun kamu belum diaktifkan oleh admin. Hubungi admin cabang/pusat ya.");
      }

      onLogin({
        id: authData.user.id,
        email: authData.user.email,
        name: profile.full_name || email.split('@')[0],
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

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setErr("Nama, email, dan password wajib diisi!");
      return;
    }
    if (password.length < 6) {
      setErr("Password minimal 6 karakter.");
      return;
    }
    setErr(""); setInfo("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(error.message);

      setInfo("Akun berhasil dibuat! Tunggu admin mengaktifkan akun kamu sebelum bisa login (biasanya diberi tahu langsung oleh admin cabang/pusat).");
      setMode("login");
      setPassword("");
    } catch (error) {
      console.error("Register Error:", error);
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: 360, boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏪</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: "#1a365d" }}>My Cashier</div>
          <div style={{ color: "#718096", fontSize: 13 }}>Terhubung ke Cloud Database</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#f7fafc", borderRadius: 10, padding: 4 }}>
          <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: mode === "login" ? "#2b6cb0" : "transparent", color: mode === "login" ? "#fff" : "#4a5568" }}>Masuk</button>
          <button onClick={() => { setMode("daftar"); setErr(""); setInfo(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: mode === "daftar" ? "#2b6cb0" : "transparent", color: mode === "daftar" ? "#fff" : "#4a5568" }}>Daftar Akun</button>
        </div>

        {err && <div style={{ background: "#fff5f5", color: "#c53030", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, border: "1px solid #fed7d7" }}>❌ {err}</div>}
        {info && <div style={{ background: "#f0fff4", color: "#276749", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, border: "1px solid #c6f6d5" }}>✅ {info}</div>}

        {mode === "daftar" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Nama Lengkap</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama kamu" style={S.inp} disabled={loading} />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#4a5568", display: "block", marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@rasanusantara.co"
            style={S.inp}
            onKeyDown={e => e.key === "Enter" && !loading && (mode === "login" ? handleLogin() : handleRegister())}
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
              onKeyDown={e => e.key === "Enter" && !loading && (mode === "login" ? handleLogin() : handleRegister())}
              disabled={loading}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>{showPw ? "🙈" : "👁️"}</button>
          </div>
        </div>

        {mode === "login" ? (
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...S.btn, width: "100%", background: loading ? "#a0aec0" : "#2b6cb0", color: "#fff", fontSize: 15, padding: 13, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "⏳ Memeriksa ke Cloud..." : "Masuk →"}
          </button>
        ) : (
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{ ...S.btn, width: "100%", background: loading ? "#a0aec0" : "#276749", color: "#fff", fontSize: 15, padding: 13, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "⏳ Membuat akun..." : "Daftar →"}
          </button>
        )}

        <div style={{ marginTop: 20, padding: "12px 14px", background: "#ebf8ff", borderRadius: 10, fontSize: 12, color: "#2c5282", textAlign: "center" }}>
          {mode === "login" ? (
            <>
              <div>🔒 Login diamankan oleh Supabase Auth</div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>Akun baru? Belum bisa masuk sampai diaktifkan admin.</div>
            </>
          ) : (
            <div>Akun yang baru daftar butuh persetujuan admin (cabang/pusat) sebelum bisa dipakai.</div>
          )}
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

// ── SCANNER MODAL ─────────────────────────────────────────────────────────────
function ScannerModal({ mode, onResult, onClose }) {
  const [scanMode, setScanMode] = useState("camera");
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
                if (mode === "produk") return;
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

// ── ADMIN DASHBOARD (MONITORING ABSENSI SEMUA CABANG) ─────────────────────────
function AdminDashboard() {
  const [data, setData] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCabang, setFilterCabang] = useState("Semua");

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    fetchAbsensi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCabang]);

  // ── REALTIME: dengarkan perubahan pada tabel attendance dari Supabase,
  // setiap ada absen masuk/pulang baru (dari cabang manapun) dashboard
  // ini langsung refresh datanya sendiri — tanpa perlu reload halaman.
  useEffect(() => {
    const channel = supabase
      .channel('realtime-attendance-monitoring')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => { fetchAbsensi(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCabang]);

  const fetchOutlets = async () => {
    const { data: outletData, error } = await supabase.from('outlets').select('id, name');
    if (!error && outletData) setOutlets(outletData);
  };

  const fetchAbsensi = async () => {
    setLoading(true);
    let query = supabase.from('monitoring_absensi').select('*');
    if (filterCabang !== "Semua") query = query.eq('nama_cabang', filterCabang);

    const { data: results, error } = await query.order('check_in_time', { ascending: false });
    if (!error) setData(results || []);
    setLoading(false);
  };

  return (
    <div className="tab-page-wrap" style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#1a365d" }}>📊 Dashboard Admin Pusat</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#c6f6d5", color: "#276749", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#276749", display: "inline-block", animation: "pulseDot 1.4s infinite" }} /> LIVE
          </span>
        </div>
        <select value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)} style={{ ...S.inp, width: 220 }}>
          <option value="Semua">Semua Cabang</option>
          {outlets.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>⏳ Memuat data...</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
            <div style={{ fontSize: 40 }}>📭</div>
            <div>Belum ada data absensi</div>
          </div>
        ) : (
          <>
            <div className="data-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                    {["Karyawan", "Cabang", "Jam Masuk", "Jam Pulang", "Durasi (Jam)"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.id} style={{ borderTop: "1px solid #f0f4f8", background: i % 2 === 0 ? "#fff" : "#f7fafc" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{row.nama_karyawan}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.nama_cabang}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap" }}>{row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString("id-ID") : "-"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap" }}>{row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString("id-ID") : "-"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#2b6cb0" }}>{row.durasi_jam ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="data-card-list">
              {data.map(row => (
                <div key={row.id} style={{ padding: "14px 16px", borderBottom: "1px solid #f0f4f8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2d3748" }}>{row.nama_karyawan}</div>
                    <span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{row.nama_cabang}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#718096" }}>
                    Masuk: <strong style={{ color: "#2d3748" }}>{row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString("id-ID") : "-"}</strong>
                    &nbsp;•&nbsp; Pulang: <strong style={{ color: "#2d3748" }}>{row.check_out_time ? new Date(row.check_out_time).toLocaleTimeString("id-ID") : "-"}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: "#2b6cb0", fontWeight: 700, marginTop: 4 }}>Durasi: {row.durasi_jam ?? "-"} jam</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── SHIFT MANAGEMENT (KELOLA JADWAL SHIFT & ASSIGN KE KARYAWAN) ──────────────
function ShiftManagement({ user }) {
  const isSuperAdmin = user.role === "admin"; // super_admin dipetakan jadi "admin" saat login
  const [outlets, setOutlets] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editShift, setEditShift] = useState(null);
  const [form, setForm] = useState({ name: "", jam_masuk: "08:00", jam_pulang: "16:00", toleransi_menit: "15", outlet_id: "" });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: outletData }, { data: shiftData }, { data: empData }] = await Promise.all([
      supabase.from('outlets').select('id, name'),
      supabase.from('shifts').select('*').order('jam_masuk', { ascending: true }),
      supabase.from('profiles').select('id, full_name, role, outlet_id, shift_id'),
    ]);
    setOutlets(outletData || []);
    setShifts(shiftData || []);
    setEmployees((empData || []).filter(e => e.role !== 'super_admin'));
    if (!isSuperAdmin && !form.outlet_id && user.outlet_id) {
      setForm(f => ({ ...f, outlet_id: user.outlet_id }));
    }
    setLoading(false);
  };

  const saveShift = async () => {
    if (!form.name || !form.jam_masuk || !form.jam_pulang) return showToast("Isi nama & jam shift!", "error");
    const outletId = isSuperAdmin ? form.outlet_id : user.outlet_id;
    if (!outletId) return showToast("Pilih cabang untuk shift ini!", "error");

    const payload = {
      name: form.name,
      jam_masuk: form.jam_masuk,
      jam_pulang: form.jam_pulang,
      toleransi_menit: Number(form.toleransi_menit || 0),
      outlet_id: outletId,
    };

    if (editShift) {
      const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id);
      if (error) return showToast("Gagal update shift: " + error.message, "error");
      showToast("Shift diperbarui!");
    } else {
      const { error } = await supabase.from('shifts').insert([payload]);
      if (error) return showToast("Gagal tambah shift: " + error.message, "error");
      showToast("Shift ditambahkan!");
    }
    setEditShift(null);
    setForm({ name: "", jam_masuk: "08:00", jam_pulang: "16:00", toleransi_menit: "15", outlet_id: isSuperAdmin ? "" : user.outlet_id });
    loadAll();
  };

  const startEditShift = (s) => {
    setEditShift(s);
    setForm({ name: s.name, jam_masuk: s.jam_masuk?.slice(0,5) || "08:00", jam_pulang: s.jam_pulang?.slice(0,5) || "16:00", toleransi_menit: String(s.toleransi_menit ?? 15), outlet_id: s.outlet_id || "" });
  };

  const deleteShift = async (id) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) return showToast("Gagal hapus shift (mungkin masih dipakai karyawan): " + error.message, "error");
    showToast("Shift dihapus!", "error");
    loadAll();
  };

  const assignShift = async (employeeId, shiftId) => {
    const { error } = await supabase.from('profiles').update({ shift_id: shiftId || null }).eq('id', employeeId);
    if (error) return showToast("Gagal assign shift: " + error.message, "error");
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, shift_id: shiftId || null } : e));
    showToast("Shift karyawan diperbarui!");
  };

  const outletName = (id) => outlets.find(o => o.id === id)?.name || "-";

  return (
    <div className="tab-page-wrap" style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "#fed7d7" : "#c6f6d5", color: toast.type === "error" ? "#c53030" : "#276749", padding: "10px 18px", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 14 }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {/* FORM TAMBAH/EDIT SHIFT */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: "#1a365d" }}>{editShift ? "✏️ Edit Shift" : "➕ Tambah Shift Baru"}</div>
        <div className="form-grid-stack" style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "1fr 140px 140px 110px" : "1fr 140px 140px 110px", gap: 10 }}>
          <input placeholder="Nama shift (contoh: Shift Pagi)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={S.inp} />
          <div>
            <label style={{ fontSize: 11, color: "#718096" }}>Jam Masuk</label>
            <input type="time" value={form.jam_masuk} onChange={e => setForm(f => ({ ...f, jam_masuk: e.target.value }))} style={S.inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#718096" }}>Jam Pulang</label>
            <input type="time" value={form.jam_pulang} onChange={e => setForm(f => ({ ...f, jam_pulang: e.target.value }))} style={S.inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#718096" }}>Toleransi (mnt)</label>
            <input type="number" min={0} value={form.toleransi_menit} onChange={e => setForm(f => ({ ...f, toleransi_menit: e.target.value }))} style={S.inp} />
          </div>
        </div>
        {isSuperAdmin && (
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: "#718096" }}>Cabang</label>
            <select value={form.outlet_id} onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))} style={S.inp}>
              <option value="">Pilih cabang...</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={saveShift} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>{editShift ? "💾 Simpan Perubahan" : "➕ Tambah Shift"}</button>
          {editShift && <button onClick={() => { setEditShift(null); setForm({ name: "", jam_masuk: "08:00", jam_pulang: "16:00", toleransi_menit: "15", outlet_id: isSuperAdmin ? "" : user.outlet_id }); }} style={{ ...S.btn, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>}
        </div>
      </div>

      {/* DAFTAR SHIFT */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>🕒 Daftar Shift</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>⏳ Memuat...</div>
        ) : shifts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>Belum ada shift dibuat.</div>
        ) : shifts.map(s => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #f7fafc", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "#718096" }}>
                {s.jam_masuk?.slice(0,5)} – {s.jam_pulang?.slice(0,5)} · Toleransi {s.toleransi_menit} mnt · {outletName(s.outlet_id)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => startEditShift(s)} style={{ ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0" }}>✏️ Edit</button>
              <button onClick={() => deleteShift(s.id)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus</button>
            </div>
          </div>
        ))}
      </div>

      {/* ASSIGN SHIFT KE KARYAWAN */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>👤 Atur Shift Karyawan</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>⏳ Memuat...</div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>Belum ada data karyawan.</div>
        ) : employees.map(emp => (
          <div key={emp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #f7fafc", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.full_name || "(tanpa nama)"}</div>
              <div style={{ fontSize: 12, color: "#718096" }}>{emp.role} · {outletName(emp.outlet_id)}</div>
            </div>
            <select
              value={emp.shift_id || ""}
              onChange={e => assignShift(emp.id, e.target.value)}
              style={{ ...S.inp, width: 220 }}
            >
              <option value="">Belum ada shift (default 08:00)</option>
              {shifts.filter(s => isSuperAdmin || s.outlet_id === emp.outlet_id).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.jam_masuk?.slice(0,5)}–{s.jam_pulang?.slice(0,5)})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MARGIN PRODUK (READ-ONLY — HPP HANYA BISA DIUBAH LANGSUNG DI SUPABASE) ───
function MarginProdukSection() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => { fetchMargin(); }, []);

  const fetchMargin = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('product_margin')
      .select('*')
      .order('margin_persen', { ascending: true });
    if (error) { setErrored(true); setLoading(false); return; }
    setData(rows || []);
    setErrored(false);
    setLoading(false);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a365d" }}>💰 Margin Produk (HPP)</div>
        <span style={{ fontSize: 11, color: "#a0aec0" }}>🔒 HPP hanya bisa diubah langsung di Supabase</span>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "#a0aec0" }}>⏳ Memuat...</div>
      ) : errored ? (
        <div style={{ padding: "14px 16px", background: "#fffaf0", color: "#c05621", fontSize: 13, borderRadius: 10 }}>
          ⚠️ Belum bisa memuat data margin. Pastikan tabel <code>product_costs</code> & view <code>product_margin</code> sudah dibuat di Supabase (lihat 07_hpp_product_cost.sql).
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: "14px 16px", background: "#ebf8ff", color: "#2c5282", fontSize: 13, borderRadius: 10 }}>
          ℹ️ Belum ada HPP yang diisi untuk produk manapun. Isi kolom "hpp" di tabel <code>product_costs</code> lewat Supabase Table Editor.
        </div>
      ) : (
        <div className="data-table-wrap" style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                {["Produk","Harga Jual","HPP","Laba Kotor","Margin"].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const tipis = row.margin_persen < 20;
                return (
                  <tr key={row.product_id} style={{ borderTop: "1px solid #f0f4f8", background: tipis ? "#fffaf0" : i % 2 === 0 ? "#fff" : "#f7fafc" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: 13 }}>{row.nama_produk}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{fmt(row.harga_jual)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: "#718096" }}>{fmt(row.hpp)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: row.laba_kotor >= 0 ? "#276749" : "#c53030" }}>{fmt(row.laba_kotor)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: tipis ? "#c05621" : "#276749" }}>{row.margin_persen}% {tipis ? "⚠️" : ""}</td>
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

// ── AUDIT LOG (READ-ONLY — dicatat otomatis oleh trigger di Supabase) ────────
function AuditLogSection() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, actor:actor_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    const channel = supabase.channel('realtime-audit-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => fetchLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const actionLabel = (a) => ({
    NONAKTIFKAN_PRODUK: "🚫 Nonaktifkan produk",
    AKTIFKAN_PRODUK: "✅ Aktifkan produk",
    UBAH_HARGA: "✏️ Ubah harga",
    UBAH_ROLE: "🔑 Ubah peran user",
    AKTIFKAN_USER: "✅ Aktifkan user",
    NONAKTIFKAN_USER: "🚫 Nonaktifkan user",
    PINDAH_CABANG: "🏬 Pindah cabang",
    STOCK_TRANSFER_DITERIMA: "🔀 Mutasi stok diterima",
    STOCK_TRANSFER_DITOLAK: "🔀 Mutasi stok ditolak",
  }[a] || a);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", marginTop: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a365d", marginBottom: 10 }}>🧾 Audit Log (50 terbaru)</div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "#a0aec0" }}>⏳ Memuat...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#a0aec0" }}>Belum ada aktivitas tercatat.</div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {logs.map(l => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #f7fafc", fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{actionLabel(l.action)}</span>
                <span style={{ color: "#718096" }}> — {l.actor?.full_name || "sistem"}</span>
                {l.detail && <div style={{ fontSize: 11, color: "#a0aec0" }}>{JSON.stringify(l.detail)}</div>}
              </div>
              <div style={{ color: "#a0aec0", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("id-ID")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── USER MANAGEMENT (approval akun baru + kelola karyawan) ───────────────────
function UserManagement({ user, isSuperAdmin, outletsList }) {
  const [profilesList, setProfilesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [assignDraft, setAssignDraft] = useState({});

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { loadProfiles(); }, []);

  useEffect(() => {
    const channel = supabase.channel('realtime-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadProfiles())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error) setProfilesList(data || []);
    setLoading(false);
  };

  const outletName = (id) => outletsList.find(o => o.id === id)?.name || "-";
  const pending = profilesList.filter(p => !p.is_active);
  const active = profilesList.filter(p => p.is_active);

  const approveUser = async (profileId) => {
    const draft = assignDraft[profileId] || {};
    if (!draft.outlet_id || !draft.role) return showToast("Pilih cabang & peran dulu!", "error");
    const { error } = await supabase.from('profiles').update({ outlet_id: draft.outlet_id, role: draft.role, is_active: true }).eq('id', profileId);
    if (error) return showToast("Gagal aktivasi: " + error.message, "error");
    showToast("Karyawan diaktifkan!");
    loadProfiles();
  };

  const toggleActive = async (p) => {
    const { error } = await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) return showToast("Gagal update: " + error.message, "error");
    showToast(p.is_active ? "User dinonaktifkan" : "User diaktifkan");
    loadProfiles();
  };

  const changeRole = async (p, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', p.id);
    if (error) return showToast("Gagal ubah role: " + error.message, "error");
    showToast("Role diperbarui!");
    loadProfiles();
  };

  const changeOutlet = async (p, newOutletId) => {
    const { error } = await supabase.from('profiles').update({ outlet_id: newOutletId || null }).eq('id', p.id);
    if (error) return showToast("Gagal pindah cabang: " + error.message, "error");
    showToast("Cabang diperbarui!");
    loadProfiles();
  };

  return (
    <div className="tab-page-wrap" style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "error" ? "#fed7d7" : "#c6f6d5", color: toast.type === "error" ? "#c53030" : "#276749", padding: "10px 18px", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontSize: 14 }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {isSuperAdmin && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>
            ⏳ Menunggu Aktivasi {pending.length > 0 && <span style={{ background: "#e53e3e", color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 12, marginLeft: 6 }}>{pending.length}</span>}
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "#a0aec0" }}>⏳ Memuat...</div>
          ) : pending.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#a0aec0" }}>Tidak ada akun baru yang menunggu.</div>
          ) : pending.map(p => (
            <div key={p.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid #f7fafc" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={assignDraft[p.id]?.outlet_id || ""} onChange={e => setAssignDraft(d => ({ ...d, [p.id]: { ...d[p.id], outlet_id: e.target.value } }))} style={{ ...S.inp, width: 180 }}>
                  <option value="">Pilih cabang</option>
                  {outletsList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select value={assignDraft[p.id]?.role || "kasir"} onChange={e => setAssignDraft(d => ({ ...d, [p.id]: { ...d[p.id], role: e.target.value } }))} style={{ ...S.inp, width: 150 }}>
                  <option value="kasir">Kasir</option>
                  <option value="admin_cabang">Admin Cabang</option>
                </select>
                <button onClick={() => approveUser(p.id)} style={{ ...S.smBtn, background: "#276749", color: "#fff" }}>✅ Aktifkan</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>👥 Karyawan Aktif</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24, color: "#a0aec0" }}>⏳ Memuat...</div>
        ) : active.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#a0aec0" }}>Belum ada karyawan aktif.</div>
        ) : active.map(p => (
          <div key={p.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid #f7fafc" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name} {p.id === user.id && <span style={{ fontSize: 11, color: "#a0aec0" }}>(kamu)</span>}</div>
              <div style={{ fontSize: 12, color: "#718096" }}>{outletName(p.outlet_id)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {isSuperAdmin ? (
                <>
                  <select value={p.outlet_id || ""} onChange={e => changeOutlet(p, e.target.value)} style={{ ...S.inp, width: 170 }}>
                    <option value="">- (tanpa cabang) -</option>
                    {outletsList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select value={p.role} onChange={e => changeRole(p, e.target.value)} style={{ ...S.inp, width: 140 }}>
                    <option value="kasir">Kasir</option>
                    <option value="admin_cabang">Admin Cabang</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </>
              ) : (
                <span style={{ background: "#bee3f8", color: "#2b6cb0", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.role}</span>
              )}
              {p.id !== user.id && (
                <button onClick={() => toggleActive(p)} style={{ ...S.smBtn, background: p.is_active ? "#fff5f5" : "#f0fff4", color: p.is_active ? "#e53e3e" : "#276749" }}>
                  {p.is_active ? "🚫 Nonaktifkan" : "✅ Aktifkan"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#a0aec0" }}>
        💡 Karyawan baru mendaftar sendiri lewat halaman "Daftar Akun" di layar login. Akunnya otomatis masuk ke "Menunggu Aktivasi" (khusus super_admin) untuk ditugaskan ke cabang & peran.
      </div>
    </div>
  );
}

// ── MUTASI STOK ANTAR CABANG ──────────────────────────────────────────────────
function StockTransferPanel({ user, isSuperAdmin, activeOutletId, outletsList, products, showToast }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ direction: "masuk", otherOutletId: "", productId: "", qty: "" });

  const fetchTransfers = async () => {
    if (!activeOutletId) { setTransfers([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from('stock_transfers')
      .select('*, product:product_id(name, icon), from_outlet:from_outlet_id(name), to_outlet:to_outlet_id(name)')
      .order('created_at', { ascending: false });
    if (!isSuperAdmin) query = query.or(`from_outlet_id.eq.${activeOutletId},to_outlet_id.eq.${activeOutletId}`);
    const { data, error } = await query;
    if (!error) setTransfers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransfers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeOutletId]);

  useEffect(() => {
    if (!activeOutletId) return;
    const channel = supabase.channel('realtime-stock-transfers-' + activeOutletId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transfers' }, () => fetchTransfers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutletId]);

  const submitRequest = async () => {
    if (!form.otherOutletId || !form.productId || !form.qty) return showToast("Lengkapi form dulu!", "error");
    const qty = Number(form.qty);
    if (qty <= 0) return showToast("Jumlah harus lebih dari 0", "error");

    const payload = form.direction === "masuk"
      ? { from_outlet_id: form.otherOutletId, to_outlet_id: activeOutletId, product_id: form.productId, qty, requested_by: user.id }
      : { from_outlet_id: activeOutletId, to_outlet_id: form.otherOutletId, product_id: form.productId, qty, requested_by: user.id };

    const { error } = await supabase.from('stock_transfers').insert([payload]);
    if (error) return showToast("Gagal ajukan mutasi: " + error.message, "error");
    showToast("Mutasi stok diajukan!");
    setForm({ direction: "masuk", otherOutletId: "", productId: "", qty: "" });
    fetchTransfers();
  };

  const resolve = async (id, approve) => {
    const { error } = await supabase.rpc('resolve_stock_transfer', { p_transfer_id: id, p_approve: approve });
    if (error) return showToast("Gagal proses: " + error.message, "error");
    showToast(approve ? "Mutasi disetujui & stok dipindahkan!" : "Mutasi ditolak.");
    fetchTransfers();
  };

  const statusBadge = (s) => {
    if (s === "pending") return { label: "⏳ Pending", bg: "#fffaf0", color: "#c05621" };
    if (s === "diterima") return { label: "✅ Diterima", bg: "#f0fff4", color: "#276749" };
    return { label: "❌ Ditolak", bg: "#fff5f5", color: "#c53030" };
  };

  return (
    <div className="tab-page-wrap" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: "#1a365d" }}>🔀 Ajukan Mutasi Stok</div>
        <div className="form-grid-stack" style={{ display: "grid", gridTemplateColumns: "170px 1fr 1fr 100px", gap: 10 }}>
          <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} style={S.inp} disabled={!isSuperAdmin}>
            <option value="masuk">Minta dari cabang lain</option>
            {isSuperAdmin && <option value="keluar">Kirim ke cabang lain</option>}
          </select>
          <select value={form.otherOutletId} onChange={e => setForm(f => ({ ...f, otherOutletId: e.target.value }))} style={S.inp}>
            <option value="">Pilih cabang...</option>
            {outletsList.filter(o => o.id !== activeOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} style={S.inp}>
            <option value="">Pilih produk...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
          </select>
          <input type="number" placeholder="Qty" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={S.inp} />
        </div>
        {!isSuperAdmin && <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 6 }}>Sebagai Admin Cabang, kamu hanya bisa mengajukan permintaan stok — persetujuan dilakukan oleh Admin Pusat.</div>}
        <button onClick={submitRequest} style={{ ...S.btn, background: "#2b6cb0", color: "#fff", marginTop: 12 }}>➕ Ajukan Mutasi</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>📋 Riwayat Mutasi</div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>⏳ Memuat...</div>
        ) : transfers.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>Belum ada mutasi stok.</div>
        ) : transfers.map(t => {
          const st = statusBadge(t.status);
          return (
            <div key={t.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid #f7fafc" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.product?.icon} {t.product?.name} × {t.qty}</div>
                <div style={{ fontSize: 12, color: "#718096" }}>{t.from_outlet?.name} → {t.to_outlet?.name}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                {t.status === "pending" && isSuperAdmin && (
                  <>
                    <button onClick={() => resolve(t.id, true)} style={{ ...S.smBtn, background: "#276749", color: "#fff" }}>✅ Setujui</button>
                    <button onClick={() => resolve(t.id, false)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>❌ Tolak</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function KasirApp() {
  const [user, setUser]             = useState(() => load("kk_user", null));
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [products, setProducts]     = useState([]); // sumber: Supabase (products + outlet_stock)
  const [productsLoading, setProductsLoading] = useState(true);
  const [categories, setCategories] = useState([]); // dari tabel categories di Supabase
  const [outletsList, setOutletsList] = useState([]); // untuk super_admin pilih cabang
  const [selectedOutletId, setSelectedOutletId] = useState(""); // cabang aktif yg sedang dikelola super_admin
  const [orders, setOrders]         = useState([]); // sumber: Supabase (orders + order_items)
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [expenses, setExpenses]     = useState([]); // sumber: Supabase (expenses)
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [settings, setSettings]     = useState(INITIAL_SETTINGS); // sumber: Supabase (outlets)
  const [cart, setCart]             = useState([]);
  const [category, setCategory]     = useState("Semua");
  const [search, setSearch]         = useState("");
  const [discount, setDiscount]     = useState(0);
  const [payAmount, setPayAmount]   = useState("");
  const [tab, setTab]               = useState("kasir");
  const [showReceipt, setShowReceipt] = useState(null);
  const [toast, setToast]           = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category_id: "", icon: "🛒", stock: "", minStock: "10", barcode: "" });
  const [newExpense, setNewExpense] = useState({ type: "pengeluaran", desc: "", amount: "", date: "" });
  const [editSettings, setEditSettings] = useState(settings);
  const [stockFilter, setStockFilter] = useState("semua");
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const [showScanner, setShowScanner] = useState(null);
  const [showQris, setShowQris] = useState(false);
  const [nextOrderNumber, setNextOrderNumber] = useState(1); // fallback saja — nomor asli dari Supabase
  const [currentTime, setCurrentTime] = useState(new Date());

  // Jam real-time di header (satu-satunya interval, tidak dobel)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // persist (hanya sesi login yang di-persist lokal; produk/stok/order/
  // keuangan/setting semuanya sumber kebenarannya Supabase sekarang)
  useEffect(() => { save("kk_user", user); }, [user]);

  // Sinkronkan editSettings tiap kali settings (hasil fetch Supabase) berubah
  useEffect(() => { setEditSettings(settings); }, [settings]);

  // Cabang yang sedang "aktif" untuk operasi produk/stok:
  // - admin_cabang & kasir: selalu outlet mereka sendiri
  // - super_admin: bebas pilih lewat dropdown (selectedOutletId)
  const activeOutletId = user?.role === "admin" ? selectedOutletId : user?.outlet_id;

  // Ambil daftar kategori & daftar cabang sekali di awal (dipakai form Produk)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: cats } = await supabase.from('categories').select('id, name').order('name');
      setCategories(cats || []);
      const { data: outs } = await supabase.from('outlets').select('id, name').eq('is_active', true).order('name');
      setOutletsList(outs || []);
    })();
  }, [user?.id]);

  // Super_admin: begitu daftar cabang datang, otomatis pilih cabang pertama
  useEffect(() => {
    if (user?.role === "admin" && !selectedOutletId && outletsList.length > 0) {
      setSelectedOutletId(outletsList[0].id);
    }
  }, [user?.role, outletsList, selectedOutletId]);

  // Ambil katalog produk pusat + gabungkan dengan stok cabang aktif
  const fetchProducts = async () => {
    if (!user || !activeOutletId) { setProducts([]); setProductsLoading(false); return; }
    setProductsLoading(true);

    const { data: prodRows, error: prodErr } = await supabase
      .from('products')
      .select('id, name, category_id, price, icon, barcode, is_active, categories(name)')
      .eq('is_active', true)
      .order('name');

    if (prodErr) { console.error(prodErr); showToast("Gagal memuat produk: " + prodErr.message, "error"); setProductsLoading(false); return; }

    const { data: stockRows, error: stockErr } = await supabase
      .from('outlet_stock')
      .select('product_id, stock, min_stock')
      .eq('outlet_id', activeOutletId);

    if (stockErr) console.error(stockErr);

    const stockMap = {};
    (stockRows || []).forEach(s => { stockMap[s.product_id] = s; });

    const merged = (prodRows || []).map(p => ({
      id: p.id,
      name: p.name,
      category_id: p.category_id,
      category: p.categories?.name || "Lainnya",
      price: Number(p.price),
      icon: p.icon || "🛒",
      barcode: p.barcode || "",
      stock: stockMap[p.id]?.stock ?? 0,
      minStock: stockMap[p.id]?.min_stock ?? 10,
    }));

    setProducts(merged);
    setProductsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeOutletId]);

  // Realtime: kalau ada perubahan produk/stok (dari cabang lain, atau kamu
  // edit langsung di Supabase), daftar produk di aplikasi otomatis refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime-products-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outlet_stock' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeOutletId]);

  // Sinkronkan settings toko (nama/alamat/telp/pajak/footer/QR) dari
  // Supabase (outlets) — sumber kebenarannya sekarang di sana, bukan
  // localStorage lagi. Dipakai juga sebagai preview total di keranjang
  // biar match dengan yang dihitung server saat create_order dipanggil.
  const fetchOutletSettings = async () => {
    if (!activeOutletId) return;
    const { data } = await supabase
      .from('outlets')
      .select('name, address, phone, tax_rate, footer_note, qr_image_url')
      .eq('id', activeOutletId)
      .single();
    if (data) {
      setSettings({
        storeName: data.name || "",
        storeAddress: data.address || "",
        storePhone: data.phone || "",
        taxRate: Number(data.tax_rate) || 0,
        footerNote: data.footer_note || "",
        qrImage: data.qr_image_url || "",
      });
    }
  };
  useEffect(() => { fetchOutletSettings(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeOutletId]);

  // Riwayat transaksi (orders + order_items) dari Supabase, per cabang aktif
  const fetchOrders = async () => {
    if (!activeOutletId) { setOrders([]); setOrdersLoading(false); return; }
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), cashier:cashier_id(full_name)')
      .eq('outlet_id', activeOutletId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { console.error(error); setOrdersLoading(false); return; }
    const mapped = (data || []).map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      items: (o.order_items || []).map(it => ({ id: it.product_id, name: it.name_snapshot, icon: it.icon_snapshot || "🛒", price: Number(it.price_snapshot), qty: it.qty })),
      subtotal: Number(o.subtotal),
      discount: Number(o.discount_pct),
      discAmt: Number(o.discount_amt),
      taxAmt: Number(o.tax_amt),
      total: Number(o.total),
      pay: Number(o.pay_amount),
      change: Number(o.change_amount),
      date: new Date(o.created_at).toLocaleString("id-ID"),
      cashierName: o.cashier?.full_name || "-",
      paymentMethod: o.payment_method,
    }));
    setOrders(mapped);
    setOrdersLoading(false);
  };
  useEffect(() => { fetchOrders(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeOutletId]);
  useEffect(() => {
    if (!activeOutletId) return;
    const channel = supabase
      .channel('realtime-orders-' + activeOutletId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${activeOutletId}` }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutletId]);

  // Keuangan (expenses) dari Supabase, per cabang aktif
  const fetchExpenses = async () => {
    if (!activeOutletId) { setExpenses([]); setExpensesLoading(false); return; }
    setExpensesLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('outlet_id', activeOutletId)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); setExpensesLoading(false); return; }
    setExpenses((data || []).map(e => ({
      id: e.id,
      type: e.type,
      desc: e.description,
      amount: Number(e.amount),
      date: e.expense_date ? new Date(e.expense_date).toLocaleDateString("id-ID") : new Date(e.created_at).toLocaleString("id-ID"),
    })));
    setExpensesLoading(false);
  };
  useEffect(() => { fetchExpenses(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeOutletId]);
  useEffect(() => {
    if (!activeOutletId) return;
    const channel = supabase
      .channel('realtime-expenses-' + activeOutletId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `outlet_id=eq.${activeOutletId}` }, () => fetchExpenses())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutletId]);

  const todayStr = () => new Date().toISOString().split('T')[0];

  // Cek status absensi hari ini setiap kali user login/refresh
  // — ini yang mencegah status ke-reset saat refresh halaman.
  // Sumber kebenaran = Supabase, localStorage hanya cache tampilan.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const cached = load(`kk_attendance_${user.id}_${todayStr()}`, null);
    if (cached) setAttendanceStatus(cached);

    (async () => {
      const today = todayStr();
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!error) {
        setAttendanceStatus(data || null);
        save(`kk_attendance_${user.id}_${today}`, data || null);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const CATEGORIES = ["Semua", ...categories.map(c => c.name)];

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  if (!user) return <LoginPage onLogin={u => { setUser(u); setTab("kasir"); }} />;

  const isSuperAdmin = user.role === "admin"; // super_admin dipetakan jadi "admin" saat login
  const isAdminCabang = user.role === "admin_cabang";
  const canManage = isSuperAdmin || isAdminCabang; // kelola cabang: Produk, Stok, Keuangan, Laporan, Shift, Mutasi Stok, Setting, User
  const canAdmin = isSuperAdmin; // khusus lintas-cabang: Monitoring

  const TABS = canManage
    ? [
        ["kasir","🛒","Kasir"],["produk","📦","Produk"],["stok","📊","Stok"],
        ["mutasi","🔀","Mutasi Stok"],["keuangan","💰","Keuangan"],["riwayat","📋","Riwayat"],
        ["laporan","📈","Laporan"],
        ...(isSuperAdmin ? [["monitoring","🧭","Monitoring"]] : []),
        ["shift","🕒","Shift"],
        ...(isSuperAdmin ? [["user","👤","User"]] : []),
        ["setting","⚙️","Setting"],
      ]
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

  // Checkout SEKARANG lewat RPC atomic `create_order` (dari 02_functions.sql):
  // nomor struk + insert order + insert order_items + potong stok terjadi
  // dalam satu transaksi database. Kalau stok tidak cukup atau uang kurang,
  // function ini akan menolak (raise exception) sebelum apa pun tersimpan —
  // jadi tidak mungkin data setengah-jadi.
  const processPayment = async ({ paymentMethod, payAmountValue }) => {
    if (cart.length === 0) { showToast("Keranjang kosong!", "error"); return null; }
    if (!activeOutletId) { showToast("Outlet tidak diketahui, silakan login ulang.", "error"); return null; }

    const items = cart.map(i => ({ product_id: i.id, qty: i.qty }));

    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_outlet_id: activeOutletId,
      p_cashier_id: user.id,
      p_items: items,
      p_discount_pct: discount,
      p_payment_method: paymentMethod,
      p_pay_amount: payAmountValue,
    });

    if (error) {
      // Pesan dari raise exception di SQL (mis. "Stok X tidak cukup di cabang ini")
      // akan muncul apa adanya di error.message.
      showToast("Gagal memproses pembayaran: " + error.message, "error");
      return null;
    }

    // Ambil data final dari database (nomor struk, subtotal, pajak, dst sudah
    // dihitung server-side sesuai outlets.tax_rate — bisa saja beda tipis dari
    // preview lokal kalau tax_rate di Supabase belum sinkron).
    const { data: savedOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();

    const order = {
      id: orderId,
      orderNumber: savedOrder?.order_number ?? nextOrderNumber,
      items: [...cart],
      subtotal: savedOrder?.subtotal ?? subtotal,
      discount,
      discAmt: savedOrder?.discount_amt ?? discAmt,
      taxAmt: savedOrder?.tax_amt ?? taxAmt,
      total: savedOrder?.total ?? total,
      pay: savedOrder?.pay_amount ?? payAmountValue,
      change: savedOrder?.change_amount ?? Math.max(0, payAmountValue - total),
      date: now(),
      cashierName: user.name,
      ...(paymentMethod === "QRIS" ? { paymentMethod: "QRIS" } : {}),
    };

    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.id === p.id);
      if (!cartItem) return p;
      return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.qty) };
    }));
    fetchProducts(); // sinkronkan ulang dengan angka stok asli dari Supabase
    fetchOrders();    // riwayat & laporan langsung ikut update (realtime juga akan trigger ini)
    return order;
  };

  const handlePay = async () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    if (Number(payAmount) < total) return showToast("Uang tidak cukup!", "error");
    const order = await processPayment({ paymentMethod: "Tunai", payAmountValue: Number(payAmount) });
    if (!order) return;
    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0);
    showToast("Pembayaran berhasil! 🎉");
  };

  const handlePayQris = async () => {
    if (cart.length === 0) return showToast("Keranjang kosong!", "error");
    if (!settings.qrImage) return showToast("QR pembayaran belum diatur di menu Setting!", "error");
    const order = await processPayment({ paymentMethod: "QRIS", payAmountValue: total });
    if (!order) return;
    setShowQris(false);
    setShowReceipt(order);
    setCart([]); setPayAmount(""); setDiscount(0);
    showToast("Pembayaran QRIS berhasil! 🎉");
  };

  // ── ABSENSI: satu akun hanya bisa absen masuk 1x/hari,
  // absen pulang hanya bisa jika sudah absen masuk & belum absen pulang ──
  const handleAbsensi = async () => {
    if (attendanceStatus) {
      return showToast("Anda sudah absen masuk hari ini!", "error");
    }

    const nowTime = new Date();

    // is_late & status_label TIDAK dihitung di sini lagi — trigger
    // "calculate_attendance_status" di Supabase yang menentukan otomatis
    // berdasarkan shift yang di-assign ke karyawan ini (lihat tab Shift).
    const attendanceData = {
      user_id: user.id,
      outlet_id: user.outlet_id,
      check_in_time: nowTime.toISOString(),
    };

    const { data, error } = await supabase
      .from('attendance')
      .insert([attendanceData])
      .select()
      .single();

    if (error) {
      showToast("Gagal absensi: " + error.message, "error");
    } else {
      setAttendanceStatus(data);
      save(`kk_attendance_${user.id}_${todayStr()}`, data);
      showToast(`Berhasil Absensi! Status: ${data.status_label}`);
    }
  };

  const handleAbsenPulang = async () => {
    if (!attendanceStatus) {
      return showToast("Anda belum absen masuk hari ini!", "error");
    }
    if (attendanceStatus.check_out_time) {
      return showToast("Anda sudah absen pulang hari ini!", "error");
    }

    const nowTime = new Date();
    const { data, error } = await supabase
      .from('attendance')
      .update({ check_out_time: nowTime.toISOString() })
      .eq('id', attendanceStatus.id)
      .select()
      .single();

    if (error) {
      showToast("Gagal absen pulang: " + error.message, "error");
    } else {
      setAttendanceStatus(data);
      save(`kk_attendance_${user.id}_${todayStr()}`, data);
      showToast("Berhasil Absen Pulang! Sampai jumpa besok 👋");
    }
  };

  // ── HASIL SCAN BARCODE ──
  const handleScanResult = (code) => {
    if (showScanner === "produk") {
      const existing = products.find(p => p.barcode && p.barcode === code);
      if (existing) {
        setEditProduct(existing);
        setNewProduct({ name: existing.name, price: String(existing.price), category_id: existing.category_id || "", icon: existing.icon, stock: String(existing.stock || 0), minStock: String(existing.minStock || 10), barcode: existing.barcode || code });
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

  // ── PRODUK LOGIC (Supabase: products = katalog pusat, outlet_stock = stok per cabang) ──
  const saveProduct = async () => {
    if (!newProduct.name || !newProduct.price) return showToast("Isi nama & harga!", "error");
    if (!activeOutletId) return showToast("Pilih cabang dulu sebelum menyimpan produk!", "error");

    const productPayload = {
      name: newProduct.name,
      price: Number(newProduct.price),
      category_id: newProduct.category_id || null,
      icon: newProduct.icon || "🛒",
      barcode: newProduct.barcode || null,
    };

    let productId = editProduct?.id;

    if (editProduct) {
      const { error } = await supabase.from('products').update(productPayload).eq('id', editProduct.id);
      if (error) return showToast("Gagal update produk: " + error.message, "error");
    } else {
      const { data, error } = await supabase.from('products').insert([productPayload]).select().single();
      if (error) return showToast("Gagal tambah produk: " + error.message, "error");
      productId = data.id;
    }

    const { error: stockErr } = await supabase.from('outlet_stock').upsert(
      { outlet_id: activeOutletId, product_id: productId, stock: Number(newProduct.stock || 0), min_stock: Number(newProduct.minStock || 10) },
      { onConflict: 'outlet_id,product_id' }
    );
    if (stockErr) showToast("Produk tersimpan, tapi stok gagal disimpan: " + stockErr.message, "error");
    else showToast(editProduct ? "Produk diperbarui!" : "Produk ditambahkan!");

    setEditProduct(null);
    setNewProduct({ name: "", price: "", category_id: "", icon: "🛒", stock: "", minStock: "10", barcode: "" });
    fetchProducts();
  };

  // Nonaktifkan produk (soft-delete) — bukan hapus permanen, supaya riwayat
  // transaksi lama (order_items) yang mereferensikan produk ini tetap utuh.
  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) return showToast("Gagal menonaktifkan produk: " + error.message, "error");
    showToast("Produk dinonaktifkan!", "error");
    fetchProducts();
  };

  const startEdit = (p) => { setEditProduct(p); setNewProduct({ name: p.name, price: String(p.price), category_id: p.category_id || "", icon: p.icon, stock: String(p.stock || 0), minStock: String(p.minStock || 10), barcode: p.barcode || "" }); };

  // Tambah stok cepat (dipakai di tab Stok)
  const addStock = async (product, amount) => {
    if (!activeOutletId) return showToast("Pilih cabang dulu!", "error");
    const newStock = (product.stock || 0) + amount;
    const { error } = await supabase.from('outlet_stock').upsert(
      { outlet_id: activeOutletId, product_id: product.id, stock: newStock, min_stock: product.minStock ?? 10 },
      { onConflict: 'outlet_id,product_id' }
    );
    if (error) return showToast("Gagal update stok: " + error.message, "error");
    showToast(`Stok ${product.name} ditambah ${amount}!`);
    fetchProducts();
  };


  // ── KEUANGAN LOGIC (Supabase: expenses) ──
  const addExpense = async () => {
    if (!newExpense.desc || !newExpense.amount) return showToast("Isi deskripsi & jumlah!", "error");
    if (!activeOutletId) return showToast("Outlet tidak diketahui, silakan login ulang.", "error");
    const { error } = await supabase.from('expenses').insert([{
      outlet_id: activeOutletId,
      type: newExpense.type,
      description: newExpense.desc,
      amount: Number(newExpense.amount),
      created_by: user.id,
      expense_date: newExpense.date ? newExpense.date.slice(0, 10) : todayStr(),
    }]);
    if (error) return showToast("Gagal mencatat: " + error.message, "error");
    setNewExpense({ type: "pengeluaran", desc: "", amount: "", date: "" });
    showToast(newExpense.type === "pengeluaran" ? "Pengeluaran dicatat!" : "Pendapatan dicatat!");
    fetchExpenses();
  };

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return showToast("Gagal hapus: " + error.message, "error");
    fetchExpenses();
  };

  const totalIncome   = orders.reduce((s, o) => s + o.total, 0) + expenses.filter(e => e.type === "pendapatan").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.filter(e => e.type === "pengeluaran").reduce((s, e) => s + e.amount, 0);
  const netProfit     = totalIncome - totalExpenses;

  // ── LAPORAN EXCEL ──
  const exportExcel = async () => {
    if (!activeOutletId) return showToast("Outlet tidak diketahui.", "error");
    showToast("Menyiapkan laporan Excel...");

    const wb = XLSX.utils.book_new();

    const txRows = orders.map(o => ({
      "No. Struk": "#" + orderNo(o), "Tanggal": o.date, "Kasir": o.cashierName || "-",
      "Item": o.items.map(i => `${i.name}(${i.qty})`).join(", "),
      "Subtotal": o.subtotal, "Diskon": o.discAmt, "Pajak": o.taxAmt || 0, "Total": o.total,
      "Bayar": o.pay, "Kembalian": o.change,
    }));
    const wsTransaksi = XLSX.utils.json_to_sheet(txRows);
    wsTransaksi["!cols"] = autoFitColumns(txRows, [4, 5, 6, 7, 8, 9]);
    applyRupiahFormat(wsTransaksi, ["E", "F", "G", "H", "I", "J"], 2, txRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsTransaksi, "Transaksi");

    const expRows = expenses.map(e => ({
      "Tanggal": e.date, "Jenis": e.type === "pengeluaran" ? "Pengeluaran" : "Pendapatan Lain",
      "Deskripsi": e.desc, "Jumlah": e.type === "pengeluaran" ? -e.amount : e.amount,
    }));
    const wsKeuangan = XLSX.utils.json_to_sheet(expRows);
    wsKeuangan["!cols"] = autoFitColumns(expRows, [3]);
    applyRupiahFormat(wsKeuangan, ["D"], 2, expRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsKeuangan, "Keuangan");

    const stockRows = products.map(p => ({
      "Produk": p.name, "Kategori": p.category, "Harga": p.price,
      "Stok": p.stock || 0, "Min. Stok": p.minStock || 0,
      "Status": (p.stock || 0) <= (p.minStock || 0) ? "⚠️ Menipis" : "✅ Aman",
    }));
    const wsStok = XLSX.utils.json_to_sheet(stockRows);
    wsStok["!cols"] = autoFitColumns(stockRows, [2]);
    applyRupiahFormat(wsStok, ["C"], 2, stockRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsStok, "Stok");

    // ── Mutasi Stok ──
    let mutasiQuery = supabase
      .from('stock_transfers')
      .select('*, product:product_id(name), from_outlet:from_outlet_id(name), to_outlet:to_outlet_id(name)')
      .order('created_at', { ascending: false });
    if (!isSuperAdmin) mutasiQuery = mutasiQuery.or(`from_outlet_id.eq.${activeOutletId},to_outlet_id.eq.${activeOutletId}`);
    const { data: mutasiData } = await mutasiQuery;
    const mutasiRows = (mutasiData || []).map(t => ({
      "Tanggal": new Date(t.created_at).toLocaleString("id-ID"),
      "Produk": t.product?.name || "-",
      "Dari Cabang": t.from_outlet?.name || "-",
      "Ke Cabang": t.to_outlet?.name || "-",
      "Qty": t.qty,
      "Status": t.status === "pending" ? "Pending" : t.status === "diterima" ? "Diterima" : "Ditolak",
    }));
    const wsMutasi = XLSX.utils.json_to_sheet(mutasiRows);
    wsMutasi["!cols"] = autoFitColumns(mutasiRows, []);
    XLSX.utils.book_append_sheet(wb, wsMutasi, "Mutasi Stok");

    // ── Karyawan Aktif (RLS otomatis: super_admin lihat semua, admin_cabang cuma cabangnya) ──
    const { data: karyawanData } = await supabase
      .from('profiles')
      .select('*, outlet:outlet_id(name)')
      .eq('is_active', true)
      .order('full_name');
    const karyawanRows = (karyawanData || []).map(k => ({
      "Nama": k.full_name,
      "Peran": k.role,
      "Cabang": k.outlet?.name || "-",
      "Bergabung": k.created_at ? new Date(k.created_at).toLocaleDateString("id-ID") : "-",
    }));
    const wsKaryawan = XLSX.utils.json_to_sheet(karyawanRows);
    wsKaryawan["!cols"] = autoFitColumns(karyawanRows, []);
    XLSX.utils.book_append_sheet(wb, wsKaryawan, "Karyawan Aktif");

    // ── Produk Terlaris (dihitung dari riwayat transaksi yang sudah dimuat) ──
    const countTerlaris = {};
    orders.forEach(o => o.items.forEach(i => { countTerlaris[i.name] = (countTerlaris[i.name] || 0) + i.qty; }));
    const terlarisRows = Object.entries(countTerlaris)
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty], idx) => ({ "Peringkat": idx + 1, "Produk": name, "Terjual": qty }));
    const wsTerlaris = XLSX.utils.json_to_sheet(terlarisRows);
    wsTerlaris["!cols"] = autoFitColumns(terlarisRows, []);
    XLSX.utils.book_append_sheet(wb, wsTerlaris, "Produk Terlaris");

    // ── HPP & Margin ──
    const { data: marginData } = await supabase
      .from('product_margin')
      .select('*')
      .order('margin_persen', { ascending: true });
    const marginRows = (marginData || []).map(m => ({
      "Produk": m.nama_produk, "Harga Jual": m.harga_jual, "HPP": m.hpp,
      "Laba Kotor": m.laba_kotor, "Margin (%)": m.margin_persen,
    }));
    const wsMargin = XLSX.utils.json_to_sheet(marginRows);
    wsMargin["!cols"] = autoFitColumns(marginRows, [1, 2, 3]);
    applyRupiahFormat(wsMargin, ["B", "C", "D"], 2, marginRows.length + 1);
    XLSX.utils.book_append_sheet(wb, wsMargin, "HPP & Margin");

    // ── Absensi (cabang aktif) ──
    const { data: absensiData } = await supabase
      .from('monitoring_absensi')
      .select('*')
      .eq('outlet_id', activeOutletId)
      .order('check_in_time', { ascending: false });
    const absensiRows = (absensiData || []).map(a => ({
      "Karyawan": a.nama_karyawan,
      "Shift": a.nama_shift || "-",
      "Jam Masuk": a.check_in_time ? new Date(a.check_in_time).toLocaleString("id-ID") : "-",
      "Jam Pulang": a.check_out_time ? new Date(a.check_out_time).toLocaleString("id-ID") : "-",
      "Status": a.status_label || "-",
      "Durasi (jam)": a.durasi_jam ?? "-",
    }));
    const wsAbsensi = XLSX.utils.json_to_sheet(absensiRows);
    wsAbsensi["!cols"] = autoFitColumns(absensiRows, []);
    XLSX.utils.book_append_sheet(wb, wsAbsensi, "Absensi");

    // ── Shift (cabang aktif) ──
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('*')
      .eq('outlet_id', activeOutletId)
      .order('jam_masuk');
    const shiftRows = (shiftData || []).map(s => ({
      "Nama Shift": s.name,
      "Jam Masuk": s.jam_masuk?.slice(0, 5),
      "Jam Pulang": s.jam_pulang?.slice(0, 5),
      "Toleransi (menit)": s.toleransi_menit,
    }));
    const wsShift = XLSX.utils.json_to_sheet(shiftRows);
    wsShift["!cols"] = autoFitColumns(shiftRows, []);
    XLSX.utils.book_append_sheet(wb, wsShift, "Shift");

    const summary = [
      { "Keterangan": "Total Pendapatan Penjualan", "Jumlah": orders.reduce((s,o)=>s+o.total,0) },
      { "Keterangan": "Total Pendapatan Lain", "Jumlah": expenses.filter(e=>e.type==="pendapatan").reduce((s,e)=>s+e.amount,0) },
      { "Keterangan": "Total Pengeluaran", "Jumlah": totalExpenses },
      { "Keterangan": "Laba Bersih", "Jumlah": netProfit },
      { "Keterangan": "Total Transaksi", "Jumlah": orders.length },
    ];
    const wsRingkasan = XLSX.utils.json_to_sheet(summary);
    wsRingkasan["!cols"] = autoFitColumns(summary, [1]);
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

        {/* Jam, Absensi, User Info, Keluar — satu blok bersih */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{currentTime.toLocaleTimeString("id-ID")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAbsensi}
              disabled={!!attendanceStatus}
              style={{
                ...S.smBtn,
                background: attendanceStatus ? "#a0aec0" : "#48bb78",
                color: "#fff",
                cursor: attendanceStatus ? "not-allowed" : "pointer"
              }}
            >
              {attendanceStatus ? "✅ Sudah Masuk" : "✅ Absen Masuk"}
            </button>
            <button
              onClick={handleAbsenPulang}
              disabled={!attendanceStatus || !!attendanceStatus?.check_out_time}
              style={{
                ...S.smBtn,
                background: (!attendanceStatus || attendanceStatus?.check_out_time) ? "#a0aec0" : "#e53e3e",
                color: "#fff",
                cursor: (!attendanceStatus || attendanceStatus?.check_out_time) ? "not-allowed" : "pointer"
              }}
            >
              {attendanceStatus?.check_out_time ? "🚪 Sudah Pulang" : "🚪 Absen Pulang"}
            </button>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{user.role === "admin" ? "👑 Admin Pusat" : user.role === "admin_cabang" ? "🏬 Admin Cabang" : "💼 Kasir"}</div>
          </div>
          <button onClick={() => { setUser(null); setCart([]); }} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Keluar</button>
        </div>
      </div>

      {/* ── TAB: KASIR ── */}
      {tab === "kasir" && (
        <div className="kasir-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, height: "calc(100vh - 62px)" }}>
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
            {productsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>⏳ Memuat produk...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                <div>Belum ada produk. Tambahkan lewat tab Produk.</div>
              </div>
            ) : (
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
            )}
          </div>

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

      {/* ── TAB: PRODUK ── */}
      {tab === "produk" && canManage && (
        <div className="tab-page-wrap" style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
          {user.role === "admin" && (
            <div style={{ background: "#ebf8ff", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2c5282" }}>🏬 Kelola stok untuk cabang:</span>
              <select value={selectedOutletId} onChange={e => setSelectedOutletId(e.target.value)} style={{ ...S.inp, width: 240 }}>
                {outletsList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <span style={{ fontSize: 11, color: "#4a5568" }}>Produk sendiri berlaku untuk semua cabang, tapi jumlah stok di bawah ini khusus cabang yang dipilih.</span>
            </div>
          )}
          {isSuperAdmin && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: "#1a365d" }}>{editProduct ? "✏️ Edit Produk" : "➕ Tambah Produk"}</div>
            <div className="form-grid-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 100px 100px", gap: 10 }}>
              <input placeholder="Nama produk" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} style={S.inp} />
              <input placeholder="Harga (Rp)" type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} style={S.inp} />
              <select value={newProduct.category_id} onChange={e => setNewProduct(p => ({ ...p, category_id: e.target.value }))} style={S.inp}>
                <option value="">Pilih kategori...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Ikon" value={newProduct.icon} onChange={e => setNewProduct(p => ({ ...p, icon: e.target.value }))} style={{ ...S.inp, textAlign: "center", fontSize: 22 }} />
              <input placeholder="Stok" type="number" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} style={S.inp} />
              <input placeholder="Min. Stok" type="number" value={newProduct.minStock} onChange={e => setNewProduct(p => ({ ...p, minStock: e.target.value }))} style={S.inp} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <input placeholder="Barcode produk (scan otomatis atau ketik manual)" value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} style={{ ...S.inp, flex: 1 }} />
              <button onClick={() => setShowScanner("produk")} style={{ ...S.btn, background: "#1a365d", color: "#fff", whiteSpace: "nowrap" }}>📷 Scan Barcode</button>
            </div>
            <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 4 }}>Bisa pakai kamera HP atau scanner barcode eksternal (USB/Bluetooth) — pilih tab-nya di jendela scan.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={saveProduct} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>{editProduct ? "💾 Simpan Perubahan" : "➕ Tambah Produk"}</button>
              {editProduct && <button onClick={() => { setEditProduct(null); setNewProduct({ name: "", price: "", category_id: "", icon: "🛒", stock: "", minStock: "10", barcode: "" }); }} style={{ ...S.btn, background: "#e2e8f0", color: "#4a5568" }}>Batal</button>}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#a0aec0" }}>💡 Harga pokok (HPP) & margin produk tidak diatur di sini — lihat penjelasan di tab Laporan, HPP hanya bisa diubah langsung di Supabase.</div>
          </div>
          )}
          {!isSuperAdmin && (
            <div style={{ background: "#fffaf0", border: "1px solid #feebc8", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#c05621" }}>
              🔒 Katalog produk hanya bisa ditambah/diubah oleh <strong>Admin Pusat</strong>. Kamu bisa lihat daftar produk & stok di bawah (read-only). Kalau stok kurang, ajukan lewat tab <strong>🔀 Mutasi Stok</strong>.
            </div>
          )}
          {productsLoading ? (
            <div style={{ textAlign: "center", padding: 30, color: "#a0aec0" }}>⏳ Memuat produk dari Supabase...</div>
          ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div className="data-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ebf8ff", color: "#2c5282" }}>
                  {["Produk","Kategori","Harga","Stok","Min. Stok","Status", ...(isSuperAdmin ? ["Aksi"] : [])].map(h => (
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
                      {isSuperAdmin && (
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(p)} style={{ ...S.smBtn, background: "#ebf8ff", color: "#2b6cb0" }}>✏️ Edit</button>
                        <button onClick={() => deleteProduct(p.id)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus</button>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

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
                    {isSuperAdmin && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEdit(p)} style={{ ...S.smBtn, flex: 1, background: "#ebf8ff", color: "#2b6cb0", textAlign: "center" }}>✏️ Edit</button>
                      <button onClick={() => deleteProduct(p.id)} style={{ ...S.smBtn, flex: 1, background: "#fff5f5", color: "#e53e3e", textAlign: "center" }}>🗑️ Hapus</button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      )}

      {/* ── TAB: STOK ── */}
      {tab === "stok" && canManage && (
        <div className="tab-page-wrap" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
          {user.role === "admin" && (
            <div style={{ background: "#ebf8ff", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2c5282" }}>🏬 Cabang:</span>
              <select value={selectedOutletId} onChange={e => setSelectedOutletId(e.target.value)} style={{ ...S.inp, width: 240 }}>
                {outletsList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          {!isSuperAdmin && (
            <div style={{ background: "#fffaf0", border: "1px solid #feebc8", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#c05621" }}>
              🔒 Stok hanya bisa ditambah oleh <strong>Admin Pusat</strong>. Kalau stok kurang, ajukan lewat tab <strong>🔀 Mutasi Stok</strong>.
            </div>
          )}
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
                  {["Produk","Kategori","Stok Saat Ini","Min. Stok","Status", ...(isSuperAdmin ? ["Tambah Stok"] : [])].map(h => (
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
                      {isSuperAdmin && (
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input id={`stk-${p.id}`} type="number" placeholder="Jumlah" style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                          <button onClick={() => {
                            const inp = document.getElementById(`stk-${p.id}`);
                            const n = Number(inp.value);
                            if (!n || n <= 0) return showToast("Masukkan jumlah stok!", "error");
                            addStock(p, n);
                            inp.value = "";
                          }} style={{ ...S.smBtn, background: "#276749", color: "#fff" }}>+ Tambah</button>
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

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
                    {isSuperAdmin && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input id={`stk-m-${p.id}`} type="number" placeholder="Jumlah" style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13 }} />
                      <button onClick={() => {
                        const inp = document.getElementById(`stk-m-${p.id}`);
                        const n = Number(inp.value);
                        if (!n || n <= 0) return showToast("Masukkan jumlah stok!", "error");
                        addStock(p, n);
                        inp.value = "";
                      }} style={{ ...S.smBtn, background: "#276749", color: "#fff", whiteSpace: "nowrap" }}>+ Tambah</button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: KEUANGAN ── */}
      {tab === "keuangan" && canManage && (
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
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#1a365d" }}>📋 Riwayat Catatan Keuangan</div>
            {expensesLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>⏳ Memuat...</div>
            ) : expenses.length === 0 ? (
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
                  <button onClick={() => deleteExpense(e.id)} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: RIWAYAT ── */}
      {tab === "riwayat" && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
          {canManage && (
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
          {ordersLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#a0aec0" }}>⏳ Memuat riwayat...</div>
          ) : orders.length === 0 ? (
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
      {tab === "laporan" && canManage && (
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

          <MarginProdukSection />
          <AuditLogSection />
        </div>
      )}

      {/* ── TAB: MONITORING (DASHBOARD ADMIN PUSAT) ── */}
      {tab === "monitoring" && canAdmin && <AdminDashboard />}

      {/* ── TAB: SHIFT (KELOLA JADWAL & ASSIGN KE KARYAWAN) ── */}
      {tab === "shift" && canManage && <ShiftManagement user={user} />}

      {/* ── TAB: USER (MANAJEMEN KARYAWAN) ── */}
      {tab === "user" && isSuperAdmin && <UserManagement user={user} isSuperAdmin={isSuperAdmin} activeOutletId={activeOutletId} outletsList={outletsList} />}

      {/* ── TAB: MUTASI STOK ── */}
      {tab === "mutasi" && canManage && <StockTransferPanel user={user} isSuperAdmin={isSuperAdmin} activeOutletId={activeOutletId} outletsList={outletsList} products={products} showToast={showToast} />}

      {/* ── TAB: SETTING ── */}
      {tab === "setting" && canManage && (
        <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
          {isSuperAdmin && (
            <div style={{ background: "#ebf8ff", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2c5282" }}>🏬 Pengaturan untuk cabang:</span>
              <select value={selectedOutletId} onChange={e => setSelectedOutletId(e.target.value)} style={{ ...S.inp, width: 240 }}>
                {outletsList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
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
              <button onClick={async () => {
                const { error } = await supabase.from('outlets').update({
                  name: editSettings.storeName,
                  address: editSettings.storeAddress,
                  phone: editSettings.storePhone,
                  tax_rate: Number(editSettings.taxRate) || 0,
                  footer_note: editSettings.footerNote,
                }).eq('id', activeOutletId);
                if (error) return showToast("Gagal simpan: " + error.message, "error");
                showToast("Pengaturan disimpan! ✅");
                fetchOutletSettings();
              }} style={{ ...S.btn, background: "#2b6cb0", color: "#fff" }}>💾 Simpan Pengaturan</button>
              <button onClick={() => { fetchProducts(); fetchOrders(); fetchExpenses(); fetchOutletSettings(); showToast("Data dimuat ulang dari Supabase!"); }} style={{ ...S.btn, background: "#ebf8ff", color: "#2b6cb0" }}>🔄 Muat Ulang Semua Data</button>
            </div>
            <div style={{ marginTop: 24, padding: "14px 16px", background: "#f7fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a365d", marginBottom: 4 }}>👥 Manajemen Karyawan</div>
              <div style={{ fontSize: 12, color: "#718096" }}>Tambah, aktifkan, dan atur peran karyawan sekarang ada di tab <strong>👤 User</strong>.</div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", marginTop: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a365d", marginBottom: 6 }}>📱 QR Pembayaran (QRIS)</div>
            <div style={{ fontSize: 12, color: "#718096", marginBottom: 16 }}>Unggah gambar QR code milik Anda agar muncul saat pelanggan memilih pembayaran QRIS di kasir. Disimpan di Supabase Storage.</div>
            {settings.qrImage ? (
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
                <img src={settings.qrImage} alt="QR Pembayaran" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 10, border: "1.5px solid #e2e8f0" }} />
                <div>
                  <div style={{ fontSize: 13, color: "#276749", fontWeight: 600, marginBottom: 8 }}>✅ QR aktif</div>
                  <button onClick={async () => {
                    const { error } = await supabase.from('outlets').update({ qr_image_url: null }).eq('id', activeOutletId);
                    if (error) return showToast("Gagal hapus: " + error.message, "error");
                    showToast("QR dihapus!", "error");
                    fetchOutletSettings();
                  }} style={{ ...S.smBtn, background: "#fff5f5", color: "#e53e3e" }}>🗑️ Hapus QR</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "16px 14px", background: "#fffaf0", color: "#c05621", fontSize: 13, borderRadius: 10, marginBottom: 14 }}>⚠️ Belum ada QR yang diunggah.</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={async e => {
                const file = e.target.files && e.target.files[0];
                if (!file || !activeOutletId) return;
                const ext = file.name.split('.').pop();
                const path = `${activeOutletId}/qris.${ext}`;
                const { error: upErr } = await supabase.storage.from('qris').upload(path, file, { upsert: true, cacheControl: '3600' });
                if (upErr) return showToast("Gagal unggah QR: " + upErr.message, "error");
                const { data: pub } = supabase.storage.from('qris').getPublicUrl(path);
                const { error: dbErr } = await supabase.from('outlets').update({ qr_image_url: pub.publicUrl }).eq('id', activeOutletId);
                if (dbErr) return showToast("QR terunggah, tapi gagal simpan URL: " + dbErr.message, "error");
                showToast("QR pembayaran disimpan! ✅");
                fetchOutletSettings();
              }}
              style={{ fontSize: 13 }}
            />
          </div>
        </div>
      )}

      {showReceipt && <ReceiptModal order={showReceipt} settings={settings} onClose={() => setShowReceipt(null)} />}
      {showScanner && <ScannerModal mode={showScanner} onResult={handleScanResult} onClose={() => setShowScanner(null)} />}
      {showQris && <QrisModal settings={settings} total={total} onConfirm={handlePayQris} onClose={() => setShowQris(false)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }

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