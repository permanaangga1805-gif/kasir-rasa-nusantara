import React, { useState, useEffect, useRef } from 'react';

export default function ScannerSistem({ userRole, totalBelanja, onAdminInput, onKasirCart, onPembayaranSukses }) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState(null); // null, 'pilih', 'tunai', 'qris'
  const [statusBayar, setStatusBayar] = useState('pending');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  // Inisialisasi audio suara "tit"
  useEffect(() => {
    audioRef.current = new Audio('/sounds/beep.mp3');
  }, []);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.log("Audio play diblokir browser:", err));
    }
  };

  // ========================================================
  // 1. LOGIKA UNTUK ALAT SCAN FISIK / HARDWARE (LASER USB)
  // ========================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Jika sedang di menu pembayaran, matikan deteksi scan barang
      if (metodeBayar !== null) return;

      if (e.key === 'Enter') {
        if (barcodeInput.trim() !== "") {
          playBeep();
          prosesBarcode(barcodeInput);
          setBarcodeInput(""); // Reset input setelah sukses
        }
      } else {
        // Gabungkan teks dari scanner laser (abaikan tombol kontrol seperti Shift)
        if (e.key.length === 1) {
          setBarcodeInput((prev) => prev + e.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeInput, userRole, metodeBayar]);

  // ========================================================
  // 2. LOGIKA KAMERA HP (NATIVE WEBCAM API)
  // ========================================================
  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          alert("Gagal mengakses kamera. Pastikan memberikan izin akses kamera.");
          setIsCameraOpen(false);
        });
    } else {
      matikanKamera();
    }

    return () => matikanKamera();
  }, [isCameraOpen]);

  const matikanKamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Logika memproses data barcode
  const prosesBarcode = (code) => {
    if (userRole === 'admin') {
      onAdminInput(code); // Kirim kode ke fungsi input admin
    } else if (userRole === 'kasir') {
      onKasirCart(code); // Kirim kode ke fungsi tambah keranjang kasir
    }
  };

  // Simulasi scan manual dari kamera (karena tanpa library eksternal)
  const simulasiScanKameraSukses = () => {
    playBeep();
    const contohBarcodeAcak = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    prosesBarcode(contohBarcodeAcak);
    setIsCameraOpen(false);
  };

  // ========================================================
  // 3. LOGIKA PEMBAYARAN VIA QRIS (MENGGUNAKAN API QR GRATIS)
  // ========================================================
  const konfirmasiPembayaranQRIS = () => {
    playBeep(); // Bunyi "Tit!" tanda lunas
    setStatusBayar('sukses');
    onPembayaranSukses();
  };

  // Trik menggunakan API QR Code Image gratisan (tanpa butuh library qrcode.react)
  const urlDataTransaksi = encodeURIComponent(`https://kasir-rasa-nusantara.com/invoice?total=${totalBelanja}`);
  const qrImageApi = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${urlDataTransaksi}`;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-xl shadow-md border mt-4 text-gray-800">
      <h2 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2">
        🎯 Sistem Scan Barcode
      </h2>

      {/* TAMPILAN KASIR BELANJA / INPUT BARANG */}
      {metodeBayar === null && (
        <div className="text-center">
          <div className="bg-blue-50 text-blue-700 py-1 px-3 rounded-full text-xs font-bold inline-block mb-3">
            LOGIN SEBAGAI: {userRole ? userRole.toUpperCase() : 'KASIR'}
          </div>
          
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            {userRole === 'admin' 
              ? "Sistem stand-by. Tembak barcode dengan ALAT LASER USB untuk langsung menginput barang baru." 
              : "Sistem stand-by. Tembak barcode dengan ALAT LASER USB untuk memasukkan barang ke keranjang."}
          </p>

          {/* Kamera HP Box */}
          <button 
            onClick={() => setIsCameraOpen(!isCameraOpen)}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition mb-4 text-sm"
          >
            {isCameraOpen ? "❌ Tutup Kamera HP" : "📷 Aktifkan Kamera HP"}
          </button>

          {isCameraOpen && (
            <div className="relative bg-black rounded-lg overflow-hidden mb-4 max-w-xs mx-auto">
              <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover"></video>
              <div className="absolute inset-0 border-2 border-green-500 m-8 opacity-60 pointer-events-none"></div>
              <button 
                onClick={simulasiScanKameraSukses}
                className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow"
              >
                Simulasi Ambil Barcode
              </button>
            </div>
          )}

          {(userRole === 'kasir' || !userRole) && totalBelanja > 0 && (
            <button 
              onClick={() => setMetodeBayar('pilih')}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition shadow text-sm"
            >
              💰 Lanjut ke Pembayaran (Rp {totalBelanja.toLocaleString('id-ID')})
            </button>
          )}
        </div>
      )}

      {/* MENU PILIHAN PEMBAYARAN */}
      {metodeBayar === 'pilih' && (
        <div className="text-center">
          <h3 className="font-bold text-gray-700 mb-4 text-sm">Silakan Pilih Metode Pembayaran</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMetodeBayar('tunai')} className="p-3 bg-gray-100 border rounded-lg font-bold text-sm hover:bg-gray-200">💵 Tunai / Cash</button>
            <button onClick={() => setMetodeBayar('qris')} className="p-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">📱 Scan QRIS</button>
          </div>
          <button onClick={() => setMetodeBayar(null)} className="mt-4 text-xs text-gray-400 underline block mx-auto">Kembali ke Keranjang</button>
        </div>
      )}

      {/* TAMPILAN SCAN BAYAR QRIS BARCODE (MEMAKAI QR API GRATIS) */}
      {metodeBayar === 'qris' && (
        <div className="flex flex-col items-center text-center">
          <p className="text-xs text-gray-400 font-bold">TOTAL TAGIHAN</p>
          <p className="text-2xl font-black text-red-600 mb-3">Rp {totalBelanja.toLocaleString('id-ID')}</p>
          
          {/* QR Code yang di-generate langsung lewat URL Image API */}
          <div className="bg-white p-2 border rounded-lg shadow-inner mb-3">
            <img src={qrImageApi} alt="QRIS Transaksi" className="w-40 h-40" />
          </div>

          <p className="text-[11px] text-gray-400 px-4 mb-4">Tunjukkan QR Code dinamis di atas ke pembeli. Pelanggan bisa scan lewat e-wallet apa saja.</p>

          {statusBayar === 'pending' ? (
            <button 
              onClick={konfirmasiPembayaranQRIS}
              className="w-full bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700"
            >
              🤝 Pembayaran Diterima (Bunyi Tit)
            </button>
          ) : (
            <div className="w-full bg-green-100 text-green-700 py-2 rounded-lg font-bold text-sm border border-green-300">✓ LUNAS (SUKSES)</div>
          )}
          <button onClick={() => { setMetodeBayar(null); setStatusBayar('pending'); }} className="mt-4 text-xs text-gray-400 underline">Batal / Kembali</button>
        </div>
      )}

      {/* TAMPILAN BAYAR TUNAI */}
      {metodeBayar === 'tunai' && (
        <div className="text-center">
          <p className="text-xs text-gray-400 font-bold">TERIMA UANG CASH</p>
          <p className="text-xl font-black text-gray-800 my-2">Rp {totalBelanja.toLocaleString('id-ID')}</p>
          <button onClick={konfirmasiPembayaranQRIS} className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-bold mt-2 hover:bg-gray-900">Simpan Transaksi Cash</button>
          <button onClick={() => setMetodeBayar(null)} className="mt-4 text-xs text-gray-400 underline block mx-auto">Batal</button>
        </div>
      )}
    </div>
  );
}