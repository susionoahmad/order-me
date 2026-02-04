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
  image_url: ''
});
// / 1. Update State Awal
const [formData, setFormData] = useState({
  nama_produk: '',
  harga_asli: '', // <--- Tambahkan ini untuk harga modal
  harga: '',      // Ini harga jual ke pelanggan
  deskripsi: '',
  category_id: '',
  image_url: ''
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
    const payload = {
      nama_produk: form.nama_produk,
      harga: parseFloat(form.harga),
      harga_asli: form.harga_asli ? parseFloat(form.harga_asli) : null,
      deskripsi: form.deskripsi,
      category_id: form.category_id,
      image_url: form.image_url,
      profile_id: user.id // <--- WAJIB ADA agar tidak kena error RLS
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
    setForm({ nama_produk: '', harga: '', harga_asli: '', deskripsi: '', category_id: '', image_url: '' });
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
const handleDelete = async (id: string) => {
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
const handleEdit = (item: any) => {
  // Gunakan setForm sesuai dengan nama state yang Bapak pakai di input
  setForm({
    nama_produk: item.nama_produk,
    harga_asli: item.harga_asli ? item.harga_asli.toString() : '',
    harga: item.harga.toString(),
    deskripsi: item.deskripsi || '',
    category_id: item.category_id || '',
    image_url: item.image_url || ''
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
          <input 
            placeholder="Nama Menu (Contoh: Nasi Box Ayam Bakar)" 
            className="p-3 bg-gray-50 rounded-xl font-bold"
            value={form.nama_produk}
            onChange={(e) => setForm({...form, nama_produk: e.target.value})}
            required
          />
          <input 
            placeholder="Harga (Contoh: 25000)" 
            type="number"
            className="p-3 bg-gray-50 rounded-xl font-bold"
            value={form.harga}
            onChange={(e) => setForm({...form, harga: e.target.value})}
            required
          />
          {/* DROPDOWN KATEGORI - Wajib ada agar logika Harga Asli jalan */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase ml-2">Pilih Kategori Menu</label>
            <select 
              className="w-full p-3 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-orange-500"
              value={form.category_id}
              onChange={(e) => setForm({...form, category_id: e.target.value})}
              required
            >
              <option value="">-- Pilih Kategori --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nama_kategori}</option>
              ))}
            </select>
          </div>

          {/* Logika Harga Asli Bapak sudah benar, pastikan ditaruh tepat di bawah select ini */}
          {/* 2. Input Harga Asli (HANYA MUNCUL UNTUK PROMO) */}
            {/* Pastikan kita mencari objek kategori yang ID-nya cocok dengan yang dipilih di form */}
            {categories.find(c => c.id === form.category_id)?.nama_kategori.toLowerCase() === 'promo' && (
              <div className="md:col-span-2 mt-4 animate-bounce-subtle">
                <input 
                  type="number" 
                  placeholder="Harga Asli Sebelum Diskon (Contoh: 20000)"
                  className="w-full bg-orange-50 p-4 rounded-2xl border-2 border-orange-200 outline-none font-bold text-orange-600"
                  value={form.harga_asli} // <--- Tambahkan value agar tersinkron dengan state
                  onChange={(e) => setForm({...form, harga_asli: e.target.value})}
                />
                <p className="text-[10px] text-orange-400 ml-2 mt-1 font-bold">*Harga ini akan muncul dengan coretan (diskon)</p>
              </div>
            )}
          <textarea 
            placeholder="Deskripsi Singkat" 
            className="p-3 bg-gray-50 rounded-xl font-bold md:col-span-2"
            value={form.deskripsi}
            onChange={(e) => setForm({...form, deskripsi: e.target.value})}
          />
          <div className="md:col-span-2 p-4 border-2 border-dashed border-gray-200 rounded-2xl">
            <label className="block text-xs font-black text-gray-400 mb-2 uppercase">Foto Masakan</label>
            <input 
                type="file" 
                accept="image/*" 
                onChange={uploadFoto} 
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
            {/* Preview Gambar jika sudah terupload */}
              {form.image_url && (
                <div className="mt-4 relative inline-block">
                  <img src={form.image_url} className="h-32 w-32 object-cover rounded-2xl border-4 border-white shadow-md" />
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
          </div>
        </div>
        <button 
            disabled={loading}
            className={`mt-6 w-full px-8 py-3 rounded-xl font-black transition-all shadow-lg ${
              editingId 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' // Warna biru kalau lagi EDIT
                : 'bg-black hover:bg-gray-800 text-white'    // Warna hitam kalau TAMBAH BARU
            }`}
          >
            {loading ? (
              'Proses...'
            ) : editingId ? (
              '💾 SIMPAN PERUBAHAN MENU' 
            ) : (
              '➕ TAMBAHKAN MENU BARU'
            )}
          </button>
      </form>

      {/* DAFTAR MENU */}
      {menus.map((item) => (
  <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
    <div>
      {item.image_url ? (
        <img src={item.image_url} className="w-full h-40 object-cover rounded-2xl mb-4" alt={item.nama_produk} />
      ) : (
        <div className="w-full h-40 bg-gray-50 rounded-2xl mb-4 flex items-center justify-center text-gray-400 text-[10px] font-bold">
          📷 Belum ada foto
        </div>
      )}
      <h3 className="font-black text-sm uppercase text-gray-800">{item.nama_produk}</h3>
      <p className="text-orange-500 font-black text-sm">Rp {item.harga.toLocaleString()}</p>
      <p className="text-gray-400 text-[10px] mt-1 italic">{item.deskripsi}</p>
    </div>

    {/* TOMBOL AKSI: EDIT & HAPUS */}
    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
      <button 
        onClick={() => handleEdit(item)}
        className="flex-1 bg-gray-100 hover:bg-blue-100 text-blue-600 py-2 rounded-xl text-[10px] font-black transition-all"
      >
        ✏️ EDIT
      </button>
      <button 
        onClick={() => handleDelete(item.id)}
        className="flex-1 bg-gray-100 hover:bg-red-100 text-red-500 py-2 rounded-xl text-[10px] font-black transition-all"
      >
        🗑️ HAPUS
      </button>
    </div>
  </div>
))}
    </div>
  )
}