'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'; // 1. Import mesin navigasi


export default function MenuPage() {
  const router = useRouter(); // 2. 
  const [loading, setLoading] = useState(false)
  const [menus, setMenus] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
  nama_produk: '',
  harga: '',
  harga_asli: '', // <--- WAJIB beri string kosong '' agar tidak error uncontrolled
  category_id: '',
  deskripsi: '',
  image_url: '',
  is_best_seller: false // <--- Tambahkan ini di sini
});
// / 1. Update State Awal
const [formData, setFormData] = useState({
  nama_produk: '',
  harga_asli: '', // <--- Tambahkan ini untuk harga modal
  harga: '',      // Ini harga jual ke pelanggan
  deskripsi: '',
  category_id: '',
  image_url: '',
  is_best_seller: false
});
 const [editingId, setEditingId] = useState<string | null>(null); // <--- INI YANG KURANG 

  useEffect(() => {
  const fetchCategories = async () => {
    // Ambil ID Bapak yang sedang login
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('profile_id', user.id) // <--- Penting agar tidak kosong
        .order('nama_kategori', { ascending: true });
        
      if (data) setCategories(data);
    }
  };
  fetchCategories();
  fetchMenus()

}, []);

  const fetchMenus = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(nama_kategori)')
      .eq('profile_id', user.id) 
      .eq('is_visible', true) // <--- TAMBAHKAN INI (Sekarang is_visible aktif!)
      .order('created_at', { ascending: false });
    
    if (data) setMenus(data);
    if (error) console.error("Gagal mengambil menu:", error.message);
  }
};

  const simpanMenu = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1. Ambil ID User yang sedang login
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Anda harus login terlebih dahulu!");

    // 2. Siapkan Payload
    // 2. Siapkan Payload (DENGAN IS_BEST_SELLER)
    const payload = {
      nama_produk: form.nama_produk,
      harga: parseFloat(form.harga),
      harga_asli: form.harga_asli ? parseFloat(form.harga_asli) : null,
      deskripsi: form.deskripsi,
      category_id: form.category_id,
      image_url: form.image_url,
      profile_id: user.id,
      is_best_seller: form.is_best_seller // <--- INI KUNCI YANG TADI KETINGGALAN!
    };

    if (editingId) {
      // --- UPDATE ---
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingId);
      if (error) throw error;
      alert("✅ Menu berhasil diperbarui!");
    } else {
      // --- INSERT (TAMBAH BARU) ---
      const { error } = await supabase
        .from('products')
        .insert([{ 
          ...payload, 
          is_visible: true // Jamin menu baru langsung aktif
        }]);
      if (error) throw error;
      alert("🚀 Menu baru berhasil ditambahkan!");
    }

    
    // Reset Form & Refresh
    setForm({ 
      nama_produk: '', 
      harga: '', 
      harga_asli: '', 
      deskripsi: '', 
      category_id: '', 
      image_url: '', 
      is_best_seller: false // <--- Reset jadi false lagi
    });
    setEditingId(null);
    fetchMenus();

  } catch (error: any) {
    alert("Kesalahan: " + error.message);
  } finally {
    setLoading(false);
  }
};
  const uploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
  try {
    setLoading(true);
    const file = e.target.files?.[0];
    if (!file) return;

    // Nama file unik berdasarkan waktu agar tidak duplikat di storage
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;
    
    // 1. Upload ke Bucket (Pastikan namanya SAMA dengan yang Bapak buat di Supabase)
    const { error: uploadError } = await supabase.storage
      .from('food-images') // Sesuaikan dengan nama bucket yang Bapak buat lewat SQL tadi
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // 2. Ambil Link Publik
    const { data } = supabase.storage
      .from('food-images')
      .getPublicUrl(fileName);

    // 3. Simpan link ke state form
    if (data.publicUrl) {
      setForm({ ...form, image_url: data.publicUrl });
      alert("Foto berhasil diunggah! 📸");
    }

  } catch (error: any) {
    alert("Gagal unggah: " + error.message);
  } finally {
    setLoading(false);
  }
};
// Fungsi Hapus
const hapusMenu = async (id: string) => {
  const confirmDelete = confirm("Menu ini tidak akan dihapus permanen, tapi akan disembunyikan dari pelanggan. Lanjutkan?");
  
  if (confirmDelete) {
    // Kita tidak pakai .delete(), tapi pakai .update()
    const { error } = await supabase
      .from('products')
      .update({ is_visible: false }) // Sembunyikan saja
      .eq('id', id);

    if (error) {
      alert("Gagal menyembunyikan menu: " + error.message);
    } else {
      alert("Menu berhasil dinonaktifkan!");
      fetchMenus(); // Segarkan tampilan
    }
  }
};

// Fungsi Edit (Contoh sederhana: mengarahkan ke form edit)
const editMenu = (item: any) => {
  // Gunakan setForm sesuai dengan nama state yang Bapak pakai di input
  setForm({
    nama_produk: item.nama_produk,
    harga_asli: item.harga_asli ? item.harga_asli.toString() : '',
    harga: item.harga.toString(),
    deskripsi: item.deskripsi || '',
    category_id: item.category_id || '',
    image_url: item.image_url || '',
    is_best_seller: item.is_best_seller || false   
  });
  
  setEditingId(item.id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  return (
    <div className="p-8 mt-12">
      {/* --- TOMBOL KEMBALI (TAMBAHKAN DI SINI) --- */}
      <button 
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs mb-4"
      >
        ⬅️ Kembali ke Dashboard
      </button>

      <h1 className="text-2xl font-black mb-8 uppercase">Manajemen Menu 🍱</h1>
      
      {/* FORM INPUT */}
      <form onSubmit={simpanMenu} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. NAMA MENU */}
            <input 
              placeholder="Nama Menu (Contoh: Nasi Box Ayam Bakar)" 
              className="p-3 bg-gray-50 rounded-xl font-bold"
              value={form.nama_produk}
              onChange={(e) => setForm({...form, nama_produk: e.target.value})}
              required
            />

            {/* 2. KATEGORI MENU */}
            <select 
              className="p-3 bg-gray-50 rounded-xl font-bold outline-none"
              value={form.category_id}
              onChange={(e) => setForm({...form, category_id: e.target.value})}
              required
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nama_kategori}</option>
              ))}
            </select>

            {/* 3. HARGA JUAL */}
            <div>
              <label className="block text-[9px] font-black text-gray-400 mb-1 ml-2 uppercase">Harga Jual Sekarang (Rp)</label>
              <input 
                placeholder="Contoh: 15000" 
                type="number"
                className="w-full p-3 bg-gray-50 rounded-xl font-bold"
                value={form.harga}
                onChange={(e) => setForm({...form, harga: e.target.value})}
                required
              />
            </div>

            {/* 4. HARGA ASLI (LOGIKA BARU: OTOMATIS CORET JIKA BERBEDA) */}
            <div>
              <label className="block text-[9px] font-black text-gray-400 mb-1 ml-2 uppercase">Harga Coret / Asli (Rp)</label>
              <input 
                placeholder="Kosongkan jika tidak promo" 
                type="number"
                className="w-full p-3 bg-orange-50 rounded-xl font-bold text-orange-600 border-2 border-orange-100 focus:border-orange-300"
                value={form.harga_asli}
                onChange={(e) => setForm({...form, harga_asli: e.target.value})}
              />
              {/* Label Diskon Otomatis */}
              {Number(form.harga_asli) > Number(form.harga) && (
                <p className="text-[10px] text-green-600 ml-2 mt-1 font-black animate-pulse">
                  🎉 HEMAT: {Math.round(((form.harga_asli - form.harga) / form.harga_asli) * 100)}%
                </p>
              )}
            </div>

            {/* 5. CHECKBOX BEST SELLER (FITUR BARU) */}
            <div className="md:col-span-2 mt-2">
              <label className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 cursor-pointer hover:bg-amber-100 transition-all">
                <input 
                  type="checkbox"
                  checked={form.is_best_seller}
                  onChange={(e) => setForm({...form, is_best_seller: e.target.checked})}
                  className="w-6 h-6 rounded-lg text-amber-500 border-amber-300 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-black text-amber-900">🔥 JADIKAN MENU BEST SELLER</span>
                  <span className="block text-[10px] text-amber-600 font-bold">Muncul label spesial di HP Pelanggan</span>
                </div>
              </label>
            </div>

            <textarea 
              placeholder="Deskripsi Singkat" 
              className="p-3 bg-gray-50 rounded-xl font-bold md:col-span-2"
              value={form.deskripsi}
              onChange={(e) => setForm({...form, deskripsi: e.target.value})}
            />

            {/* FOTO MASAKAN */}
            <div className="md:col-span-2 p-4 border-2 border-dashed border-gray-200 rounded-2xl">
              <label className="block text-xs font-black text-gray-400 mb-2 uppercase">Foto Masakan</label>
              <input 
                  type="file" 
                  accept="image/*" 
                  onChange={uploadFoto} 
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700"
                />
                {form.image_url && (
                  <div className="mt-4">
                    <img src={form.image_url} className="h-32 w-32 object-cover rounded-2xl border-4 border-white shadow-md" />
                  </div>
                )}
            </div>
          </div>

          <button 
              disabled={loading}
              className={`mt-6 w-full px-8 py-4 rounded-2xl font-black transition-all shadow-xl ${
                editingId 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' 
                  : 'bg-black hover:bg-gray-800 text-white'
              }`}
            >
              {loading ? 'Sabar Pak, Sedang Proses...' : editingId ? '💾 SIMPAN PERUBAHAN MENU' : '➕ TAMBAHKAN MENU BARU'}
            </button>
        </form>

      {/* DAFTAR MENU */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {menus.map((item) => (
    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex gap-4 shadow-sm relative overflow-hidden">
      
      {/* 1. LABEL BEST SELLER (PERBAIKAN WARNA TULISAN) */}
      {item.is_best_seller && (
        <div className="absolute top-0 left-0 bg-amber-500 shadow-md z-10 flex items-center gap-1 px-2 py-1 rounded-br-xl">
          <span className="text-[9px]">🔥</span>
          <span className="text-[9px] font-black text-black tracking-tighter">
            BEST SELLER
          </span>
        </div>
      )}

      {/* 2. FOTO MENU (Dibuat lebih kecil & kotak) */}
      <div className="w-24 h-24 flex-shrink-0">
        <img 
          src={item.image_url || 'https://via.placeholder.com/150'} 
          className="w-full h-full object-cover rounded-xl"
          alt={item.nama_produk}
        />
      </div>

      {/* 3. INFO PRODUK */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-800 uppercase leading-tight">{item.nama_produk}</h3>
          
          <div className="flex items-center gap-2 mt-1">
            {/* Harga Sekarang */}
            <span className="text-sm font-black text-orange-600">Rp {item.harga?.toLocaleString()}</span>
            
            {/* HARGA CORET & PERSENTASE (Otomatis muncul jika ada harga_asli) */}
            {item.harga_asli > item.harga && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 line-through">Rp {item.harga_asli.toLocaleString()}</span>
                <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded font-bold">
                  -{Math.round(((item.harga_asli - item.harga) / item.harga_asli) * 100)}%
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 line-clamp-2 mt-1 leading-none">{item.deskripsi}</p>
        </div>

        {/* 4. TOMBOL AKSI (Dibuat minimalis) */}
        <div className="flex gap-2 mt-2">
          <button 
            onClick={() => editMenu(item)}
            className="flex-1 py-2 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-600 hover:text-white transition-all"
          >
            📝 EDIT
          </button>
          <button 
            onClick={() => hapusMenu(item.id)}
            className="flex-1 py-2 bg-red-50 text-red-600 text-[10px] font-black rounded-lg hover:bg-red-600 hover:text-white transition-all"
          >
            🗑️ HAPUS
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
    </div>
  )
}