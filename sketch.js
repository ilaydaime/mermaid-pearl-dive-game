const C = document.getElementById('gc');
const ctx = C.getContext('2d');
let W, H;

function resize() {
  C.width = window.innerWidth;
  C.height = window.innerHeight;
  W = C.width; H = C.height;
}
resize();

// High score & Shop Data from localStorage
let hiScore = parseInt(localStorage.getItem('mpd_hs') || '0');
document.getElementById('hv').textContent = hiScore;
if (hiScore > 0) document.getElementById('hs-line').textContent = '🏆 Best: ' + hiScore;

let paused = false;
let diamonds = parseInt(localStorage.getItem('mpd_dia') || '0');
let unlocks = JSON.parse(localStorage.getItem('mpd_unlocks') || '{"top":false, "lips":false, "wings":false}');
let gems = [];

const SHOP_ITEMS = [
  { id: 'top', name: 'XS Neon Crop Top', cost: 3 },
  { id: 'lips', name: 'Red Lipstick', cost: 5 },
  { id: 'wings', name: 'Angel Wings', cost: 10 }
];


if(document.getElementById('dv')) document.getElementById('dv').textContent = diamonds;

let score = 0, level = 1, breath = 100, alive = false;
let waveT = 0, spawnT = 0, inkBlind = 0;
let pearlsNeeded = 0, pearlsCollected = 0;
let flashMsg = '', flashAlpha = 0, flashColor = '#fff';
let mermaid, pearls = [], enemies = [], bubbles = [], particles = [];
let beams = [], currentParts = [];
let flora = [], backRocks = []; 
let current = { dir: 1, strength: 0, target: 0, changeT: 0 };
let keys = {};

const DEPTHS = [
  ['#4fc3f7', '#0277bd'], ['#0288d1', '#01579b'], ['#1565c0', '#0d47a1'],
  ['#283593', '#1a237e'], ['#1a237e', '#0d0d2b']
];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function flash(msg, col) { flashMsg = msg; flashAlpha = 1; flashColor = col || '#fde68a'; }

function saveHS() {
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('mpd_hs', hiScore);
    document.getElementById('hv').textContent = hiScore;
  }
}

function initLevel() {
  pearls = []; enemies = []; bubbles = []; particles = []; currentParts = [];
  flora = []; backRocks = []; gems = [];
  pearlsNeeded = 3 + level * 2;
  pearlsCollected = 0;
  document.getElementById('pv').textContent = pearlsCollected + '/' + pearlsNeeded;

  // Spawn Diamonds
  const gemCount = Math.random() < 0.6 ? 1 : 2;
  for(let i=0; i<gemCount; i++) {
    gems.push({
      x: rnd(100, W-100), y: rnd(120, H-150),
      wobble: rnd(0, Math.PI*2), collected: false
    });
  }

  // Pearls
  for (let i = 0; i < pearlsNeeded; i++) {
    const r = Math.random();
    pearls.push({
      baseX: rnd(50, W - 50), baseY: rnd(120, H - 120),
      x: 0, y: 0, phase: rnd(0, Math.PI * 2),
      speed: rnd(0.4, 0.9), ampX: rnd(15, 30), ampY: rnd(5, 12),
      depth: Math.random(),
      type: r < 0.55 ? 'white' : r < 0.85 ? 'gold' : 'rainbow',
      collected: false
    });
  }

  // Bubbles
  for (let i = 0; i < 5 + level; i++) bubbles.push(makeBubble());

  const allTypes = ['jellyfish', 'shark', 'octopus', 'crab', 'eel', 'pufferfish'];
  const types = allTypes.slice(0, Math.min(level + 1, 6));
  const count = 2 + Math.floor(level / 2) + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    enemies.push(makeEnemy(types[Math.floor(Math.random() * types.length)]));
  }

  beams = [];
  for (let i = 0; i < 5; i++) {
    beams.push({ x: rnd(40, W - 40), angle: rnd(-0.15, 0.15), w: rnd(20, 40), t: rnd(0, Math.PI * 2) });
  }


  for(let i=0; i < W/50; i++) {
    flora.push({ x: rnd(0, W), r: rnd(15, 30), type: Math.random()<0.4?'coral':'seaweed', color: rndCol() });
  }
  for(let i=0; i<10; i++) {
    backRocks.push({ x: rnd(0, W), y: rnd(H-80, H-40), r: rnd(20, 50), speed: rnd(0.1, 0.3) });
  }

  current.dir = Math.random() < 0.5 ? -1 : 1;
  current.target = level >= 2 ? clamp(0.3 + (level - 2) * 0.1, 0, 0.8) : 0;
  current.changeT = rnd(360, 600);
}

function rndCol() {
  const cols = ['#f472b6', '#34d399', '#fb923c', '#c084fc', '#fde68a'];
  return cols[Math.floor(Math.random()*cols.length)];
}

function makeBubble() {
  return { x: rnd(20, W - 20), y: rnd(140, H - 30), r: rnd(7, 13),
            vy: -rnd(0.3, 0.6), wobble: rnd(0, Math.PI * 2), depth: rnd(0.1, 0.9) };
}

function makeEnemy(type) {
  const spd = 0.7 + level * 0.12;
  const e = {
    type, x: rnd(40, W - 40), y: rnd(90, H - 70),
    vx: (Math.random() > 0.5 ? 1 : -1) * spd,
    vy: (Math.random() - 0.5) * spd * 0.5,
    wobble: rnd(0, Math.PI * 2), inkCd: 0, depth: rnd(0.1, 0.7),
    puffed: false, puffT: 0
  };
  if (type === 'crab') { e.y = H - 26; e.vy = 0; e.depth = rnd(0.05, 0.3); }
  if (type === 'eel') {
    e.vy = 0; e.body = [];
    for (let i = 0; i < 10; i++) e.body.push({ x: e.x, y: e.y });
  }
  return e;
}


function drawBg() {
  const d = DEPTHS[Math.min(level - 1, 4)];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, d[0]); g.addColorStop(1, d[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawBackRocks() {
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,50,0.5)';
  backRocks.forEach(r => {
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r*0.6, 0, 0, Math.PI*2); ctx.fill();
    r.x += current.dir * r.speed;
    if(r.x < -100) r.x = W+100; if(r.x > W+100) r.x = -100;
  });
  ctx.restore();
}

function drawBeams() {
  ctx.save();
  beams.forEach(b => {
    b.t += 0.003;
    ctx.globalAlpha = Math.max(0, 0.05 + Math.sin(b.t) * 0.03);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, 0);
    ctx.lineTo(b.x + b.w / 2, 0);
    ctx.lineTo(b.x + b.w / 2 + b.angle * H * 2, H);
    ctx.lineTo(b.x - b.w / 2 + b.angle * H * 2, H);
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}

function drawSurface() {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let x = 0; x <= W; x += 4) {
    const y = 65 + Math.sin(x * 0.035 + waveT) * 6 + Math.sin(x * 0.018 + waveT * 0.6) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(100,200,255,0.5)'; ctx.fill();
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) {
    const y = 65 + Math.sin(x * 0.035 + waveT) * 6 + Math.sin(x * 0.018 + waveT * 0.6) * 4;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function drawSeaFloor() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,80,0.4)';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - 15 + Math.sin(x * 0.05) * 6);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

  flora.forEach(f => {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    if(f.type === 'seaweed') {
      ctx.beginPath(); ctx.moveTo(f.x, H - 6);
      for (let s = 1; s <= 6; s++) {
        const sway = Math.sin(waveT * 0.7 + s * 0.8 + f.x) * 10 + current.dir * current.strength * s * 1.5;
        ctx.lineTo(f.x + sway, H - 6 - s * 14);
      }
      ctx.stroke();
    } else {
      drawCoral(f.x, H-6, f.r, f.color);
    }
  });
  ctx.restore();
}

function drawCoral(x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x-r/2, y);
  ctx.quadraticCurveTo(x, y-r, x+r/2, y);
  ctx.quadraticCurveTo(x, y-r*1.3, x-r/2, y); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y-r, r/2, 0, Math.PI*2); ctx.fill();
}

function drawBubbles() {
  bubbles.forEach(b => {
    const scale = 0.5 + (1 - b.depth) * 0.55;
    ctx.save();
    ctx.globalAlpha = 0.3 + (1 - b.depth) * 0.6;
    ctx.translate(b.x, b.y); ctx.scale(scale, scale);
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(186,230,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
    ctx.beginPath(); ctx.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    ctx.restore();
  });
}

function drawPearls() {
  pearls.forEach(p => {
    if (p.collected) return;
    p.x = p.baseX + Math.sin(waveT * p.speed + p.phase) * p.ampX
        + current.dir * current.strength * (1 - p.depth) * 15;
    p.y = p.baseY + Math.sin(waveT * p.speed * 0.5 + p.phase) * p.ampY;

    const scale = 0.5 + (1 - p.depth) * 0.55;
    ctx.save();
    ctx.globalAlpha = 0.3 + (1 - p.depth) * 0.7;
    ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    const col = p.type === 'gold' ? '#fde68a' : p.type === 'rainbow' ? '#f0abfc' : '#bae6fd';
    ctx.fillStyle = col + '55';
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.type === 'gold' ? '#fef3c7' : p.type === 'rainbow' ? '#fae8ff' : '#e0f2fe';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

function drawGems() {
  gems.forEach(g => {
    if(g.collected) return;
    ctx.save(); ctx.translate(g.x, g.y + Math.sin(waveT * 2 + g.wobble) * 5);
    ctx.fillStyle = '#6ee7b7'; 
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 12); ctx.lineTo(-8, 0); ctx.fill();
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, 0); ctx.lineTo(0, 12); ctx.lineTo(-4, 0); ctx.fill();
    ctx.restore();
  });
}

function drawEnemies() {
  enemies.forEach(e => {
    const scale = 0.55 + (1 - e.depth) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.4 + (1 - e.depth) * 0.6;
    ctx.translate(e.x, e.y);
    if (e.vx < 0 && e.type !== 'eel') ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    const bob = Math.sin(waveT * 1.2 + e.wobble) * 3;

    if (e.type === 'shark') drawShark(bob);
    else if (e.type === 'jellyfish') drawJellyfish(bob, e);
    else if (e.type === 'octopus') drawOctopus(bob, e);
    else if (e.type === 'crab') drawCrab(e);
    else if (e.type === 'eel') {
      ctx.restore(); ctx.save();
      ctx.globalAlpha = 0.4 + (1 - e.depth) * 0.6;
      const sc = 0.55 + (1 - e.depth) * 0.5;
      drawEel(e, sc);
    }
    else if (e.type === 'pufferfish') drawPufferfish(bob, e);
    ctx.restore();
  });
}

function drawShark(bob) {
  ctx.fillStyle = '#64748b';
  ctx.beginPath(); ctx.ellipse(0, bob, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath(); ctx.ellipse(2, bob + 3, 14, 5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.beginPath(); ctx.moveTo(0, bob - 10); ctx.lineTo(8, bob - 20); ctx.lineTo(16, bob - 10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-20, bob); ctx.lineTo(-30, bob - 8); ctx.lineTo(-30, bob + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(12, bob - 3, 2, 0, Math.PI * 2); ctx.fill();
}

function drawJellyfish(bob, e) {
  ctx.fillStyle = 'rgba(57,255,20,0.85)';
  ctx.shadowColor = 'rgba(40, 248, 3, 0.9)'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(0, bob - 6, 16, 12, 0, Math.PI, 0); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(57,255,20,0.6)'; ctx.lineWidth = 2;
  for (let t = -2; t <= 2; t++) {
    const sw = Math.sin(waveT * 1.5 + t + e.wobble) * 5;
    ctx.beginPath(); ctx.moveTo(t * 5, bob + 4);
    ctx.quadraticCurveTo(t * 5 + sw, bob + 16, t * 4, bob + 28); ctx.stroke();
  }
}

function drawOctopus(bob, e) {
  ctx.fillStyle = '#ec4899';
  ctx.beginPath(); ctx.ellipse(0, bob - 4, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 1.5 - Math.PI * 0.25;
    const sw = Math.sin(waveT + a + e.wobble) * 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 10, bob + Math.sin(ang) * 6);
    ctx.lineTo(Math.cos(ang) * 20 + sw, bob + Math.sin(ang) * 22); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-5, bob - 7, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, bob - 7, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-4, bob - 7, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, bob - 7, 1.5, 0, Math.PI * 2); ctx.fill();
  if (e.inkCd > 0) {
    ctx.globalAlpha *= e.inkCd / 80 * 0.5;
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath(); ctx.arc(25, bob, 20, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCrab(e) {
  const leg = Math.sin(waveT * 4 + e.wobble) * 3;
  ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(-16 - i * 3, 8 + (i % 2 ? leg : -leg)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(16 + i * 3, 8 - (i % 2 ? leg : -leg)); ctx.stroke();
  }
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(-16, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-4, -6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(4, -6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-4, -6, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(4, -6, 1, 0, Math.PI * 2); ctx.fill();
}

function drawEel(e, sc) {
  for (let i = e.body.length - 1; i >= 0; i--) {
    const s = e.body[i];
    const r = (8 * (1 - i / e.body.length) + 3) * sc;
    ctx.fillStyle = i === 0 ? '#7c3aed' : '#a855f7';
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
  }
  const h = e.body[0];
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(h.x, h.y - 2 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(h.x, h.y - 2 * sc, 1 * sc, 0, Math.PI * 2); ctx.fill();
}

function drawPufferfish(bob, e) {
  const r = e.puffed ? 28 : 18;
  ctx.fillStyle = e.puffed ? '#ef444455' : '#fef3c7';
  ctx.beginPath(); ctx.arc(0, bob, r+5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath(); ctx.arc(0, bob, r, 0, Math.PI * 2); ctx.fill();
  if(e.puffed) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    for(let i=0; i<12; i++) {
      const a = (i/12)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*r, bob+Math.sin(a)*r);
      ctx.lineTo(Math.cos(a)*(r+8), bob+Math.sin(a)*(r+8)); ctx.stroke();
    }
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, bob-4, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(10, bob-4, 2, 0, Math.PI*2); ctx.fill();
}

function drawMermaid() {
  const m = mermaid;
  if (m.inv > 0 && Math.floor(m.inv / 5) % 2 === 1) return;

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(0.75 * (m.facing < 0 ? -1 : 1), 0.75);
  const swing = Math.sin(m.tailT) * 12;
  const hairFlow = current.dir * current.strength * 5;

  // Melek Kanatları (Shop'tan alınırsa, vücudun arkasında çizilir)
  if(unlocks.wings) {
    ctx.fillStyle = 'rgba(252, 165, 165, 0.8)';
    ctx.beginPath(); ctx.ellipse(-12, 0, 8, 18, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 0, 8, 18, 0.3, 0, Math.PI*2); ctx.fill();
  }

  const tg = ctx.createLinearGradient(0, 15, 0, 70);
  tg.addColorStop(0, '#7c3aed'); tg.addColorStop(1, '#f472b6');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.moveTo(-7, 18);
  ctx.bezierCurveTo(-15, 40 + swing * 0.4, -15, 55 + swing, -5, 65 + swing);
  ctx.bezierCurveTo(5, 70 + swing, 15, 60 + swing, 18, 18);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#34d399';
  ctx.beginPath(); ctx.ellipse(4, 68 + swing, 16, 8, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fce7f3';
  ctx.beginPath(); ctx.ellipse(4, 8, 12, 20, 0, 0, Math.PI * 2); ctx.fill();

  if(unlocks.top) { 
    ctx.fillStyle = '#f508b9'; 
    ctx.fillRect(-6, -6, 20, 10);
  } else {
    ctx.fillStyle = '#a855f7';
    ctx.beginPath(); ctx.ellipse(-3, -3, 7, 5, -0.3, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11, -3, 7, 5, 0.3, 0, Math.PI); ctx.fill();
  }

  ctx.strokeStyle = '#fce7f3'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const armSw = Math.sin(m.tailT * 0.8) * 5;
  ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-20, 8 + armSw, -22, 16 + armSw); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 4); ctx.quadraticCurveTo(28, 8 - armSw, 30, 16 - armSw); ctx.stroke();

  ctx.fillStyle = '#fce7f3';
  ctx.beginPath(); ctx.arc(4, -28, 14, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fb923c';
  ctx.beginPath(); ctx.arc(4, -28, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, -32);
  ctx.bezierCurveTo(-16 + hairFlow, -20, -18 + hairFlow, 0, -14 + hairFlow, 15);
  ctx.bezierCurveTo(-10, 18, -6, 10, -8, -10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16, -32);
  ctx.bezierCurveTo(24 + hairFlow, -20, 26 + hairFlow, 0, 22 + hairFlow, 15);
  ctx.bezierCurveTo(18, 18, 14, 10, 16, -10); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, -38, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(0, -42, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -40, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(10, -41, 2, 0, Math.PI*2); ctx.fill();

  const bh = m.blinkT > 0 ? 0.3 : 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-2, -28, 6, 6 * bh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -28, 6, 6 * bh, 0, 0, Math.PI * 2); ctx.fill();
  if (m.blinkT <= 0) {
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(-2, -28, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -28, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-2, -28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-1, -29, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -29, 1, 0, Math.PI * 2); ctx.fill();
  }

  if(unlocks.lips) { 
    ctx.fillStyle = '#e11d48';
    ctx.beginPath(); ctx.ellipse(4, -18, 5, 2, 0, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.strokeStyle = '#be185d'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(4, -18, 8, -20); ctx.stroke();
  }

  ctx.restore();

  if (Math.random() < 0.15) {
    particles.push({
      x: m.x + (m.facing < 0 ? 8 : -8), y: m.y - 8,
      vx: (Math.random() - 0.5) * 0.5, vy: -1,
      life: 1, r: 2 + Math.random() * 2, col: 'rgba(186,230,255,0.7)'
    });
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save(); ctx.globalAlpha = p.life;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

function drawCurrent() {
  if (current.strength < 0.05) return;
  ctx.save();
  currentParts.forEach(p => {
    ctx.globalAlpha = (0.15 + (1 - p.depth) * 0.3) * p.life;
    ctx.strokeStyle = 'rgba(186,230,255,0.9)';
    ctx.lineWidth = p.r; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - current.dir * 14, p.y); ctx.stroke();
  });
  ctx.restore();
}

function drawInkBlind() {
  if (inkBlind <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(inkBlind / 100 * 0.6, 0.6);
  const g = ctx.createRadialGradient(mermaid.x, mermaid.y, 30, mermaid.x, mermaid.y, W);
  g.addColorStop(0, 'rgba(30,27,75,0.3)'); g.addColorStop(1, 'rgba(15,10,50,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha;
  ctx.font = "bold 22px 'Fredoka One', cursive";
  ctx.textAlign = 'center';
  ctx.fillStyle = flashColor;
  ctx.shadowColor = flashColor; ctx.shadowBlur = 12;
  ctx.fillText(flashMsg, W / 2, H / 2 - 30);
  ctx.restore();
  flashAlpha -= 0.022;
}


function updateCurrent() {
  current.changeT--;
  if (current.changeT <= 0) {
    current.dir = -current.dir;
    current.target = level >= 2 ? clamp(0.25 + (level - 2) * 0.1, 0, 0.8) : 0;
    current.changeT = rnd(360, 600);
    if (level >= 2) flash(current.dir > 0 ? '🌊 Current → right' : '🌊 ← Current left', '#7dd3fc');
  }
  current.strength += (current.target - current.strength) * 0.02;

  if (current.strength > 0.05 && Math.random() < 0.5) {
    currentParts.push({
      x: current.dir > 0 ? -10 : W + 10, y: rnd(60, H - 50),
      vx: current.dir * (1.5 + current.strength * 3),
      life: 1, r: rnd(1.2, 2.5), depth: rnd(0.3, 1)
    });
  }
  currentParts.forEach(p => { p.x += p.vx * (1 - p.depth * 0.4); p.life -= 0.005; });
  currentParts = currentParts.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20);

  const ind = document.getElementById('current-indicator');
  if (current.strength > 0.08) {
    ind.classList.add('active');
    document.getElementById('ci-arrow').textContent = current.dir > 0 ? '→' : '←';
    document.getElementById('ci-label').textContent = (current.strength > 0.5 ? 'Strong' : 'Moderate') + ' Current';
  } else ind.classList.remove('active');
}

function updateBreath() {
  const atSurface = mermaid.y < 80;
  if (atSurface) {
    breath = Math.min(100, breath + 1.8);
    document.getElementById('surf-hint').textContent = '⬆ Surfacing!';
  } else {
    breath = Math.max(0, breath - 0.07 * (1 + level * 0.08));
    document.getElementById('surf-hint').textContent = '';
  }
  const bf = document.getElementById('breath-fill');
  bf.style.width = breath + '%';
  bf.style.background = breath > 50 ? 'linear-gradient(90deg,#38bdf8,#818cf8)'
                        : breath > 25 ? 'linear-gradient(90deg,#f59e0b,#f87171)' : '#ef4444';
  if (breath <= 0) die('💨 Out of breath!');
}

function die(msg) {
  if (!alive) return;
  alive = false;
  saveHS();
  setTimeout(() => {
    document.getElementById('go-msg').textContent = msg;
    document.getElementById('go-score').textContent = score;
    document.getElementById('go-level').textContent = level;
    document.getElementById('go-best').textContent = hiScore;
    document.getElementById('gameover').classList.remove('hidden');
  }, 700);
}

function levelUp() {
  level++;
  document.getElementById('lv').textContent = level;
  score += level * 50;
  document.getElementById('sv').textContent = score;
  flash('Level ' + level + '! Diving deeper 🌊', '#c4b5fd');
  saveHS();
  setTimeout(initLevel, 700);
}

function loop() {
  if (!alive) return;
  if (paused) return; // PAUSE KONTROLÜ
  
  requestAnimationFrame(loop);
  waveT += 0.028;
  spawnT++;

  mermaid.tailT += (Math.abs(mermaid.vx) + Math.abs(mermaid.vy) > 0.3) ? 0.15 : 0.05;
  if (mermaid.blinkT > 0) mermaid.blinkT--;
  else if (Math.random() < 0.005) mermaid.blinkT = 8;
  if (mermaid.inv > 0) mermaid.inv--;
  if (inkBlind > 0) inkBlind--;

  const accel = 0.6, damp = 0.88, maxV = 6;
  if (keys.ArrowLeft || keys.a) { mermaid.vx -= accel; mermaid.facing = -1; }
  if (keys.ArrowRight || keys.d) { mermaid.vx += accel; mermaid.facing = 1; }
  if (keys.ArrowUp || keys.w) mermaid.vy -= accel;
  if (keys.ArrowDown || keys.s) mermaid.vy += accel;
  mermaid.vx = clamp(mermaid.vx * damp, -maxV, maxV);
  mermaid.vy = clamp(mermaid.vy * damp, -maxV, maxV);

  updateCurrent();
  const currentForce = current.dir * current.strength * (0.3 + (mermaid.y / H) * 0.5);
  mermaid.x = clamp(mermaid.x + mermaid.vx + currentForce, 18, W - 18);
  mermaid.y = clamp(mermaid.y + mermaid.vy, 60, H - 35);

  updateBreath();

  if (spawnT % 200 === 0) bubbles.push(makeBubble());
  bubbles.forEach(b => {
    b.y += b.vy; b.wobble += 0.04;
    b.x += Math.sin(b.wobble) * 0.35 + current.dir * current.strength * 0.3;
  });
  bubbles = bubbles.filter(b => b.y > -20);

  enemies.forEach(e => {
    e.wobble += 0.04;
    if (e.type === 'crab') {
      e.x += e.vx;
      if (e.x < 28 || e.x > W - 28) e.vx *= -1;
      e.y = H - 26 + Math.sin(waveT * 4 + e.wobble);
    } else if (e.type === 'eel') {
      e.x += e.vx;
      e.y += Math.sin(waveT * 1.8 + e.wobble) * 0.6;
      e.y = clamp(e.y, 80, H - 60);
      if (e.x < 30 || e.x > W - 30) e.vx *= -1;
      e.body[0].x = e.x; e.body[0].y = e.y;
      for (let i = 1; i < e.body.length; i++) {
        const dx = e.body[i - 1].x - e.body[i].x;
        const dy = e.body[i - 1].y - e.body[i].y;
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.max(0, d - 7);
        e.body[i].x += (dx / d) * m;
        e.body[i].y += (dy / d) * m;
      }
    } else if (e.type === 'pufferfish') {
      e.puffT++;
      if(e.puffed && e.puffT > 100) { e.puffed = false; e.puffT = 0; }
      else if(!e.puffed && e.puffT > 150) { e.puffed = true; e.puffT = 0; }
      e.x += e.vx * (e.puffed?0.3:1);
      if (e.x < 25 || e.x > W - 25) e.vx *= -1;
    } else {
      e.x += e.vx; e.y += e.vy;
      if (e.x < 25 || e.x > W - 25) e.vx *= -1;
      if (e.y < 50 || e.y > H - 50) e.vy *= -1;
    }
    if (e.type === 'octopus') {
      if (e.inkCd > 0) e.inkCd--;
      else if (Math.hypot(mermaid.x - e.x, mermaid.y - e.y) < 200 && Math.random() < 0.0015) e.inkCd = 70;
    }
  });

  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.life -= 0.022; });
  particles = particles.filter(p => p.life > 0);

  pearls.forEach(p => {
    if (p.collected) return;
    const collisionRadius = 24 * (0.8 + p.depth * 0.4); 
    if (Math.hypot(mermaid.x - p.x, mermaid.y - p.y) < collisionRadius) {
      p.collected = true;
      pearlsCollected++;
      document.getElementById('pv').textContent = pearlsCollected + '/' + pearlsNeeded;
      const pts = p.type === 'gold' ? 60 : p.type === 'rainbow' ? 40 : 20;
      score += pts;
      document.getElementById('sv').textContent = score;
      if (p.type === 'rainbow') { breath = Math.min(100, breath + 20); flash('+20 breath 🌈', '#f0abfc'); }
      else flash('+' + pts + ' pts!', '#fde68a');
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
          x: p.x, y: p.y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5,
          life: 1, r: 2 + Math.random() * 2,
          col: p.type === 'gold' ? '#fde68a' : '#c4b5fd'
        });
      }
      if (pearlsCollected >= pearlsNeeded) setTimeout(levelUp, 500);
    }
  });

  gems.forEach(g => {
    if(g.collected) return;
    g.y += Math.sin(waveT * 2 + g.wobble) * 0.5;
    if (Math.hypot(mermaid.x - g.x, mermaid.y - g.y) < 25) {
      g.collected = true;
      diamonds++;
      localStorage.setItem('mpd_dia', diamonds);
      if(document.getElementById('dv')) document.getElementById('dv').textContent = diamonds;
      flash('+1 Diamond 💎!', '#6ee7b7');
    }
  });

  bubbles = bubbles.filter(b => {
    if (Math.hypot(mermaid.x - b.x, mermaid.y - b.y) < b.r + 16) {
      breath = Math.min(100, breath + 18);
      flash('+18 breath 🫧', '#7dd3fc');
      return false;
    }
    return true;
  });

  if (mermaid.inv <= 0) {
    enemies.forEach(e => {
      let hit = false;
      if (e.type === 'eel') {
        for (let i = 0; i < e.body.length; i++) {
          const s = e.body[i];
          const r = 8 * (1 - i / e.body.length) + 4;
          if (Math.hypot(mermaid.x - s.x, mermaid.y - s.y) < r + 12) { hit = true; break; }
        }
      } else {
        const r = (e.type === 'shark' ? 28 : e.type === 'pufferfish' ? (e.puffed?32:18) : 22) * (0.55 + (1 - e.depth) * 0.5);
        hit = Math.hypot(mermaid.x - e.x, mermaid.y - e.y) < r;
      }
      if (hit) {
        if (e.type === 'octopus' && e.inkCd > 0) {
          inkBlind = 90; flash('🦑 Inked!', '#a78bfa'); mermaid.inv = 60;
        } else {
          const dam = e.type === 'pufferfish' && e.puffed ? 35 : 22;
          breath = Math.max(0, breath - dam);
          flash('Ouch! -'+dam+' breath', '#fca5a5');
          mermaid.inv = 80;
          if (breath <= 0) die('Caught by a ' + e.type + '!');
        }
      }
    });
  }

  ctx.clearRect(0, 0, W, H);
  drawBg();
  drawBeams();
  drawBackRocks();
  drawSeaFloor();
  drawSurface();
  drawCurrent();
  drawBubbles();
  drawPearls();
  drawGems(); // Elmasları çiz
  drawEnemies();
  drawMermaid();
  drawParticles();
  drawInkBlind();
  drawFlash();
}

function startGame() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  score = 0; level = 1; breath = 100; inkBlind = 0;
  mermaid = { x: W / 2, y: 180, vx: 0, vy: 0, tailT: 0, blinkT: 0, inv: 0, facing: 1 };
  particles = [];
  current = { dir: 1, strength: 0, target: 0, changeT: 0 };
  document.getElementById('sv').textContent = 0;
  document.getElementById('lv').textContent = 1;
  document.getElementById('breath-fill').style.width = '100%';
  initLevel();
  alive = true;
  loop();
}

// === DOM EVENT LISTENERS & SHOP LOGIC ===

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
document.addEventListener('keyup', e => keys[e.key] = false);

document.getElementById('startbtn').onclick = startGame;
document.getElementById('retrybtn').onclick = startGame;
window.addEventListener('resize', resize);

function renderShop() {
  const container = document.getElementById('shop-container');
  if(!container) return;
  container.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    const hasItem = unlocks[item.id];
    btn.textContent = hasItem ? `✅ ${item.name} (Owned)` : `💎 ${item.cost} - ${item.name}`;
    btn.style.width = '100%';
    btn.style.padding = '8px';
    btn.style.fontSize = '14px';
    btn.style.background = hasItem ? '#10b981' : (diamonds >= item.cost ? '#8b5cf6' : '#4b5563');
    btn.disabled = hasItem || diamonds < item.cost;
    
    btn.onclick = () => {
      if(diamonds >= item.cost && !hasItem) {
        diamonds -= item.cost;
        unlocks[item.id] = true;
        localStorage.setItem('mpd_dia', diamonds);
        localStorage.setItem('mpd_unlocks', JSON.stringify(unlocks));
        document.getElementById('dv').textContent = diamonds;
        document.getElementById('shop-dia').textContent = diamonds;
        renderShop();
      }
    };
    container.appendChild(btn);
  });
}

const pauseBtn = document.getElementById('pausebtn');
if(pauseBtn) {
  pauseBtn.onclick = () => {
    if(!alive || paused) return;
    paused = true;
    document.getElementById('pausemenu').classList.remove('hidden');
    document.getElementById('shop-dia').textContent = diamonds;
    renderShop();
  };
}

const resumeBtn = document.getElementById('resumebtn');
if(resumeBtn) {
  resumeBtn.onclick = () => {
    paused = false;
    document.getElementById('pausemenu').classList.add('hidden');
    loop();
  };
}

const restartBtnMenu = document.getElementById('restartbtn');
if(restartBtnMenu) {
  restartBtnMenu.onclick = () => {
    paused = false;
    document.getElementById('pausemenu').classList.add('hidden');
    startGame();
  };
}

drawBg();