'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [namaToko, setNamaToko] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Daftarkan User di Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      alert("Gagal Daftar: " + authError.message)
    } else if (authData.user) {
      // 2. Buat Profil Toko Otomatis di tabel 'profiles'
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        nama_toko: namaToko,
      })

      if (profileError) alert("Profil gagal dibuat: " + profileError.message)
      else {
        alert("Pendaftaran Berhasil! Silakan Login.")
        router.push('/login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-gray-100">
        <h1 className="text-3xl font-black text-gray-900 mb-8 text-center uppercase tracking-tighter">Buka <span className="text-orange-500">Toko Baru</span></h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" placeholder="Nama Toko" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold" onChange={(e) => setNamaToko(e.target.value)} />
          <input type="email" placeholder="Email Admin" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold" onChange={(e) => setPassword(e.target.value)} />
          <button disabled={loading} className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase hover:bg-gray-800 transition-all shadow-lg mt-4">
            {loading ? 'MENDAFTAR...' : 'DAFTAR SEKARANG'}
          </button>
        </form>
        {/* Tombol Kembali ke Login */}
          <p className="mt-6 text-center text-sm font-bold text-gray-500">
            Sudah punya toko?{" "}
            <button 
              onClick={() => router.push('/login')} 
              className="text-orange-600 hover:underline"
            >
              Masuk di sini
            </button>
          </p>
      </div>
    </div>
  )
}