(function (root) {
  'use strict';
  const types = [{ key: 'coffee', label: 'Coffee' }, { key: 'non', label: 'Non-coffee' }, { key: 'hot', label: 'Hot' }];
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  
  function blank() {
    return { 
      date: today(), shift: 'Sore', open: '', close: '', reporter: '', 
      cashPagi: '', qrisPagi: '', cashTotal: '', qrisTotal: '', 
      cash: '', qris: '', gofood: '', expense: '', expenseNote: '', 
      cups: Object.fromEntries(types.map(t => [t.key, { start: '', added: '', sold: '', broken: '', other: '', actual: '' }])), 
      tumbler: '', bottle: '', consumption: [], cupNote: '', pending: '', note: '', uhtUsed: '', uhtLeft: '' 
    };
  }

  function sample() {
    const s = blank();
    Object.assign(s, { 
      date: '2026-10-08', shift: 'Sore', open: 'Awan', close: 'Zia', reporter: 'Awan', 
      cashPagi: '300000', qrisPagi: '500000', cashTotal: '820000', qrisTotal: '628000', 
      gofood: '50000', pending: 'Thai tea 1 di sebelah', uhtUsed: '2000', uhtLeft: '0' 
    });
    for (const [key, start, sold] of [['coffee', 63, 13], ['non', 18, 0], ['hot', 11, 0]]) Object.assign(s.cups[key], { start: String(start), sold: String(sold) });
    s.consumption = [{ name: 'Pakde', drink: 'Thai tea', qty: '1', cup: 'non' }, { name: 'Awan', drink: 'Aren', qty: '1', cup: 'coffee' }, { name: 'Zia', drink: 'Caramel', qty: '1', cup: 'coffee' }, { name: 'Pak Iwan', drink: 'Aren', qty: '1', cup: 'coffee' }, { name: 'Papi', drink: 'Americano', qty: '1', cup: 'coffee' }];
    return s;
  }

  function number(value) {
    const s = String(value ?? '').trim();
    if (!s) return 0;
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(s)) return NaN;
    const n = Number(s.replaceAll('.', ''));
    return Number.isSafeInteger(n) && n <= 999999999 ? n : NaN;
  }

  function calculate(s) {
    const errors = [], warnings = [];
    const read = (v, label) => { const n = number(v); if (!Number.isFinite(n)) { errors.push(`${label}: isi bilangan bulat positif atau 0 (contoh: 128000 atau 128.000).`); return 0; } return n; };
    
    const isSore = s.shift.toLowerCase() === 'sore';
    
    const cashPagi = isSore ? read(s.cashPagi, 'Cash Shift Pagi') : 0;
    const qrisPagi = isSore ? read(s.qrisPagi, 'QRIS Shift Pagi') : 0;
    const cashTotal = isSore ? read(s.cashTotal, 'Total Cash Hari Ini') : read(s.cash, 'Cash');
    const qrisTotal = isSore ? read(s.qrisTotal, 'Total QRIS Hari Ini') : read(s.qris, 'QRIS');

    const cash = isSore ? Math.max(0, cashTotal - cashPagi) : cashTotal;
    const qris = isSore ? Math.max(0, qrisTotal - qrisPagi) : qrisTotal;
    const gofood = read(s.gofood, 'GoFood');
    const expense = read(s.expense, 'Pengeluaran');

    const money = { cashPagi, qrisPagi, cashTotal, qrisTotal, cash, qris, gofood, expense };

    if (isSore && cashTotal < cashPagi) warnings.push('Total Cash hari ini lebih kecil dari Cash Shift Pagi.');
    if (isSore && qrisTotal < qrisPagi) warnings.push('Total QRIS hari ini lebih kecil dari QRIS Shift Pagi.');

    const consumed = { coffee: 0, non: 0, hot: 0 };
    s.consumption.forEach((c, i) => { const qty = read(c.qty, `Jumlah konsumsi baris ${i + 1}`); if (c.cup in consumed) consumed[c.cup] += qty; if (!qty) errors.push(`Konsumsi baris ${i + 1}: jumlah minimal 1.`); if (!c.name.trim() || !c.drink.trim()) errors.push(`Lengkapi nama dan minuman konsumsi baris ${i + 1}.`); if (![...types.map(t => t.key), 'none'].includes(c.cup)) errors.push(`Pilih jenis cup konsumsi baris ${i + 1}.`); });
    
    const cups = types.map(t => {
      const entry = s.cups[t.key];
      const v = Object.fromEntries(['start', 'added', 'sold', 'broken', 'other'].map((k, i) => [k, read(entry[k], `${t.label} ${['stok awal', 'tambahan', 'terjual', 'pecah', 'pemakaian lain'][i]}`)]));
      const used = consumed[t.key], left = v.start + v.added - v.sold - v.broken - v.other - used;
      const actual = String(entry.actual).trim() === '' ? null : read(entry.actual, `Stok fisik ${t.label}`);
      if (left < 0) errors.push(`Stok ${t.label} kurang ${-left} cup. Periksa stok awal, tambahan, penjualan, dan pemakaian.`);
      const diff = actual === null ? null : actual - left;
      if (diff) warnings.push(`Stok fisik ${t.label} ${actual} cup, selisih ${diff > 0 ? '+' : ''}${diff} dari sisa hitung ${left} cup.`);
      return { ...t, ...v, used, left, actual, diff };
    });
    
    const totals = Object.fromEntries(['start', 'added', 'sold', 'broken', 'other', 'used', 'left'].map(k => [k, cups.reduce((sum, c) => sum + c[k], 0)]));
    const revenue = money.cash + money.qris + money.gofood;
    const tumbler = read(s.tumbler, 'Tumbler terjual'), bottle = read(s.bottle, 'Botol 1 L terjual');
    const uhtUsed = read(s.uhtUsed, 'UHT terpakai'), uhtLeft = read(s.uhtLeft, 'UHT tersisa');
    
    if (money.expense > revenue) warnings.push('Pengeluaran lebih besar dari penjualan. Saldo setelah pengeluaran bernilai negatif.');
    
    return { money, cups, totals, revenue, net: revenue - money.expense, tumbler, bottle, uhtUsed, uhtLeft, errors, warnings, isSore };
  }

  function format(n) { return new Intl.NumberFormat('id-ID').format(n); }
  function dateLabel(value) { const d = new Date(value + 'T12:00:00'); return Number.isNaN(d.getTime()) ? 'Tanggal belum diisi' : new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
  
  function reportText(s, c) {
    const dash = v => v.trim() || '-';
    return [
      `*Sales Report — KOMI KOPI*`, dateLabel(s.date), '', `Shift: *${s.shift}*`, `Open: ${dash(s.open)}`, `Close: ${dash(s.close)}`, '', 
      ...(c.isSore ? [
        `Cash Shift Pagi: Rp${format(c.money.cashPagi)}`,
        `QRIS Shift Pagi: Rp${format(c.money.qrisPagi)}`,
        `Total Cash Hari Ini: Rp${format(c.money.cashTotal)}`,
        `Total QRIS Hari Ini: Rp${format(c.money.qrisTotal)}`,
        `Cash Shift Sore: Rp${format(c.money.cash)}`,
        `QRIS Shift Sore: Rp${format(c.money.qris)}`,
        ''
      ] : []),
      ...(!c.isSore ? [`Cash: Rp${format(c.money.cash)}`, `QRIS: Rp${format(c.money.qris)}`] : []),
      `GoFood: Rp${format(c.money.gofood)}`, `Pengeluaran: Rp${format(c.money.expense)}`, 
      ...(s.expenseNote.trim() ? [`Rincian: ${s.expenseNote.trim()}`] : []), 
      `*Total revenue: Rp${format(c.revenue)}*`, `Saldo setelah pengeluaran: Rp${format(c.net)}`, '', '*Catatan cup*', ...c.cups.map(v => `${v.label}: awal ${v.start} + tambahan ${v.added} − jual ${v.sold} − konsumsi ${v.used} − pecah ${v.broken} − lain ${v.other} = *${v.left} cup*${v.actual === null ? '' : ` | fisik ${v.actual} (selisih ${v.diff > 0 ? '+' : ''}${v.diff})`}`), `Total stok awal: ${c.totals.start}`, `Total tambahan: ${c.totals.added}`, `Total penjualan cup: ${c.totals.sold}`, `*Sisa cup: ${c.totals.left}*`, `Cup pecah: ${c.totals.broken}`, `Catatan cup: ${dash(s.cupNote)}`, '', `Tumbler terjual: ${c.tumbler}`, `Botol 1 L terjual: ${c.bottle}`, '', '*Konsumsi*', ...(s.consumption.length ? s.consumption.map(v => `• ${v.name} (${v.drink}) × ${number(v.qty)} — ${v.cup === 'none' ? 'tanpa cup sekali pakai' : types.find(t => t.key === v.cup)?.label || '?'}`) : ['-']), '', `UHT terpakai: ${format(c.uhtUsed)} ml`, `UHT tersisa di kulkas: ${format(c.uhtLeft)} ml`, '', `Pending: ${dash(s.pending)}`, `Catatan: ${dash(s.note)}`, ...(c.warnings.length ? ['', '*Perlu diperiksa*', ...c.warnings] : []), '', `Report closing: *${dash(s.reporter)}*`
    ].join('\n');
  }

  root.Komi = { types, blank, sample, number, calculate, format, dateLabel, reportText };
})(typeof window !== 'undefined' ? window : globalThis);
