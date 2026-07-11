'use client'

import { supabase } from '@/app/supabase'

/**
 * Panggil API server /api/admin/buat-akun-guru untuk membuat/memperbarui akun
 * Supabase Auth seorang guru secara otomatis (tanpa email verifikasi, tanpa
 * kena rate limit). Dipanggil dari halaman "Kelola Data Guru" setiap kali
 * Admin menyimpan satu guru atau mengimpor CSV.
 *
 * Mengembalikan { ok: true } kalau berhasil, atau { ok: false, error } kalau
 * gagal (mis. service_role key belum diatur) — kegagalan ini TIDAK
 * menggagalkan penyimpanan data guru di master_guru, supaya Admin tetap bisa
 * lanjut bekerja sambil memperbaiki konfigurasi server.
 */
export async function buatAkunGuruOtomatis(params: {
  email: string
  password: string
  nama?: string
}): Promise<{ ok: boolean; error?: string; mode?: string }> {
  try {
    let { data: sessionData } = await supabase.auth.getSession()
    let token = sessionData.session?.access_token

    // Kalau token tidak ada / sudah kedaluwarsa (umum terjadi kalau yang
    // login sudah agak lama sebelum mengisi form ini -- baik Admin maupun
    // akun bukan-Admin yang diberi wewenang mengelola Kelola Data Guru),
    // coba REFRESH sesi dulu sebelum benar-benar menyerah. Tanpa ini,
    // akun login guru gagal dibuat secara senyap kalau sesi sempat kedaluwarsa.
    if (!token) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      token = refreshed.session?.access_token
    }

    if (!token) {
      return { ok: false, error: 'Sesi Anda tidak ditemukan/sudah kedaluwarsa. Silakan logout lalu login ulang, kemudian simpan data guru ini lagi.' }
    }

    const res = await fetch('/api/admin/buat-akun-guru', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
    const json = await res.json()
    if (!res.ok) {
      return { ok: false, error: json?.error || 'Gagal membuat akun guru.' }
    }
    return { ok: true, mode: json?.mode }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}
