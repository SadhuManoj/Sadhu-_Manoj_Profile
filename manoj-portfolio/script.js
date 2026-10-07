/* ============================================================
   Utility: device pixel ratio aware canvas sizing
   ============================================================ */
function fitCanvas(canvas){
  const parent = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = parent.clientWidth, h = parent.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   NAV: scroll shadow + mobile toggle
   ============================================================ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

const navToggle = document.getElementById('navToggle');
navToggle.addEventListener('click', () => {
  document.querySelector('.nav__links').classList.toggle('open');
});

/* ============================================================
   CURSOR GLOW (desktop only)
   ============================================================ */
const glow = document.getElementById('cursor-glow');
const isTouch = matchMedia('(pointer: coarse)').matches;
if (!isTouch && !reduceMotion) {
  window.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  }, { passive: true });
} else {
  glow.style.display = 'none';
}

/* ============================================================
   3D TILT — generic for [data-tilt] cards + hero card
   ============================================================ */
function attachTilt(el, maxTilt = 8, scale = 1.02){
  if (isTouch || reduceMotion) return;
  let raf = null;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * -2 * maxTilt;
    const ry = (px - 0.5) * 2 * maxTilt;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
    });
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)';
  });
}
document.querySelectorAll('[data-tilt]').forEach(el => attachTilt(el, 7, 1.015));

/* ============================================================
   HERO: animated perspective grid + drifting nodes
   ============================================================ */
(function heroGrid(){
  const canvas = document.getElementById('webGrid');
  if (!canvas) return;
  let ctx = fitCanvas(canvas);
  let w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;

  const nodeCount = Math.min(46, Math.floor((w*h)/26000));
  let nodes = Array.from({length: nodeCount}, () => ({
    x: Math.random()*w, y: Math.random()*h,
    vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25,
    r: Math.random()*1.6 + 0.6
  }));

  function resize(){
    ctx = fitCanvas(canvas);
    w = canvas.parentElement.clientWidth; h = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resize);

  function draw(){
    ctx.clearRect(0,0,w,h);

    // perspective floor grid
    ctx.strokeStyle = 'rgba(79,168,255,0.10)';
    ctx.lineWidth = 1;
    const horizon = h * 0.42;
    for (let i=0; i<=10; i++){
      const y = horizon + (h - horizon) * Math.pow(i/10, 1.6);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    const vanishX = w*0.7;
    for (let i=-6; i<=6; i++){
      ctx.beginPath();
      ctx.moveTo(vanishX + i*40, horizon);
      ctx.lineTo(vanishX + i*220, h);
      ctx.stroke();
    }

    // drifting nodes + connecting lines
    for (const n of nodes){
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h*0.55) n.vy *= -1;
    }
    for (let i=0;i<nodes.length;i++){
      for (let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x-b.x, a.y-b.y);
        if (d < 130){
          ctx.strokeStyle = `rgba(110,231,199,${0.16 * (1 - d/130)})`;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    for (const n of nodes){
      ctx.beginPath();
      ctx.fillStyle = 'rgba(79,168,255,0.75)';
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fill();
    }

    if (!reduceMotion) requestAnimationFrame(draw);
  }
  draw();
})();

/* ============================================================
   STAT COUNTERS — animate when scrolled into view
   ============================================================ */
const counters = document.querySelectorAll('.strip__num[data-count]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) { counterObserver.unobserve(el); return; }
    const suffix = el.dataset.suffix || '';
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const tick = () => {
      cur += step;
      if (cur >= target){ el.textContent = target + suffix; return; }
      el.textContent = cur;
      requestAnimationFrame(tick);
    };
    tick();
    counterObserver.unobserve(el);
  });
}, { threshold: 0.6 });
counters.forEach(c => counterObserver.observe(c));

/* ============================================================
   PROJECT VISUALIZATIONS
   Each is a small canvas-based animated "glimpse" of the system
   ============================================================ */

function makeCanvas(containerId){
  const container = document.getElementById(containerId);
  if (!container) return null;
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  return { canvas, ctx, container };
}

/* ---- 1. RAG chatbot: query pulses through a node graph ---- */
(function vizRAG(){
  const setup = makeCanvas('viz-rag');
  if (!setup) return;
  let { canvas, ctx, container } = setup;
  let w, h;
  function size(){ ctx = fitCanvas(canvas); w = container.clientWidth; h = container.clientHeight; }
  size(); window.addEventListener('resize', size);

  const cols = 4, rows = 3;
  let nodes = [];
  function layout(){
    nodes = [];
    for (let r=0;r<rows;r++){
      for (let c=0;c<cols;c++){
        nodes.push({
          x: (w/(cols+1))*(c+1) + (Math.random()-0.5)*10,
          y: (h/(rows+1))*(r+1) + (Math.random()-0.5)*10,
          pulse: Math.random()*Math.PI*2
        });
      }
    }
  }
  layout(); window.addEventListener('resize', layout);

  let pulses = [];
  let t = 0;
  function spawnPulse(){
    const from = { x: -10, y: h/2 };
    const to = nodes[Math.floor(Math.random()*nodes.length)];
    pulses.push({ from, to, p: 0, color: 'rgba(79,168,255,0.9)' });
  }
  setInterval(spawnPulse, 1400);

  function draw(){
    t += 0.016;
    ctx.clearRect(0,0,w,h);

    // connections
    ctx.lineWidth = 1;
    for (let i=0;i<nodes.length;i++){
      for (let j=i+1;j<nodes.length;j++){
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x-b.x,a.y-b.y);
        if (d < w*0.32){
          ctx.strokeStyle = `rgba(110,231,199,${0.12})`;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    // nodes
    for (const n of nodes){
      const s = 3 + Math.sin(t*1.5 + n.pulse) * 1.2;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(79,168,255,0.85)';
      ctx.arc(n.x, n.y, s, 0, Math.PI*2);
      ctx.fill();
    }
    // pulses (query traveling to relevant nodes)
    pulses.forEach(p => { p.p += 0.02; });
    pulses = pulses.filter(p => p.p <= 1);
    for (const p of pulses){
      const x = p.from.x + (p.to.x - p.from.x) * p.p;
      const y = p.from.y + (p.to.y - p.from.y) * p.p;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(x,y, 3.4, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(79,168,255,0.25)';
      ctx.moveTo(p.from.x,p.from.y); ctx.lineTo(x,y); ctx.stroke();
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  draw();
})();

/* ---- 2. Translation: two text panels cross-flowing glyphs ---- */
(function vizTranslate(){
  const setup = makeCanvas('viz-translate');
  if (!setup) return;
  let { canvas, ctx, container } = setup;
  let w,h;
  function size(){ ctx = fitCanvas(canvas); w = container.clientWidth; h = container.clientHeight; }
  size(); window.addEventListener('resize', size);

  const glyphSets = ['ABCDEFGHIJ', 'あいうえおかき', 'अआइईउऊए', '中文字符例子', 'العربية نص'];
  let particles = [];
  function spawn(){
    const setIdx = Math.floor(Math.random()*glyphSets.length);
    const glyphs = glyphSets[setIdx];
    particles.push({
      x: 14, y: 20 + Math.random()*(h-40),
      ch: glyphs[Math.floor(Math.random()*glyphs.length)],
      p: 0, speed: 0.006 + Math.random()*0.006,
      color: setIdx % 2 === 0 ? 'rgba(79,168,255,0.85)' : 'rgba(255,180,84,0.85)'
    });
  }
  setInterval(spawn, 380);

  function draw(){
    ctx.clearRect(0,0,w,h);
    // center divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(w/2,10); ctx.lineTo(w/2,h-10); ctx.stroke();

    particles.forEach(pt => pt.p += pt.speed);
    particles = particles.filter(pt => pt.p <= 1);
    ctx.font = '14px Space Grotesk, sans-serif';
    ctx.textBaseline = 'middle';
    for (const pt of particles){
      const x = 14 + (w-28) * pt.p;
      const y = pt.y + Math.sin(pt.p*Math.PI*2) * 6;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.sin(pt.p*Math.PI);
      ctx.fillText(pt.ch, x, y);
      ctx.globalAlpha = 1;
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  draw();
})();

/* ---- 3. n8n automation: workflow boxes with flowing packets ---- */
(function vizN8n(){
  const setup = makeCanvas('viz-n8n');
  if (!setup) return;
  let { canvas, ctx, container } = setup;
  let w,h, boxes = [];
  function size(){
    ctx = fitCanvas(canvas); w = container.clientWidth; h = container.clientHeight;
    boxes = [
      { x: w*0.12, y: h*0.5, label: 'Trigger' },
      { x: w*0.40, y: h*0.28, label: 'Parse' },
      { x: w*0.40, y: h*0.74, label: 'Route' },
      { x: w*0.68, y: h*0.5, label: 'LLM' },
      { x: w*0.90, y: h*0.5, label: 'Reply' },
    ];
  }
  size(); window.addEventListener('resize', size);

  const edges = [[0,1],[0,2],[1,3],[2,3],[3,4]];
  let packets = edges.map((e,i) => ({ edge: e, p: (i*0.2)%1, speed: 0.008 + Math.random()*0.004 }));

  function draw(){
    ctx.clearRect(0,0,w,h);
    // edges
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.4;
    edges.forEach(([a,b]) => {
      ctx.beginPath();
      ctx.moveTo(boxes[a].x, boxes[a].y);
      ctx.lineTo(boxes[b].x, boxes[b].y);
      ctx.stroke();
    });
    // boxes
    boxes.forEach(b => {
      ctx.fillStyle = 'rgba(23,29,51,0.95)';
      ctx.strokeStyle = 'rgba(110,231,199,0.55)';
      ctx.lineWidth = 1.2;
      const bw = 58, bh = 26;
      roundRect(ctx, b.x-bw/2, b.y-bh/2, bw, bh, 6);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(233,237,247,0.85)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y+1);
    });
    // packets
    packets.forEach(pk => {
      pk.p += pk.speed;
      if (pk.p > 1) pk.p = 0;
      const a = boxes[pk.edge[0]], b = boxes[pk.edge[1]];
      const x = a.x + (b.x-a.x)*pk.p;
      const y = a.y + (b.y-a.y)*pk.p;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,180,84,0.95)';
      ctx.arc(x,y,3,0,Math.PI*2);
      ctx.fill();
    });
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  draw();
})();

/* ---- 4. Car rental price prediction: animated forecast line ---- */
(function vizRental(){
  const setup = makeCanvas('viz-rental');
  if (!setup) return;
  let { canvas, ctx, container } = setup;
  let w,h;
  function size(){ ctx = fitCanvas(canvas); w = container.clientWidth; h = container.clientHeight; }
  size(); window.addEventListener('resize', size);

  const points = 24;
  let base = Array.from({length: points}, (_,i) => 0.4 + 0.25*Math.sin(i*0.5) + Math.random()*0.08);
  let t = 0;

  function draw(){
    t += 0.01;
    ctx.clearRect(0,0,w,h);
    const padX = 16, padY = 20;
    const plotW = w - padX*2, plotH = h - padY*2;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i=0;i<=4;i++){
      const y = padY + (plotH/4)*i;
      ctx.beginPath(); ctx.moveTo(padX,y); ctx.lineTo(w-padX,y); ctx.stroke();
    }

    // actual line (solid) + forecast line (dashed, animated draw)
    const splitIdx = Math.floor(points*0.62);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(79,168,255,0.9)';
    ctx.beginPath();
    for (let i=0;i<=splitIdx;i++){
      const x = padX + (plotW/(points-1))*i;
      const y = padY + plotH - base[i]*plotH;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();

    ctx.setLineDash([5,5]);
    ctx.strokeStyle = 'rgba(255,180,84,0.9)';
    ctx.beginPath();
    const revealCount = splitIdx + Math.floor((points-1-splitIdx) * ((Math.sin(t)+1)/2));
    for (let i=splitIdx;i<=Math.max(splitIdx,revealCount);i++){
      const x = padX + (plotW/(points-1))*i;
      const jitter = Math.sin(t*2+i)*0.015;
      const y = padY + plotH - (base[i]+jitter)*plotH;
      i===splitIdx ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // moving marker (car position) along actual line
    const markerP = (Math.sin(t*0.8)+1)/2 * splitIdx;
    const mi = Math.floor(markerP);
    const frac = markerP - mi;
    const x1 = padX + (plotW/(points-1))*mi;
    const y1 = padY + plotH - base[mi]*plotH;
    const x2 = padX + (plotW/(points-1))*Math.min(mi+1,splitIdx);
    const y2 = padY + plotH - base[Math.min(mi+1,splitIdx)]*plotH;
    const mx = x1 + (x2-x1)*frac, my = y1 + (y2-y1)*frac;
    ctx.beginPath();
    ctx.fillStyle = '#6ee7c7';
    ctx.arc(mx,my,4,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(110,231,199,0.3)';
    ctx.arc(mx,my,9,0,Math.PI*2);
    ctx.stroke();

    if (!reduceMotion) requestAnimationFrame(draw);
  }
  draw();
})();
