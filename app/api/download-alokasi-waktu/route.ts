// FILE: app/api/download-alokasi-waktu/route.ts
// API Route untuk generate dan download PDF Analisis Alokasi Waktu
// Layout mengikuti persis format "Aplikasi Buku Kerja Guru" yang dipakai sekolah.

import { NextRequest, NextResponse } from 'next/server'

type Sel = { text: string; width: number; align?: 'left' | 'center' | 'right'; bold?: boolean; color?: string }

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const {
      namaSekolah, titiMangsa, kota,
      semester, tahunAjaran,
      namaGuru, namaMapel, namaRombel, jpPerMinggu, nuptkGuru,
      hasil, hasilHari,
      namaPenandatangan, nipPenandatangan, labelPenandatangan,
      distribusiTp,
    } = data

    const PDFDocument = (await import('pdfkit')).default

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 45, left: 55, right: 55 }
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    await new Promise<void>((resolve) => {
      doc.on('end', resolve)

      const W = doc.page.width - 110
      const L = 55
      const DARK = '#000000'
      const FONT_REG = 'Times-Roman'
      const FONT_BOLD = 'Times-Bold'
      const borderColor = '#000000'
      const HEADER_BG = '#EDE3F3' // ungu SOFT untuk header tabel (bukan ungu tua)
      const PAD = 4

      let y = 45

      /**
       * Menggambar satu baris tabel pada posisi (x, y) dengan garis pembatas
       * di SETIAP kolom (bukan cuma garis atas/bawah), dan tinggi baris
       * otomatis menyesuaikan teks terpanjang di baris itu -- supaya teks
       * tidak pernah terpotong/menumpuk dengan baris di bawahnya.
       */
      function drawRow(x: number, yPos: number, cells: Sel[], opts?: { header?: boolean; minHeight?: number }): number {
        const header = !!opts?.header
        doc.font(header || cells.some(c => c.bold) ? FONT_BOLD : FONT_REG)
        doc.fontSize(9)
        let tinggi = opts?.minHeight || (header ? 14 : 13)
        cells.forEach(c => {
          const h = doc.heightOfString(c.text || '', { width: c.width - PAD * 2 }) + PAD * 2
          if (h > tinggi) tinggi = h
        })

        // Latar header (ungu soft)
        if (header) {
          doc.rect(x, yPos, cells.reduce((s, c) => s + c.width, 0), tinggi).fill(HEADER_BG)
        }

        // Garis kolom (vertikal) + isi teks -- teks header diposisikan tepat DI
        // TENGAH baris secara vertikal (bukan menempel di atas), supaya header
        // yang teksnya sempat membungkus 2 baris tetap terlihat center.
        let cx = x
        cells.forEach(c => {
          doc.rect(cx, yPos, c.width, tinggi).stroke(borderColor)
          const tinggiTeks = doc.heightOfString(c.text || '', { width: c.width - PAD * 2 })
          const yTeks = yPos + Math.max(PAD - 1, (tinggi - tinggiTeks) / 2)
          doc.fillColor(c.color || DARK)
            .font(header || c.bold ? FONT_BOLD : FONT_REG)
            .fontSize(9)
            .text(c.text || '', cx + PAD, yTeks, { width: c.width - PAD * 2, align: c.align || 'left' })
          cx += c.width
        })
        doc.fillColor(DARK)
        return yPos + tinggi
      }

      // ── JUDUL ──
      doc.fillColor(DARK).font(FONT_BOLD).fontSize(13)
        .text('ANALISIS ALOKASI WAKTU', L, y, { width: W, align: 'center' })
      y += 22

      // ── BARIS IDENTITAS (Label : Value) ──
      doc.font(FONT_REG).fontSize(11)
      const baris = (label: string, value: string) => {
        doc.text(`${label}`, L, y, { continued: false, width: 140 })
        doc.text(`: ${value || ''}`, L + 105, y, { width: W - 105 })
        y += 13.5
      }
      baris('Satuan Pendidikan', namaSekolah || '')
      if (namaMapel) baris('Mata Pelajaran', namaMapel)
      if (namaRombel) baris('Kelas', namaRombel)
      baris('Semester', semester || '')
      baris('Tahun Ajaran', tahunAjaran || '')
      baris('Jumlah Jam Pelajaran', `${jpPerMinggu || 0} JP/Minggu`)
      if (namaGuru) baris('Guru Mata Pelajaran', namaGuru)

      y += 4
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(borderColor).lineWidth(0.75).stroke()
      y += 12

      doc.font(FONT_BOLD).fontSize(12)
        .text('PERHITUNGAN MINGGU/JAM EFEKTIF', L, y, { width: W, align: 'center' })
      y += 18

      // ── I & II BERDAMPINGAN (2 kolom) ──
      const colGap = 10
      const colW = (W - colGap) / 2
      const col1X = L
      const col2X = L + colW + colGap

      doc.font(FONT_BOLD).fontSize(10).text('I. Jumlah Minggu :', col1X, y)
      doc.text('II. Jumlah Minggu Tidak Efektif :', col2X, y)
      y += 13
      const yTabelAwal = y

      // -- Kolom I: No | Bulan | Jml Minggu --
      const bulanMap: { [k: string]: { label: string; jml: number } } = {}
      if (hasil?.detail) {
        hasil.detail.forEach((d: any) => {
          const key = d.bulanKey
          if (!bulanMap[key]) bulanMap[key] = { label: d.bulanLabel, jml: 0 }
          bulanMap[key].jml++
        })
      }
      const bulanEntries = Object.entries(bulanMap).sort(([a], [b]) => a.localeCompare(b))
      const c1w = [22, colW - 22 - 42, 42]

      let yy = yTabelAwal
      yy = drawRow(col1X, yy, [
        { text: 'No', width: c1w[0], align: 'center' },
        { text: 'Bulan', width: c1w[1], align: 'center' },
        { text: 'Jml. Minggu', width: c1w[2], align: 'center' },
      ], { header: true })

      let totalMinggu = 0
      bulanEntries.forEach(([, v], i) => {
        yy = drawRow(col1X, yy, [
          { text: String(i + 1), width: c1w[0], align: 'center' },
          { text: v.label, width: c1w[1] },
          { text: String(v.jml), width: c1w[2], align: 'center' },
        ])
        totalMinggu += v.jml
      })
      yy = drawRow(col1X, yy, [
        { text: '', width: c1w[0] },
        { text: 'Jumlah', width: c1w[1] },
        { text: String(totalMinggu), width: c1w[2], align: 'center' },
      ])
      const yAkhirKol1 = yy

      // -- Kolom II: Bulan | Kegiatan | Jml Minggu --
      const tidakEfektifPerBulan: { [k: string]: { label: string; kegiatan: Set<string>, jml: number } } = {}
      if (hasil?.detail) {
        hasil.detail.filter((d: any) => !d.efektif).forEach((d: any) => {
          const key = d.bulanKey
          if (!tidakEfektifPerBulan[key]) tidakEfektifPerBulan[key] = { label: d.bulanLabel, kegiatan: new Set(), jml: 0 }
          tidakEfektifPerBulan[key].jml++
          ;(d.kegiatanDiMingguIni || []).forEach((k: string) => tidakEfektifPerBulan[key].kegiatan.add(k))
        })
      }
      const teEntries = Object.entries(tidakEfektifPerBulan).sort(([a], [b]) => a.localeCompare(b))
      const c2w = [45, colW - 45 - 40, 40]

      yy = yTabelAwal
      yy = drawRow(col2X, yy, [
        { text: 'Bulan', width: c2w[0], align: 'center' },
        { text: 'Kegiatan', width: c2w[1], align: 'center' },
        { text: 'Jml. Minggu', width: c2w[2], align: 'center' },
      ], { header: true })

      let totalTE = 0
      if (teEntries.length === 0) {
        yy = drawRow(col2X, yy, [{ text: 'Tidak ada minggu tidak efektif', width: colW, align: 'center', color: '#000000' }])
      } else {
        teEntries.forEach(([, v]) => {
          const kegiatanTxt = [...v.kegiatan].join(', ') || '-'
          yy = drawRow(col2X, yy, [
            { text: v.label, width: c2w[0] },
            { text: kegiatanTxt, width: c2w[1] },
            { text: String(v.jml), width: c2w[2], align: 'center' },
          ])
          totalTE += v.jml
        })
      }
      yy = drawRow(col2X, yy, [
        { text: '', width: c2w[0] },
        { text: 'Jumlah', width: c2w[1] },
        { text: String(totalTE), width: c2w[2], align: 'center' },
      ])
      const yAkhirKol2 = yy

      y = Math.max(yAkhirKol1, yAkhirKol2) + 14

      // ── III & IV (teks polos, tanpa kotak) ──
      const mingguEfektif = totalMinggu - totalTE
      doc.font(FONT_BOLD).fontSize(10).fillColor(DARK)
        .text('III. JUMLAH MINGGU EFEKTIF', L, y, { continued: true })
        .font(FONT_REG).text('= Jumlah Minggu - Jumlah Minggu Tidak Efektif', { continued: false })
      y += 12
      doc.font(FONT_REG).fontSize(10).text(`= ${totalMinggu} - ${totalTE} Minggu`, L + 15, y)
      y += 12
      doc.font(FONT_BOLD).fontSize(10.5).text(`= ${mingguEfektif} Minggu`, L + 15, y)
      y += 18

      // "Jumlah Hari Efektif" & "Jumlah Jam Efektif" (IV & V) HANYA relevan untuk
      // unduhan per Mapel (hasilHari terisi) -- konsepnya memang berbasis jadwal
      // mengajar satu guru/mapel per hari, tidak berlaku di level Lembaga. Untuk
      // unduhan Lembaga/Unit/Kelas (tanpa hasilHari), penomoran cukup berhenti di III.
      const adaHariEfektif = typeof hasilHari?.totalHariMengajar === 'number'
      if (adaHariEfektif) {
        const perHariTxt = Array.isArray(hasilHari?.perHari)
          ? hasilHari.perHari.map((h: { hari: string; jumlah: number }) => `${h.hari}(${h.jumlah}x)`).join(', ')
          : ''
        doc.font(FONT_BOLD).fontSize(10)
          .text('IV. JUMLAH HARI EFEKTIF', L, y, { continued: true })
          .font(FONT_REG).text('= Jumlah hari mengajar yang tidak kena libur (dijumlahkan per minggu)', { continued: false })
        y += 12
        doc.font(FONT_BOLD).fontSize(10.5).text(`= ${hasilHari.totalHariMengajar} Hari`, L + 15, y, { continued: true })
        doc.font(FONT_REG).fontSize(9).text(perHariTxt ? ` (${perHariTxt})` : '', { continued: false })
        y += 18

        const totalJpPresisi = typeof hasilHari?.totalJpEfektif === 'number' ? hasilHari.totalJpEfektif : null
        const totalJp = totalJpPresisi !== null ? totalJpPresisi : mingguEfektif * (jpPerMinggu || 0)
        doc.font(FONT_BOLD).fontSize(10)
          .text('V. JUMLAH JAM EFEKTIF', L, y, { continued: true })
          .font(FONT_REG).text('= Jumlah JP pada tiap hari mengajar yang tidak kena libur', { continued: false })
        y += 12
        doc.font(FONT_REG).fontSize(9).text('(dihitung dari Jadwal Pelajaran per hari, bukan sekadar minggu x JP/minggu)', L + 15, y)
        y += 12
        doc.font(FONT_BOLD).fontSize(10.5).text(`= ${totalJp} Jam Pelajaran`, L + 15, y)
        y += 26
      } else {
        y += 8
      }

      // ── TANDA TANGAN ──────────────────────────────────────
      // HANYA untuk unduhan per Mapel/Guru (namaGuru terisi) -- laporan Lembaga
      // (Pusat/Unit/Kelas, tanpa guru/mapel spesifik) sekadar rekap jumlah
      // minggu, tidak perlu ditandatangani Kepala Sekolah/Mudir maupun titimangsa.
      if (namaGuru) {
        // Aturan penempatan (berlaku sama di SEMUA dokumen unduhan):
        // Kepala Sekolah/Mudir ("Mengetahui") SELALU di KIRI. Pihak lain
        // (Guru Mapel, Waka Kurikulum, dst) SELALU di KANAN -- dan titi
        // mangsa sejajar dengan pihak KANAN itu. Tidak ada garis TTD.
        if (y > doc.page.height - 185) { doc.addPage(); y = 50 }

        // Kolom dilebarkan (gutter tengah diperkecil dari 10 ke 6, lebar teks nama
        // guru tidak lagi dipotong -20) supaya ruang membubuhkan tanda tangan basah
        // lebih leluasa.
        const kolomKiriX = L
        const kolomKiriW = W / 2 - 6
        const kolomKananX = L + W / 2 + 6
        const kolomKananW = W / 2 - 6

        const tanggalHariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        const titiMangsaFinal = titiMangsa || `${kota || 'Bandung'}, ${tanggalHariIni}`
        doc.font(FONT_REG).fontSize(10.5).fillColor(DARK)
        // Blok KIRI (Kepala Sekolah/Mudir) tetap di sisi KIRI halaman, blok KANAN
        // (Guru Mapel) tetap di sisi KANAN -- tapi teks di dalam masing-masing
        // kolom rata TENGAH (center) terhadap lebar kolomnya sendiri, bukan rata
        // kiri/kanan mentah, supaya blok tanda tangan terlihat rapi di tengah
        // "ruang"-nya masing-masing.
        doc.text(titiMangsaFinal, kolomKananX, y, { width: kolomKananW, align: 'center' })
        y += 16

        doc.text('Mengetahui,', kolomKiriX, y, { width: kolomKiriW, align: 'center' })
        y += 12

        const ttdY = y
        doc.font(FONT_REG).fontSize(10.5)
        doc.text(`${labelPenandatangan || 'Kepala Sekolah'},`, kolomKiriX, ttdY, { width: kolomKiriW, align: 'center' })
        doc.text('Guru Mata Pelajaran,', kolomKananX, ttdY, { width: kolomKananW, align: 'center' })

        // Tanpa garis TTD -- langsung nama, jarak vertikal diperbesar (42 -> 65px)
        // supaya ruang membubuhkan tanda tangan basah lebih leluasa.
        const namaY = ttdY + 65

        doc.font(FONT_BOLD).fontSize(10.5)
          .text(namaPenandatangan || '', kolomKiriX, namaY, { width: kolomKiriW, align: 'center' })
        // Mudir (Lembaga Pusat) TIDAK pakai NUPTK. Kepala Sekolah Unit tetap pakai.
        if (labelPenandatangan !== 'Mudir') {
          doc.font(FONT_REG).fontSize(9.5)
            .text(`NUPTK: ${nipPenandatangan || '-'}`, kolomKiriX, namaY + 12, { width: kolomKiriW, align: 'center' })
        }

        doc.font(FONT_BOLD).fontSize(10.5)
          .text(namaGuru, kolomKananX, namaY, { width: kolomKananW, align: 'center' })
        doc.font(FONT_REG).fontSize(9.5)
          .text(`NUPTK: ${nuptkGuru || '-'}`, kolomKananX, namaY + 12, { width: kolomKananW, align: 'center' })
      }

      doc.end()
    })

    const pdfBuffer = Buffer.concat(chunks)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Alokasi_Waktu_${semester}_${String(tahunAjaran || '').replace('/', '-')}.pdf"`,
        'Content-Length': String(pdfBuffer.length)
      }
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return new NextResponse('Gagal membuat PDF: ' + String(err), { status: 500 })
  }
}
