'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/app/supabase'
import { useAksesGuard } from '@/lib/useAksesGuard'

type Status = 'menunggu' | 'jalan' | 'lulus' | 'gagal'

interface Langkah {
  id: string
  judul: string
  status: Status
  detail?: string
}

const LANGKAH_AWAL: Langkah[] = [
  { id: 'sesi', judul: '1) Cek sesi login saat ini', status: 'menunggu' },
  { id: 'select', judul: '2) Baca tabel app_storage (SELECT)', status: 'menunggu' },
  { id: 'insert', judul: '3) Tulis data uji ke app_storage (INSERT/UPSERT)', status: 'menunggu' },
  { id: 'select2', judul: '4) Baca kembali data uji yang baru ditulis', status: 'menunggu' },
  { id: 'delete', judul: '5) Hapus data uji (DELETE, membersihkan)', status: 'menunggu' },
]

export default function StatusSinkronisasiPage() {
  const diizinkanAkses = useAksesGuard('diagnostik')
  const [langkah, setLangkah] = useState<Langkah[]>(LANGKAH_AWAL)
  const [berjalan, setBerjalan] = useState(false)

  const perbarui = (id: string, patch: Partial<Langkah>) => {
    setLangkah(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  const jalankanTes = async () => {
    setBerjalan(true)
    setLangkah(LANGKAH_AWAL.map(l => ({ ...l, status: 'menunggu', detail: undefined })))
    const kunciUji = `_tes_sinkronisasi_${Date.now()}`
    const nilaiUji = `nilai-uji-${Math.random().toString(36).slice(2, 8)}`

    // 1) Sesi login
    perbarui('sesi', { status: 'jalan' })
    try {
      const { data: sessionData, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!sessionData.session) {
        perbarui('sesi', {
          status: 'gagal',
          detail: 'Tidak ada sesi login aktif. Anda harus login (Admin/Guru) sebelum uji tulis data bisa berhasil.',
        })
      } else {
        perbarui('sesi', {
          status: 'lulus',
          detail: `Login sebagai: ${sessionData.session.user.email}`,
        })
      }
    } catch (e: any) {
      perbarui('sesi', { status: 'gagal', detail: String(e?.message || e) })
    }

    // 2) SELECT
    perbarui('select', { status: 'jalan' })
    try {
      const { data, error } = await supabase.from('app_storage').select('key').limit(1)
      if (error) throw error
      perbarui('select', {
        status: 'lulus',
        detail: `Berhasil membaca tabel app_storage (contoh ${data?.length ?? 0} baris diambil).`,
      })
    } catch (e: any) {
      perbarui('select', {
        status: 'gagal',
        detail: `${e?.message || e}${e?.code ? ` (kode: ${e.code})` : ''} — kemungkinan tabel app_storage belum dibuat, atau nama project/anon key di app/supabase.ts salah.`,
      })
      setBerjalan(false)
      return // tidak ada gunanya lanjut kalau baca saja sudah gagal
    }

    // 3) INSERT/UPSERT
    perbarui('insert', { status: 'jalan' })
    try {
      const { error } = await supabase
        .from('app_storage')
        .upsert({ key: kunciUji, value: nilaiUji, updated_at: new Date().toISOString() })
      if (error) throw error
      perbarui('insert', { status: 'lulus', detail: 'Berhasil menulis baris uji.' })
    } catch (e: any) {
      perbarui('insert', {
        status: 'gagal',
        detail: `${e?.message || e}${e?.code ? ` (kode: ${e.code})` : ''} — kalau errornya soal RLS/permission, artinya kebijakan INSERT di Supabase mewajibkan login, tapi sesi Anda tidak terbaca sah oleh server. Kalau errornya "relation does not exist", tabel app_storage belum dibuat sama sekali di project ini.`,
      })
      setBerjalan(false)
      return
    }

    // 4) SELECT ulang utk verifikasi tulisan barusan
    perbarui('select2', { status: 'jalan' })
    try {
      const { data, error } = await supabase.from('app_storage').select('value').eq('key', kunciUji).single()
      if (error) throw error
      if (data?.value === nilaiUji) {
        perbarui('select2', { status: 'lulus', detail: 'Data uji yang baru ditulis berhasil terbaca kembali — tulis & baca ke cloud BERFUNGSI.' })
      } else {
        perbarui('select2', { status: 'gagal', detail: `Nilai tidak cocok. Diharapkan "${nilaiUji}", didapat "${data?.value}".` })
      }
    } catch (e: any) {
      perbarui('select2', { status: 'gagal', detail: String(e?.message || e) })
    }

    // 5) DELETE (bersih-bersih)
    perbarui('delete', { status: 'jalan' })
    try {
      const { error } = await supabase.from('app_storage').delete().eq('key', kunciUji)
      if (error) throw error
      perbarui('delete', { status: 'lulus', detail: 'Data uji berhasil dihapus.' })
    } catch (e: any) {
      perbarui('delete', {
        status: 'gagal',
        detail: `${e?.message || e} — data uji "${kunciUji}" tertinggal di tabel, boleh dihapus manual lewat Supabase Table Editor.`,
      })
    }

    setBerjalan(false)
  }

  const warna = (s: Status) =>
    s === 'lulus' ? 'text-green-700 bg-green-50 border-green-200'
    : s === 'gagal' ? 'text-red-700 bg-red-50 border-red-200'
    : s === 'jalan' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-slate-500 bg-slate-50 border-slate-200'

  const label = (s: Status) =>
    s === 'lulus' ? '✅ Lulus' : s === 'gagal' ? '❌ Gagal' : s === 'jalan' ? '⏳ Berjalan...' : '⏸ Menunggu'

  if (diizinkanAkses === null) return <div className="p-8 text-center font-semibold text-[#6A197D]">Memuat...</div>
  if (diizinkanAkses === false) return null

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-opensans">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-3xl mx-auto space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-baloo font-black text-slate-900">Status Sinkronisasi Cloud</h1>
          <p className="text-xs text-gray-500">
            Alat ini menguji langsung ke Supabase project Anda yang sesungguhnya (bukan simulasi) —
            gunakan untuk memastikan data benar-benar tersimpan &amp; terbaca dari cloud.
          </p>
        </header>

        <button
          onClick={jalankanTes}
          disabled={berjalan}
          className="bg-[#6A197D] hover:bg-[#571466] disabled:opacity-50 text-white font-baloo font-bold px-6 py-3 rounded-xl text-sm transition"
        >
          {berjalan ? 'Sedang menguji...' : 'Jalankan Tes Sinkronisasi'}
        </button>

        <div className="space-y-3">
          {langkah.map(l => (
            <div key={l.id} className={`border rounded-xl p-4 text-sm ${warna(l.status)}`}>
              <div className="flex justify-between items-center font-bold">
                <span>{l.judul}</span>
                <span>{label(l.status)}</span>
              </div>
              {l.detail && <p className="mt-1.5 text-xs leading-relaxed">{l.detail}</p>}
            </div>
          ))}
        </div>

        <div className="bg-[#FFFBEA] border border-[#FFEDA3] rounded-xl p-4 text-xs text-[#440F55] leading-relaxed">
          <strong className="block mb-1">Cara membaca hasil:</strong>
          Kalau langkah 2 (SELECT) gagal → tabel <code>app_storage</code> kemungkinan belum dibuat, jalankan lagi
          <code> supabase/migrations/001_app_storage.sql</code> di Supabase SQL Editor.<br />
          Kalau langkah 3 (INSERT) gagal soal permission/RLS → Anda perlu login dulu sebelum menguji, atau kebijakan
          RLS di Supabase belum sesuai dengan file migrasi terbaru.<br />
          Kalau langkah 2–5 semua LULUS di sini tapi data <em>tetap</em> tidak muncul di perangkat lain saat
          dipakai sungguhan → kemungkinan besar masalahnya bukan di Supabase, tapi di sisi
          <code> lib/cloudSync.ts</code> (proses menyalin data cloud ke localStorage saat aplikasi dibuka) —
          beri tahu saya hasil tes ini dan saya telusuri lebih lanjut dari situ.
        </div>
      </main>
    </div>
  )
}
