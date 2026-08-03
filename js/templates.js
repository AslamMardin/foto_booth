/**
 * Katalog template bingkai.
 * Untuk menambah bingkai baru:
 *   1. Simpan file PNG (transparan di tengah) berukuran PERSIS 555 x 331 px
 *      ke folder assets/templates/
 *   2. Simpan thumbnail preview (jpg/png bebas ukuran) ke assets/thumb/
 *   3. Tambahkan satu baris objek baru di array `templates` di bawah ini.
 */
const templates = [
  {
    id: 1,
    nama: "Tema Basic",
    src: "assets/templates/basic.png",
    thumbnail: "assets/thumb/basic.jpg"
  },
  {
    id: 2,
    nama: "Tema Sekolah",
    src: "assets/templates/sekolah.png",
    thumbnail: "assets/thumb/sekolah.jpg"
  }
];
