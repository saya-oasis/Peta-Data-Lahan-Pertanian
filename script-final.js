// ========== script-final.js ==========
document.addEventListener('DOMContentLoaded', () => {
    // Semua kode inisialisasi map dan event listener di sini!
    var map = L.map("map").setView([-8.5, 119.9], 10);
    var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" });
    var googleSat = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: "© Google" });
    var googleLabels = L.tileLayer("https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}", { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: "© Google" });
    var googleHybrid = L.layerGroup([googleSat, googleLabels]).addTo(map);

    var baseMaps = { "OSM": osm, "Google Hybrid": googleHybrid };
    var overlayMaps = { "Batas & Label": googleLabels };
    L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);

    // Geocoder
    L.Control.geocoder({
        defaultMarkGeocode: false,
        placeholder: "Cari lokasi...",
        errorMessage: "Lokasi tidak ditemukan.",
        position: 'topright' // <-- tambahkan ini!
    })
        .on('markgeocode', function (e) {
            var latlng = e.geocode.center;
            L.marker(latlng).addTo(map).bindPopup(e.geocode.name).openPopup();
            map.setView(latlng, 15);
        }).addTo(map);

    // ================= DATA & FEATURE LAYER =================
    var geojsonData = { "type": "FeatureCollection", "features": [] };
    var featureLayers = L.geoJSON(null, {
        style: function (feature) { return { color: '#ff6600', weight: 3, opacity: 0.8, fillOpacity: 0.5 }; }
    }).addTo(map);

    var drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    var drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        position: 'topright' // <-- tambahkan ini!
    });
    map.addControl(drawControl);

    // ================= HELPER =================
    function genId() {
        return 'feat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function addFeatureLayer(feature, layer) {
        layer.feature = feature;
        layer.on('click', function () {
            const p = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
            // Saat membuat popup polygon
            let popupContent = `
              <b>Kecamatan:</b> ${feature.properties.kecamatan}<br>
              <b>Desa:</b> ${feature.properties.desa}<br>
              <b>Kelompok:</b> ${feature.properties.kelompok}<br>
              <b>Luas (Ha):</b> ${feature.properties.luas_ha}<br>
            `;
            if (feature.properties.nama_pemilik) {
                popupContent += `<b>Pemilik:</b> ${feature.properties.nama_pemilik}<br>`;
            }
            layer.bindPopup(popupContent).openPopup();
        });
        featureLayers.addLayer(layer);
    }

    // ================= EVENT DRAW =================
    map.on(L.Draw.Event.CREATED, function (e) {
        var layer = e.layer;
        var feature = layer.toGeoJSON();
        if (!feature.properties) feature.properties = {};
        if (e.layerType === 'polygon' || e.layerType === 'rectangle') {
            let areaHa = turf.area(feature) / 10000;
            feature.properties.luas_ha = Number(areaHa.toFixed(2));
            feature.properties.id = genId();

            // Ambil data hierarki dari dropdown
            const kecamatanSelect = document.getElementById('kecamatanSelect');
            const desaSelect = document.getElementById('desaSelect');
            const kelompokSelect = document.getElementById('kelompokSelect');

            feature.properties.kecamatan = (kecamatanSelect && kecamatanSelect.selectedIndex > 0) ? kecamatanSelect.options[kecamatanSelect.selectedIndex].text : 'Belum Dipilih';
            feature.properties.desa = (desaSelect && desaSelect.selectedIndex > 0) ? desaSelect.options[desaSelect.selectedIndex].text : 'Belum Dipilih';
            feature.properties.kelompok = (kelompokSelect && kelompokSelect.selectedIndex > 0) ? kelompokSelect.options[kelompokSelect.selectedIndex].text : 'Belum Dipilih';

            // === Tambahkan input nama pemilik per polygon ===
            let namaPemilik = prompt("Masukkan Nama Pemilik Lahan untuk polygon ini:", "");
            feature.properties.nama_pemilik = namaPemilik ? namaPemilik.trim() : "";
        }
        layer.feature = feature;
        drawnItems.addLayer(layer);
        addFeatureLayer(feature, layer);
        geojsonData.features.push(feature);
        updateSummaryTable();
    });

    // EDITED & DELETED
    map.on(L.Draw.Event.EDITED, function (e) {
        e.layers.eachLayer(function (layer) {
            let feature = layer.toGeoJSON();
            if (!feature.properties) feature.properties = {};
            const originalId = layer.feature?.properties?.id || genId();
            feature.properties.id = originalId;
            let areaHa = turf.area(feature) / 10000;
            feature.properties.luas_ha = Number(areaHa.toFixed(2));

            const idx = geojsonData.features.findIndex(f => f.properties?.id === originalId);
            if (idx !== -1) {
                feature.properties.kecamatan = layer.feature?.properties?.kecamatan || feature.properties.kecamatan || 'Data';
                feature.properties.desa = layer.feature?.properties?.desa || feature.properties.desa || 'Data';
                feature.properties.kelompok = layer.feature?.properties?.kelompok || feature.properties.kelompok || 'Data';
                geojsonData.features[idx] = feature;
                layer.feature = feature;
            }
        });
        updateSummaryTable();
    });

    map.on(L.Draw.Event.DELETED, function (e) {
        e.layers.eachLayer(function (layer) {
            const fid = layer.feature?.properties?.id;
            if (fid) geojsonData.features = geojsonData.features.filter(f => f.properties?.id !== fid);
            if (layer) featureLayers.removeLayer(layer);
        });
        updateSummaryTable();
    });

    // ================= SUMMARY TABLE =================
    function updateSummaryTable() {
        const tableBody = document.querySelector("#summaryTable tbody");
        if (!tableBody) return;
        tableBody.innerHTML = "";

        geojsonData.features.forEach((feature, index) => {
            const props = feature.properties || {};
            const row = document.createElement('tr');

            row.innerHTML = `
            <td>${props.kecamatan || '-'}</td>
            <td>${props.desa || '-'}</td>
            <td>${props.kelompok || '-'}</td>
            <td>${props.nama_pemilik || '-'}</td>
            <td>${props.luas_ha || 0} Ha</td>
            <td>
                <button class="btn-lihat" data-id="${props.id}">Lihat</button>
                <button class="btn-edit" data-id="${props.id}" style="margin-left:6px;color:#fff;background:#1976d2;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">Edit</button>
                <button class="btn-hapus" data-id="${props.id}" style="margin-left:6px;color:#fff;background:#e53935;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">Hapus</button>
            </td>
        `;
            tableBody.appendChild(row);
        });

        // Event listener tombol Edit
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.getAttribute('data-id');
                const feature = geojsonData.features.find(f => f.properties?.id === id);
                if (!feature) return alert('Data tidak ditemukan.');

                const kecamatanBaru = prompt("Edit Kecamatan:", feature.properties.kecamatan || '');
                const desaBaru = prompt("Edit Desa:", feature.properties.desa || '');
                const kelompokBaru = prompt("Edit Kelompok Tani:", feature.properties.kelompok || '');
                const pemilikBaru = prompt("Edit Nama Pemilik:", feature.properties.nama_pemilik || '');

                if (!kecamatanBaru || !desaBaru || !kelompokBaru || !pemilikBaru) {
                    alert("Semua data harus diisi!");
                    return;
                }

                feature.properties.kecamatan = kecamatanBaru;
                feature.properties.desa = desaBaru;
                feature.properties.kelompok = kelompokBaru;
                feature.properties.nama_pemilik = pemilikBaru;

                fetch('edit_lahan.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: id,
                        kecamatan: kecamatanBaru,
                        desa: desaBaru,
                        kelompok: kelompokBaru,
                        nama_pemilik: pemilikBaru
                    })
                }).then(res => res.json()).then(result => {
                    if (result.status === 'ok') {
                        alert('Data lahan berhasil diupdate!');
                        updateSummaryTable();
                        loadLahanFromServer();
                    } else {
                        alert(result.message || 'Gagal update data lahan.');
                    }
                }).catch(error => {
                    alert('Gagal update lahan: ' + error.message);
                });
            });
        });

        // Event listener tombol Hapus
        document.querySelectorAll('.btn-hapus').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.getAttribute('data-id');
                if (confirm("Anda yakin ingin menghapus data ini?")) {
                    fetch('hapus_lahan.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id })
                    }).then(res => res.json()).then(result => {
                        if (result.status === 'ok') {
                            alert('Data lahan berhasil dihapus!');
                            updateSummaryTable();
                            loadLahanFromServer();
                        } else {
                            alert(result.message || 'Gagal menghapus data lahan.');
                        }
                    }).catch(error => {
                        alert('Gagal menghapus lahan: ' + error.message);
                    });
                }
            });
        });
    }

    // Fungsi cari layer berdasarkan ID
    function findLayerById(id) {
        let found = null;
        drawnItems.eachLayer(layer => {
            if (layer.feature && layer.feature.properties && layer.feature.properties.id == id) {
                found = layer;
            }
        });
        return found;
    }

    // ================= SAVE HIERARCHY =================
    async function saveNewHierarchy(data) {
        if (!data.kecamatan || !data.desa || !data.kelompok) {
            alert("Data hierarki tidak lengkap. Mohon isi semua field.");
            return;
        }
        try {
            const response = await fetch('add_data.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'full_hierarchy', data })
            });
            const result = await response.json();
            if (result.status === 'ok') {
                alert(result.message);
                loadKecamatan(); // <-- ini penting agar filter ter-update
                document.getElementById('desaSelect').disabled = true;
                document.getElementById('kelompokSelect').disabled = true;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert('Gagal menambahkan: ' + error.message);
        }
    }

    // ================= LOAD DATA =================
    async function loadKecamatan() {
        try {
            const response = await fetch('get_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'kecamatan' }) });
            const result = await response.json();
            const kecamatanSelect = document.getElementById('kecamatanSelect');
            kecamatanSelect.innerHTML = '<option value="">Pilih Kecamatan</option>';
            if (result.status === 'ok' && result.data) result.data.forEach(item => kecamatanSelect.add(new Option(item.nama, item.id)));
        } catch (error) { alert('Error fetching kecamatan: ' + error.message); }
    }

    async function loadDesa(id_kecamatan) {
        try {
            const response = await fetch('get_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'desa', id_kecamatan }) });
            const result = await response.json();
            const desaSelect = document.getElementById('desaSelect');
            desaSelect.innerHTML = '<option value="">Pilih Desa</option>';
            if (result.status === 'ok' && result.data) result.data.forEach(item => desaSelect.add(new Option(item.nama, item.id)));
        } catch (error) { alert('Error fetching desa: ' + error.message); }
    }

    async function loadKelompok(id_desa) {
        try {
            const response = await fetch('get_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'kelompok', id_desa }) });
            const result = await response.json();
            const kelompokSelect = document.getElementById('kelompokSelect');
            kelompokSelect.innerHTML = '<option value="">Pilih Kelompok Tani</option>';
            if (result.status === 'ok' && result.data) result.data.forEach(item => kelompokSelect.add(new Option(item.nama, item.id)));
        } catch (error) { alert('Error fetching kelompok: ' + error.message); }
    }

    async function loadPemilik(id_kelompok) {
        try {
            const response = await fetch('get_data.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'pemilik', id_kelompok })
            });
            const result = await response.json();
            const pemilikSelect = document.getElementById('pemilikSelect');
            pemilikSelect.innerHTML = '<option value="">Semua Pemilik</option>';
            if (result.status === 'ok' && result.data) {
                result.data.forEach(item => {
                    pemilikSelect.add(new Option(item.nama_pemilik, item.nama_pemilik));
                });
                pemilikSelect.disabled = false;
            } else {
                pemilikSelect.disabled = true;
            }
        } catch (error) {
            alert('Error fetching pemilik: ' + error.message);
            document.getElementById('pemilikSelect').disabled = true;
        }
    }

    async function loadLahanFromServer() {
        try {
            const response = await fetch('get_lahan.php');
            const result = await response.json();
            if (result.status === 'ok' && result.data) {
                featureLayers.clearLayers();
                drawnItems.clearLayers();
                geojsonData.features = [];
                result.data.forEach(feature => {
                    const layer = L.geoJSON(feature).getLayers()[0];
                    if (layer) {
                        drawnItems.addLayer(layer);
                        addFeatureLayer(feature, layer);
                        geojsonData.features.push(feature);
                    }
                });
                updateSummaryTable();
                if (Object.keys(drawnItems._layers).length > 0) map.fitBounds(drawnItems.getBounds());
                else map.setView([-8.5, 119.9], 10);
            }
        } catch (error) { alert('Error fetching lahan: ' + error.message); }
    }

    // ================= UPLOAD GEOJSON =================
    function processUploadedGeoJSON(geojson) {
        let newLayers = [];
        geojson.features.forEach(feature => {
            if (feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
                const areaHa = turf.area(feature) / 10000;
                if (!feature.properties) feature.properties = {};
                feature.properties.luas_ha = Number(areaHa.toFixed(2));
                feature.properties.id = genId();
                feature.properties.kecamatan = feature.properties.kecamatan || "Data Unggah";
                feature.properties.desa = feature.properties.desa || "Data Unggah";
                feature.properties.kelompok = feature.properties.kelompok || "Data Unggah";
                let layer = L.geoJSON(feature).getLayers()[0];
                if (layer) { layer.feature = feature; drawnItems.addLayer(layer); addFeatureLayer(feature, layer); geojsonData.features.push(feature); newLayers.push(layer); }
            }
        });
        updateSummaryTable();
        if (newLayers.length > 0) map.fitBounds(new L.FeatureGroup(newLayers).getBounds());
    }

    // ===== Ringkasan Modal ===
    const showSummaryBtn = document.getElementById('showSummaryBtn');
    const showSummaryContainer = document.getElementById('showSummaryContainer');
    const summaryModal = document.getElementById('summaryModal');
    const toggleSummaryBtn = document.getElementById('toggleSummaryBtn');

    showSummaryBtn?.addEventListener('click', () => {
        summaryModal.classList.add('show');
        summaryModal.classList.remove('hide');
        showSummaryContainer.classList.add('hide');
        updateSummaryTable?.();
    });

    function closeModalWithAnimation() {
        summaryModal.classList.add('hide');
        summaryModal.classList.remove('show');
        setTimeout(() => {
            summaryModal.classList.remove('hide');
            showSummaryContainer.classList.remove('hide');
        }, 400); // waktu sesuai transition CSS
    }

    toggleSummaryBtn?.addEventListener('click', closeModalWithAnimation);
    summaryModal?.addEventListener('click', (e) => {
        if (e.target === summaryModal) closeModalWithAnimation();
    });

    // ===== Event listener dropdown =====
    kecamatanSelect?.addEventListener('change', function () {
        const id_kecamatan = this.value;
        desaSelect.innerHTML = '<option value="">Pilih Desa</option>';
        kelompokSelect.innerHTML = '<option value="">Pilih Kelompok Tani</option>';
        desaSelect.disabled = !id_kecamatan;
        kelompokSelect.disabled = true;
        if (id_kecamatan) loadDesa(id_kecamatan);
    });

    desaSelect?.addEventListener('change', function () {
        const id_desa = this.value;
        kelompokSelect.innerHTML = '<option value="">Pilih Kelompok Tani</option>';
        kelompokSelect.disabled = !id_desa;
        if (id_desa) loadKelompok(id_desa);
    });

    kelompokSelect?.addEventListener('change', function () {
        const id_kelompok = this.value;
        if (id_kelompok) {
            loadPemilik(id_kelompok);
        } else {
            const pemilikSelect = document.getElementById('pemilikSelect');
            pemilikSelect.innerHTML = '<option value="">Semua Pemilik</option>';
            pemilikSelect.disabled = true;
        }
    });

    window.addEventListener('resize', () => {
        map.invalidateSize();
    });

    // ===== Tambah Hierarki =====
    addHierarchyBtn?.addEventListener('click', () => {
        const kec = newKecamatanName.value.trim();
        const desa = newDesaName.value.trim();
        const kel = newKelompokName.value.trim();
        if (!kec || !desa || !kel) { alert("Mohon isi semua nama."); return; }
        saveNewHierarchy({ kecamatan: kec, desa: desa, kelompok: kel });
    });

    // ===== Simpan Lahan =====
    saveDBBtn?.addEventListener('click', async () => {
        const selectedKecamatanId = kecamatanSelect.value;
        const selectedDesaId = desaSelect.value;
        const selectedKelompokId = kelompokSelect.value;
        const drawnFeatures = drawnItems.toGeoJSON();
        if (drawnFeatures.features.length === 0) { alert("Pilih satu atau lebih fitur lahan pada peta untuk disimpan."); return; }
        if (!selectedKecamatanId || !selectedDesaId || !selectedKelompokId) { alert("Mohon pilih semua data hierarki sebelum menyimpan."); return; }

        const lahanArray = drawnFeatures.features.map(feature => ({
            luas_ha: feature.properties.luas_ha,
            geometry: feature.geometry,
            id_kecamatan: selectedKecamatanId,
            id_desa: selectedDesaId,
            id_kelompok: selectedKelompokId,
            nama_pemilik: feature.properties.nama_pemilik || ""
        }));

        try {
            const response = await fetch('add_data.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'lahan_batch', data: lahanArray }) });
            const result = await response.json();
            if (result.status === 'ok') { alert(result.message); loadLahanFromServer(); }
            else throw new Error(result.message);
        } catch (error) { alert('Gagal menyimpan lahan: ' + error.message); }
    });

    // === Upload File GeoJSON / KML / KMZ ===
    fileInput?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            uploadBtn.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Tidak ada file terpilih.';
            uploadBtn.disabled = true;
        }
    });

    uploadBtn?.addEventListener('click', function () {
        const file = fileInput.files[0];
        if (!file) {
            alert("Pilih file GeoJSON atau KML/KMZ untuk diunggah.");
            return;
        }

        // --- GeoJSON
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    const geojson = JSON.parse(ev.target.result);
                    if (geojson && geojson.features) {
                        processUploadedGeoJSON(geojson);
                        alert('File GeoJSON berhasil dimuat!');
                    } else {
                        throw new Error('File GeoJSON tidak valid.');
                    }
                } catch (err) {
                    alert('Gagal membaca file GeoJSON: ' + err.message);
                }
            };
            reader.readAsText(file);
        }

        // --- KML
        else if (file.name.endsWith('.kml')) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    const kmlText = ev.target.result;
                    const geojsonLayer = omnivore.kml.parse(kmlText);
                    geojsonLayer.addTo(map);
                    map.fitBounds(geojsonLayer.getBounds());
                    alert('File KML berhasil dimuat!');
                } catch (err) {
                    alert('Gagal membaca file KML: ' + err.message);
                }
            };
            reader.readAsText(file);
        }

        // --- KMZ (pakai JSZip)
        else if (file.name.endsWith('.kmz')) {
            const reader = new FileReader();
            reader.onload = async function (ev) {
                try {
                    const zip = await JSZip.loadAsync(ev.target.result);
                    const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
                    if (!kmlFile) throw new Error("KMZ tidak mengandung file KML.");

                    const kmlText = await zip.files[kmlFile].async("string");
                    const geojsonLayer = omnivore.kml.parse(kmlText);
                    geojsonLayer.addTo(map);
                    map.fitBounds(geojsonLayer.getBounds());
                    alert('File KMZ berhasil dimuat!');
                } catch (err) {
                    alert('Gagal membaca file KMZ: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        }

        else {
            alert("Format file tidak didukung. Gunakan GeoJSON, KML, atau KMZ.");
        }
    });

    // ===== Load Awal =====
    loadKecamatan();
    loadLahanFromServer();

    // ================= FIX LAYER CHECKBOX =================
    function fixLeafletCheckboxIds() {
        document.querySelectorAll('.leaflet-control-layers-selector').forEach((el, idx) => {
            if (!el.id) el.id = "layerCheckbox_" + idx;
            if (!el.name) el.name = "layerSelector";
        });
    }

    // === Sidebar Toggle untuk HP/Tablet ===
    const sidebar = document.getElementById('sidebar');
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    menuToggleBtn?.addEventListener('click', function () {
        sidebar.classList.toggle('active');
        setTimeout(() => map.invalidateSize(), 350);
    });

    // Tutup sidebar jika klik di luar sidebar pada layar kecil
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 900) {
            if (
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                !menuToggleBtn.contains(e.target)
            ) {
                sidebar.classList.remove('active');
            }
        }
    });

    const downloadExcelBtn = document.getElementById('downloadExcelBtn');
    downloadExcelBtn?.addEventListener('click', function () {
        const table = document.getElementById('summaryTable');
        if (!table) return;
        // Convert table to worksheet
        const wb = XLSX.utils.table_to_book(table, { sheet: "Ringkasan Lahan" });
        // Download as Excel file
        XLSX.writeFile(wb, "Ringkasan_Lahan.xlsx");
    });
});
map.on('overlayadd', fixLeafletCheckboxIds);
map.zoomControl.setPosition('topright');
document.querySelectorAll('.leaflet-control').forEach(ctrl => {
    ctrl.style.right = '20px';
    ctrl.style.left = 'auto';
});