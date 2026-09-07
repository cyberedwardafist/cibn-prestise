// admin/analisa/analisa-export.js
// Dipakai oleh 2 tombol "Ekstrak":
//   1) admin/analisa/analisa-token-detail.js (AnalisaExport.build) — data
//      analisa 1 GRUP TOKEN (window._analisaTokenDetailAgg, hasil GET
//      /api/analisa/grup/:grubKey).
//   2) admin/analisa/analisa-soal-detail.js (AnalisaExport.buildSoal) — data
//      analisa 1 SOAL TUNGGAL lewat Sampel manual (window.
//      _analisaSoalDetailHasil, hasil POST /api/analisa/soal/:kode/hitung).
// Keduanya jadi 1 file .xlsx yang bisa diunduh admin, strukturnya sama
// persis (lihat _appendChartSummaryBlocks/_appendSoalSheets) — cuma beda
// header ringkasan di sheet "ANALISA" (_buildSheetAnalisa vs
// _buildSheetAnalisaSoal), karena versi soal tunggal tidak punya info
// token/modul grup.
//
// SEMUA proses jalan di BROWSER (tidak ada endpoint server baru) — pakai 2
// library yang SUDAH dimuat eager di shell admin (lihat admin/index_admin.html):
//   - XLSX (SheetJS, cdnjs) — sudah dipakai admin/cat/shared-export.js juga,
//     untuk bangun sheet/tabel datanya.
//   - JSZip (cdnjs) — dipakai KHUSUS di sini untuk menyisipkan GRAFIK NATIF
//     Excel (bar chart asli, bisa diklik/diedit di Excel — bukan gambar/PNG),
//     karena SheetJS versi gratis tidak bisa menulis grafik. Caranya: re-buka
//     file .xlsx hasil SheetJS.write() sebagai file ZIP (format asli .xlsx
//     memang ZIP+XML), lalu tambahkan bagian XML grafik (xl/charts/chartN.xml
//     + xl/drawings/drawingN.xml) sesuai standar OOXML, baru di-zip ulang.
//     Data grafik ditulis sbg nilai LITERAL (c:numLit/c:strLit, bukan rujukan
//     sel) — sengaja, supaya tidak perlu hitung koordinat sel yang gampang
//     meleset; grafiknya tetap grafik asli Excel, cuma datanya "terpatri"
//     sesuai kondisi saat diekspor (wajar utk file hasil export/snapshot).
//
// STRUKTUR FILE:
//   Sheet 1 "ANALISA"   = ringkasan grup (token, modul, daftar soal) + grafik
//                         ringkasan per tipe (Benar/Salah, Nilai/Skor, Sikap Kerja).
//   Sheet 2, 3, dst "Soal N" = 1 sheet PER SOAL (urut: semua soal
//                         Benar/Salah dulu, lalu Nilai/Skor) — isinya
//                         pertanyaan lengkap, opsi/kunci/nilai, jumlah & nama
//                         peserta per opsi, + grafik distribusi jawaban soal
//                         itu. Kalau modul ada soal Sikap Kerja, SEMUA
//                         kolomnya (K1, K2, dst) digabung jadi 1 sheet
//                         terakhir, isinya per PENGERJAAN (bukan per akun) —
//                         1 blok grafik per pengerjaan ditumpuk ke bawah;
//                         pengerjaan berulang dgn nama sama TETAP jadi blok
//                         terpisah (dibedakan via id laporan, bukan nama).

const AnalisaExport = (() => {

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    // Buang tag HTML dari teks pertanyaan/opsi (bisa berisi <img>/format lain
    // dari rich-text editor soal) — Excel sel cuma butuh teks polos.
    function _stripHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function _sanitizeFilename(s) {
        return String(s || 'Grup').replace(/[\\/:*?"<>|]+/g, '_').trim().substring(0, 60) || 'Grup';
    }

    // ── OOXML CHART BUILDER (native <c:lineChart>, data literal) ───────────
    function _numLit(values) {
        const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${Number(v) || 0}</c:v></c:pt>`).join('');
        return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numLit>`;
    }
    function _strLit(values) {
        const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${_esc(v)}</c:v></c:pt>`).join('');
        return `<c:strLit><c:ptCount val="${values.length}"/>${pts}</c:strLit>`;
    }
    function _seriesXml(idx, ser, categories) {
        return `<c:ser>
            <c:idx val="${idx}"/><c:order val="${idx}"/>
            <c:tx><c:v>${_esc(ser.name)}</c:v></c:tx>
            <c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${ser.color}"/></a:solidFill></a:ln></c:spPr>
            <c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${ser.color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${ser.color}"/></a:solidFill></a:ln></c:spPr></c:marker>
            <c:cat>${_strLit(categories)}</c:cat>
            <c:val>${_numLit(ser.values)}</c:val>
            <c:smooth val="0"/>
        </c:ser>`;
    }
    function _buildChartXml({ title, categories, series }) {
        const seriesAll = series.map((s, i) => _seriesXml(i, s, categories)).join('');
        const titleXml = title
            ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${_esc(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
            : '<c:autoTitleDeleted val="1"/>';
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:chart>
${titleXml}
<c:plotArea><c:layout/>
<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${seriesAll}<c:marker val="1"/><c:axId val="111111111"/><c:axId val="222222222"/></c:lineChart>
<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:txPr><a:bodyPr rot="-2700000" vert="horz"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:crossAx val="222222222"/></c:catAx>
<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:crossAx val="111111111"/></c:valAx>
</c:plotArea>
<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
<c:plotVisOnly val="1"/>
</c:chart>
</c:chartSpace>`;
    }

    function _buildDrawingXml(anchors) {
        let id = 2;
        const xml = anchors.map(a => {
            const thisId = id++;
            return `<xdr:twoCellAnchor>
<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${a.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="${thisId}" name="Chart ${thisId}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${a.rId}"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
        }).join('');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${xml}</xdr:wsDr>`;
    }
    function _addOverride(ctXml, partName, contentType) {
        if (ctXml.includes(`PartName="${partName}"`)) return ctXml;
        return ctXml.replace('</Types>', `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
    }

    // Suntik grafik ke file .xlsx (ArrayBuffer/Uint8Array hasil XLSX.write)
    // — lihat komentar besar di atas file ini untuk alasan pendekatannya.
    async function _injectCharts(xlsxBytes, sheetChartsMap) {
        const zip = await JSZip.loadAsync(xlsxBytes);
        const workbookXml = await zip.file('xl/workbook.xml').async('string');
        const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');

        const sheetNameToRid = {};
        let m;
        const sheetRe = /<sheet\b[^>]*\/>/g;
        while ((m = sheetRe.exec(workbookXml))) {
            const tag = m[0];
            const nameM = /name="([^"]*)"/.exec(tag);
            const ridM = /r:id="(rId\d+)"/.exec(tag);
            if (nameM && ridM) {
                const nm = nameM[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                sheetNameToRid[nm] = ridM[1];
            }
        }
        const ridToTarget = {};
        const relRe = /<Relationship\b[^>]*\/>/g;
        while ((m = relRe.exec(relsXml))) {
            const tag = m[0];
            const idM = /Id="(rId\d+)"/.exec(tag);
            const tgtM = /Target="([^"]*)"/.exec(tag);
            if (idM && tgtM) ridToTarget[idM[1]] = tgtM[1];
        }

        let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
        let chartCounter = 1, drawingCounter = 1;

        for (const sheetName of Object.keys(sheetChartsMap)) {
            const specs = sheetChartsMap[sheetName];
            if (!specs || !specs.length) continue;
            const rid = sheetNameToRid[sheetName];
            if (!rid) continue;
            const target = ridToTarget[rid];
            if (!target) continue;
            const sheetPath = 'xl/' + target;
            const sheetFile = target.split('/').pop();
            const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;

            const chartRelEntries = [];
            const anchorSpecs = [];
            specs.forEach((spec, i) => {
                const cNum = chartCounter++;
                zip.file(`xl/charts/chart${cNum}.xml`, _buildChartXml(spec));
                const rIdLocal = `rId${i + 1}`;
                chartRelEntries.push(`<Relationship Id="${rIdLocal}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${cNum}.xml"/>`);
                anchorSpecs.push({ rId: rIdLocal, fromCol: spec.fromCol, fromRow: spec.fromRow, toCol: spec.toCol, toRow: spec.toRow });
                contentTypesXml = _addOverride(contentTypesXml, `/xl/charts/chart${cNum}.xml`, 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml');
            });

            const dNum = drawingCounter++;
            zip.file(`xl/drawings/drawing${dNum}.xml`, _buildDrawingXml(anchorSpecs));
            zip.file(`xl/drawings/_rels/drawing${dNum}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${chartRelEntries.join('')}</Relationships>`);
            contentTypesXml = _addOverride(contentTypesXml, `/xl/drawings/drawing${dNum}.xml`, 'application/vnd.openxmlformats-officedocument.drawing+xml');

            let sheetRelsXml;
            const existing = zip.file(sheetRelsPath);
            let nextRid = 1;
            if (existing) {
                sheetRelsXml = await existing.async('string');
                const idRe = /Id="rId(\d+)"/g; let mm, max = 0;
                while ((mm = idRe.exec(sheetRelsXml))) max = Math.max(max, parseInt(mm[1], 10));
                nextRid = max + 1;
                sheetRelsXml = sheetRelsXml.replace('</Relationships>', `<Relationship Id="rId${nextRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${dNum}.xml"/></Relationships>`);
            } else {
                sheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId${nextRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${dNum}.xml"/></Relationships>`;
            }
            zip.file(sheetRelsPath, sheetRelsXml);

            let sheetXml = await zip.file(sheetPath).async('string');
            const drawingTag = `<drawing r:id="rId${nextRid}"/>`;
            sheetXml = sheetXml.includes('<extLst>')
                ? sheetXml.replace('<extLst>', drawingTag + '<extLst>')
                : sheetXml.replace('</worksheet>', drawingTag + '</worksheet>');
            zip.file(sheetPath, sheetXml);
        }

        zip.file('[Content_Types].xml', contentTypesXml);
        return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // ── BLOK GRAFIK RINGKASAN (Benar/Salah, Nilai/Skor, Sikap Kerja) ──────
    // Dipakai bareng oleh sheet "ANALISA" versi grup TOKEN (_buildSheetAnalisa)
    // MAUPUN versi 1 SOAL tunggal (_buildSheetAnalisaSoal, dipakai tombol
    // Ekstrak di admin/analisa/analisa-soal-detail.js) — isinya sama sekali
    // tidak bergantung pada info grup/token/modul, murni dari `tipeSoal` +
    // `charts` (bentuknya identik persis di kedua konteks, lihat
    // computeAnalisaGrupAggregate() vs computeAnalisaSoalAggregate() di
    // server.js), jadi aman dipakai ulang tanpa modifikasi. `rows` di-MUTASI
    // langsung (push) supaya posisi baris grafik (fromRow) tetap akurat
    // relatif terhadap baris header yang sudah ditaruh pemanggil sebelumnya.
    function _appendChartSummaryBlocks(rows, tipeSoal, charts) {
        const chartSpecs = [];
        const PAD_ROWS = 18; // baris kosong pencadang ruang visual grafik (drawing melayang, tidak mendorong sel)

        if (tipeSoal.binary && charts.binary.length) {
            rows.push(['GRAFIK BENAR/SALAH PER SOAL']);
            rows.push(['NO SOAL', 'BENAR', 'SALAH']);
            charts.binary.forEach(b => rows.push([b.nomor, b.benar, b.salah]));
            chartSpecs.push({
                title: 'Grafik Benar/Salah per Soal',
                categories: charts.binary.map(b => String(b.nomor)),
                series: [
                    { name: 'Benar', color: '16A34A', values: charts.binary.map(b => b.benar) },
                    { name: 'Salah', color: 'DC2626', values: charts.binary.map(b => b.salah) }
                ],
                fromCol: 0, fromRow: rows.length + 1, toCol: 8, toRow: rows.length + 1 + 16
            });
            for (let i = 0; i < PAD_ROWS; i++) rows.push([]);
        }

        if (tipeSoal.skor && charts.skor.length) {
            rows.push(['GRAFIK NILAI/SKOR PER SOAL (RATA-RATA NILAI DIPILIH)']);
            rows.push(['NO SOAL', 'RATA-RATA NILAI']);
            const rataRata = charts.skor.map(s => {
                const totalJumlah = s.opsi.reduce((a, o) => a + (o.jumlah || 0), 0);
                const totalNilai = s.opsi.reduce((a, o) => a + (o.jumlah || 0) * (o.nilai || 0), 0);
                return totalJumlah > 0 ? Math.round((totalNilai / totalJumlah) * 100) / 100 : 0;
            });
            charts.skor.forEach((s, i) => rows.push([s.nomor, rataRata[i]]));
            chartSpecs.push({
                title: 'Grafik Rata-rata Nilai per Soal',
                categories: charts.skor.map(s => String(s.nomor)),
                series: [{ name: 'Rata-rata Nilai', color: '2666B8', values: rataRata }],
                fromCol: 0, fromRow: rows.length + 1, toCol: 8, toRow: rows.length + 1 + 16
            });
            for (let i = 0; i < PAD_ROWS; i++) rows.push([]);
        }

        if (tipeSoal.sikap && charts.sikap.length) {
            rows.push(['GRAFIK SIKAP KERJA — MEDIAN & SD PER KOLOM']);
            rows.push(['KOLOM', 'MEDIAN BENAR', 'SD BENAR', 'MEDIAN SALAH', 'SD SALAH', 'MEDIAN DIJAWAB', 'SD DIJAWAB']);
            const median = arr => {
                if (!arr.length) return 0;
                const s = arr.slice().sort((a, b) => a - b);
                const n = s.length;
                return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
            };
            // Standar deviasi POPULASI (bagi n) — sama persis rumusnya dgn
            // _atdWeightedStdDev di analisa-token-detail.js (popup "Kolom K1"
            // di halaman on-screen), cuma di sini inputnya array nilai
            // mentah per peserta, bukan peta distribusi tertimbang.
            const stdDev = arr => {
                if (!arr.length) return 0;
                const mean = arr.reduce((a, v) => a + v, 0) / arr.length;
                const variance = arr.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / arr.length;
                return Math.round(Math.sqrt(variance) * 100) / 100;
            };
            const medBenar = [], sdBenar = [], medSalah = [], sdSalah = [], medDijawab = [], sdDijawab = [], catKolom = [];
            charts.sikap.forEach((kolom, ki) => {
                catKolom.push('K' + (ki + 1));
                const arrBenar = kolom.map(p => p.benar);
                const arrSalah = kolom.map(p => p.salah);
                const arrDijawab = kolom.map(p => p.benar + p.salah);
                medBenar.push(median(arrBenar)); sdBenar.push(stdDev(arrBenar));
                medSalah.push(median(arrSalah)); sdSalah.push(stdDev(arrSalah));
                medDijawab.push(median(arrDijawab)); sdDijawab.push(stdDev(arrDijawab));
            });
            catKolom.forEach((k, i) => rows.push([k, medBenar[i], sdBenar[i], medSalah[i], sdSalah[i], medDijawab[i], sdDijawab[i]]));
            chartSpecs.push({
                title: 'Grafik Median Sikap Kerja per Kolom',
                categories: catKolom,
                series: [
                    { name: 'Median Benar', color: '16A34A', values: medBenar },
                    { name: 'Median Salah', color: 'DC2626', values: medSalah },
                    { name: 'Median Dijawab', color: '2666B8', values: medDijawab }
                ],
                fromCol: 0, fromRow: rows.length + 1, toCol: 8, toRow: rows.length + 1 + 16
            });
        }

        return chartSpecs;
    }

    // ── SUSUN ISI SHEET "ANALISA" (ringkasan grup + grafik ringkasan) ─────
    function _buildSheetAnalisa(grupNama, agg) {
        const { ringkasan, tipe_soal: tipeSoal, charts } = agg;
        const modul = ringkasan.modul;
        const rows = [];
        rows.push(['NAMA GRUP', grupNama]);
        rows.push(['TOKEN DIBUAT', ringkasan.total]);
        rows.push(['TOKEN TERPAKAI', ringkasan.used]);
        rows.push(['TOKEN HANGUS', ringkasan.hangus]);
        rows.push(['NAMA MODUL', modul ? modul.nama : '-']);
        rows.push([]);
        rows.push(['DAFTAR SOAL / KOLOM']);
        (modul && modul.soal || []).forEach((s, i) => rows.push([`${i + 1}. ${s.nama}`, `${s.butir} pertanyaan`]));
        rows.push([]);

        const chartSpecs = _appendChartSummaryBlocks(rows, tipeSoal, charts);
        return { rows, chartSpecs };
    }

    // ── SUSUN ISI SHEET "ANALISA" versi 1 SOAL TUNGGAL — dipakai tombol
    // "Ekstrak" di admin/analisa/analisa-soal-detail.js (kartu "Grafik",
    // sumber datanya SAMPEL manual, bukan grup token). Header ringkasannya
    // sengaja beda dari versi grup (tidak ada token/modul, cuma soal + jumlah
    // peserta sampel) — blok grafik di bawahnya sama persis (_appendChartSummaryBlocks).
    function _buildSheetAnalisaSoal(soalNama, jumlahPeserta, tipeSoal, charts) {
        const rows = [];
        rows.push(['NAMA SOAL', soalNama]);
        rows.push(['JUMLAH PESERTA (SAMPEL)', jumlahPeserta]);
        rows.push([]);

        const chartSpecs = _appendChartSummaryBlocks(rows, tipeSoal, charts);
        return { rows, chartSpecs };
    }

    // ── SUSUN SEMUA SHEET "Soal N" (per butir) KE DALAM WORKBOOK ──────────
    // Dipakai bareng oleh build() (grup token) & buildSoal() (1 soal tunggal
    // lewat Sampel) — logikanya identik, `charts.binary`/`charts.skor`/
    // `charts.sikap` bentuknya sama persis di kedua konteks.
    function _appendSoalSheets(wb, sheetChartsMap, charts) {
        let globalIdx = 0;

        (charts.binary || []).forEach(item => {
            globalIdx++;
            const sheetName = `Soal ${globalIdx}`;
            const { rows, merges, chart } = _buildSheetSoalItem(globalIdx, item, 'binary');
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 55 }];
            ws['!merges'] = merges;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            sheetChartsMap[sheetName] = [chart];
        });

        (charts.skor || []).forEach(item => {
            globalIdx++;
            const sheetName = `Soal ${globalIdx}`;
            const { rows, merges, chart } = _buildSheetSoalItem(globalIdx, item, 'skor');
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 55 }];
            ws['!merges'] = merges;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            sheetChartsMap[sheetName] = [chart];
        });

        if (charts.sikap && charts.sikap.length) {
            globalIdx++;
            const sheetName = `Soal ${globalIdx}`;
            const { rows, chartSpecs: sikapCharts } = _buildSheetSikapKerja(globalIdx, charts.sikap);
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 24 }];
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            sheetChartsMap[sheetName] = sikapCharts;
        }
    }

    // ── SUSUN ISI SHEET "Soal N" (tipe Benar/Salah atau Nilai/Skor Sendiri) ─
    function _buildSheetSoalItem(globalIdx, item, kind) {
        const rows = [];
        rows.push(['SOAL', globalIdx]);
        rows.push(['TIPE', kind === 'binary' ? 'Benar / Salah' : 'Nilai / Skor Sendiri']);
        rows.push(['NO SOAL (ASLI, PER TIPE)', item.nomor]);
        rows.push([]);
        rows.push(['PERTANYAAN']);
        const pertanyaanRowIdx = rows.length;
        rows.push([_stripHtml(item.pertanyaan)]);
        rows.push([]);
        if (item.pembahasan) {
            rows.push(['PEMBAHASAN']);
            rows.push([_stripHtml(item.pembahasan)]);
            rows.push([]);
        }
        rows.push(kind === 'binary'
            ? ['OPSI', 'KUNCI', 'JUMLAH PESERTA', 'NAMA PESERTA']
            : ['OPSI', 'NILAI', 'JUMLAH PESERTA', 'NAMA PESERTA']);
        const options = item.options || [];
        options.forEach((o, oi) => {
            const label = `${String.fromCharCode(65 + oi)}. ${_stripHtml(o.teks)}`;
            rows.push(kind === 'binary'
                ? [label, o.isKunci ? 'KUNCI' : '', o.count, (o.names || []).join(', ')]
                : [label, o.nilai, o.count, (o.names || []).join(', ')]);
        });
        rows.push([]);

        const merges = [{ s: { r: pertanyaanRowIdx, c: 0 }, e: { r: pertanyaanRowIdx, c: 3 } }];
        const chart = {
            title: 'Distribusi Jawaban',
            categories: options.map((o, oi) => String.fromCharCode(65 + oi)),
            series: [{ name: 'Jumlah Peserta', color: '2666B8', values: options.map(o => o.count || 0) }],
            fromCol: 0, fromRow: rows.length + 1, toCol: 6, toRow: rows.length + 1 + 16
        };
        return { rows, merges, chart };
    }

    // ── SUSUN ISI SHEET "Soal N" (SEMUA kolom Sikap Kerja jadi 1 sheet) ────
    // Per PERMINTAAN: bukan 1 sheet per kolom (K1, K2, ...), tapi 1 sheet utk
    // seluruh soal tipe Sikap Kerja, isinya per PENGERJAAN (bukan per akun/
    // nama) — 1 blok grafik utk 1 pengerjaan, ditumpuk ke bawah utk
    // pengerjaan berikutnya. Kalau 1 nama/akun yg sama mengerjakan token
    // lain lagi, itu TETAP masuk sbg blok baru terpisah (dibedakan pakai
    // `id` = kode laporan per baris sikapRaw, bukan `nama` — lihat komentar
    // di server.js computeAnalisaGrupAggregate soal ini), tidak digabung
    // jadi satu walau namanya sama.
    function _buildSheetSikapKerja(globalIdx, sikapRaw) {
        const rows = [];
        rows.push(['SOAL', globalIdx]);
        rows.push(['TIPE', 'Sikap Kerja (semua kolom, per pengerjaan)']);
        rows.push([]);

        const chartSpecs = [];
        const nKolom = sikapRaw.length;
        const nPengerjaan = (sikapRaw[0] || []).length;
        const PAD_ROWS = 16;

        for (let pi = 0; pi < nPengerjaan; pi++) {
            const first = sikapRaw[0][pi] || {};
            rows.push(['PESERTA', first.nama || '-', 'ID PENGERJAAN', first.id || '-']);
            rows.push(['KOLOM', 'BENAR', 'SALAH', 'JUMLAH DIJAWAB']);
            const cats = [], benarArr = [], salahArr = [];
            for (let ki = 0; ki < nKolom; ki++) {
                const p = (sikapRaw[ki] && sikapRaw[ki][pi]) || { benar: 0, salah: 0 };
                rows.push([`K${ki + 1}`, p.benar, p.salah, p.benar + p.salah]);
                cats.push(`K${ki + 1}`);
                benarArr.push(p.benar);
                salahArr.push(p.salah);
            }
            chartSpecs.push({
                title: `Sikap Kerja — ${first.nama || '-'} (${first.id || '-'})`,
                categories: cats,
                series: [
                    { name: 'Benar', color: '16A34A', values: benarArr },
                    { name: 'Salah', color: 'DC2626', values: salahArr }
                ],
                fromCol: 0, fromRow: rows.length + 1, toCol: 7, toRow: rows.length + 1 + 14
            });
            for (let i = 0; i < PAD_ROWS; i++) rows.push([]);
        }

        return { rows, chartSpecs };
    }

    // ── ENTRY POINT ─────────────────────────────────────────────────────────
    async function build(agg, grupNama) {
        if (typeof XLSX === 'undefined' || typeof JSZip === 'undefined') {
            throw new Error('Library XLSX/JSZip tidak termuat');
        }
        const wb = XLSX.utils.book_new();
        const sheetChartsMap = {};

        const { rows: rowsAnalisa, chartSpecs: chartsAnalisa } = _buildSheetAnalisa(grupNama, agg);
        const wsAnalisa = XLSX.utils.aoa_to_sheet(rowsAnalisa);
        wsAnalisa['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, wsAnalisa, 'ANALISA');
        if (chartsAnalisa.length) sheetChartsMap['ANALISA'] = chartsAnalisa;

        const charts = agg.charts || { binary: [], skor: [], sikap: [] };
        _appendSoalSheets(wb, sheetChartsMap, charts);

        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        return _injectCharts(xlsxBytes, sheetChartsMap);
    }

    // ── ENTRY POINT — 1 SOAL TUNGGAL (tombol "Ekstrak" di admin/analisa/
    // analisa-soal-detail.js, kartu "Grafik") ──────────────────────────────
    // `hasil` = respons POST /api/analisa/soal/:kode/hitung apa adanya
    // ({ jumlah_peserta, charts:{binary,skor,sikap}, tipe_soal }) — TIDAK
    // perlu fetch API lagi di sini, dipakai ulang dari data yang sudah
    // dimuat _asdRenderChart() di halaman itu (sama pola dgn build()/agg
    // di atas). Struktur file .xlsx yang dihasilkan SAMA PERSIS dgn build()
    // (sheet "ANALISA" + 1 sheet "Soal N" per butir, grafik native Excel),
    // cuma sheet "ANALISA"-nya pakai header ringkas 1 soal (bukan ringkasan
    // grup/token) — lihat _buildSheetAnalisaSoal().
    async function buildSoal(soalNama, jumlahPeserta, hasil) {
        if (typeof XLSX === 'undefined' || typeof JSZip === 'undefined') {
            throw new Error('Library XLSX/JSZip tidak termuat');
        }
        const wb = XLSX.utils.book_new();
        const sheetChartsMap = {};

        const tipeSoal = hasil.tipe_soal || { binary: false, skor: false, sikap: false };
        const charts = hasil.charts || { binary: [], skor: [], sikap: [] };

        const { rows: rowsAnalisa, chartSpecs: chartsAnalisa } = _buildSheetAnalisaSoal(soalNama, jumlahPeserta, tipeSoal, charts);
        const wsAnalisa = XLSX.utils.aoa_to_sheet(rowsAnalisa);
        wsAnalisa['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, wsAnalisa, 'ANALISA');
        if (chartsAnalisa.length) sheetChartsMap['ANALISA'] = chartsAnalisa;

        _appendSoalSheets(wb, sheetChartsMap, charts);

        const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        return _injectCharts(xlsxBytes, sheetChartsMap);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    return { build, buildSoal, downloadBlob, sanitizeFilename: _sanitizeFilename };
})();
