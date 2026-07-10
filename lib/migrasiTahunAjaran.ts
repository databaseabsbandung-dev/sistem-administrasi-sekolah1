'use client'

import { kunciTahun } from './tahunAjaran'

// Daftar SEMUA kunci dasar yang sejak fitur "Arsip per Tahun Ajaran" dibungkus
// kunciTahun(). Kalau aplikasi ini sudah dipakai SEBELUM fitur itu ada, data
// lama tersimpan di kunci POLOS (mis. "data_kaldik_events"), sedangkan kode
// yang baru mencari kunci berlabel tahun ajaran (mis.
// "data_kaldik_events__ta-1234") -- sehingga TERLIHAT seperti data hilang,
// padahal cuma "tersembunyi" di kunci lama. Migrasi ini menyalin data lama
// itu ke kunci baru (mengikuti tahun ajaran yang sedang aktif SAAT migrasi
// dijalankan), TANPA menghapus kunci lamanya (aman diulang / tidak merusak apa-apa).
export const DAFTAR_KUNCI_TERDAMPAK_ARSIP_TAHUN = [
  'data_atp',
  'data_cp',
  'data_cp_umum',
  'data_materi',
  'data_tp',
  'data_jadwal_pelajaran',
  'master_pemetaan_waktu',
  'master_kelas_gabungan',
  'master_jadwal_tetap',
  'master_jadwal_giliran',
  'master_larangan_beriringan',
  'master_piket_guru',
  'matriks_alokasi_rinci_samping',
  'request_hari_jp_guru',
  'jadwal_semester_aktif',
  'jadwal_titimangsa_ttd',
  'jadwal_keterangan_unit',
  'master_maks_jp_guru_per_hari',
  'data_kaldik_events',
  'kaldik_agenda_list',
  'setting_semester_ganjil',
  'setting_semester_genap',
]

export interface HasilMigrasiTahun {
  disalin: string[]      // kunci lama yang berhasil disalin ke kunci baru
  dilewati: string[]     // kunci baru sudah ada isinya -> tidak ditimpa, dilewati
  tidakAdaData: string[] // kunci lama memang kosong/tidak ada
}

/**
 * Jalankan migrasi SATU KALI. Aman dipanggil berkali-kali (idempotent) --
 * kalau kunci baru sudah pernah terisi, tidak akan ditimpa lagi.
 */
export function jalankanMigrasiArsipTahun(): HasilMigrasiTahun {
  const hasil: HasilMigrasiTahun = { disalin: [], dilewati: [], tidakAdaData: [] }

  for (const kunciDasar of DAFTAR_KUNCI_TERDAMPAK_ARSIP_TAHUN) {
    const dataLama = localStorage.getItem(kunciDasar)
    if (!dataLama) {
      hasil.tidakAdaData.push(kunciDasar)
      continue
    }
    const kunciBaru = kunciTahun(kunciDasar)
    const sudahAdaBaru = localStorage.getItem(kunciBaru)
    if (sudahAdaBaru) {
      hasil.dilewati.push(kunciDasar)
      continue
    }
    localStorage.setItem(kunciBaru, dataLama)
    hasil.disalin.push(kunciDasar)
  }

  return hasil
}

/** Cek cepat: apakah ada indikasi data lama yang belum bermigrasi? (untuk tampilkan peringatan) */
export function adaDataLamaBelumBermigrasi(): boolean {
  for (const kunciDasar of DAFTAR_KUNCI_TERDAMPAK_ARSIP_TAHUN) {
    const dataLama = localStorage.getItem(kunciDasar)
    if (dataLama && !localStorage.getItem(kunciTahun(kunciDasar))) return true
  }
  return false
}
