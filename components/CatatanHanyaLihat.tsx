'use client'

import { Eye } from 'lucide-react'

/**
 * Ditampilkan menggantikan form tambah/ubah data ketika peran pengguna
 * hanya diberi akses LIHAT (read) untuk modul ini, tanpa akses UBAH (write).
 * Bagian lihat/daftar/unduh/cetak di halaman tetap tampil seperti biasa --
 * yang disembunyikan HANYA form isiannya.
 */
export default function CatatanHanyaLihat({ pesan }: { pesan?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
      <Eye className="w-6 h-6 text-slate-400" />
      <p className="text-sm font-bold text-slate-500">Akses Anda: Lihat Saja</p>
      <p className="text-xs text-slate-400 max-w-xs">
        {pesan || 'Peran Anda tidak diberi izin untuk menambah/mengubah data pada modul ini. Anda tetap bisa melihat, mengunduh, atau mencetak data yang sudah ada.'}
      </p>
    </div>
  )
}
