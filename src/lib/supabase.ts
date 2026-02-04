import { createClient } from '@supabase/supabase-js'

// Pastikan ejaan NEXT_PUBLIC_ tidak ada yang salah ketik
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Kunci Supabase belum terpasang di .env!")
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')