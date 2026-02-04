'use client'
import { useRouter } from 'next/navigation'; // Pastikan import ini ada di paling atas
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SettingsForm from './SettingsForm'; // Import komponennya
import { QRCodeSVG } from 'qrcode.react'; // <--- Tambahkan baris ini!

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([])
  const [omzet, setOmzet] = useState(0)
  const [host, setHost] = useState('');

  const fetchData = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        jumlah,
        subtotal,  
        products (nama_produk)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Gagal ambil data:", error);
  } else if (data) {
    setOrders(data);
    
    const total = data
      .filter(o => o.status_pesanan === 'selesai')
      .reduce((acc, curr) => acc + curr.total_bayar, 0);
    setOmzet(total);
  }
};
// 1. Tambahkan state untuk profile
const [profile, setProfile] = useState<any>(null)

// 2. Tambahkan fungsi untuk mengambil data profil
const fetchProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('slug, nama_toko')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data)
  }
}

  useEffect(() => {
    const checkAccessAndSubscribe = async () => {
    // --- 1. PROTEKSI LOGIN (SATPARAM) ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined') {
    setHost(window.location.origin);
  }
  fetchData();
  fetchProfile();

  // AKTIFKAN REALTIME LISTENER
  const channel = supabase
    .channel('order-updates') // Beri nama bebas
    .on(
      'postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' }, 
      (payload) => {
        console.log('Ada perubahan data!', payload);
        fetchData(); // Panggil ulang data setiap ada perubahan di tabel orders
        
        // Opsional: Bunyi notifikasi jika ada pesanan baru
        if (payload.eventType === 'INSERT') {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
  const channelPromise = checkAccessAndSubscribe();

  // --- CLEANUP ---
  return () => {
        channelPromise.then((channel) => {
          if (channel) {
            // @ts-ignore
            supabase.removeChannel(channel);
          }
        });
      };
    }, [router]);// Tambahkan router di dependency agar sinkron

  const updateStatus = async (id: string, statusBaru: string) => {
  console.log("Mencoba update ID:", id, "ke status:", statusBaru); // Cek di console browser (F12)

  const { error } = await supabase
    .from('orders')
    .update({ status_pesanan: statusBaru }) // Pastikan nama kolom di Supabase tepat 'status_pesanan'
    .eq('id', id);

  if (error) {
    console.error("Detail Error Supabase:", error.message);
    alert("Gagal Update: " + error.message);
  } else {
    console.log("Update Berhasil!");
    // Panggil kembali data terbaru agar tampilan berubah
    fetchData(); 
  }
};

const handlePrint = (order: any) => {
  // 1. OLAH DATA ITEM DULU (Agar muncul daftar menu di struk)
  const rincianStruk = order.order_items?.map((item: any) => {
  // Ambil nama produk, tangani jika products adalah objek atau array
  const namaMenu = Array.isArray(item.products) 
    ? item.products[0]?.nama_produk 
    : item.products?.nama_produk;

  return `
    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>${namaMenu || 'Menu'} x${item.jumlah}</span>
        <span>Rp ${(item.subtotal || 0).toLocaleString()}</span>
    </div>
  `;
}).join('') || '<div class="text-center">Tidak ada detail menu</div>';

  // 2. BUKA JENDELA PRINT
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  // 3. SUSUN HTML STRUK
  const content = `
    <html>
      <head>
        <style>
          body { font-family: 'Courier New', monospace; width: 58mm; padding: 10px; font-size: 11px; color: #000; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .bold { font-weight: bold; }
          .text-center { text-align: center; }
          .flex { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 14px;">AHMAD CODING</div>
        <div class="text-center" style="font-size: 8px;">Digital Order System</div>
        <div class="line"></div>
        
        <div style="font-size: 10px;">
          <div>Nota: #${order.id.substring(0, 5).toUpperCase()}</div>
          <div>Plg : ${order.nama_pelanggan}</div>
        </div>
        <div class="line"></div>
        
        <div class="bold" style="margin-bottom: 5px;">DAFTAR MENU:</div>
        
        ${rincianStruk} 
        
        <div class="line"></div>
        <div class="flex bold" style="font-size: 12px;">
          <span>TOTAL BAYAR</span>
          <span>Rp ${order.total_bayar.toLocaleString()}</span>
        </div>
        <div class="line"></div>

        <div class="text-center" style="margin-top: 10px; font-size: 9px;">
          Terima kasih sudah jajan!<br>
          YouTube: AhmadCoding
        </div>

        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          }
        </script>
      </body>
    </html>
  `;

  // 4. KIRIM KE PRINTER
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
  }
};

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) alert(error.message)
  else window.location.href = '/login' // Tendang balik ke halaman login
}

const linkToko = `${host}/s/${profile?.slug}`;
// Masukkan variabel rincianStruk ke dalam HTML struk Anda
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
    <div className="max-w-5xl mx-auto">
      
      {/* HEADER: Judul & Logout Sejajar */}
      {/* HEADER: Judul & Navigasi & Logout */}
    {/* HEADER: Judul & Navigasi & Logout */}
      {/* HEADER: Judul & Navigasi & Logout */}
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
  <div>
    <h1 className="text-3xl font-black text-gray-800">
      Admin Dashboard 👨‍🍳
    </h1>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Ahmad Coding System</p>
  </div>
  
  {/* NAVIGASI TOMBOL: Menggunakan Grid agar sama rata di HP */}
  <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
    {/* 1. TOMBOL LIHAT TOKO */}
    <button 
      onClick={() => {
        if (profile.slug) {
          window.open(`/s/${profile.slug}`, '_blank');
        } else {
          alert("Silakan atur Slug terlebih dahulu!");
        }
      }}
      className="bg-orange-500 text-white px-4 py-3 rounded-2xl font-black text-[10px] shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all uppercase tracking-widest text-center flex items-center justify-center"
    >
      🌐 Buka Toko
    </button>

    {/* 2. TOMBOL KELOLA MENU */}
    <a 
      href="/admin/menu" 
      className="bg-blue-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-center flex items-center justify-center"
    >
      🍱 Kelola Menu
    </a>

    {/* 3. TOMBOL KELOLA KATEGORI */}
    <a 
      href="/admin/categories" 
      className="bg-purple-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all uppercase tracking-widest text-center flex items-center justify-center"
    >
      🏷️ Kategori
    </a>

    {/* 4. TOMBOL LOGOUT */}
    <button 
      onClick={handleLogout}
      className="bg-white text-red-500 px-4 py-3 rounded-2xl font-black text-[10px] shadow-sm hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest border border-red-100 text-center flex items-center justify-center"
    >
      Keluar
    </button>
  </div>
</div>
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-orange-500">
            <p className="text-gray-400 text-xs font-bold uppercase">Omzet Selesai</p>
            <p className="text-2xl font-black text-gray-800">Rp {omzet.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-blue-500">
            <p className="text-gray-400 text-xs font-bold uppercase">Antrian Aktif</p>
            <p className="text-2xl font-black text-gray-800">{orders.filter(o => o.status_pesanan === 'antri').length} Pesanan</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-b-4 border-green-500">
            <p className="text-gray-400 text-xs font-bold uppercase">Total Orderan</p>
            <p className="text-2xl font-black text-gray-800">{orders.length}</p>
          </div>
        </div>
        {/* 2. LETAKKAN DI SINI: BAGIKAN LINK & QR CODE */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            🔗 Bagikan Link Toko
          </h3>

          {/* 1. QR CODE */}
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <QRCodeSVG 
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${profile?.slug || ''}`}
                size={140} 
              />
            </div>
          </div>

          {/* 2. INPUT LINK */}
          <div className="flex gap-2 mb-4">
            <input 
              readOnly 
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/s/${profile?.slug || ''}`}
              className="flex-grow bg-gray-100 p-3 rounded-xl text-xs font-mono text-gray-600 border-none"
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/s/${profile?.slug}`);
                alert("Link disalin!");
              }}
              className="bg-orange-500 text-white px-4 rounded-xl text-[10px] font-bold"
            >
              SALIN
            </button>
          </div>

          {/* 3. TOMBOL WHATSAPP (SAYA BUAT STANDAR BANGET BIAR GAK TERPOTONG) */}
          <button 
            onClick={() => {
              const teksWA = `Halo! Yuk jajan di *${profile?.nama_toko || 'Toko Kami'}* lewat link ini: ${window.location.origin}/s/${profile?.slug}`;
              window.open(`https://wa.me/?text=${teksWA}`, '_blank');
            }}
            style={{ backgroundColor: '#25D366', color: 'white', width: '100%', padding: '15px', borderRadius: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <span>📲</span>
            <span style={{ fontSize: '14px' }}>BAGIKAN KE WHATSAPP</span>
          </button>
        </div>       
        {/* ORDER LIST: VERSI STABIL & AMAN (TIDAK AKAN HANCUR) */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          {/* Pembungkus ini yang bikin tabel bisa digeser di HP tapi tetap rapi di Laptop */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="p-6">Nama Pelanggan</th>
                  <th className="p-6">Rincian Menu</th>
                  <th className="p-6">Total Bayar</th>
                  <th className="p-6 text-center">Status</th>
                  <th className="p-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-all">
                    {/* 1. NAMA */}
                    <td className="p-6">
                      <div className="font-bold text-gray-800 text-lg lowercase first-letter:uppercase">
                        {order.nama_pelanggan}
                      </div>
                    </td>

                    {/* 2. MENU */}
                    <td className="p-6">
                      <div className="flex flex-wrap gap-1">
                        {order.order_items?.map((item: any, idx: number) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded-md border border-blue-100 font-bold">
                            {item.products?.nama_produk} x{item.jumlah}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 3. TOTAL */}
                    <td className="p-6 font-black text-orange-600 text-base">
                      Rp {order.total_bayar?.toLocaleString()}
                    </td>

                    {/* 4. STATUS */}
                    <td className="p-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        order.status_pesanan === 'antri' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {order.status_pesanan}
                      </span>
                    </td>

                    {/* 5. AKSI */}
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                        {order.status_pesanan === 'antri' && (
                          <button 
                            onClick={() => updateStatus(order.id, 'dimasak')} 
                            className="bg-blue-600 text-white text-[10px] px-4 py-2 rounded-xl font-black shadow-lg shadow-blue-100 whitespace-nowrap"
                          >
                            👨‍🍳 TERIMA
                          </button>
                        )}
                        {order.status_pesanan === 'selesai' && (
                          <button 
                            onClick={() => handlePrint(order)} 
                            className="bg-gray-800 text-white text-[10px] px-4 py-2 rounded-xl font-black shadow-lg whitespace-nowrap"
                          >
                            🖨️ STRUK
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mb-8">
           <SettingsForm />
        </div>
      </div>
    </div>
  )
}