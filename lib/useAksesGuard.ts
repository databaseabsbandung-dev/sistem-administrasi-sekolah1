'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAksesInfo } from './aksesPeran'

/**
 * Menjaga sebuah halaman/modul agar hanya bisa diakses oleh akun yang memang
 * diberi hak akses (read) ke modul tsb lewat menu "Pembagian Peran".
 *
 * - Admin (login via email/Supabase Auth) -> selalu diizinkan.
 * - Guru -> diizinkan HANYA jika salah satu peran yang dimilikinya punya
 *   akses read ke moduleId ini. Kalau tidak, otomatis diarahkan ke /dashboard.
 *
 * Pakai di baris paling atas komponen halaman:
 *   const diizinkan = useAksesGuard('kaldik')
 *   if (diizinkan === null) return <div>Memuat...</div>
 *   if (diizinkan === false) return null // sudah diarahkan ke /dashboard
 */
export function useAksesGuard(moduleId: string): boolean | null {
  const router = useRouter()
  const [diizinkan, setDiizinkan] = useState<boolean | null>(null)

  useEffect(() => {
    const akses = getAksesInfo()

    if (!akses.isGuru || akses.aksesMap === 'all') {
      setDiizinkan(true)
      return
    }

    const boleh = !!akses.aksesMap[moduleId]?.read
    setDiizinkan(boleh)
    if (!boleh) {
      router.replace('/dashboard')
    }
  }, [moduleId, router])

  return diizinkan
}
