'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation';

export default function AhmadCodingApp() {
  // State Management
  const params = useParams(); // Sudah benar

  // State Management
  const [toko, setToko] = useState<any>(null) // Tambahkan ini untuk data profil
  const [produk, setProduk] = useState<any[]>([]) // Ubah 'products' jadi 'produk' agar sinkron
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState('Semua')
  const [cart, setCart] = useState<any[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState<any>(null);
  
  // Form State
  const [form, setForm] = useState({
    nama: '',
    metode: 'Tunai(COD',
    maps: ''
  })

  async function fetchDataToko() {
  try {
    setLoading(true)

    // 1. Ambil data lengkap profil (termasuk nomor WA dan Nama Toko)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, nama_toko, logo_url, nomor_wa_admin, qris_url') // <--- Ambil semua data penting
      .eq('slug', params.slug)
      .single()

    if (profileError || !profileData) {
      setToko(null)
      setProduk([])
      return
    }

    // SIMPAN data profil ke state agar nomor WA dinamis bekerja
    setToko(profileData) 

    // 2. Ambil produk dan kategorinya
    const { data: produkData } = await supabase
      .from('products')
      .select('*, categories(nama_kategori)')
      .eq('profile_id', profileData.id)
      .eq('is_visible', true) // <--- SAMAKAN dengan kolom is_visible yang tadi kita buat

    if (produkData) setProduk(produkData)

    // 3. Ambil juga daftar kategori agar tombol filter muncul
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('profile_id', profileData.id)
    
    if (catData) setCategories(catData)
    
  } catch (error) {
    console.error("System Error:", error)
  } finally {
    setLoading(false)
  }
}
  // 1. Ambil Data dari Supabase
  useEffect(() => {
  // Hanya jalankan mesin pencari jika Slug di URL sudah terbaca
  if (params.slug) {
    fetchDataToko(); 
  }
}, [params.slug]); // <--- Akan otomatis cari ulang jika Bapak ganti alamat toko

  // 2. Logika Keranjang (Add, Update, Remove)
  const addToCart = (item: any) => {
    const exist = cart.find(x => x.id === item.id)
    if (exist) {
      setCart(cart.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x))
    } else {
      setCart([...cart, { ...item, qty: 1 }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
    ).filter(item => item.qty > 0))
  }

  const totalHarga = cart.reduce((acc, curr) => acc + (curr.harga * curr.qty), 0)

  // 3. Fitur Geolocation (Share Location)
  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`
        setForm({ ...form, maps: link })
        alert("📍 Lokasi pengiriman berhasil dikunci!")
      }, () => {
        alert("Gagal mengambil lokasi. Pastikan GPS aktif.")
      })
    }
  }

const formatNomorWA = (nomor: string) => {
  if (!nomor) return "";
  // 1. Hapus semua karakter selain angka (spasi, strip, dll)
  let cleaned = nomor.replace(/\D/g, "");
  
  // 2. Jika diawali '08', ganti jadi '628'
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  }
  
  // 3. Jika sudah diawali '8' (tanpa 0 atau 62), tambahkan '62'
  if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  
  return cleaned;
};

  // 4. Proses Checkout & Kirim ke WA
  // 4. Proses Checkout (Header & Detail)
const handleCheckout = async () => {
  if (!form.nama || cart.length === 0) return alert("Lengkapi nama dan pesanan!");
  setLoading(true);

  try {
    // TAHAP 1: Simpan Header ke tabel 'orders'
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ 
        profile_id: toko.id, // ID Toko (Penting!)
        nama_pelanggan: form.nama, 
        total_bayar: totalHarga,
        alamat_maps_url: form.maps,
        status_pesanan: 'antri'
      }])
      .select()
      .single(); // Ambil data order yang baru saja dibuat untuk dapat ID-nya

    if (orderError) throw orderError;

    // TAHAP 2: Simpan Detail ke tabel 'order_items' menggunakan ID dari order tadi
    const detailItems = cart.map(item => ({
      order_id: order.id, // Foreign Key ke tabel orders
      product_id: item.id, // Foreign Key ke tabel products
      jumlah: item.qty || item.quantity,
      subtotal: item.harga * (item.qty || item.quantity)
    }));

    const { error: itemError } = await supabase.from('order_items').insert(detailItems);
    if (itemError) throw itemError;

    // TAHAP 3: Kirim Notifikasi WhatsApp
    // TAHAP 3: Kirim Notifikasi WhatsApp
    const daftarBelanja = cart.map(c => `- ${c.nama_produk} (x${c.qty})`).join('%0A');
    const nomorTujuan = formatNomorWA(toko?.nomor_wa_admin);

    // Tambahkan variabel pembayaran di sini
    const textWA = `*PESANAN BARU* (ID: ${order.id.substring(0,5)})%0A` +
                  `*Nama:* ${form.nama}%0A` +
                  `*Item:*%0A${daftarBelanja}%0A` +
                  `*Total:* Rp ${totalHarga.toLocaleString()}%0A` +
                  `*Metode Pembayaran:* ${form.metode}%0A` + // <--- Baris baru
                  `📍 *Maps:* ${form.maps}`;

    window.open(`https://wa.me/${nomorTujuan}?text=${textWA}`, '_blank');
        
    // Reset Keranjang
    setCart([]);
    setShowCheckout(false);
    alert("Pesanan berhasil dicatat!");

  } catch (err) {
    console.error(err);
    alert("Terjadi kesalahan saat menyimpan pesanan.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-28 font-sans shadow-2xl relative">
    
    {/* HEADER */}
<div className="p-6 bg-white sticky top-0 z-20 shadow-sm border-b-2 border-emerald-50">
  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
    Powered by AhmadCoding
  </p>
  <h1 
    className="text-2xl font-black uppercase leading-none" 
    style={{ color: '#10b981' }}
  >
    {toko?.nama_toko || 'NESSA'}
  </h1>
  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
    Digital Food Order System
  </p>
  <p className="text-xs text-gray-400 mt-2 font-medium">
    Silakan pilih menu favorit Anda di bawah ini ✨
  </p>
</div>

 {/* FILTER KATEGORI */}
<div className="flex gap-2 overflow-x-auto p-4 no-scrollbar bg-white border-b">
  <button 
    onClick={() => setSelectedCat('Semua')}
    style={selectedCat === 'Semua' ? { backgroundColor: '#10b981', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
    className="px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm"
  >
    Semua
  </button>
  {categories.map(c => (
    <button 
      key={c.id}
      onClick={() => setSelectedCat(c.nama_kategori)}
      style={selectedCat === c.nama_kategori ? { backgroundColor: '#10b981', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
      className="px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm"
    >
      {c.nama_kategori}
    </button>
  ))}
</div>

{/* LIST PRODUK */}
<div className="p-4 grid gap-4">
  {produk.filter(p => selectedCat === 'Semua' || p.categories?.nama_kategori?.toLowerCase() === selectedCat.toLowerCase()).map(p => (
    <div key={p.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-gray-100 hover:border-emerald-200 transition-all">
      <div className="flex-grow">
        <h3 className="font-bold text-gray-800">{p.nama_produk}</h3>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 font-black text-lg">Rp {p.harga.toLocaleString()}</span>
          {p.harga_asli && <span className="text-xs text-gray-400 line-through italic">Rp {p.harga_asli.toLocaleString()}</span>}
        </div>
      </div>
      <button 
        onClick={() => addToCart(p)}
        style={{ backgroundColor: '#10b981', color: 'white' }}
        className="h-10 px-6 rounded-xl font-black text-xs shadow-md active:scale-90 transition-all uppercase tracking-tight"
      >
        + TAMBAH
      </button>
    </div>
  ))}
</div>

{/* FLOATING CART BUTTON - VERSI PASTI HIJAU */}
{cart.length > 0 && (
  <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 px-6">
    <button 
      onClick={() => setShowCheckout(true)}
      style={{ backgroundColor: '#059669' }} // Paksa Hijau Emerald 600
      className="w-full max-w-sm text-white p-5 rounded-[2rem] shadow-2xl flex justify-between items-center transition-all active:scale-95"
    >
      <div className="text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-white opacity-90">
          Total {cart.length} Pesanan
        </p>
        <p className="font-black text-2xl text-white">
          Rp {totalHarga.toLocaleString()}
        </p>
      </div>
      <div 
        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} 
        className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/30"
      >
        <span className="font-black text-sm uppercase text-white">Cek Keranjang</span>
      </div>
    </button>
  </div>
)}

      {/* MODAL CHECKOUT POS STYLE */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">Review Pesanan</h2>
              <button onClick={() => setShowCheckout(false)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400">×</button>
            </div>

            {/* TABEL POS */}
            <div className="border-2 border-gray-100 rounded-3xl overflow-hidden mb-6 bg-white shadow-sm">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="p-4 text-left w-1/2">Menu</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cart.map((item) => (
                    <tr key={item.id} className="text-sm">
                      {/* Kolom Menu: Dibuat wrap agar jika nama panjang tidak merusak tabel */}
                      <td className="p-4">
                        <p className="font-bold text-gray-800 leading-tight">{item.nama_produk}</p>
                        <p className="text-[10px] text-gray-400 italic">Rp {item.harga.toLocaleString()}</p>
                      </td>

                      {/* Kolom Qty: Dibuat lebih lega tombolnya */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2 bg-gray-50 p-1 rounded-xl">
                          <button 
                            onClick={() => updateQty(item.id, -1)} 
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm active:scale-90 transition-all"
                          >
                            <span style={{ color: '#10b981' }} className="font-black">-</span>
                          </button>
                          <span className="font-black text-gray-700 w-4 text-center">{item.qty}</span>
                          <button 
                            onClick={() => updateQty(item.id, 1)} 
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm active:scale-90 transition-all"
                          >
                            <span style={{ color: '#10b981' }} className="font-black">+</span>
                        </button>
                        </div>
                      </td>

                      {/* Kolom Subtotal */}
                      <td className="p-4 text-right font-black text-gray-900">
                        Rp {(item.harga * item.qty).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                
                {/* Footer: Dibuat lebih kontras sebagai highlight */}
                <tfoot style={{ backgroundColor: '#065f46' }} className="text-white">
                  <tr className="font-black">
                    <td colSpan={2} className="p-5 text-xs uppercase tracking-widest opacity-90 text-white">
                      Total Bayar
                    </td>
                    <td className="p-5 text-right text-xl font-black text-white">
                      Rp {totalHarga.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* FORM DATA & METODE PEMBAYARAN */}
            <div className="space-y-4 mb-6">
              <input 
                type="text" placeholder="Tulis Nama Anda..." 
                className="w-full p-4 bg-gray-100 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 transition-all font-bold"
                onChange={(e) => setForm({...form, nama: e.target.value})}
              />
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleShareLocation}
                  className={`p-3 rounded-2xl text-[10px] font-black border-2 transition-all ${form.maps ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-blue-100 text-blue-600'}`}
                >
                  📍 {form.maps ? 'LOKASI TERKUNCI' : 'SHARE LOKASI (MAPS)'}
                </button>
                <select 
                  className="p-3 rounded-2xl text-[10px] font-black border-2 border-gray-100 bg-white outline-none"
                  onChange={(e) => setForm({...form, metode: e.target.value})}
                >
                  <option value="Tunai">💵 TUNAI / COD</option>
                  <option value="QRIS">📱 QRIS (SCAN)</option>
                  <option value="Transfer">🏦 TRANSFER BANK</option>
                </select>
              </div>

              {/* Tampilan QRIS jika dipilih */}
              {form.metode === 'QRIS' && (
                <div className="mt-4 p-4 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Scan QRIS di bawah ini</p>
                  
                  <img 
                    src={toko?.qris_url} 
                    className="w-48 h-48 object-contain rounded-xl"
                    alt="QRIS Pembayaran"
                    onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/200?text=QRIS+Belum+Siap" }}
                  />
                </div>
              )}
            </div>

            {/* TOMBOL AKHIR */}
            <button 
              disabled={loading}
              onClick={handleCheckout}
              style={{ backgroundColor: '#10b981' }}
              className="w-full text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 active:scale-95 transition-all flex justify-center items-center gap-3 mt-6"
            >
              {loading ? 'MEMPROSES...' : '🚀 KIRIM PESANAN SEKARANG'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}