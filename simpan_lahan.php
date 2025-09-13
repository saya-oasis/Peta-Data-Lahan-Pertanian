<?php
// filepath: c:\xampp\htdocs\PRAJAB\simpan_lahan.php
header('Content-Type: application/json');

$host = "localhost";
$user = "root";
$pass = "";
$db   = "db_prajab";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die(json_encode(['status' => 'error', 'message' => 'Koneksi database gagal']));
}

// Ambil data POST
$id_kelompok = $_POST['kelompok_id'] ?? 0;
$nama_lahan  = $_POST['nama_lahan'] ?? '';
$luas        = $_POST['luas'] ?? 0;
$geojson     = $_POST['geojson'] ?? '';
$nama_pemilik = $_POST['nama_pemilik'] ?? '';
$kecamatan = $_POST['kecamatan'] ?? '';
$desa = $_POST['desa'] ?? '';

// Pastikan nama kolom sesuai dengan database
$stmt = $conn->prepare("INSERT INTO lahan (id_kelompok, nama_lahan, luas, geojson, nama_pemilik, kecamatan, desa) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("isdssss", $id_kelompok, $nama_lahan, $luas, $geojson, $nama_pemilik, $kecamatan, $desa);

if ($stmt->execute()) {
    echo json_encode(['status' => 'ok', 'message' => 'Data lahan berhasil disimpan']);
} else {
    echo json_encode(['status' => 'error', 'message' => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
