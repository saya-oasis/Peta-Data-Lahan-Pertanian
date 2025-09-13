<?php
header('Content-Type: application/json');
require 'koneksi.php';

try {
    if ($conn->connect_error) {
        throw new Exception("Koneksi database gagal: " . $conn->connect_error);
    }

    $data = [];
    $sql = "SELECT l.id, l.id_kecamatan, l.id_desa, l.id_kelompok, l.luas_ha, ST_AsGeoJSON(geometry) as geojson,
            k.nama as kecamatan, d.nama as desa, kt.nama as kelompok, l.nama_pemilik
            FROM lahan l
            JOIN kecamatan k ON k.id = l.id_kecamatan
            JOIN desa d ON d.id = l.id_desa
            JOIN kelompok_tani kt ON kt.id = l.id_kelompok";
            
    $res = $conn->query($sql);
    
    if (!$res) {
        throw new Exception("Error dalam query: " . $conn->error);
    }
    
    while ($row = $res->fetch_assoc()) {
        // Handle kasus di mana geojson bisa null atau tidak valid
        $geometry = json_decode($row['geojson'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Data GeoJSON tidak valid untuk ID lahan: " . $row['id']);
        }

        $feature = [
            'type' => 'Feature',
            'properties' => [
                'id' => $row['id'],
                'luas_ha' => $row['luas_ha'],
                'kecamatan' => $row['kecamatan'],
                'desa' => $row['desa'],
                'kelompok' => $row['kelompok'],
                'nama_pemilik' => $row['nama_pemilik'] // tambahkan ini
            ],
            'geometry' => $geometry
        ];
        $data[] = $feature;
    }

    echo json_encode(['status' => 'ok', 'data' => $data]);
} catch (Exception $e) {
    // Tangkap semua error dan kembalikan respons JSON yang terstruktur
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
} finally {
    // Pastikan koneksi ditutup
    if ($conn && $conn->ping()) {
        $conn->close();
    }
}
?>