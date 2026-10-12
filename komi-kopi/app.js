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
    $('.privacy-note').textContent = storageAvailable ? 'Draf hanya tersimpan di perangkat ini. Unduh laporan untuk menyimpan atau membagikannya.' : 'Browser tidak dapat menyimpan draf.';
  }

  function cupFields() {
    $('#cup-fields').innerHTML = Komi.types.map(t => `<div class="cup-card"><div class="cup-heading"><h3>${t.label}</h3><span class="remaining-badge" id="left-${t.key}">Sisa 0 cup</span></div><div class="cup-inputs">${[['start', 'Stok awal'], ['added', 'Tambahan'], ['sold', 'Terjual']].map(([k, label]) => `<label>${label}<input inputmode="numeric" data-cup="${t.key}" data-cup-field="${k}" placeholder="0"></label>`).join('')}</div><p class="cup-consumption" id="consumed-${t.key}">Konsumsi: 0 cup</p><details><summary>Cup pecah, pemakaian lain & cek stok fisik</summary><div class="cup-inputs">${[['broken', 'Cup pecah'], ['other', 'Pakai lain'], ['actual', 'Stok fisik']].map(([k, label]) => `<label>${label}<input inputmode="numeric" data-cup="${t.key}" data-cup-field="${k}" placeholder="${k === 'actual' ? 'Opsional' : '0'}"></label>`).join('')}</div></details></div>`).join('');
  }

  function consumptionFields() {
    $('#consumption-list').innerHTML = state.consumption.length ? state.consumption.map((v, i) => `<div class="consumption-row"><button type="button" class="remove-consumption" data-remove="${i}">×</button><div class="field-grid"><label>Nama<input data-person="${i}" data-person-field="name" value="${escape(v.name)}" maxlength="45" placeholder="Nama"></label><label>Minuman<input data-person="${i}" data-person-field="drink" value="${escape(v.drink)}" maxlength="60" placeholder="Minuman"></label></div><div class="field-grid"><label>Jumlah<input data-person="${i}" data-person-field="qty" value="${escape(v.qty)}" inputmode="numeric" placeholder="1"></label><label>Cup<select data-person="${i}" data-person-field="cup">${[['', 'Pilih jenis cup'], ['coffee', 'Coffee'], ['non', 'Non-coffee'], ['hot', 'Hot'], ['none', 'Tanpa cup']].map(([k, label]) => `<option value="${k}"${v.cup === k ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div></div>`).join('') : '<div class="empty-consumption">Belum ada konsumsi. Tambahkan jika ada.</div>';
  }

  function fill() {
    all('[data-field]').forEach(el => { el.value = state[el.dataset.field]; });
    all('[data-cup]').forEach(el => { el.value = state.cups[el.dataset.cup][el.dataset.cupField]; });
    consumptionFields(); update();
  }

  function update() {
    const isSore = state.shift.toLowerCase() === 'sore';
    const soreContainer = document.getElementById('shift-sore-container');
    const biasaContainer = document.getElementById('shift-biasa-container');
    
    if (soreContainer) soreContainer.style.display = isSore ? 'block' : 'none';
    if (biasaContainer) biasaContainer.style.display = isSore ? 'none' : 'grid';
    
    calculation = Komi.calculate(state);

    if (isSore) {
      document.getElementById('val-cash-sore').textContent = `Rp${Komi.format(calculation.money.cash)}`;
      document.getElementById('val-qris-sore').textContent = `Rp${Komi.format(calculation.money.qris)}`;
    }

    $('#date-stamp').textContent = Komi.dateLabel(state.date);
    $('#shift-stamp').textContent = `SHIFT ${state.shift.toUpperCase()}`;
    $('#summary-revenue').textContent = `Rp${Komi.format(calculation.revenue)}`;
    $('#revenue-form').textContent = `Rp${Komi.format(calculation.revenue)}`;
    $('#net-form').textContent = `Rp${Komi.format(calculation.net)}`;
    $('#summary-sold').innerHTML = `${Komi.format(calculation.totals.sold)} <small>cup</small>`;
    $('#summary-left').innerHTML = `${Komi.format(calculation.totals.left)} <small>cup</small>`;
    
    for (const c of calculation.cups) { 
      $(`#left-${c.key}`).textContent = `Sisa ${c.left} cup`; 
      $(`#consumed-${c.key}`).textContent = `Konsumsi: ${c.used} cup · otomatis dari langkah 04`; 
    }
    
    all('input[inputmode="numeric"]').forEach(el => el.setAttribute('aria-invalid', String(!Number.isFinite(Komi.number(el.value)))));
    
    const messages = [...calculation.errors, ...calculation.warnings];
    $('#validation').hidden = !messages.length;
    $('#validation').classList.toggle('warning', !calculation.errors.length);
    $('#validation').replaceChildren();
    
    if (messages.length) { 
      const b = document.createElement('strong'); 
      b.textContent = calculation.errors.length ? 'Periksa dulu sebelum mengunduh' : 'Ada selisih yang perlu dicek'; 
      const ul = document.createElement('ul'); 
      messages.forEach(m => { const li = document.createElement('li'); li.textContent = m; ul.append(li); }); 
      $('#validation').append(b, ul); 
    } 
    
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
    if (calculation.errors.length) { $('#validation').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Masih ada input yang perlu diperbaiki.'); return false; }
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
    } catch { toast('Unduhan belum berhasil. Coba lagi.'); }
    finally { button.disabled = false; }
  }

  async function copy() {
    if (!valid()) return;
    const output = Komi.reportText(state, calculation);
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(output); toast('Teks tersalin ke clipboard.'); }
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
  
  $('#report-form').addEventListener('focusout', e => { 
    const el = e.target; 
    const targetFields = ['cash', 'qris', 'gofood', 'expense', 'cashPagi', 'qrisPagi', 'cashTotal', 'qrisTotal'];
    if (el.dataset.field && targetFields.includes(el.dataset.field) && el.value.trim() && Number.isFinite(Komi.number(el.value))) { 
      el.value = Komi.format(Komi.number(el.value)); 
      state[el.dataset.field] = el.value; 
      save(); 
    } 
  });

  // --- LOGIKA KALKULATOR UHT SESUAI 5 RUMUS LAPANGAN ---
  const chkNoPrevSisa = document.getElementById('calc-no-prev-sisa');
  const inputSisaPagi = document.getElementById('calc-sisa-pagi');
  const lblSisaPagi = document.getElementById('lbl-sisa-pagi');
  const uhtHelpText = document.getElementById('uht-calc-help');
  const btnHitungUht = document.getElementById('btn-hitung-uht');

  if (chkNoPrevSisa && inputSisaPagi) {
    chkNoPrevSisa.addEventListener('change', () => {
      const noSisa = chkNoPrevSisa.checked;
      inputSisaPagi.disabled = noSisa;
      if (noSisa) inputSisaPagi.value = '0';
      if (lblSisaPagi) lblSisaPagi.style.opacity = noSisa ? '0.5' : '1';
      if (uhtHelpText) {
        uhtHelpText.textContent = noSisa 
          ? 'Mode tanpa sisa sebelumnya: Box di tempat sampah TIDAK dikurangi 1.' 
          : 'Menghitung box utuh di sampah (−1), sisa berat timbangan (−30 ml), lalu ditotal dengan sisa shift sebelumnya.';
      }
    });
  }

  if (btnHitungUht) {
    btnHitungUht.addEventListener('click', () => {
      const noPrevSisa = chkNoPrevSisa ? chkNoPrevSisa.checked : false;
      const boxSampah = Number(document.getElementById('calc-box-sampah').value) || 0;
      const beratSisaTimbangan = Number(document.getElementById('calc-berat-sisa').value) || 0;
      const sisaShiftSebelumnya = noPrevSisa ? 0 : (Number(inputSisaPagi.value) || 0);

      // RUMUS 1: Jika tidak ada sisa sebelumnya, box TIDAK dikurangi 1.
      const rumus1_boxUtuh = noPrevSisa ? boxSampah : Math.max(0, boxSampah - 1);
      
      // RUMUS 2: Rumus 1 x 1000
      const rumus2_mlUtuhTerpakai = rumus1_boxUtuh * 1000;
      
      // RUMUS 3: Total berat UHT - 30
      const rumus3_sisaUhtRiil = Math.max(0, beratSisaTimbangan - 30);
      
      // RUMUS 4: 1000 - Rumus 3
      const rumus4_terpakaiKotakSisa = beratSisaTimbangan > 0 ? Math.max(0, 1000 - rumus3_sisaUhtRiil) : 0;
      
      // RUMUS 5: Rumus 2 + Rumus 4 + Sisa UHT shift sebelumnya
      const rumus5_totalPenggunaan = rumus2_mlUtuhTerpakai + rumus4_terpakaiKotakSisa + sisaShiftSebelumnya;

      state.uhtUsed = String(rumus5_totalPenggunaan);
      state.uhtLeft = String(rumus3_sisaUhtRiil);

      const inputUsed = document.querySelector('[data-field="uhtUsed"]');
      const inputLeft = document.querySelector('[data-field="uhtLeft"]');
      if (inputUsed) inputUsed.value = Komi.format(rumus5_totalPenggunaan);
      if (inputLeft) inputLeft.value = Komi.format(rumus3_sisaUhtRiil);

      update();
      toast(`Kalkulasi UHT Selesai: Terpakai ${Komi.format(rumus5_totalPenggunaan)} ml, Sisa ${Komi.format(rumus3_sisaUhtRiil)} ml.`);
    });
  }

  all('.step').forEach(button => { button.addEventListener('click', () => showStep(Number(button.dataset.step))); });
  $('#previous').addEventListener('click', () => showStep(step - 1));
  $('#next').addEventListener('click', () => { if (step === 3) download(); else showStep(step + 1); });
  $('#download').addEventListener('click', download); 
  $('#copy').addEventListener('click', copy);
  
  $('#add-consumption').addEventListener('click', () => { 
    if (state.consumption.length >= 30) return toast('Maksimal 30 baris konsumsi.'); 
    state.consumption.push({ name: '', drink: '', qty: '1', cup: '' }); 
    consumptionFields(); update(); 
  });
  
  $('#consumption-list').addEventListener('click', e => { 
    const button = e.target.closest('[data-remove]'); 
    if (!button) return; 
    state.consumption.splice(Number(button.dataset.remove), 1); 
    consumptionFields(); update(); 
  });

  $('#sample').addEventListener('click', () => { 
    const apply = () => { state = Komi.sample(); fill(); showStep(0); toast('Contoh berhasil diisi.'); }; 
    if (hasData()) confirmReplace('Isi data contoh?', 'Draf saat ini akan diganti.', apply); else apply(); 
  });

  $('#reset').addEventListener('click', () => confirmReplace('Mulai laporan baru?', 'Draf akan dikosongkan.', () => { state = Komi.blank(); fill(); showStep(0); toast('Laporan baru siap.'); }));
  $('#help').addEventListener('click', () => $('#help-dialog').showModal());
  all('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).close()));
  $('#select-text').addEventListener('click', () => { $('#report-text').focus(); $('#report-text').select(); });
  window.addEventListener('pagehide', save);
})();
