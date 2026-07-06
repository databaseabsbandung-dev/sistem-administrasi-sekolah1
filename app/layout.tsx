import type { Metadata } from "next";
import { Baloo_2, Open_Sans } from "next/font/google";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import CloudSyncProvider from "@/components/CloudSyncProvider";

// Ini adalah kode sakti agar seluruh E-Rapor selalu update data seketika
export const dynamic = 'force-dynamic';

// Font Tebal / display untuk judul & elemen penting (dipakai lewat class "font-baloo")
const baloo = Baloo_2({
  variable: "--font-baloo",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

// Font utama untuk seluruh isi halaman (dipakai lewat class "font-opensans",
// dan juga menjadi font default seluruh body)
const openSans = Open_Sans({
  variable: "--font-opensans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem Administrasi Sekolah",
  description: "Sistem Administrasi Sekolah",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${baloo.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-opensans">
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          <CloudSyncProvider>
            {children}
          </CloudSyncProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
