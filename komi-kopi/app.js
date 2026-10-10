(function () {
  'use strict';
  const key = 'komi-kopi-report-v1';
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const escape = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let state = Komi.blank(), step = 0, toastTimer, saveTimer, storageAvailable = true, calculation;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.version === 1 && saved.state && Array.isArray(saved.state.consumption)) {
      const raw = saved.state, base = Komi.blank();
      for (const name of Object.keys(base)) if (typeof base[name] === 'string' && typeof raw[name] === 'string') base[name] = raw[name];
      for (const type of Komi.types) for (const name of Object.keys(base.cups[type.key])) if (typeof raw.cups?.[type.key]?.[name] === 'string') base.cups[type.key][name] = raw.cups[type.key][name];
      base.consumption = raw.consumption.filter(v => v && ['name', 'drink', 'qty', 'cup'].every(k => typeof v[k] === 'string')).slice(0, 30);
      state = base;
    }
  } catch { storageAvailable = false; }
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ version: 1, state })); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('#save-status').innerHTML = storageAvailable ? '<i></i> Tersimpan di perangkat ini' : 'Draf belum tersimpan — unduh laporan';
    $('.privacy-note').textContent = storageAvailable ? 'Draf hanya tersimpan di perangkat ini. Unduh laporan untuk menyimpan atau membagikannya.' : 'Browser tidak dapat menyimpan draf. Unduh laporan sebelum menutup halaman.';
  }
  function cupFields() {
    $('#cup-fields').innerHTML = Komi.types.map(t => `<div class="cup-card"><div class="cup-heading"><h3>${t.label}</h3><span class="remaining-badge" id="left-${t.key}">Sisa 0 cup</span></div><div class="cup-inputs">${[['start', 'Stok awal'], ['added', 'Tambahan'], ['sold', 'Terjual']].map(([k, label]) => `<label>${label}<input inputmode="numeric" data-cup="${t.key}" data-cup-field="${k}" placeholder="0" aria-label="${t.label} ${label}"></label>`).join('')}</div><p class="cup-consumption" id="consumed-${t.key}">Konsumsi: 0 cup</p><details><summary>Cup pecah, pemakaian lain & cek stok fisik</summary><div class="cup-inputs">${[['broken', 'Cup pecah'], ['other', 'Pakai lain'], ['actual', 'Stok fisik']].map(([k, label]) => `<label>${label}<input inputmode="numeric" data-cup="${t.key}" data-cup-field="${k}" placeholder="${k === 'actual' ? 'Opsional' : '0'}" aria-label="${t.label} ${label}"></label>`).join('')}</div><p class="helper">Pakai lain di luar konsumsi. Stok fisik hanya untuk mengecek selisih, tidak mengubah sisa hitung.</p></details></div>`).join('');
  }
  function consumptionFields() {
    $('#consumption-list').innerHTML = state.consumption.length ? state.consumption.map((v, i) => `<div class="consumption-row"><button type="button" class="remove-consumption" data-remove="${i}" aria-label="Hapus konsumsi ${i + 1}">×</button><div class="field-grid"><label>Nama<input data-person="${i}" data-person-field="name" value="${escape(v.name)}" maxlength="45" placeholder="Nama" aria-label="Nama konsumsi ${i + 1}"></label><label>Minuman<input data-person="${i}" data-person-field="drink" value="${escape(v.drink)}" maxlength="60" placeholder="Nama minuman" aria-label="Minuman konsumsi ${i + 1}"></label></div><div class="field-grid"><label>Jumlah<input data-person="${i}" data-person-field="qty" value="${escape(v.qty)}" inputmode="numeric" placeholder="1" aria-label="Jumlah konsumsi ${i + 1}"></label><label>Cup yang digunakan<select data-person="${i}" data-person-field="cup" aria-label="Cup konsumsi ${i + 1}">${[['', 'Pilih jenis cup'], ['coffee', 'Coffee'], ['non', 'Non-coffee'], ['hot', 'Hot'], ['none', 'Tanpa cup']].map(([k, label]) => `<option value="${k}"${v.cup === k ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div></div>`).join('') : '<div class="empty-consumption">Belum ada konsumsi. Tambahkan jika ada.</div>';
  }
  function fill() {
    all('[data-field]').forEach(el => { el.value = state[el.dataset.field]; });
    all('[data-cup]').forEach(el => { el.value = state.cups[el.dataset.cup][el.dataset.cupField]; });
    consumptionFields(); update();
  }
  function update() {
    calculation = Komi.calculate(state);
    $('#date-stamp').textContent = Komi.dateLabel(state.date);
    $('#shift-stamp').textContent = `SHIFT ${state.shift.toUpperCase()}`;
    $('#summary-revenue').textContent = `Rp${Komi.format(calculation.revenue)}`;
    $('#revenue-form').textContent = `Rp${Komi.format(calculation.revenue)}`;
    $('#net-form').textContent = `Rp${Komi.format(calculation.net)}`;
    $('#summary-sold').innerHTML = `${Komi.format(calculation.totals.sold)} <small>cup</small>`;
    $('#summary-left').innerHTML = `${Komi.format(calculation.totals.left)} <small>cup</small>`;
    for (const c of calculation.cups) { $(`#left-${c.key}`).textContent = `Sisa ${c.left} cup`; $(`#consumed-${c.key}`).textContent = `Konsumsi: ${c.used} cup · otomatis dari langkah 04`; }
    all('input[inputmode="numeric"]').forEach(el => el.setAttribute('aria-invalid', String(!Number.isFinite(Komi.number(el.value)))));
    const messages = [...calculation.errors, ...calculation.warnings];
    $('#validation').hidden = !messages.length;
    $('#validation').classList.toggle('warning', !calculation.errors.length);
    $('#validation').replaceChildren();
    if (messages.length) { const b = document.createElement('strong'); b.textContent = calculation.errors.length ? 'Periksa dulu sebelum mengunduh' : 'Ada selisih yang perlu dicek'; const ul = document.createElement('ul'); messages.forEach(m => { const li = document.createElement('li'); li.textContent = m; ul.append(li); }); $('#validation').append(b, ul); }
    Komi.render($('#report-canvas'), state, calculation);
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 200);
  }
  function showStep(n) {
    step = Math.max(0, Math.min(3, n));
    all('.step').forEach((button, i) => { button.classList.toggle('active', i === step); button.setAttribute('aria-selected', String(i === step)); button.tabIndex = i === step ? 0 : -1; });
    all('.form-panel').forEach((panel, i) => { panel.hidden = i !== step; });
    $('#previous').style.visibility = step === 0 ? 'hidden' : 'visible';
    $('#step-count').textContent = `Langkah ${step + 1} dari 4`;
    $('#next').innerHTML = step === 3 ? 'Unduh PNG <span>↓</span>' : 'Lanjut <span>→</span>';
  }
  function change(event) {
    const el = event.target;
    if (el.dataset.field) state[el.dataset.field] = el.value;
    else if (el.dataset.cup) state.cups[el.dataset.cup][el.dataset.cupField] = el.value;
    else if (el.dataset.person !== undefined) state.consumption[Number(el.dataset.person)][el.dataset.personField] = el.value;
    else return;
    update();
  }
  function valid() {
    update();
    for (const k of ['date', 'open', 'close', 'reporter']) {
      const el = $(`[data-field="${k}"]`);
      if (!state[k].trim() || !el.checkValidity()) { showStep(0); el.focus(); toast('Lengkapi tanggal, petugas open/close, dan pembuat laporan terlebih dahulu.'); return false; }
    }
    if (calculation.errors.length) { $('#validation').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Masih ada input yang perlu diperbaiki. Lihat rincian di bawah formulir.'); return false; }
    return true;
  }
  async function download() {
    if (!valid()) return;
    const button = $('#download'); button.disabled = true;
    try {
      const url = $('#report-canvas').toDataURL('image/png');
      $('#export-image').src = url;
      $('#save-image').href = url;
      $('#save-image').download = `Komi-Kopi-${state.date}-${state.shift.replace(/\s/g, '-')}.png`;
      $('#image-dialog').showModal();
      if (calculation.warnings.length) toast('Selisih stok ikut tercantum pada gambar laporan.');
    } catch { toast('Unduhan belum berhasil. Coba lagi dari browser perangkat ini.'); }
    finally { button.disabled = false; }
  }
  async function copy() {
    if (!valid()) return;
    const output = Komi.reportText(state, calculation);
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard tidak tersedia'); await navigator.clipboard.writeText(output); toast('Teks tersalin. Tempel ke WhatsApp untuk dibagikan.'); }
    catch { $('#report-text').value = output; $('#text-dialog').showModal(); $('#report-text').select(); }
  }
  function confirmReplace(title, description, action) {
    $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
    $('#confirm-action').onclick = () => { $('#confirm-dialog').close(); action(); };
    $('#confirm-dialog').showModal();
  }
  function hasData() { const b = Komi.blank(); return Object.keys(b).some(k => !['date', 'shift'].includes(k) && JSON.stringify(state[k]) !== JSON.stringify(b[k])); }
  cupFields(); fill(); showStep(0);
  $('#report-form').addEventListener('input', change);
  $('#report-form').addEventListener('change', change);
  $('#report-form').addEventListener('submit', e => e.preventDefault());
  $('#report-form').addEventListener('focusout', e => { const el = e.target; if (el.dataset.field && ['cash', 'qris', 'gofood', 'expense'].includes(el.dataset.field) && el.value.trim() && Number.isFinite(Komi.number(el.value))) { el.value = Komi.format(Komi.number(el.value)); state[el.dataset.field] = el.value; save(); } });
  all('.step').forEach(button => { button.addEventListener('click', () => showStep(Number(button.dataset.step))); button.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showStep((step + (e.key === 'ArrowRight' ? 1 : 3)) % 4); $(`#tab-${step}`).focus(); } }); });
  $('#previous').addEventListener('click', () => showStep(step - 1));
  $('#next').addEventListener('click', () => { if (step === 3) download(); else showStep(step + 1); });
  $('#download').addEventListener('click', download); $('#copy').addEventListener('click', copy);
  $('#add-consumption').addEventListener('click', () => { if (state.consumption.length >= 30) return toast('Maksimal 30 baris konsumsi per laporan.'); state.consumption.push({ name: '', drink: '', qty: '1', cup: '' }); consumptionFields(); update(); $(`[data-person="${state.consumption.length - 1}"]`).focus(); });
  $('#consumption-list').addEventListener('click', e => { const button = e.target.closest('[data-remove]'); if (!button) return; state.consumption.splice(Number(button.dataset.remove), 1); consumptionFields(); update(); });
  $('#sample').addEventListener('click', () => { const apply = () => { state = Komi.sample(); fill(); showStep(0); toast('Contoh terisi: QRIS Rp128.000. Lima konsumsi diasumsikan masing-masing memakai 1 cup; jenis cup bisa diubah di langkah 04.'); }; if (hasData()) confirmReplace('Isi data contoh?', 'Draf saat ini akan diganti contoh 8 Oktober. Unduh laporan sebelumnya jika ingin menyimpannya.', apply); else apply(); });
  $('#reset').addEventListener('click', () => confirmReplace('Mulai laporan baru?', 'Draf saat ini akan dikosongkan. Pastikan laporan sebelumnya sudah diunduh.', () => { state = Komi.blank(); fill(); showStep(0); toast('Laporan baru siap diisi.'); }));
  $('#help').addEventListener('click', () => $('#help-dialog').showModal());
  all('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).close()));
  $('#select-text').addEventListener('click', () => { $('#report-text').focus(); $('#report-text').select(); });
  window.addEventListener('pagehide', save);
})();
