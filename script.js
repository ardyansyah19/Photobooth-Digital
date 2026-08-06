(function(){
  "use strict";

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- state ---------------- */
  const state = {
    template: 'maroon',
    name: '',
    photos: [null,null,null,null],
    filter: 'none',
    facingMode: 'user',
    stream: null,
    seat: '',
    gate: '',
    currentSlot: 0
  };

  /* ---------------- typewriter effect ---------------- */
  function typeText(el, text, speed){
    speed = speed || 45;
    el.textContent = '';
    if(reduceMotion){
      el.textContent = text;
      return;
    }
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.textContent = ' ';
    function tick(){
      if(i <= text.length){
        el.textContent = text.slice(0, i);
        el.appendChild(cursor);
        i++;
        setTimeout(tick, speed);
      } else {
        cursor.remove();
      }
    }
    tick();
  }

  typeText(document.getElementById('typeTitle'), 'PHOTO BOOTH', 60);

  /* ---------------- screen switching ---------------- */
  const screens = {
    setup: document.getElementById('screen-setup'),
    camera: document.getElementById('screen-camera'),
    result: document.getElementById('screen-result')
  };
  function showScreen(name){
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  /* ---------------- template picker ---------------- */
  const templatePicker = document.getElementById('templatePicker');
  templatePicker.addEventListener('click', (e) => {
    const card = e.target.closest('.stub');
    if(!card) return;
    state.template = card.dataset.template;
    [...templatePicker.children].forEach(c => c.classList.toggle('selected', c === card));
  });

  const nameInput = document.getElementById('nameInput');

  /* ---------------- camera setup ---------------- */
  const video = document.getElementById('video');
  const camHint = document.getElementById('camHint');
  const flashEl = document.getElementById('flash');
  const countdownEl = document.getElementById('countdownEl');
  const statusText = document.getElementById('statusText');
  const slotDots = document.getElementById('slotDots');
  const shutterBtn = document.getElementById('shutterBtn');
  const flipBtn = document.getElementById('flipBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const filterRow = document.getElementById('filterRow');
  const captureCanvas = document.getElementById('captureCanvas');
  const filmStrip = document.getElementById('filmStrip');

  async function startCamera(){
    stopCamera();
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: state.facingMode },
        audio: false
      });
      state.stream = stream;
      video.srcObject = stream;
      video.classList.toggle('env', state.facingMode === 'environment');
      camHint.textContent = 'Tekan tombol merah untuk hitung mundur 3 detik.';
    }catch(err){
      camHint.textContent = 'Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan lalu coba lagi.';
      statusText.textContent = 'KAMERA TIDAK TERDETEKSI';
    }
  }
  function stopCamera(){
    if(state.stream){
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
  }

  function renderSlotDots(){
    slotDots.innerHTML = '';
    for(let i=0;i<4;i++){
      const d = document.createElement('div');
      d.className = 'sprocket-dot' + (state.photos[i] ? ' filled' : '') + (i === state.currentSlot ? ' current' : '');
      slotDots.appendChild(d);
    }
  }

  filterRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if(!btn) return;
    state.filter = btn.dataset.filter;
    [...filterRow.children].forEach(c => c.classList.toggle('active', c === btn));
    video.style.filter = state.filter === 'none' ? '' : state.filter;
  });

  flipBtn.addEventListener('click', () => {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    startCamera();
  });

  cancelBtn.addEventListener('click', () => {
    stopCamera();
    showScreen('setup');
  });

  let capturing = false;
  shutterBtn.addEventListener('click', () => {
    if(capturing || state.currentSlot >= 4) return;
    if(!video.videoWidth || !video.videoHeight){
      camHint.textContent = 'Kamera belum siap, tunggu sebentar lalu coba lagi.';
      return;
    }
    capturing = true;
    runCountdown();
  });

  function runCountdown(){
    shutterBtn.disabled = true;
    statusText.textContent = 'SIAP-SIAP...';
    let n = 3;
    countdownEl.innerHTML = '';
    const tick = () => {
      if(n > 0){
        const span = document.createElement('span');
        span.textContent = n;
        countdownEl.innerHTML = '';
        countdownEl.appendChild(span);
        n--;
        setTimeout(tick, 700);
      } else {
        countdownEl.innerHTML = '';
        doCapture();
      }
    };
    tick();
  }

  function doCapture(){
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');

    const vw = video.videoWidth, vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size)/2, sy = (vh - size)/2;
    captureCanvas.width = 480;
    captureCanvas.height = 480;
    const ctx = captureCanvas.getContext('2d');
    ctx.save();
    ctx.filter = state.filter === 'none' ? 'none' : state.filter;
    if(state.facingMode === 'user'){
      ctx.translate(480,0);
      ctx.scale(-1,1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480);
    ctx.restore();

    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);
    state.photos[state.currentSlot] = dataUrl;
    state.currentSlot++;
    renderSlotDots();
    addPolaroidToStrip(dataUrl);

    setTimeout(() => {
      capturing = false;
      shutterBtn.disabled = false;
      if(state.currentSlot >= 4){
        statusText.textContent = 'SEMUA FOTO SELESAI';
        setTimeout(finishSession, 600);
      } else {
        statusText.textContent = 'FOTO ' + (state.currentSlot+1) + ' DARI 4';
      }
    }, 400);
  }

  function addPolaroidToStrip(dataUrl){
    const p = document.createElement('div');
    p.className = 'polaroid';
    const img = document.createElement('img');
    img.src = dataUrl;
    p.appendChild(img);
    filmStrip.appendChild(p);
  }

  function finishSession(){
    stopCamera();
    renderTicket();
    showScreen('result');
    typeText(document.getElementById('resultTitle'), 'BOARDING SELESAI', 45);
    if(!reduceMotion) launchConfetti();
  }

  /* ---------------- start check-in ---------------- */
  document.getElementById('startBtn').addEventListener('click', async () => {
    state.name = (nameInput.value || 'PASSENGER').toUpperCase().slice(0,18);
    state.photos = [null,null,null,null];
    state.currentSlot = 0;
    state.gate = String(Math.floor(Math.random()*28)+1);
    const seatLetters = 'ABCDEF';
    state.seat = String(Math.floor(Math.random()*30)+1) + seatLetters[Math.floor(Math.random()*6)];
    filmStrip.innerHTML = '';
    showScreen('camera');
    renderSlotDots();
    statusText.textContent = 'FOTO 1 DARI 4';
    await startCamera();
  });

  document.getElementById('retakeBtn').addEventListener('click', async () => {
    state.photos = [null,null,null,null];
    state.currentSlot = 0;
    filmStrip.innerHTML = '';
    showScreen('camera');
    renderSlotDots();
    statusText.textContent = 'FOTO 1 DARI 4';
    await startCamera();
  });

  document.getElementById('changeTemplateBtn').addEventListener('click', () => {
    showScreen('setup');
  });

  /* ---------------- ticket rendering (mengikuti desain asli persis) ---------------- */
  const PLANE_SVG = '<svg viewBox="0 0 100 60" fill="currentColor"><path d="M2 32 L96 6 L60 30 L96 54 L2 32 Z"/></svg>';
  const GLOBE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M4.5 7.5h15M4.5 16.5h15"/></svg>';
  const CAMERA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7l1.6-2.5h4.8L16 7"/><circle cx="12" cy="13.5" r="3.6"/></svg>';

  function barcodeBars(count, tall){
    let html = '';
    for(let i=0;i<count;i++){
      const h = tall ? (10 + Math.floor(Math.random()*6)) : (6 + Math.floor(Math.random()*9));
      const w = Math.random() > 0.7 ? 2.2 : 1.1;
      html += `<i style="height:${h}px;width:${w}px;"></i>`;
    }
    return html;
  }
  function fakeQR(){
    let html = '';
    for(let i=0;i<25;i++){
      html += `<i class="${Math.random() > 0.5 ? '' : 'off'}"></i>`;
    }
    return html;
  }

  function renderTicket(){
    const ticket = document.getElementById('ticket');
    const isNavy = state.template === 'navy';
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue(isNavy ? '--navy' : '--maroon');
    ticket.style.setProperty('--theme', themeColor);
    const routePlaneColor = isNavy ? themeColor : '#8a8a8a';

    ticket.innerHTML = `
      <div class="t-header">
        <div class="t-head-left">${GLOBE_SVG.replace('stroke="currentColor"','stroke="#fff"')} GARUDA INDONESIA</div>
        <div class="t-head-right">SUB ${PLANE_SVG.replace('fill="currentColor"','fill="#fff"')} JKT</div>
      </div>
      <div class="t-main">
        <div class="t-route">SUB <span style="color:${routePlaneColor}">${PLANE_SVG}</span> JKT</div>
        <div class="t-info">
          <div>
            <div class="lbl">Name</div>
            <div class="val name-val">${escapeHtml(state.name)}</div>
          </div>
          <div>
            <div class="lbl">Flight</div>
            <div class="val">GF 6815</div>
          </div>
          <div class="row2">
            <div class="col"><div class="lbl">Gate</div><div class="val">${state.gate}</div></div>
            <div class="col"><div class="lbl">Seat</div><div class="val">${state.seat}</div></div>
          </div>
          <div>
            <div class="lbl">Departure</div>
            <div class="val">10:15 AM</div>
          </div>
        </div>
      </div>
      <div class="t-subbar">
        <div class="bars-h">${barcodeBars(18,false)}</div>
        <div class="fields">
          <div class="field">Name<b>${escapeHtml(state.name)}</b></div>
          <div class="field">Flight<b>GF 6815</b></div>
          <div class="field">Gate<b>${state.gate}</b></div>
          <div class="field">Seat<b>${state.seat}</b></div>
        </div>
        <div class="qr-group">
          <div class="qr">${fakeQR()}</div>
          <div class="date-red">AUG 16<br>10:15 AM</div>
        </div>
      </div>
      <div class="t-body">
        <div class="t-airport-label">AIR PORT</div>
        <div class="t-photo-grid">
          ${state.photos.map(p => `<div class="t-photo-slot">${p ? `<img src="${p}" alt="Foto photobooth">` : ''}</div>`).join('')}
        </div>
      </div>
      <div class="t-footer">
        <div class="item">${GLOBE_SVG} <div class="txt"><span class="lbl">Destination</span><span class="val">JAKARTA</span></div></div>
        <div class="item">${PLANE_SVG.replace('viewBox="0 0 100 60"','viewBox="0 0 100 60" style="width:13px;height:8px;transform:rotate(-40deg)"')} <div class="txt"><span class="lbl">Date</span><span class="val">AUG 16, 2026</span></div></div>
        <div class="item">${CAMERA_SVG} <div class="txt"><span class="lbl">Photobooth</span><span class="val">AIR PORT</span></div></div>
      </div>
    `;
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  /* ---------------- download ---------------- */
  document.getElementById('downloadBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'MENYIAPKAN...';
    try{
      const ticketEl = document.getElementById('ticket');
      const canvas = await html2canvas(ticketEl, { scale: 3, backgroundColor: null, useCORS: true });
      const link = document.createElement('a');
      link.download = 'boarding-pass-photobooth-' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }catch(err){
      alert('Gagal membuat file gambar. Coba lagi ya.');
    }finally{
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  /* ---------------- confetti (paper snips) ---------------- */
  function launchConfetti(){
    const colors = ['#eccf6b','#e9a6a0','#a9c6a0','#b23a2e','#f4ead7'];
    for(let i=0;i<50;i++){
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random()*100 + 'vw';
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.animationDuration = (2.2 + Math.random()*1.8) + 's';
      p.style.animationDelay = (Math.random()*0.4) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4500);
    }
  }
})();
