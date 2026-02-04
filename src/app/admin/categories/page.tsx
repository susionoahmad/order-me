'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'; // 1. Import mesin navigasi



export default function CategoryManager() {
  const router = useRouter(); // 2. 
  const [categories, setCategories] = useState<any[]>([])
  const [newCat, setNewCat] = useState('')
  const [loading, setLoading] = useState(false)

  // Ambil daftar kategori milik user yang sedang login
  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('profile_id', user.id)
        .order('nama_kategori', { ascending: true })
      if (data) setCategories(data)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  // Fungsi Tambah Kategori
  const handleAddCategory = async () => {
    if (!newCat) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('categories')
      .insert([{ nama_kategori: newCat, profile_id: user?.id }])

    if (!error) {
      setNewCat('')
      fetchCategories()
    }
    setLoading(false)
  }

  // Fungsi Hapus Kategori
  const handleDelete = async (id: string) => {
    if (confirm('Hapus kategori ini? Menu yang terkait mungkin akan kehilangan kategorinya.')) {
      await supabase.from('categories').delete().eq('id', id)
      fetchCategories()
    }
  }

  return (
    
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-8">
      <button 
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs mb-4"
      >
        ⬅️ Kembali ke Dashboard
      </button>
      <h2 className="text-xl font-black text-gray-800 mb-4">🏷️ Kelola Kategori</h2>
      
      {/* Input Tambah */}
      <div className="flex gap-2 mb-6">
        <input 
          type="text"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Tambah kategori (misal: Promo)"
          className="flex-1 bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
        />
        <button 
          onClick={handleAddCategory}
          disabled={loading}
          className="bg-black text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
        >
          {loading ? '...' : 'Tambah'}
        </button>
      </div>

      {/* List Kategori */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <div key={cat.id} className="group flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
            <span className="font-bold text-sm text-gray-600">{cat.nama_kategori}</span>
            <button 
              onClick={() => handleDelete(cat.id)}
              className="text-gray-300 hover:text-red-500 transition-colors font-black text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}