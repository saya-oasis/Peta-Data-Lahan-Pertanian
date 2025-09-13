<?php
header('Content-Type: application/json');
include 'koneksi.php';

$data = json_decode(file_get_contents("php://input"), true);
$type = $data['type'] ?? '';

if ($type == 'kecamatan') {
    $res = $conn->query("SELECT * FROM kecamatan ORDER BY nama ASC");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['status' => 'ok', 'data' => $rows]);
    exit;
}

if ($type == 'desa') {
    $id = intval($data['id_kecamatan'] ?? 0);
    $res = $conn->query("SELECT * FROM desa WHERE id_kecamatan=$id ORDER BY nama ASC");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['status' => 'ok', 'data' => $rows]);
    exit;
}

if ($type == 'kelompok') {
    $id = intval($data['id_desa'] ?? 0);
    $res = $conn->query("SELECT * FROM kelompok_tani WHERE id_desa=$id ORDER BY nama ASC");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['status' => 'ok', 'data' => $rows]);
    exit;
}

if ($type == 'geojson') {
    $id = intval($data['id'] ?? 0);
    $res = $conn->query("SELECT * FROM geojson_table WHERE id=$id");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['status' => 'ok', 'data' => $rows]);
    exit;
}

if ($type == 'pemilik') {
    $id = intval($data['id_kelompok'] ?? 0);
    $res = $conn->query("SELECT DISTINCT nama_pemilik FROM lahan WHERE id_kelompok=$id AND nama_pemilik IS NOT NULL AND nama_pemilik != '' ORDER BY nama_pemilik ASC");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['status' => 'ok', 'data' => $rows]);
    exit;
}

// default fallback
echo json_encode(['status' => 'error', 'message' => 'Tipe data tidak dikenal.']);
?>
