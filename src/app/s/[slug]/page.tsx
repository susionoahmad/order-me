'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation';

export default function AhmadCodingApp() {
  const params = useParams()
  const router = useRouter();
  // 1. STATE MANAGEMENT
  const [toko, setToko] = useState<any>(null)
  const [produk, setProduk] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('Semua')
  const [cart, setCart] = useState<any[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<any>({ 
          nama: '', 
          nomor_wa_pelanggan: '', // <--- Tambahkan ini
          metode: 'Tunai', 
          maps: '' 
        });

  // 2. AMBIL DATA DARI DATABASE
  useEffect(() => {
  async function loadData() {
    if (!params.slug) return
    const { data: p } = await supabase.from('profiles').select('*').eq('slug', params.slug).single()
    if (p) {
      setToko(p)
      const { data: pr } = await supabase.from('products').select('*, categories(nama_kategori)').eq('profile_id', p.id).eq('is_visible', true)
      const { data: ct } = await supabase.from('categories').select('*').eq('profile_id', p.id)
      if (pr) setProduk(pr)
      if (ct) setCategories(ct)

      // --- TAMBAHKAN LOGIKA INI DI SINI PAK ---
      const storedWa = localStorage.getItem('pembeli_wa');
      const storedNama = localStorage.getItem('pembeli_nama');
      if (storedWa || storedNama) {
        setForm(prev => ({
          ...prev,
          nomor_wa_pelanggan: storedWa || '',
          nama: storedNama || ''
        }));
      }
      // ----------------------------------------
    }
  }
  loadData()
}, [params.slug])

  // 3. LOGIKA KERANJANG
  const addToCart = (p: any) => {
    const ex = cart.find(x => x.id === p.id)
    setCart(ex ? cart.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...cart, { ...p, qty: 1 }])
  }

  const updateQty = (id: string, d: number) => {
    setCart(cart.map(x => x.id === id ? { ...x, qty: x.qty + d } : x).filter(x => x.qty > 0))
  }

  const total = cart.reduce((a, c) => a + (c.harga * c.qty), 0)

  const handleCheckout = async () => {
  if (loading) return;
  if (!form.nama || !form.nomor_wa_pelanggan || cart.length === 0) {
    alert("Waduh, Nama, Nomor WA, atau Pesanan masih kosong Pak!");
    return;
  }
  
  setLoading(true);

  try {
    const totalBayar = cart.reduce((acc, item) => acc + (item.harga * item.qty), 0);
    const metodeDB = form.metode?.toLowerCase().includes('qris') ? 'qris' : 'tunai';
    const hariIni = new Date().toISOString().split('T')[0];

    // 1. Ambil Nomor Antrian
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', toko.id)
      .gte('created_at', hariIni);

    const nomorAntrianBaru = (count || 0) + 1;

    // 2. Simpan ke Tabel Orders
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        profile_id: toko.id,
        nama_pelanggan: form.nama,
        nomor_wa_pelanggan: form.nomor_wa_pelanggan,
        catatan_tambahan: form.catatan_tambahan,
        total_bayar: totalBayar,
        metode_bayar: metodeDB, 
        alamat_maps_url: form.maps || '', 
        status_pesanan: 'antri',
        nomor_antrian: nomorAntrianBaru
      }])
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    // 3. Simpan ke Tabel Order Items
    const detailItems = cart.map(item => ({
      order_id: orderData.id,
      product_id: item.id,
      jumlah: item.qty,
      subtotal: item.harga * item.qty
    }));
    
    const { error: itemsError } = await supabase.from('order_items').insert(detailItems);
    if (itemsError) throw itemsError;

    // 4. Susun Pesan WhatsApp
    let nomorWAAdmin = toko?.nomor_wa_admin?.replace(/\D/g, "") || "";
    if (nomorWAAdmin.startsWith("0")) nomorWAAdmin = "62" + nomorWAAdmin.slice(1);

    const teksCatatanWA = form.catatan_tambahan ? `\n📝 *Catatan:* _${form.catatan_tambahan}_` : '';
    const listPesananWA = cart.map(i => `* ${i.nama_produk} (x${i.qty})`).join('\n');
    const labelBayarWA = form.metode?.includes('QRIS') ? '📱 QRIS / TRANSFER' : '💵 TUNAI / COD';

    const pesanMurni = `*PESANAN BARU - #${orderData?.nomor_antrian || '1'}*\n\n` +
                       `👤 *Nama:* ${form.nama}\n` +
                       `💵 *Bayar:* ${labelBayarWA}\n` +
                       `${form.maps ? `📍 *Lokasi:* ${form.maps}\n` : ''}` +
                       `${teksCatatanWA}\n` +
                       `\n*Detail Menu:*\n${listPesananWA}\n\n` +
                       `💰 *TOTAL: Rp ${totalBayar.toLocaleString()}*`;

    const linkFinal = `https://api.whatsapp.com/send?phone=${nomorWAAdmin}&text=${encodeURIComponent(pesanMurni)}`;

    // 5. Simpan LocalStorage & Reset Form (Lakukan SEBELUM buka WA)
    localStorage.setItem('pembeli_wa', form.nomor_wa_pelanggan);
    setCart([]);
    setShowCheckout(false);
    setForm({
      nama: '',
      nomor_wa_pelanggan: '',
      catatan_tambahan: '',
      metode: 'Tunai',
      maps: ''
    });

    // 6. JURUS ANTI-BLOKIR POPUP
    // Jika HP (iPhone/Android), gunakan location.href agar tidak diblokir browser
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        window.location.href = linkFinal;
    } else {
        window.open(linkFinal, '_blank');
    }
    
  } catch (err: any) {
    console.error("Detail Error:", err);
    alert("Gagal Proses: " + err.message);
  } finally {
    setLoading(false);
  }
};
  return (
    <div style={{ maxWidth: '448px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh', paddingBottom: '140px', fontFamily: 'sans-serif', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflowX: 'hidden' }}>
      
      {/* 1. HEADER & SEARCH (STICKY) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'white', borderBottom: '2px solid #ecfdf5', padding: '15px', textAlign: 'center' }}>
  
  {/* --- JUDUL APLIKASI (BRAND BAPAK) --- */}
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
    <span style={{ backgroundColor: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '5px', fontSize: '9px', fontWeight: '900', letterSpacing: '0.05em' }}>
      PRO
    </span>
    <p style={{ fontSize: '10px', fontWeight: '900', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
      DIGITAL FOOD ORDER SYSTEM
    </p>
  </div>

  {/* WATERMARK DEVELOPER */}
  <p style={{ fontSize: '8px', fontWeight: '900', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 5px 0' }}>
    Powered by AhmadCoding
  </p>

  {/* NAMA TOKO */}
  <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#10b981', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.05em' }}>
    {toko?.nama_toko || 'NESSA MART'}
  </h1>
  
  {/* 2. Tombol Lacak (Muncul hanya jika sudah ada data WA) */}
  {form.nomor_wa_pelanggan && (
    <div style={{ textAlign: 'center', marginTop: '15px' }}>
      <button 
        onClick={() => router.push('/lacak')}
        className="w-full bg-orange-50 text-orange-600 py-3 rounded-2xl text-[10px] font-black border border-orange-200 shadow-sm active:scale-95 transition-all"
      >
        🔎 CEK STATUS PESANAN AKTIF
      </button>
    </div>
  )}

  {/* Scrollable Kategori */}
  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 20px 0', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
    <button onClick={() => setSelectedCat('Semua')} 
      style={{ padding: '8px 18px', borderRadius: '25px', fontSize: '11px', fontWeight: 'bold', border: '2px solid', flexShrink: 0, cursor: 'pointer', transition: '0.3s', backgroundColor: selectedCat === 'Semua' ? '#10b981' : '#f9fafb', color: selectedCat === 'Semua' ? 'white' : '#6b7280', borderColor: selectedCat === 'Semua' ? '#10b981' : '#f3f4f6' }}>
      SEMUA
    </button>
    {categories.map(c => (
      <button key={c.id} onClick={() => setSelectedCat(c.nama_kategori)}
        style={{ padding: '8px 18px', borderRadius: '25px', fontSize: '11px', fontWeight: 'bold', border: '2px solid', flexShrink: 0, cursor: 'pointer', transition: '0.3s', backgroundColor: selectedCat === c.nama_kategori ? '#10b981' : '#f9fafb', color: selectedCat === c.nama_kategori ? 'white' : '#6b7280', borderColor: selectedCat === c.nama_kategori ? '#10b981' : '#f3f4f6' }}>
        {c.nama_kategori.toUpperCase()}
      </button>
    ))}
  </div>

  {/* Search Bar Lengkap */}
  <div style={{ position: 'relative', marginTop: '5px' }}>
    <input 
      type="text" 
      placeholder="Cari menu favorit..." 
      style={{ width: '100%', padding: '12px 15px 12px 40px', backgroundColor: '#f3f4f6', borderRadius: '15px', border: 'none', outline: 'none', fontSize: '14px', fontWeight: 'bold', boxSizing: 'border-box' }}
      onChange={e => setSearchTerm(e.target.value.toLowerCase())}
    />
    <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>🔍</span>
  </div>
</div>

      {/* 2. DAFTAR PRODUK (TETAP TERKUNCI) */}
      <div style={{ padding: '15px' }}>
        {produk.filter(p => (selectedCat === 'Semua' || (p.categories?.nama_kategori || p.nama_kategori) === selectedCat) && p.nama_produk.toLowerCase().includes(searchTerm)).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '28px', marginBottom: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', height: '110px', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
            
            {/* 1. BAGIAN FOTO & BADGE (Kiri) */}
    <div style={{ position: 'relative', width: '85px', height: '85px', flexShrink: 0 }}>
      {/* Foto Masakan */}
      <img 
        src={p.image_url || 'https://via.placeholder.com/150'} 
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }} 
        alt={p.nama_produk} 
      />
      
      {/* Badge Best Seller (Oranye) */}
      {p.is_best_seller && (
        <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', zIndex: 30, backgroundColor: '#f97316', color: 'white', fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '8px', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          🔥 BEST
        </div>
      )}

      {/* Badge Persen Diskon (Merah) */}
      {p.harga_asli > p.harga && (
        <div style={{ position: 'absolute', top: '-2px', left: '-2px', zIndex: 30, backgroundColor: '#dc2626', color: 'white', fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '8px', border: '2px solid white' }}>
          -{Math.round(((p.harga_asli - p.harga) / p.harga_asli) * 100)}%
        </div>
      )}
    </div>

      {/* 2. BAGIAN INFO PRODUK (Kanan) */}
      <div style={{ flex: 1, minWidth: 0, padding: '0 15px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#374151', margin: 0, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.nama_produk}
        </h3>
        
        {/* Baris Harga: Utama + Coret */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <p style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', margin: 0 }}>
            Rp {Number(p.harga).toLocaleString()}
          </p>

          {p.harga_asli > p.harga && (
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textDecoration: 'line-through' }}>
              Rp {Number(p.harga_asli).toLocaleString()}
            </span>
          )}
        </div>
      </div>

            {/* Tombol Tambah */}
            <div style={{ flexShrink: 0 }}>
              <button onClick={() => addToCart(p)} style={{ height: '45px', padding: '0 12px', borderRadius: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderBottom: '4px solid #065f46', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '75px', transition: '0.1s' }}>
                <span style={{ fontWeight: '900', fontSize: '16px', lineHeight: 1 }}>+</span>
                <span style={{ fontWeight: '900', fontSize: '9px' }}>TAMBAH</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. FLOATING KERANJANG */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '25px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', zIndex: 100 }}>
          <button onClick={() => setShowCheckout(true)} style={{ width: '100%', backgroundColor: '#059669', color: 'white', padding: '20px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 30px rgba(5,150,105,0.4)', cursor: 'pointer' }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', margin: 0, opacity: 0.9 }}>{cart.length} Pesanan</p>
              <p style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>Rp {total.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: 'white', color: '#059669', padding: '10px 20px', borderRadius: '20px', fontSize: '12px', fontWeight: '900' }}>Review 🛒</div>
          </button>
        </div>
      )}

      {/* 4. MODAL CHECKOUT (VERSI LENGKAP: MAPS & METODE BAYAR) */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '448px', borderTopLeftRadius: '40px', borderTopRightRadius: '40px', padding: '25px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>Review Pesanan</h2>
              <button onClick={() => setShowCheckout(false)} style={{ border: 'none', backgroundColor: '#f3f4f6', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer' }}>×</button>
            </div>

            {/* List Belanjaan */}
            <div style={{ marginBottom: '20px', border: '1px solid #f3f4f6', borderRadius: '20px', padding: '10px' }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>{item.nama_produk}</p>
                    <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', margin: 0 }}>Rp {(item.harga * item.qty).toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => updateQty(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white', fontWeight: '900' }}>-</button>
                    <span style={{ fontWeight: '900', fontSize: '14px' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: 'white', fontWeight: '900' }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* INPUT NAMA PEMBELI */}
            <div className="mb-4">
              <label className="block text-[10px] font-black text-gray-400 mb-1 ml-2 uppercase">Nama Lengkap</label>
              <input 
                type="text"
                placeholder="Contoh: Pak Ahmad"
                className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-orange-500 transition-all"
                value={form.nama || ''}
                onChange={(e) => setForm({...form, nama: e.target.value})}
                required
              />
            </div>

            {/* INPUT NOMOR WHATSAPP (TAMBAHKAN INI PAK!) */}
            <div className="mb-4">
              <label className="block text-[10px] font-black text-gray-400 mb-1 ml-2 uppercase">Nomor WhatsApp Aktif</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm">🟢</span>
                <input 
                  type="number"
                  placeholder="Contoh: 08123456789"
                  className="w-full p-4 pl-10 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={form.nomor_wa_pelanggan|| ''}
                  onChange={(e) => setForm({...form, nomor_wa_pelanggan: e.target.value})}
                  required
                />
              </div>
              <p className="text-[9px] text-gray-400 ml-2 mt-1 font-medium">
                * Digunakan untuk memantau status pesanan Bapak/Ibu.
              </p>

              {/* INPUT CATATAN TAMBAHAN */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-400 ml-2">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  placeholder="Contoh: Sambel sedang, jangan pakai bawang goreng..."
                  className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-sm font-bold min-h-[100px]"
                  value={form.catatan_tambahan || ''}
                  onChange={(e) => setForm({ ...form, catatan_tambahan: e.target.value })}
                />
              </div>
            </div>
            {/* AREA RAMBING: MAPS & BAYAR (1 BARIS SAJA) */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              
              {/* TOMBOL LOKASI - RAMPING */}
              <button 
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const link = `http://maps.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
                      setForm({...form, maps: link});
                      alert("📍 Lokasi Terkunci!");
                    });
                  }
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '15px', border: '2px solid #3b82f6', fontSize: '11px', fontWeight: '900', cursor: 'pointer', backgroundColor: form.maps ? '#3b82f6' : 'white', color: form.maps ? 'white' : '#3b82f6' }}
              >
                {form.maps ? '📍 OK' : '📍 LOKASI'}
              </button>

              {/* PILIHAN BAYAR - RAMPING */}
              {/* Pilihan Pembayaran */}
            <select 
              style={{ 
                padding: '12px', 
                borderRadius: '15px', 
                border: '2px solid #f3f4f6', 
                fontSize: '11px', 
                fontWeight: '900', 
                outline: 'none', 
                backgroundColor: 'white',
                width: '100%' 
              }}
              // Kita simpan hanya kata "Tunai" atau "QRIS" ke dalam form
              onChange={e => setForm({...form, metode: e.target.value})}
              value={form.metode || "Tunai"} 
            >
              <option value="Tunai">💵 TUNAI / COD</option>
              <option value="QRIS">📱 QRIS / TRANSFER</option>
            </select>

            </div>

            {/* QRIS TAMPIL JIKA DIPILIH - POSISI CENTER */}
            {form.metode === 'QRIS' && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: '20px', 
                padding: '20px', 
                backgroundColor: '#f8fafc', 
                borderRadius: '25px', 
                border: '2px dashed #e2e8f0' 
              }}>
                <p style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Silakan Scan QRIS di Bawah Ini
                </p>
                
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '15px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' 
                }}>
                  <img 
                    src={toko?.qris_url || 'https://via.placeholder.com/200?text=QRIS+BELUM+ADA'} 
                    style={{ width: '180px', height: '180px', display: 'block', objectFit: 'contain' }} 
                    alt="QRIS Pembayaran" 
                  />
                </div>
                
                <p style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', marginTop: '10px' }}>
                  *Simpan bukti transfer untuk dikirim ke WA
                </p>
              </div>
            )}

            {/* TOMBOL FINAL */}
            <button 
              disabled={loading}
              onClick={handleCheckout}
              style={{ width: '100%', padding: '20px', borderRadius: '20px', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: '900', fontSize: '18px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(16,185,129,0.3)' }}
            >
              {loading ? 'MEMPROSES...' : '🚀 KIRIM KE WHATSAPP'}
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
}