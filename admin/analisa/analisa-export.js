// admin/analisa/analisa-export.js
// Tombol "Ekstrak" di admin/analisa/analisa-token-detail.js — mengubah data
// analisa 1 grup token (window._analisaTokenDetailAgg, hasil GET
// /api/analisa/grup/:grubKey) jadi 1 file .xlsx yang bisa diunduh admin.
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
//   Sheet 2, 3, dst "Soal N" = 1 sheet PER SOAL/KOLOM (urut: semua soal
//                         Benar/Salah dulu, lalu Nilai/Skor, lalu tiap kolom
//                         Sikap Kerja) — isinya pertanyaan lengkap, opsi/kunci/
//                         nilai, jumlah & nama peserta per opsi, + grafik
//                         distribusi jawaban soal itu.

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

    // ── OOXML CHART BUILDER (native <c:barChart>, data literal) ───────────
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
            <c:spPr><a:solidFill><a:srgbClr val="${ser.color}"/></a:solidFill></c:spPr>
            <c:cat>${_strLit(categories)}</c:cat>
            <c:val>${_numLit(ser.values)}</c:val>
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
<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${seriesAll}<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>
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
            rows.push(['GRAFIK SIKAP KERJA — MEDIAN PER KOLOM']);
            rows.push(['KOLOM', 'MEDIAN BENAR', 'MEDIAN SALAH', 'MEDIAN DIJAWAB']);
            const median = arr => {
                if (!arr.length) return 0;
                const s = arr.slice().sort((a, b) => a - b);
                const n = s.length;
                return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
            };
            const medBenar = [], medSalah = [], medDijawab = [], catKolom = [];
            charts.sikap.forEach((kolom, ki) => {
                catKolom.push('K' + (ki + 1));
                medBenar.push(median(kolom.map(p => p.benar)));
                medSalah.push(median(kolom.map(p => p.salah)));
                medDijawab.push(median(kolom.map(p => p.benar + p.salah)));
            });
            catKolom.forEach((k, i) => rows.push([k, medBenar[i], medSalah[i], medDijawab[i]]));
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

        return { rows, chartSpecs };
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

    // ── SUSUN ISI SHEET "Soal N" (1 kolom Sikap Kerja) ─────────────────────
    function _buildSheetSikapKolom(globalIdx, kolomIdx, peserta) {
        const rows = [];
        rows.push(['SOAL', globalIdx]);
        rows.push(['TIPE', `Sikap Kerja — Kolom K${kolomIdx + 1}`]);
        rows.push([]);
        rows.push(['NAMA PESERTA', 'BENAR', 'SALAH', 'JUMLAH DIJAWAB']);
        (peserta || []).forEach(p => rows.push([p.nama, p.benar, p.salah, p.benar + p.salah]));
        rows.push([]);

        // Grafik dibatasi 30 peserta pertama biar tetap terbaca (tabel di atas tetap lengkap semua peserta)
        const capped = (peserta || []).slice(0, 30);
        const chart = {
            title: `Sebaran Benar/Salah — Kolom K${kolomIdx + 1}`,
            categories: capped.map(p => p.nama),
            series: [
                { name: 'Benar', color: '16A34A', values: capped.map(p => p.benar) },
                { name: 'Salah', color: 'DC2626', values: capped.map(p => p.salah) }
            ],
            fromCol: 0, fromRow: rows.length + 1, toCol: 8, toRow: rows.length + 1 + 16
        };
        return { rows, chart };
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
        wsAnalisa['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsAnalisa, 'ANALISA');
        if (chartsAnalisa.length) sheetChartsMap['ANALISA'] = chartsAnalisa;

        let globalIdx = 0;
        const charts = agg.charts || { binary: [], skor: [], sikap: [] };

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

        (charts.sikap || []).forEach((peserta, ki) => {
            globalIdx++;
            const sheetName = `Soal ${globalIdx}`;
            const { rows, chart } = _buildSheetSikapKolom(globalIdx, ki, peserta);
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            sheetChartsMap[sheetName] = [chart];
        });

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

    return { build, downloadBlob, sanitizeFilename: _sanitizeFilename };
})();
