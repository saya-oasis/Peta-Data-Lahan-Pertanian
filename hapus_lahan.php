    <?php
    header('Content-Type: application/json');
    require 'koneksi.php';

    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);

    if ($id > 0) {
        $stmt = $conn->prepare("DELETE FROM lahan WHERE id=?");
        $stmt->bind_param("i", $id);
        if ($stmt->execute()) {
            echo json_encode(['status' => 'ok', 'message' => 'Data lahan berhasil dihapus.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Gagal menghapus data lahan.']);
        }
        $stmt->close();
    } else {
        echo json_encode(['status' => 'error', 'message' => 'ID tidak valid.']);
    }
    $conn->close();
    ?>