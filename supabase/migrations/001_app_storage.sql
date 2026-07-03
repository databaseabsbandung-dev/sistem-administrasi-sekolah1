-- Jalankan skrip ini SEKALI di Supabase Dashboard > SQL Editor
-- (Project: whnwipppzjauxkmdiqfv) sebelum fitur sinkronisasi lintas
-- perangkat/akun bisa berjalan.

create table if not exists public.app_storage (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- Aktifkan Row Level Security lalu buka akses baca/tulis untuk anon key.
-- CATATAN: ini sengaja dibuat terbuka karena login akun Guru di aplikasi ini
-- BUKAN memakai Supabase Auth (hanya validasi nama + NPSN di sisi klien),
-- sehingga tidak ada sesi terautentikasi yang bisa dijadikan syarat RLS.
-- Kalau nanti ingin lebih aman, pertimbangkan memindahkan login Guru ke
-- Supabase Auth juga, lalu ganti policy di bawah ini agar mensyaratkan
-- auth.role() = 'authenticated'.
alter table public.app_storage enable row level security;

drop policy if exists "app_storage_select" on public.app_storage;
create policy "app_storage_select" on public.app_storage
  for select using (true);

drop policy if exists "app_storage_insert" on public.app_storage;
create policy "app_storage_insert" on public.app_storage
  for insert with check (true);

drop policy if exists "app_storage_update" on public.app_storage;
create policy "app_storage_update" on public.app_storage
  for update using (true) with check (true);

drop policy if exists "app_storage_delete" on public.app_storage;
create policy "app_storage_delete" on public.app_storage
  for delete using (true);

-- Aktifkan realtime agar perubahan dari satu perangkat langsung terlihat
-- (tanpa perlu refresh) di perangkat lain yang sedang online.
alter publication supabase_realtime add table public.app_storage;
