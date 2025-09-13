<?php
header('Content-Type: application/json');
require 'koneksi.php';

$data = json_decode(file_get_contents('php://input'), true);
$id = intval($data['id'] ?? 0);
$kecamatan = $data['kecamatan'] ?? '';
$desa = $data['desa'] ?? '';
$kelompok = $data['kelompok'] ?? '';
$nama_pemilik = $data['nama_pemilik'] ?? '';

if ($id > 0 && $kecamatan && $desa && $kelompok && $nama_pemilik) {
    $stmt = $conn->prepare("UPDATE lahan SET kecamatan=?, desa=?, kelompok=?, nama_pemilik=? WHERE id=?");
    $stmt->bind_param("ssssi", $kecamatan, $desa, $kelompok, $nama_pemilik, $id);
    if ($stmt->execute()) {
        echo json_encode(['status' => 'ok', 'message' => 'Data lahan berhasil diupdate.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Gagal update data lahan.']);
    }
    $stmt->close();
} else {
    echo json_encode(['status' => 'error', 'message' => 'Data tidak lengkap.']);
}
$conn->close();
?>