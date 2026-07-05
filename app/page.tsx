"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "./supabase";
import { refreshSetelahLogin } from "@/lib/cloudSync";
import { Landmark, User, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [identity, setIdentity] = useState(""); 
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Tarik data terbaru dari cloud dulu (identitas lembaga, master guru, dst)
    // supaya login (terutama pencarian nama guru) selalu memakai data paling
    // baru, walaupun perubahan itu baru saja dilakukan Admin di perangkat
    // lain sesaat sebelumnya.
    await refreshSetelahLogin();

    // Deteksi apakah input berupa Email (mengandung '@') atau Nama Guru (teks biasa)
    const isEmail = identity.includes("@");

    if (isEmail) {
      // Alur Akses Admin / Kurikulum (Menggunakan Auth Supabase)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identity,
        password,
      });

      if (error) {
        setMessage(`Gagal masuk Admin: ${error.message}`);
      } else if (data.user?.user_metadata?.role === 'guru') {
        // PENTING: akun Guru dibuat otomatis sebagai akun Supabase Auth asli
        // (lihat app/api/admin/buat-akun-guru), jadi SECARA TEKNIS akun itu
        // bisa saja dicoba login lewat kolom Email Admin ini. Kita tolak di
        // sini supaya Guru tidak bisa mendapat akses admin penuh (menembus
        // batasan peran) hanya dengan memasukkan email mereka sendiri.
        await supabase.auth.signOut();
        setMessage("Akun ini adalah akun Guru. Silakan login lewat kolom \"Nama Lengkap (Guru)\" di atas, bukan kolom Email Admin.");
      } else {
        setMessage("Login Admin Berhasil! Menghubungkan ke sistem...");
        router.push('/dashboard'); 
      }
    } else {
      // Alur Akses Guru / Kontributor
      // Guru mengetik NAMA (bukan email) + sandi (NPSN sekolah). Kita cari dulu
      // email otomatis guru tsb di data master lokal (sudah tersinkron dari
      // cloud saat halaman ini dibuka), lalu login sungguhan lewat Supabase
      // Auth memakai email tsb -- supaya sesi guru juga tervalidasi server,
      // bukan sekadar cek nama di browser.
      const daftarGuru = JSON.parse(localStorage.getItem('master_guru') || '[]')

      const bersihkanNama = (str: string) => {
        return str
          .split(',')[0]
          .replace(/\./g, '')
          .replace(/\s+/g, '')
          .toLowerCase();
      };

      const inputNamaBersih = bersihkanNama(identity);
      const inputRapiUntukAkun = identity.trim().toLowerCase().replace(/\s+/g, '');
      const guruKetemu = daftarGuru.find((g: any) => {
        // Cara 1: cocok dengan nama murni (mis. "nurulfitri")
        if (bersihkanNama(g.nama) === inputNamaBersih) return true;
        // Cara 2: cocok persis dengan Nama Akun di tabel "Lihat & Unduh Data
        // Akun Guru" (mis. "nurulfitri485" -- termasuk angka pembeda kalau
        // ada nama yang mirip). Banyak guru salah ketik ini karena memang
        // itu yang tertulis jelas di tabel kredensial.
        const namaAkunEmail = (g.email || '').split('@')[0]?.toLowerCase();
        if (namaAkunEmail && namaAkunEmail === inputRapiUntukAkun) return true;
        return false;
      });

      if (!guruKetemu) {
        setMessage("Nama tidak terdaftar sebagai guru/kontributor di sistem sekolah.");
        setLoading(false);
        return;
      }

      if (!guruKetemu.email) {
        setMessage("Akun guru ini belum punya akun login otomatis. Minta Admin membuka & menyimpan ulang data guru ini di menu Kelola Data Guru.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: guruKetemu.email,
        password,
      });

      if (error) {
        setMessage("Kata sandi tidak sesuai dengan NPSN sekolah, atau akun belum aktif.");
        setLoading(false);
        return;
      }

      // Simpan sesi login guru di browser (dipakai lib/aksesPeran.ts & Sidebar
      // untuk menentukan menu/hak akses)
      localStorage.setItem('sesi_guru_login', JSON.stringify(guruKetemu));
      setMessage("Login Guru Berhasil! Mengarahkan ke dasbor...");
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center space-y-2">
           <Landmark className="w-10 h-10 mx-auto text-[#6A197D]" />
           <h1 className="text-xl font-black text-gray-900 tracking-wide">
             Sistem Administrasi Sekolah
           </h1>
           <p className="text-xs font-medium text-slate-500">Portal Akses Admin Kurikulum & Pendidik</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Email (Admin) atau Nama Lengkap (Guru)</label>
            <div className="relative">
               <User className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" />
               <input 
                 type="text" 
                 value={identity}
                 onChange={(e) => setIdentity(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#8A2FA0] font-semibold text-slate-700" 
                 placeholder="admin@sekolah.sch.id ATAU nurulfitri" 
                 required
               />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 pl-1 leading-relaxed">
               * Guru: ketik nama murni tanpa gelar/spasi (misal: <i>nurulfitri</i>), <strong>atau</strong> nama akun persis seperti tertulis di tabel &quot;Lihat &amp; Unduh Data Akun Guru&quot; (misal: <i>nurulfitri485</i>).
            </p>
          </div>
          
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Kata Sandi</label>
            <div className="relative">
               <Lock className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" />
               <input 
                 type="password" 
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#8A2FA0] font-semibold text-slate-700" 
                 placeholder="Kata sandi / NPSN sekolah"
                 required
               />
            </div>
          </div>

          {message && (
            <p className={`text-xs text-center font-bold p-2 rounded-lg ${message.startsWith('Gagal') || message.includes('tidak sesuai') || message.includes('tidak terdaftar') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
              {message}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full px-4 py-3.5 text-white bg-[#6A197D] rounded-xl hover:bg-[#571466] focus:outline-none focus:ring-2 focus:ring-[#8A2FA0] focus:ring-offset-2 font-black shadow-md transition flex items-center justify-center gap-2"
          >
            {loading ? 'Memvalidasi Akses...' : 'Masuk Sistem'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}