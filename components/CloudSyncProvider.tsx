'use client'

import { useEffect, useState } from 'react'
import { initCloudSync } from '@/lib/cloudSync'

/**
 * Membungkus seluruh aplikasi. Sebelum halaman apapun dirender, komponen ini
 * menarik data terbaru dari cloud (Supabase) ke localStorage perangkat ini,
 * supaya data selalu konsisten di perangkat & akun manapun aplikasi dibuka.
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    let selesai = false
    initCloudSync().finally(() => {
      selesai = true
      setSiap(true)
    })
    // Jaga-jaga bila koneksi lambat/terputus, jangan biarkan pengguna
    // terjebak di layar loading selamanya.
    const batasWaktu = setTimeout(() => {
      if (!selesai) setSiap(true)
    }, 4000)
    return () => clearTimeout(batasWaktu)
  }, [])

  if (!siap) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white">
        <div className="w-10 h-10 border-4 border-[#F0DFF5] border-t-[#6A197D] rounded-full animate-spin" />
        <p className="text-sm font-opensans font-semibold text-[#6A197D]">
          Menyinkronkan data terbaru...
        </p>
      </div>
    )
  }

  return <>{children}</>
}
