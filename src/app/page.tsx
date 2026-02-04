export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <h1 className="text-4xl font-black text-gray-800 mb-2">AHMAD CODING SYSTEM 👨‍🍳</h1>
      <p className="text-gray-400 font-bold mb-8 uppercase tracking-widest text-xs">Digital Catering Management</p>
      
      <div className="flex gap-4">
        <a href="/login" className="bg-black text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl">
          MASUK ADMIN
        </a>
        <a href="/register" className="bg-white text-gray-800 px-8 py-3 rounded-2xl font-black text-sm shadow-sm border border-gray-200">
          DAFTAR TOKO
        </a>
      </div>
    </div>
  )
}