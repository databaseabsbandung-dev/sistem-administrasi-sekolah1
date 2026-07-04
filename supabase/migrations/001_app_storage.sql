-- Jalankan skrip ini SEKALI di Supabase Dashboard > SQL Editor
-- (Project: whnwipppzjauxkmdiqfv) sebelum fitur sinkronisasi lintas
-- perangkat/akun bisa berjalan.

create table if not exists public.app_storage (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- RLS: baca (SELECT) tetap dibuka untuk siapapun -- ini SENGAJA, karena
-- halaman login Guru perlu mencari email guru di data ini SEBELUM guru
-- tsb berhasil login (ayam-telur: butuh data untuk bisa login). Sesuai
-- arahan bahwa data sekolah ini tidak tergolong sangat rahasia.
--
-- Yang benar-benar ditutup adalah TULIS/UBAH/HAPUS -- wajib sudah login
-- (Admin atau Guru, karena akun Guru sekarang juga akun Supabase Auth asli,
-- lihat app/api/admin/buat-akun-guru/route.ts) supaya pengunjung anonim
-- tidak bisa merusak/menghapus data sekolah.
alter table public.app_storage enable row level security;

drop policy if exists "app_storage_select" on public.app_storage;
create policy "app_storage_select" on public.app_storage
  for select using (true);

drop policy if exists "app_storage_insert" on public.app_storage;
create policy "app_storage_insert" on public.app_storage
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "app_storage_update" on public.app_storage;
create policy "app_storage_update" on public.app_storage
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "app_storage_delete" on public.app_storage;
create policy "app_storage_delete" on public.app_storage
  for delete using (auth.role() = 'authenticated');

-- Aktifkan realtime agar perubahan dari satu perangkat langsung terlihat
-- (tanpa perlu refresh) di perangkat lain yang sedang online.
alter publication supabase_realtime add table public.app_storage;
