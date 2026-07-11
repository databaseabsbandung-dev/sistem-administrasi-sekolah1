'use client'

import { useEffect, useState, useRef } from 'react'
import { initCloudSync } from '@/lib/cloudSync'

/**
 * Membungkus seluruh aplikasi. Sebelum halaman apapun dirender, komponen ini
 * menarik data terbaru dari cloud (Supabase) ke localStorage perangkat ini,
 * supaya data selalu konsisten di perangkat & akun manapun aplikasi dibuka.
 *
 * SOAL "REALTIME": lib/cloudSync.ts sudah berlangganan perubahan cloud
 * (Supabase Realtime) dan diam-diam memperbarui localStorage begitu ada
 * perubahan dari perangkat/akun lain -- TAPI itu saja tidak cukup, karena
 * state React di tiap halaman (useState) sudah kadung dibaca sekali saat
 * halaman pertama dimuat, jadi tampilan tetap terlihat "lama" walau data di
 * baliknya sudah baru (baru terlihat kalau di-refresh manual). Di sinilah
 * kita dengarkan event "cloud-sync-update" itu dan otomatis muat ulang
 * halaman begitu ada perubahan, supaya semua pengguna selalu melihat data
 * terbaru tanpa perlu refresh manual.
 */
export default function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const [siap, setSiap] = useState(false)
  const [errorSinkron, setErrorSinkron] = useState<string | null>(null)
  const [pembaruanTerdeteksi, setPembaruanTerdeteksi] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let selesai = false
    initCloudSync()
      .then(hasil => {
        if (!hasil.ok) setErrorSinkron(hasil.error || 'Gagal terhubung ke cloud.')
      })
      .finally(() => {
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

  useEffect(() => {
    const onUpdate = () => {
      // Beberapa key bisa berubah beruntun dalam waktu singkat (mis. saat
      // generate jadwal otomatis menulis puluhan slot sekaligus) -- tunggu
      // sebentar sampai perubahan "diam" dulu sebelum memuat ulang, supaya
      // tidak reload berkali-kali dalam hitungan detik.
      setPembaruanTerdeteksi(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
    window.addEventListener('cloud-sync-update', onUpdate)
    return () => {
      window.removeEventListener('cloud-sync-update', onUpdate)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
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

  return (
    <>
      {errorSinkron && (
        <div className="bg-red-600 text-white text-xs font-opensans font-semibold px-4 py-2 text-center">
          ⚠️ Sinkronisasi cloud gagal: {errorSinkron} — data mungkin tidak ter-update lintas perangkat.
          Buka menu &quot;Status Sinkronisasi&quot; untuk detail.
        </div>
      )}
      {pembaruanTerdeteksi && (
        <div className="fixed top-3 right-3 z-[9999] bg-[#6A197D] text-white text-xs font-opensans font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Ada pembaruan data dari pengguna lain — memuat ulang...
        </div>
      )}
      {children}
    </>
  )
}
