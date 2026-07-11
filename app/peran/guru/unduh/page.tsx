'use client'
import { useAksesGuard } from '@/lib/useAksesGuard'

import Sidebar from '@/components/Sidebar'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../supabase'
import { buatAkunGuruOtomatis } from '@/lib/buatAkunGuru'
import {
  Download, Pencil, Check, X, Loader2
} from 'lucide-react'

export default function UnduhDataGuruPage() {
  const [loading, setLoading] = useState(true)
  const diizinkanAkses = useAksesGuard('guru')
  const [namaInduk, setNamaInduk] = useState('Lembaga / Yayasan Pusat')

  const [daftarGuru, setDaftarGuru] = useState<any[]>([])
  const router = useRouter()

  // State untuk mode edit nama akun & kata sandi per baris
  const [editId, setEditId] = useState<string | null>(null)
  const [editNamaAkun, setEditNamaAkun] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [sedangSimpan, setSedangSimpan] = useState(false)

  const muatUlangDaftarGuru = () => {
    const storedGuru = localStorage.getItem('master_guru')
    if (storedGuru) {
      const parsedGuru = JSON.parse(storedGuru).map((g: any) => {
        // PENTING (keamanan): password TIDAK LAGI disimpan di data guru sama
        // sekali (dulu tersimpan sebagai teks biasa dan ikut tersinkron ke
        // cloud yang bisa dibaca publik -- celah keamanan serius). Sekarang
        // password hanya ada sesaat di memori saat admin membuat/mengganti
        // akun, lalu dibuang. Di sini kita cuma tahu email-nya.
        return {
          ...g,
          email_abs: g.email || '(belum ada akun — simpan ulang data guru ini)',
        }
      })
      setDaftarGuru(parsedGuru)
    }
  }

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
      } else {
        const storedInduk = localStorage.getItem('identitas_induk')
        if (storedInduk) {
          const parsed = JSON.parse(storedInduk)
          setNamaInduk(parsed.nama || 'Lembaga / Yayasan Pusat')
        }

        muatUlangDaftarGuru()
        setLoading(false)
      }
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const mulaiEdit = (item: any) => {
    setEditId(item.id)
    setEditNamaAkun((item.email_abs || '').includes('@') ? item.email_abs.split('@')[0] : '')
    setEditPassword('') // sengaja kosong -- password lama tidak lagi tersimpan/diketahui
  }

  const batalEdit = () => {
    setEditId(null)
    setEditNamaAkun('')
    setEditPassword('')
  }

  const simpanEdit = async (item: any) => {
    const namaAkunBaru = editNamaAkun.trim().replace(/[^a-zA-Z]/g, '').toLowerCase() || 'guru'
    const passwordBaru = editPassword.trim()
    // PENTING (keamanan): password lama TIDAK diketahui lagi (sengaja tidak
    // disimpan). Jadi kalau kolom kata sandi dikosongkan, JANGAN diam-diam
    // di-reset ke "123456" -- wajib diisi eksplisit setiap kali mengganti,
    // supaya tidak ada akun yang tanpa sadar jadi lemah.
    if (!passwordBaru) {
      alert('Isi kata sandi baru untuk akun ini (wajib diisi setiap kali menyimpan perubahan, demi keamanan kata sandi lama tidak lagi disimpan/ditampilkan).')
      return
    }
    if (passwordBaru.length < 6) {
      alert('Kata sandi minimal 6 karakter.')
      return
    }
    const emailBaru = `${namaAkunBaru}@abs.sch.id`

    setSedangSimpan(true)
    try {
      // 1) Perbarui akun Supabase Auth-nya yang SUNGGUHAN
      const hasil = await buatAkunGuruOtomatis({ email: emailBaru, password: passwordBaru, nama: item.nama })
      if (!hasil.ok) {
        alert(`Gagal memperbarui akun login: ${hasil.error}`)
        setSedangSimpan(false)
        return
      }

      // 2) Perbarui data guru di master_guru -- HANYA email yang disimpan,
      //    password TIDAK PERNAH ditulis ke sini (lihat catatan keamanan di atas).
      const storedGuru = localStorage.getItem('master_guru')
      const daftar = storedGuru ? JSON.parse(storedGuru) : []
      const diperbarui = daftar.map((g: any) =>
        g.id === item.id ? { ...g, email: emailBaru } : g
      )
      localStorage.setItem('master_guru', JSON.stringify(diperbarui))

      muatUlangDaftarGuru()
      batalEdit()
      alert('Nama akun & kata sandi berhasil diperbarui. Beri tahu guru yang bersangkutan kredensial barunya secara langsung/pribadi (jangan lewat pesan tidak aman).')
    } catch (e: any) {
      alert(`Terjadi kesalahan: ${e?.message || e}`)
    } finally {
      setSedangSimpan(false)
    }
  }

  const handleUnduhExcel = async () => {
    if (daftarGuru.length === 0) {
      alert('Belum ada data guru untuk diunduh.')
      return
    }

    // File Excel (.xlsx) ASLI -- setiap data disimpan di SEL/kolom terpisah
    // sungguhan (bukan teks yang dipisah tanda baca seperti CSV), jadi tidak
    // ada lagi risiko salah pisah kolom di Excel.
    const XLSX = await import('xlsx')
    const dataSheet = daftarGuru.map(g => ({
      'Nama': g.nama,
      'Email': g.email_abs,
      'Nama Akun': (g.email_abs || '').split('@')[0] || '',
    }))
    const ws = XLSX.utils.json_to_sheet(dataSheet)
    ws['!cols'] = [{ wch: 28 }, { wch: 26 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
    XLSX.writeFile(wb, `Data Akun Guru ${namaInduk.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`)
  }

  if (loading || diizinkanAkses === null) return <div className="p-8 text-center font-semibold text-[#6A197D]">Memuat Halaman Distribusi Data Guru...</div>
  if (diizinkanAkses === false) return null

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-800 font-opensans">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-start flex-wrap gap-4">
           <div className="space-y-1.5">
              <h1 className="text-2xl font-baloo font-black text-slate-900">Unduh Profil & Kredensial Akun Pendidik</h1>
              <p className="text-xs text-gray-500">Daftar akun guru beserta nama akun (email login domain @abs.sch.id) dan kata sandi. Klik ikon pensil untuk mengubah nama akun/kata sandi seorang guru.</p>
           </div>
           <button onClick={handleUnduhExcel} className="flex items-center gap-2 bg-[#FFDE59] hover:bg-[#E6C850] text-[#6A197D] font-baloo font-extrabold px-5 py-3 rounded-xl shadow-sm text-xs transition">
              <Download className="w-4 h-4" /> Unduh Data Guru (.xlsx)
           </button>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                 <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-baloo font-black text-slate-400 uppercase tracking-wider">
                       <th className="py-4 px-6">No</th>
                       <th className="py-4 px-6">Nama Lengkap Guru</th>
                       <th className="py-4 px-6">NIP</th>
                       <th className="py-4 px-6">Nama Akun (Email Login)</th>
                       <th className="py-4 px-6 font-mono">Kata Sandi</th>
                       <th className="py-4 px-6">Aksi</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {daftarGuru.map((item, index) => {
                      const sedangDiedit = editId === item.id
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                           <td className="py-3.5 px-6">{index + 1}</td>
                           <td className="py-3.5 px-6 font-baloo font-bold text-slate-900">{item.nama}</td>
                           <td className="py-3.5 px-6 font-mono text-slate-500">{item.nip || '-'}</td>

                           {sedangDiedit ? (
                             <td className="py-2 px-6">
                               <div className="flex items-center gap-1">
                                 <input
                                   value={editNamaAkun}
                                   onChange={e => setEditNamaAkun(e.target.value)}
                                   className="w-28 px-2 py-1.5 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-[#8A3499]"
                                 />
                                 <span className="text-slate-400 text-xs">@abs.sch.id</span>
                               </div>
                             </td>
                           ) : (
                             <td className="py-3.5 px-6 font-mono text-[#57146A] select-all font-semibold tracking-wide">{item.email_abs}</td>
                           )}

                           {sedangDiedit ? (
                             <td className="py-2 px-6">
                               <input
                                 value={editPassword}
                                 onChange={e => setEditPassword(e.target.value)}
                                 placeholder="Wajib isi kata sandi baru"
                                 className="w-36 px-2 py-1.5 border rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-[#8A3499]"
                               />
                             </td>
                           ) : (
                             <td className="py-3.5 px-6 font-mono text-slate-400 italic text-xs">•••••• (tersembunyi)</td>
                           )}

                           <td className="py-3.5 px-6">
                             {sedangDiedit ? (
                               <div className="flex items-center gap-1.5">
                                 <button
                                   onClick={() => simpanEdit(item)}
                                   disabled={sedangSimpan}
                                   className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                                   title="Simpan"
                                 >
                                   {sedangSimpan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                 </button>
                                 <button
                                   onClick={batalEdit}
                                   disabled={sedangSimpan}
                                   className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50"
                                   title="Batal"
                                 >
                                   <X className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             ) : (
                               <button
                                 onClick={() => mulaiEdit(item)}
                                 className="p-1.5 rounded-lg bg-[#F7ECFA] text-[#57146A] hover:bg-[#EFD9F5] transition"
                                 title="Ubah nama akun & kata sandi"
                               >
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                             )}
                           </td>
                        </tr>
                      )
                    })}
                    {daftarGuru.length === 0 && (
                      <tr>
                         <td colSpan={6} className="py-16 text-center text-slate-400 font-semibold text-sm">Belum ada data pendidik yang terdaftar pada sistem database.</td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </section>

        <div className="bg-[#FFFBEA] border border-[#FFEDA3] rounded-xl p-4 text-[10px] font-baloo font-bold text-[#440F55] leading-relaxed max-w-2xl tracking-wide">
           <strong className="block uppercase tracking-wider mb-0.5 text-[9px]">Catatan Distribusi Akun Login:</strong>
           Kata sandi bawaan setiap akun baru adalah <span className="font-mono">123456</span>, kecuali diubah manual saat
           mendaftarkan/mengimpor guru, atau diubah lewat tombol pensil di tabel atas. Pastikan menginformasikan
           nama akun &amp; kata sandi terbaru kepada guru yang bersangkutan setiap kali diubah.
        </div>
      </main>
    </div>
  )
}
