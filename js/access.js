/**
 * Daftar kode akses / paket waktu.
 * minutes: null  -> tanpa batas waktu (akun utama panitia).
 * minutes: angka -> sesi otomatis berakhir setelah sekian menit.
 *
 * CATATAN KEAMANAN: timer ini berjalan di browser (client-side), sesuai
 * kebutuhan "cepat & simpel". Karena aplikasi ini dipakai di 1 device kios
 * yang dijaga panitia, ini cukup aman untuk penggunaan normal — tapi bukan
 * proteksi anti-curang tingkat tinggi (mis. kalau tamu sendiri yang pegang
 * device dan tahu cara refresh/clear data browser, timer bisa reset).
 *
 * Ganti kode-kode di bawah ini sebelum acara berlangsung.
 */
const accessPackages = [
  { code: "1515", label: "Paket 15 Menit", minutes: 15 },
  { code: "2525", label: "Paket 25 Menit", minutes: 25 },
  { code: "PANITIA", label: "Akun Utama (Tanpa Batas Waktu)", minutes: null },
];
