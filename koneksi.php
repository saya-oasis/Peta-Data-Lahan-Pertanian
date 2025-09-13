<?php
$host = "localhost";
$user = "root";       // default XAMPP
$pass = "";           // default kosong
$db   = "db_prajab"; // nama database baru
$conn = new mysqli($host, $user, $pass, $db);

if($conn->connect_error){
    die("Koneksi gagal: " . $conn->connect_error);
}
?>