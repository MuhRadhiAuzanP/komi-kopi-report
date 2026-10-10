(function () {
  'use strict';
  const P = { paper: '#f4f0e9', card: '#fcfaf5', ink: '#171914', olive: '#656a4d', line: '#c9bc98', red: '#d32116', coral: '#fa807c' };
  function render(canvas, s, data) {
    const ctx = canvas.getContext('2d');
    const W = 1132, margin = 60, gap = 34, cw = 489, lx = margin, rx = margin + cw + gap, top = 352;
    const font = (size, weight = 'normal', family = 'Arial') => { ctx.font = `${weight} ${size}px ${family}`; };
    const wrapped = (value, width, size = 24, weight = 'normal') => {
      font(size, weight);
      const output = [];
      for (const paragraph of String(value || '—').split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
          if (ctx.measureText((line ? line + ' ' : '') + word).width <= width) { line += (line ? ' ' : '') + word; continue; }
          if (line) { output.push(line); line = ''; }
          for (const letter of word) { if (ctx.measureText(line + letter).width > width && line) { output.push(line); line = ''; } line += letter; }
        }
        output.push(line);
      }
      return output;
    };
    const cNotes = wrapped('Catatan cup: ' + (s.cupNote.trim() || '—'), cw - 64, 23);
    const expenseLines = s.expenseNote.trim() ? wrapped(s.expenseNote, cw - 64, 21) : [];
    const actualLines = data.cups.filter(c => c.actual !== null).flatMap(c => wrapped(`Fisik ${c.label}: ${c.actual} · selisih ${c.diff > 0 ? '+' : ''}${c.diff}`, cw - 64, 21));
    const consumptionLines = s.consumption.flatMap(v => wrapped(`•  ${v.name || 'Nama'} (${v.drink || 'minuman'}) × ${Komi.number(v.qty) || 0}`, cw - 72, 24));
    if (!consumptionLines.length) consumptionLines.push('Belum ada konsumsi.');
    const pendingLines = wrapped('Pending: ' + (s.pending.trim() || '—'), cw - 64, 23);
    const noteLines = wrapped(s.note.trim() || '—', cw - 64, 23);
    const warningLines = data.warnings.flatMap(v => wrapped(v, cw - 64, 20));
    const financeH = 480 + expenseLines.length * 27;
    const inventoryH = 665 + cNotes.length * 31 + actualLines.length * 28;
    const consumptionH = Math.max(440, 206 + consumptionLines.length * 35);
    const notesH = Math.max(246, 139 + pendingLines.length * 31 + noteLines.length * 31 + (warningLines.length ? 40 + warningLines.length * 27 : 0));
    const bottom = Math.max(top + financeH + 35 + consumptionH, top + inventoryH + 35 + notesH);
    canvas.width = W; canvas.height = Math.max(1600, bottom + 110);
    ctx.textBaseline = 'top';
    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const text = (value, x, y, size = 24, weight = 'normal', color = P.ink, family = 'Arial') => { font(size, weight, family); ctx.fillStyle = color; ctx.fillText(String(value), x, y); };
    const right = (value, x, y, size = 24, weight = 'normal', color = P.ink) => { font(size, weight); ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(String(value), x, y); ctx.textAlign = 'left'; };
    const line = (x1, y, x2, color = P.line) => { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const lines = (items, x, y, size = 24, height = 32, color = P.ink, weight = 'normal') => { items.forEach((v, i) => text(v, x, y + i * height, size, weight, color)); return y + items.length * height; };
    const fitted = (value, x, y, maxWidth, size, weight = 'normal', family = 'Arial', color = P.ink) => { font(size, weight, family); const scale = Math.min(1, maxWidth / Math.max(1, ctx.measureText(value).width)); ctx.save(); ctx.translate(x, y); ctx.scale(scale, 1); text(value, 0, 0, size, weight, color, family); ctx.restore(); };
    const title = (value, x, y) => { fitted(value, x + 30, y + 31, cw - 103, 42, 'bold'); ctx.fillStyle = P.olive; ctx.beginPath(); ctx.arc(x + cw - 42, y + 46, 15, 0, Math.PI * 2); ctx.fill(); text('↓', x + cw - 52, y + 28, 31, 'bold', P.card); };
    const pair = (label, value, x, y, color = P.ink) => { text(label, x, y, 24); right(value, x + cw - 64, y, 25, 'normal', color); line(x, y + 35, x + cw - 64); };
    rect(0, 0, W, canvas.height, P.paper);
    fitted('Report', 56, 52, 355, 125, 'normal', 'Georgia', P.red);
    fitted('KOMI KOPI', 61, 184, 547, 104, 'normal', 'Georgia', P.red);
    ctx.save(); ctx.translate(455, 88); ctx.fillStyle = P.olive;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.ellipse(0, -23, 4.5, 20, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
    line(499, 88, 1072, P.olive);
    text('HARI, TANGGAL', 701, 106, 17, 'normal', P.olive);
    fitted(Komi.dateLabel(s.date), 701, 139, 369, 25);
    line(696, 188, 1072, P.olive);
    fitted(`Open:  ${s.open.trim() || '—'}`, 701, 209, 368, 25);
    fitted(`Close:  ${s.close.trim() || '—'}`, 701, 252, 368, 25);
    line(696, 295, 1072, P.olive);
    text(`SHIFT ${s.shift.toUpperCase()}`, 64, 311, 17, 'bold', P.olive);
    rect(lx, top, cw, financeH, P.card); title('KEUANGAN', lx, top);
    let fy = top + 120;
    pair('Cash', Komi.format(data.money.cash), lx + 32, fy); fy += 56;
    pair('QRIS', Komi.format(data.money.qris), lx + 32, fy); fy += 56;
    pair('GoFood', Komi.format(data.money.gofood), lx + 32, fy); fy += 56;
    pair('Pengeluaran', Komi.format(data.money.expense), lx + 32, fy); fy += 52;
    if (expenseLines.length) lines(expenseLines, lx + 32, fy, 21, 27, P.olive);
    rect(lx, top + financeH - 107, cw, 107, P.coral);
    text('TOTAL REVENUE', lx + 31, top + financeH - 84, 22, 'bold');
    right(Komi.format(data.revenue), lx + cw - 31, top + financeH - 86, 29, 'bold');
    text('Setelah pengeluaran', lx + 31, top + financeH - 43, 19);
    right(Komi.format(data.net), lx + cw - 31, top + financeH - 45, 23, 'bold');
    const cy = top + financeH + 35;
    rect(lx, cy, cw, consumptionH, P.card); title('KONSUMSI', lx, cy);
    lines(consumptionLines, lx + 33, cy + 117, 24, 35);
    rect(lx, cy + consumptionH - 94, cw, 94, P.coral);
    text(`UHT TERPAKAI: ${Komi.format(data.uhtUsed)} ML`, lx + 31, cy + consumptionH - 71, 24, 'bold');
    text(`UHT TERSISA: ${Komi.format(data.uhtLeft)} ML`, lx + 31, cy + consumptionH - 38, 24, 'bold');
    rect(rx, top, cw, inventoryH, P.card); title('CATATAN CUP', rx, top);
    const tx = rx + 30, col1 = rx + 275, col2 = rx + 356, col3 = rx + 453;
    text('CUP', tx, top + 105, 18, 'normal', P.olive);
    right('AWAL', col1, top + 105, 18, 'normal', P.olive); right('JUAL', col2, top + 105, 18, 'normal', P.olive); right('SISA', col3, top + 105, 18, 'normal', P.olive);
    data.cups.forEach((v, i) => { const y = top + 145 + i * 60; text(v.label, tx, y, 25); right(Komi.format(v.start), col1, y, 25); right(Komi.format(v.sold), col2, y, 25); right(Komi.format(v.left), col3, y, 25, 'bold', v.left < 0 ? P.red : P.ink); line(tx, y + 37, rx + cw - 30); });
    let iy = top + 343;
    pair('Total stok awal', Komi.format(data.totals.start), rx + 32, iy); iy += 51;
    pair('Tambahan cup', Komi.format(data.totals.added), rx + 32, iy); iy += 51;
    fitted(`Konsumsi: ${data.totals.used}    Pecah: ${data.totals.broken}    Lain: ${data.totals.other}`, rx + 32, iy, cw - 64, 22, 'normal', 'Arial', P.olive); iy += 47;
    pair('Stok akhir (hitung)', Komi.format(data.totals.left), rx + 32, iy); iy += 53;
    if (actualLines.length) { iy = lines(actualLines, rx + 32, iy, 21, 28, P.olive); iy += 8; }
    lines(cNotes, rx + 32, iy, 23, 31);
    rect(rx, top + inventoryH - 93, cw, 93, P.coral);
    text(`TOTAL PENJUALAN CUP: ${data.totals.sold}`, rx + 31, top + inventoryH - 70, 24, 'bold');
    fitted(`TUMBLER: ${data.tumbler}  ·  BOTOL 1 L: ${data.bottle}`, rx + 31, top + inventoryH - 37, cw - 62, 22, 'bold');
    const ny = top + inventoryH + 35;
    rect(rx, ny, cw, notesH, P.card); rect(rx, ny, cw, 73, P.coral);
    text('CATATAN TAMBAHAN', rx + 31, ny + 24, 25, 'bold');
    let py = lines(pendingLines, rx + 32, ny + 98, 23, 31); line(rx + 32, py + 6, rx + cw - 32); py += 26;
    py = lines(noteLines, rx + 32, py, 23, 31);
    if (warningLines.length) { text('PERLU DIPERIKSA', rx + 32, py + 14, 17, 'bold', P.red); lines(warningLines, rx + 32, py + 42, 20, 27, P.red); }
    fitted(`REPORT: ${(s.reporter.trim() || '—').toUpperCase()}`, rx, canvas.height - 66, cw, 24, 'bold');
    text('KOMI KOPI  /  CATATAN HARIAN', lx, canvas.height - 57, 14, 'normal', P.olive);
    if (data.errors.length) { rect(0, canvas.height - 27, W, 27, '#b64330'); text('DRAF · PERIKSA INPUT SEBELUM DIUNDUH', 60, canvas.height - 23, 16, 'bold', '#fff'); }
    canvas.setAttribute('aria-label', `Laporan ${Komi.dateLabel(s.date)}, shift ${s.shift}. Total revenue Rp${Komi.format(data.revenue)}, cup terjual ${data.totals.sold}, sisa stok ${data.totals.left}.`);
    return canvas;
  }
  window.Komi.render = render;
})();
