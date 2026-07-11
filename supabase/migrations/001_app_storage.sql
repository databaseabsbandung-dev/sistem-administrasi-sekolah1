-- Jalankan skrip ini di Supabase Dashboard > SQL Editor.
-- Skrip ini AMAN dijalankan berkali-kali (idempotent) -- tidak akan error
-- walau tabel/policy/publication-nya sudah pernah dibuat sebelumnya.

create table if not exists public.app_storage (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- RLS: SEBELUMNYA seluruh isi tabel (SELECT) dibuka untuk siapapun supaya
-- halaman login Guru bisa mencari data akun SEBELUM guru itu berhasil
-- login. Setelah diaudit, ini terlalu longgar -- seluruh data sekolah
-- (nama, NIP, jadwal, dst) jadi bisa dibaca siapapun di internet tanpa
-- login sama sekali.
--
-- PERBAIKAN: sekarang HANYA SATU key ("guru_login_lookup" -- isinya CUMA
-- nama & email guru, tidak ada NIP/data lain) yang tetap terbuka publik,
-- khusus untuk keperluan pencarian akun sebelum login. SEMUA key lain
-- (master_guru yang sesungguhnya lengkap dengan NIP dkk, data jadwal,
-- kaldik, dan seterusnya) WAJIB sudah login (Admin atau Guru) untuk bisa
-- dibaca. Lihat app/page.tsx (alur login) dan app/peran/guru/page.tsx
-- (yang menjaga key "guru_login_lookup" ini tetap sinkron dengan master_guru).
alter table public.app_storage enable row level security;

drop policy if exists "app_storage_select" on public.app_storage;
create policy "app_storage_select" on public.app_storage
  for select using (
    key = 'guru_login_lookup'
    or auth.role() = 'authenticated'
  );

drop policy if exists "app_storage_insert" on public.app_storage;
create policy "app_storage_insert" on public.app_storage
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "app_storage_update" on public.app_storage;
create policy "app_storage_update" on public.app_storage
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "app_storage_delete" on public.app_storage;
create policy "app_storage_delete" on public.app_storage
  for delete using (
    auth.role() = 'authenticated'
    -- PERKUAT KEAMANAN: HAPUS hanya boleh dilakukan akun yang BUKAN guru
    -- (yaitu Admin) -- dicek di level DATABASE lewat penanda
    -- user_metadata.role yang ditetapkan saat akun guru dibuat (lihat
    -- app/api/admin/buat-akun-guru/route.ts), bukan cuma di kode aplikasi.
    -- Jadi walau seorang guru mencoba memanggil API Supabase langsung lewat
    -- luar aplikasi, database sendiri yang menolak percobaan hapus data.
    and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'guru'
  );

-- Aktifkan realtime -- dibungkus pengecekan supaya TIDAK ERROR walau
-- tabel ini sudah pernah ditambahkan ke publication sebelumnya (ini yang
-- menyebabkan error di percobaan Anda barusan, karena baris ini sempat
-- dijalankan dua kali).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_storage'
  ) then
    alter publication supabase_realtime add table public.app_storage;
  end if;
end $$;

-- Verifikasi cepat: kalau baris di bawah ini berhasil menampilkan hasil
-- (bukan error), berarti tabel app_storage sudah benar-benar ada & siap.
select count(*) as jumlah_baris_saat_ini from public.app_storage;
