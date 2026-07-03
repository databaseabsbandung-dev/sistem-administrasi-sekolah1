'use client'

// lib/cloudSync.ts
//
// Lapisan sinkronisasi lintas-perangkat & lintas-akun.
//
// MASALAH YANG DIPERBAIKI:
// Sebelumnya seluruh data aplikasi (identitas lembaga, data guru, jadwal,
// kaldik, RPP, dst) hanya disimpan di localStorage — artinya data itu
// TERKUNCI di satu browser/perangkat saja. Mengisi data di laptop dengan
// akun A tidak akan pernah terlihat di HP dengan akun B.
//
// SOLUSI:
// Modul ini membuat localStorage.setItem/removeItem juga otomatis mengirim
// perubahan ke tabel `app_storage` di Supabase (cloud), dan saat aplikasi
// dibuka di perangkat/akun manapun, ia menarik dulu data terbaru dari cloud
// sebelum halaman ditampilkan. ​Tidak perlu mengubah kode di tiap halaman
// (app/dashboard, app/kaldik, app/rpp, dst) karena yang di-"sadap" adalah
// API localStorage itu sendiri.
//
// CATATAN KEAMANAN (penting dibaca):
// Tabel `app_storage` diakses memakai anon key Supabase yang memang publik
// (ikut ter-bundle di kode frontend). Supaya sinkronisasi ini bisa jalan
// untuk akun Guru (yang login-nya BUKAN lewat Supabase Auth, hanya validasi
// nama + NPSN di sisi klien), RLS tabel ini dibuat terbuka (siapapun yang
// punya anon key bisa baca/tulis). Ini konsisten dengan desain login Guru
// yang sudah ada sebelumnya (juga tidak diverifikasi di server), tapi kalau
// aplikasi ini dipakai sungguhan oleh sekolah dengan data sensitif, sangat
// disarankan upgrade ke Supabase Auth + RLS per-sekolah di kemudian hari.

import { supabase } from '@/app/supabase'

// Key yang TIDAK boleh disinkronkan ke cloud — sesi login ini harus tetap
// unik per-perangkat (device A login sbg Guru X tidak boleh menimpa sesi
// login device B).
const KEY_TIDAK_DISINKRONKAN = new Set<string>(['sesi_guru_login'])

let sudahDipasang = false
let originalSetItem: (key: string, value: string) => void
let originalRemoveItem: (key: string) => void

const antrianKirim = new Map<string, ReturnType<typeof setTimeout>>()

function kirimKeCloud(key: string, value: string | null) {
  if (KEY_TIDAK_DISINKRONKAN.has(key)) return

  const timerLama = antrianKirim.get(key)
  if (timerLama) clearTimeout(timerLama)

  // Debounce singkat supaya ketikan cepat tidak membanjiri request ke cloud.
  const timer = setTimeout(async () => {
    antrianKirim.delete(key)
    try {
      if (value === null) {
        await supabase.from('app_storage').delete().eq('key', key)
      } else {
        await supabase
          .from('app_storage')
          .upsert({ key, value, updated_at: new Date().toISOString() })
      }
    } catch (e) {
      console.warn('[cloudSync] Gagal mengirim perubahan ke cloud untuk key:', key, e)
    }
  }, 400)

  antrianKirim.set(key, timer)
}

/**
 * Panggil sekali di awal (lihat components/CloudSyncProvider.tsx).
 * 1) Menarik seluruh data terbaru dari cloud ke localStorage perangkat ini.
 * 2) Memasang penyadap agar setiap localStorage.setItem/removeItem
 *    selanjutnya otomatis terkirim ke cloud.
 * 3) Berlangganan perubahan real-time dari perangkat/akun lain.
 */
export async function initCloudSync(): Promise<void> {
  if (typeof window === 'undefined') return

  // 1) Tarik data terbaru dari cloud lebih dulu, sebelum halaman apapun
  //    sempat membaca localStorage.
  try {
    const { data, error } = await supabase.from('app_storage').select('key, value')
    if (!error && data) {
      for (const row of data as { key: string; value: string | null }[]) {
        if (KEY_TIDAK_DISINKRONKAN.has(row.key)) continue
        window.localStorage.setItem(row.key, row.value ?? '')
      }
    } else if (error) {
      console.warn('[cloudSync] Tabel app_storage belum siap / gagal diakses:', error.message)
    }
  } catch (e) {
    console.warn('[cloudSync] Gagal menghubungi cloud, memakai data lokal dulu.', e)
  }

  // 2) Pasang penyadap localStorage (hanya sekali).
  if (!sudahDipasang) {
    originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage)

    window.localStorage.setItem = function (key: string, value: string) {
      originalSetItem(key, value)
      kirimKeCloud(key, value)
    }
    window.localStorage.removeItem = function (key: string) {
      originalRemoveItem(key)
      kirimKeCloud(key, null)
    }
    sudahDipasang = true
  }

  // 3) Real-time: kalau perangkat/akun LAIN mengubah data, tarik ke sini juga.
  try {
    supabase
      .channel('app_storage_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_storage' },
        (payload: any) => {
          const row = payload.new || payload.old
          if (!row?.key || KEY_TIDAK_DISINKRONKAN.has(row.key)) return
          if (payload.eventType === 'DELETE') {
            originalRemoveItem(row.key)
          } else {
            originalSetItem(row.key, row.value ?? '')
          }
          // Beritahu bagian UI yang mau bereaksi (opsional, tidak wajib dipakai).
          window.dispatchEvent(new CustomEvent('cloud-sync-update', { detail: { key: row.key } }))
        }
      )
      .subscribe()
  } catch (e) {
    console.warn('[cloudSync] Realtime tidak tersedia, sinkronisasi tetap jalan saat reload halaman.', e)
  }
}
