<?php
file_put_contents('debug_add_data.txt', file_get_contents('php://input'));
header('Content-Type: application/json');
require 'koneksi.php';

// Fungsi konversi GeoJSON ke WKT
function geojsonToWKT($geojson) {
    if (empty($geojson) || !isset($geojson['type'])) return null;

    $type = strtoupper($geojson['type']);

    if ($type === 'POLYGON') {
        $coords = $geojson['coordinates'][0];
        $wktCoords = [];
        foreach ($coords as $c) $wktCoords[] = "{$c[0]} {$c[1]}";
        return "POLYGON((" . implode(', ', $wktCoords) . "))";

    } elseif ($type === 'MULTIPOLYGON') {
        $polygons = [];
        foreach ($geojson['coordinates'] as $polygon) {
            $rings = [];
            foreach ($polygon as $ring) {
                $pts = [];
                foreach ($ring as $coord) $pts[] = "{$coord[0]} {$coord[1]}";
                $rings[] = "(" . implode(', ', $pts) . ")";
            }
            $polygons[] = "(" . implode(', ', $rings) . ")";
        }
        return "MULTIPOLYGON(" . implode(', ', $polygons) . ")";
    }

    return null;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['type'])) {
    echo json_encode(['status'=>'error','message'=>'Input JSON tidak valid.']);
    exit;
}

$type = $input['type'];
$data = $input['data'] ?? null;
$inTransaction = false;

try {
    switch($type) {
        case 'full_hierarchy':
            if (empty($data['kecamatan']) || empty($data['desa']) || empty($data['kelompok'])) {
                throw new Exception("Data hierarki tidak lengkap.");
            }

            $conn->begin_transaction();
            $inTransaction = true;

            $nama_kecamatan = trim($data['kecamatan']);
            $nama_desa = trim($data['desa']);
            $nama_kelompok = trim($data['kelompok']);

            // 1. Insert/Get Kecamatan
            $stmt = $conn->prepare("INSERT INTO kecamatan (nama) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)");
            $stmt->bind_param("s", $nama_kecamatan);
            $stmt->execute();
            $id_kecamatan = $conn->insert_id;

            if ($id_kecamatan === 0) {
                $stmt = $conn->prepare("SELECT id FROM kecamatan WHERE nama=?");
                $stmt->bind_param("s",$nama_kecamatan);
                $stmt->execute();
                $id_kecamatan = $stmt->get_result()->fetch_assoc()['id'];
            }

            // 2. Insert/Get Desa
            $stmt = $conn->prepare("INSERT INTO desa (id_kecamatan,nama) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)");
            $stmt->bind_param("is",$id_kecamatan,$nama_desa);
            $stmt->execute();
            $id_desa = $conn->insert_id;
            if ($id_desa === 0) {
                $stmt = $conn->prepare("SELECT id FROM desa WHERE id_kecamatan=? AND nama=?");
                $stmt->bind_param("is",$id_kecamatan,$nama_desa);
                $stmt->execute();
                $id_desa = $stmt->get_result()->fetch_assoc()['id'];
            }

            // 3. Insert/Get Kelompok Tani
            $stmt = $conn->prepare("INSERT INTO kelompok_tani (id_desa,nama) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)");
            $stmt->bind_param("is",$id_desa,$nama_kelompok);
            $stmt->execute();
            $id_kelompok = $conn->insert_id;
            if ($id_kelompok === 0) {
                $stmt = $conn->prepare("SELECT id FROM kelompok_tani WHERE id_desa=? AND nama=?");
                $stmt->bind_param("is",$id_desa,$nama_kelompok);
                $stmt->execute();
                $id_kelompok = $stmt->get_result()->fetch_assoc()['id'];
            }

            $conn->commit();
            $inTransaction=false;

            echo json_encode([
                'status'=>'ok',
                'message'=>'Hierarki wilayah berhasil disimpan.',
                'id_kecamatan'=>$id_kecamatan,
                'id_desa'=>$id_desa,
                'id_kelompok'=>$id_kelompok
            ]);
            break;

        case 'lahan_batch':
            if (!is_array($data) || empty($data)) {
                throw new Exception("Data lahan tidak valid.");
            }

            $conn->begin_transaction();
            $inTransaction=true;

            $id_kelompok = intval($data[0]['id_kelompok']);

            // Hapus data lama
            $stmt = $conn->prepare("DELETE FROM lahan WHERE id_kelompok=?");
            $stmt->bind_param("i",$id_kelompok);
            $stmt->execute();

            // TAMBAHKAN nama_pemilik pada query insert!
            $stmt = $conn->prepare("INSERT INTO lahan (id_kecamatan,id_desa,id_kelompok,luas_ha,geometry,nama_pemilik)
                VALUES (?,?,?,?,ST_GeomFromText(?),?)");

            foreach($data as $lahan){
                $id_kec = intval($lahan['id_kecamatan']);
                $id_desa = intval($lahan['id_desa']);
                $id_kel = intval($lahan['id_kelompok']);
                $luas = floatval($lahan['luas_ha']);
                $wkt = geojsonToWKT($lahan['geometry']);
                $nama_pemilik = isset($lahan['nama_pemilik']) ? $lahan['nama_pemilik'] : null;
                if (!$wkt) throw new Exception("GeoJSON tidak valid.");

                $stmt->bind_param("iiidss",$id_kec,$id_desa,$id_kel,$luas,$wkt,$nama_pemilik);
                $stmt->execute();
            }

            $conn->commit();
            $inTransaction=false;

            echo json_encode(['status'=>'ok','message'=>'Data lahan berhasil disimpan.']);
            break;

        default:
            throw new Exception("Tipe data tidak dikenal.");
    }
} catch(Exception $e){
    if($inTransaction) $conn->rollback();
    echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
}

$conn->close();
file_put_contents('debug.txt', print_r($_POST, true));


