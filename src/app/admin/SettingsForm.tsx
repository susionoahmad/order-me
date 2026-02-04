'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsForm() {
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState({
    nama_toko: '',
    slug: '',
    alamat_lengkap: '',
    nomor_wa_admin: '',
    deskripsi: '',
    logo_url: '',
    qris_url: '',
  })

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
    }
  }

  // FUNGSI UPLOAD KE SUPABASE STORAGE
  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>, columnName: string) {
    try {
      setLoading(true)
      const file = e.target.files?.[0]
      if (!file) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Silakan login kembali")

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${columnName}.${fileExt}`

      // 1. Upload ke Bucket 'toko-assets'
      const { error: uploadError } = await supabase.storage
        .from('storage-toko')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Ambil URL Publik
      const { data } = supabase.storage.from('storage-toko').getPublicUrl(fileName)
      setProfile({ ...profile, [columnName]: data.publicUrl })
      
    } catch (error: any) {
      alert('Gagal unggah: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert("Sesi berakhir, silakan login kembali")
      setLoading(false)
      return
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      ...profile,
      updated_at: new Date()
    })

    if (error) alert(error.message)
    else {
      alert('Data Toko Berhasil Disimpan! ✅')
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8 mt-12">
      <h2 className="text-xl font-black mb-6 uppercase">Pengaturan Toko 🏪</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Nama Toko</label>
          <input 
            type="text" 
            value={profile.nama_toko || ''} 
            onChange={(e) => setProfile({...profile, nama_toko: e.target.value})} 
            className="w-full p-3 bg-gray-50 border-none rounded-xl mt-1 font-bold" 
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Link Jualan (Slug)</label>
          <div className="flex items-center bg-gray-100 rounded-xl mt-1 px-3 py-1">
            <span className="text-gray-400 text-[10px] font-bold">toko/</span>
            <input 
              type="text" 
              value={profile.slug || ''} 
              onChange={(e) => {
                // Otomatis merubah spasi jadi dash (-) dan huruf kecil semua
                const formattedSlug = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                setProfile({...profile, slug: formattedSlug})
              }} 
              className="w-full p-2 bg-transparent border-none font-black text-blue-600 focus:ring-0" 
              placeholder="nama-toko-anda"
            />
          </div>
          <p className="text-[8px] text-gray-400 mt-1">*Jangan pakai spasi, otomatis jadi tanda hubung (-)</p>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Nomor WA Order</label>
          <input type="text" value={profile.nomor_wa_admin || ''} onChange={(e) => setProfile({...profile, nomor_wa_admin: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl mt-1 font-bold" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-black text-gray-400 uppercase">Alamat Lengkap</label>
          <textarea value={profile.alamat_lengkap || ''} onChange={(e) => setProfile({...profile, alamat_lengkap: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl mt-1 font-bold" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-black text-gray-400 uppercase">Deskripsi Toko</label>
          <input type="text" value={profile.deskripsi || ''} onChange={(e) => setProfile({...profile, deskripsi: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl mt-1 font-bold" />
        </div>
        
        {/* INPUT FILE UNTUK LOGO & QRIS */}
        <div className="p-4 bg-gray-50 rounded-2xl">
          <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Logo Toko</label>
          {profile.logo_url && <img src={profile.logo_url || ''} className="h-12 mb-2 rounded-lg" />}
          <input type="file" onChange={(e) => uploadImage(e, 'logo_url')} className="text-xs" />
        </div>
        <div className="p-4 bg-gray-50 rounded-2xl">
          <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">QRIS Pembayaran</label>
          {profile.qris_url && <img src={profile.qris_url || ''} className="h-12 mb-2 rounded-lg" />}
          <input type="file" onChange={(e) => uploadImage(e, 'qris_url')} className="text-xs" />
        </div>
      </div>
      
      <button onClick={updateProfile} disabled={loading} className="mt-8 w-full md:w-auto bg-black text-white px-12 py-4 rounded-2xl font-black hover:bg-gray-800 transition-all uppercase tracking-widest text-sm">
        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button>
    </div>
  )
}