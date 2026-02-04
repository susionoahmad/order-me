'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      alert("Gagal masuk: " + error.message)
    } else {
      // Jika berhasil, lempar ke dashboard admin
      router.push('/admin')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-10">
          <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-2">Ahmad Coding System</p>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">ADMIN <span className="text-gray-400">LOGIN</span></h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Email Address</label>
            <input 
              type="email" 
              required
              placeholder="admin@toko.com" 
              className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold mt-1 focus:ring-2 focus:ring-black outline-none"
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Password</label>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold mt-1 focus:ring-2 focus:ring-black outline-none"
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg mt-4 disabled:bg-gray-400"
          >
            {loading ? 'MEMVERIFIKASI...' : 'MASUK KE DASHBOARD'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm font-bold text-gray-500">
            Belum punya akun? 
            <a href="/register" className="text-orange-500 ml-2 hover:underline">Daftar Toko Baru</a>
            </p>
        <p className="text-center mt-8 text-xs text-gray-400 font-bold uppercase tracking-widest">
          &copy; 2026 AhmadCoding System
        </p>
      </div>
    </div>
  )
}