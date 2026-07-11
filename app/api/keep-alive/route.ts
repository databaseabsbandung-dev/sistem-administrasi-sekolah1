import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// WAJIB jalan di Node.js runtime (bukan edge), supaya konsisten dengan route lain.
export const runtime = 'nodejs'

const SUPABASE_URL = 'https://whnwipppzjauxkmdiqfv.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_szkotq6gG7TVSfBfIumxJQ_92oC5eoH'

/**
 * GET /api/keep-alive
 *
 * Dipanggil OTOMATIS setiap hari oleh Vercel Cron (lihat vercel.json di root
 * proyek) supaya proyek Supabase (paket gratis) TIDAK PERNAH dianggap "tidak
 * aktif" dan di-pause setelah 7 hari tanpa aktivitas.
 *
 * Cukup melakukan SATU query paling ringan (hitung baris di tabel
 * app_storage) -- ini sudah dihitung sebagai "aktivitas database" oleh
 * Supabase, jadi jeda waktunya ter-reset lagi setiap kali route ini dipanggil.
 *
 * Aman diakses siapapun (tidak membocorkan data apapun, cuma angka jumlah
 * baris) -- tidak perlu login sama sekali, supaya Vercel Cron bisa
 * memanggilnya tanpa perlu mengatur token/kredensial rahasia apapun.
 */
export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { count, error } = await supabase
      .from('app_storage')
      .select('key', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({ ok: false, waktu: new Date().toISOString(), error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, waktu: new Date().toISOString(), jumlahBaris: count })
  } catch (e: any) {
    return NextResponse.json({ ok: false, waktu: new Date().toISOString(), error: String(e?.message || e) }, { status: 500 })
  }
}
