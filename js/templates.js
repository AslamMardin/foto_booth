/**
 * Ukuran cetak: 2,6 x 5,9 cm  ->  307 x 697 px @300dpi (HARDCODED, jangan diubah
 * kecuali ukuran cetak fisiknya juga berubah).
 *
 * STRIP.slots = posisi 3 lubang foto di dalam kanvas. Ketiganya HARUS
 * berukuran sama persis dengan lubang transparan pada file PNG template.
 */
const STRIP = {
  width: 307,
  height: 697,
  slots: [
    { x: 18, y: 18, w: 271, h: 185 },
    { x: 18, y: 215, w: 271, h: 185 },
    { x: 18, y: 412, w: 271, h: 185 },
  ],
};

/**
 * Katalog template bingkai strip.
 * Untuk menambah bingkai baru (mis. hasil edit Canva):
 *   1. Export PNG 307 x 697 px, bagian 3 kotak foto (lihat STRIP.slots di atas)
 *      HARUS transparan.
 *   2. Simpan ke assets/templates/, buat thumbnail-nya ke assets/thumb/.
 *   3. Tambahkan satu baris objek baru di array `templates` di bawah ini.
 */
const templates = [
  {
    id: 1,
    nama: "Tema Basic",
    src: "assets/templates/strip-basic.png",
    thumbnail: "assets/thumb/strip-basic.jpg",
  },
  {
    id: 2,
    nama: "Tema Sekolah",
    src: "assets/templates/strip-sekolah.png",
    thumbnail: "assets/thumb/strip-sekolah.jpg",
  },
];
