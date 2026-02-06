'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Pastikan path ke supabase.ts sudah benar
import { useRouter } from 'next/navigation';

export default function LacakPesanan() {
  const [pesanan, setPesanan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // 1. Tambahkan state baru di bagian atas (bersama state lainnya)
  const [inputWa, setInputWa] = useState('');
  const [isSearching, setIsSearching] = useState(false);


  // 2. Fungsi untuk mencari berdasarkan nomor yang diketik manual
const handleCariManual = async () => {
  if (!inputWa) return;
  setIsSearching(true);
  
  const { data } = await supabase
    .from('orders')
    .select('*, profiles(nama_toko)')
    .eq('nomor_wa_pelanggan', inputWa)
    .order('created_at', { ascending: false });

  if (data) {
    setPesanan(data);
    // Sekalian simpan ke memori HP supaya besok-besok nggak ngetik lagi
    localStorage.setItem('pembeli_wa', inputWa);
  }
  setIsSearching(false);
};
  useEffect(() => {
    async function fetchStatus() {
      // 1. Ambil nomor WA dari memori HP
      const waTersimpan = localStorage.getItem('pembeli_wa');
      
      if (!waTersimpan) {
        setLoading(false);
        return;
      }

      // 2. Tarik data dari Supabase berdasarkan nomor WA
      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles(nama_toko)')
        .eq('nomor_wa_pelanggan', waTersimpan)
        .order('created_at', { ascending: false })
        .limit(5); // Ambil 5 pesanan terakhir

      if (!error && data) {
        setPesanan(data);
      }
      setLoading(false);
    }

    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-5 pb-20 font-sans">
      {/* Tombol Kembali & Judul */}
      {/* Header Lacak */}
        <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="...">👈</button>
        <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">STATUS PESANAN</h1>
            {/* GANTI BAGIAN INI PAK: */}
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
            {pesanan[0]?.profiles?.nama_toko || 'TOKO ANDA'} 
            </p>
            <div className="mb-6 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Cek Nomor WhatsApp Lain:</p>
                <div className="flex gap-2">
                    <input 
                    type="number" 
                    placeholder="0812xxxx"
                    className="flex-1 bg-gray-50 p-3 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    value={inputWa}
                    onChange={(e) => setInputWa(e.target.value)}
                    />
                    <button 
                    onClick={handleCariManual}
                    className="bg-orange-500 text-white px-5 rounded-2xl font-black text-[10px] uppercase shadow-md shadow-orange-100 active:scale-95 transition-all"
                    >
                    {isSearching ? '...' : 'CARI'}
                    </button>
                </div>
            </div>
        </div>
        </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
          <p className="font-bold text-sm">Mengecek pesanan Bapak/Ibu...</p>
        </div>
      ) : pesanan.length > 0 ? (
        <div className="space-y-5">
          {pesanan.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 relative overflow-hidden">
              
              {/* Header Kartu */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-tighter mb-1">ID: #{p.id.slice(0, 8)}</p>
                  <p className="text-sm font-black text-gray-800 uppercase italic">
                    {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* Status Badge */}
                <div className={`px-4 py-2 rounded-2xl text-[9px] font-black tracking-tighter shadow-sm ${
                  p.status_pesanan === 'antri' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                  p.status_pesanan === 'dimasak' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {p.status_pesanan === 'antri' && '⏳ MENUNGGU'}
                  {p.status_pesanan === 'dimasak' && '👨‍🍳 DIMASAK'}
                  {p.status_pesanan === 'selesai' && '✅ SELESAI'}
                </div>
              </div>

              {/* Progress Bar Visual */}
              <div className="relative h-2 w-full bg-gray-100 rounded-full mb-6">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                    p.status_pesanan === 'antri' ? 'w-1/3 bg-blue-500' : 
                    p.status_pesanan === 'dimasak' ? 'w-2/3 bg-orange-500' : 
                    'w-full bg-emerald-500'
                  }`}
                />
              </div>

              {/* Pesan Keterangan */}
              <div className="bg-gray-50 p-4 rounded-2xl">
                <p className="text-[11px] text-gray-600 font-bold leading-relaxed italic text-center">
                  {p.status_pesanan === 'antri' && "“Sabar ya, pesanan Bapak/Ibu sudah masuk antrian dapur kami.”"}
                  {p.status_pesanan === 'dimasak' && "“Mantap! Chef kami sedang mengolah hidangan spesial untuk Anda.”"}
                  {p.status_pesanan === 'selesai' && "“Pesanan sudah Matang & Siap! Silakan diambil atau tunggu kurir kami.”"}
                </p>
              </div>

              {/* Total Bayar Sederhana */}
              <div className="mt-5 pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Total Pesanan</span>
                <span className="text-sm font-black text-gray-800">Rp {Number(p.total_bayar).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-[3rem] text-center shadow-sm border border-gray-100">
          <p className="text-5xl mb-6">🥡</p>
          <p className="font-black text-gray-800 text-lg mb-2">Belum Ada Pesanan</p>
          <p className="text-xs text-gray-400 font-medium leading-relaxed px-4">
            Sepertinya Bapak/Ibu belum melakukan pemesanan hari ini. Silakan pilih menu lezat kami dulu ya!
          </p>
          <button 
            onClick={() => router.push('/')}
            className="mt-8 bg-emerald-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-200 active:scale-95 transition-all"
          >
            Lihat Menu Sekarang
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-10 text-center pb-10">
            <p className="text-[8px] font-medium text-gray-400/50 uppercase tracking-[0.2em]">
                Powered by AhmadCoding
            </p>
            </div>
    </div>
  );
}