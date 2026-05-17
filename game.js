const C   = document.getElementById('gc');
const ctx = C.getContext('2d');
const W = 700, H = 650;

// ─── High Score (localStorage) ───────────────────────────────
let best = parseInt(localStorage.getItem('flappy_best') || '0');

let bird, pipes, particles, score, lives, state, raf, frame;
let level, pipeSpeed, pipeInterval, pipeGap, levelBanner;

// ─── Sound Engine (Web Audio API) ────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playFlap() {
  try {
    const ac = getAudio(), osc = ac.createOscillator(), gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    osc.start(); osc.stop(ac.currentTime + 0.12);
  } catch(e) {}
}
function playScore() {
  try {
    const ac = getAudio();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ac.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.08 + 0.15);
      osc.start(ac.currentTime + i * 0.08);
      osc.stop(ac.currentTime + i * 0.08 + 0.15);
    });
  } catch(e) {}
}
function playDie() {
  try {
    const ac = getAudio(), osc = ac.createOscillator(), gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.4);
    gain.gain.setValueAtTime(0.4, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.start(); osc.stop(ac.currentTime + 0.4);
  } catch(e) {}
}
function playLevelUp() {
  try {
    const ac = getAudio();
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ac.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.18);
      osc.start(ac.currentTime + i * 0.1);
      osc.stop(ac.currentTime + i * 0.1 + 0.18);
    });
  } catch(e) {}
}

// ─── Level Config ────────────────────────────────────────────
function getLevelConfig(lvl) {
  return {
    speed:    Math.min(1.4 + (lvl - 1) * 0.25, 4.0),
    interval: Math.max(130 - (lvl - 1) * 8, 70),
    gap:      Math.max(175 - (lvl - 1) * 8, 110),
  };
}

function applyLevel(lvl) {
  const cfg = getLevelConfig(lvl);
  pipeSpeed    = cfg.speed;
  pipeInterval = cfg.interval;
  pipeGap      = cfg.gap;
}

function updateLevelDisplay() {
  document.getElementById('sc').textContent   = score;
  document.getElementById('best').textContent = best;
  document.getElementById('lv').textContent   = level;
  document.getElementById('li').textContent   = lives;
}

// ─── Init ────────────────────────────────────────────────────
function initGame() {
  level       = 1;
  levelBanner = 0;
  applyLevel(1);
  bird        = { x: 100, y: 300, vy: 0, r: 20, rot: 0, flap: 0 };
  pipes       = [];
  particles   = [];
  score       = 0;
  lives       = 3;
  frame       = 0;
  state       = 'start';
  updateLevelDisplay();
  document.getElementById('msg').textContent = 'Click / Space / Tap to flap!';
  spawnPipe();
}

// ─── Check Level Up ──────────────────────────────────────────
function checkLevelUp() {
  const newLevel = Math.floor(score / 10) + 1;
  if (newLevel > level) {
    level = newLevel;
    applyLevel(level);
    document.getElementById('lv').textContent = level;
    levelBanner = 90;
    playLevelUp();
    spawnParticle(W / 2, H / 2, '#FFD700');
    spawnParticle(W / 2, H / 2, '#00ffff');
  }
}

// ─── Pipe Spawner ────────────────────────────────────────────
function spawnPipe() {
  const minTop = 80;
  const maxTop = H - pipeGap - 100;
  const topH   = Math.floor(Math.random() * (maxTop - minTop) + minTop);
  pipes.push({ x: W + 10, topH, gap: pipeGap, scored: false, wobble: 0 });
}

// ─── Flap / Input ────────────────────────────────────────────
function flap() {
  if (state === 'start') {
    state = 'play';
    document.getElementById('msg').textContent = '';
  }
  if (state === 'play') {
    bird.vy = -7; bird.flap = 10;
    playFlap();
  }
  if (state === 'dead') {
    if (lives > 0) {
      bird      = { x: 100, y: 300, vy: 0, r: 20, rot: 0, flap: 0 };
      pipes     = []; frame = 0; particles = [];
      state     = 'play';
      document.getElementById('msg').textContent = '';
      spawnPipe();
    } else {
      initGame();
    }
  }
}

document.addEventListener('keydown', function(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});
C.addEventListener('click', flap);
C.addEventListener('touchstart', function(e) { e.preventDefault(); flap(); }, { passive: false });

// ─── Particles ───────────────────────────────────────────────
function spawnParticle(x, y, col) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7,
      life: 40, col
    });
  }
}

// ─── Update ──────────────────────────────────────────────────
function update() {
  if (state !== 'play') return;
  frame++;

  bird.vy  = Math.min(bird.vy + 0.28, 9);
  bird.y  += bird.vy;
  bird.rot = Math.max(-25, Math.min(80, bird.vy * 4));
  if (bird.flap > 0) bird.flap--;

  if (frame % pipeInterval === 0) spawnPipe();

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x    -= pipeSpeed;
    p.wobble = Math.sin(frame * 0.05) * 1.5;
    if (p.x + 62 < 0) { pipes.splice(i, 1); continue; }

    if (!p.scored && p.x + 62 < bird.x) {
      p.scored = true; score++;
      if (score > best) {
        best = score;
        localStorage.setItem('flappy_best', best);
      }
      updateLevelDisplay();
      checkLevelUp();
      spawnParticle(bird.x, bird.y, '#FFD700');
      playScore();
    }

    const bx = bird.x - bird.r + 5, by = bird.y - bird.r + 5;
    const bw = bird.r * 2 - 10,     bh = bird.r * 2 - 10;
    const hit = (bx < p.x + 62 && bx + bw > p.x) &&
                (by < p.topH + p.wobble || by + bh > p.topH + p.gap + p.wobble);
    if (hit) { die(); return; }
  }

  if (bird.y + bird.r > H - 35) { die(); return; }
  if (bird.y - bird.r < 0)      { bird.y = bird.r; bird.vy = 0; }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (levelBanner > 0) levelBanner--;
}

// ─── Die ─────────────────────────────────────────────────────
function die() {
  spawnParticle(bird.x, bird.y, '#ff4444');
  playDie();
  lives--;
  document.getElementById('li').textContent = Math.max(0, lives);
  state = 'dead';
  if (lives <= 0) {
    document.getElementById('msg').textContent =
      'Game Over! Score: ' + score + '  Best: ' + best + ' — Click to restart.';
  } else {
    document.getElementById('msg').textContent =
      'Ouch! ' + lives + ' lives left. Click to continue.';
  }
}

// ─── Draw Helpers ────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function drawCloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.arc(x + s * 1.1, y - s * 0.2, s * 0.75, 0, Math.PI * 2);
  ctx.arc(x + s * 2,   y,            s * 0.85,  0, Math.PI * 2);
  ctx.fill();
}

// ─── Sky color changes per level ─────────────────────────────
const skyColors = ['#70c5ce','#5ba8d4','#7b6db5','#c07840','#3a7a5c','#1a2a5c'];
function getSkyColor() { return skyColors[Math.min(level - 1, skyColors.length - 1)]; }

// ─── Draw Background ─────────────────────────────────────────
function drawBG() {
  ctx.fillStyle = getSkyColor(); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  drawCloud(80,90,36); drawCloud(280,60,28); drawCloud(460,110,32);
  drawCloud(600,75,24); drawCloud(150,160,22);
  for (let i = 0; i < W; i += 50) {
    ctx.fillStyle = i % 100 === 0 ? '#deb887' : '#c8a276';
    ctx.fillRect(i, H - 35, 50, 35);
  }
  ctx.fillStyle = '#8B6914'; ctx.fillRect(0, H - 38, W, 5);
}

// ─── Draw Pipe ───────────────────────────────────────────────
function drawPipe(p) {
  const pw = 62, rx = 7;
  ctx.fillStyle = '#4caf50';
  roundRect(ctx, p.x, 0, pw, p.topH + p.wobble, rx); ctx.fill();
  roundRect(ctx, p.x, p.topH + p.gap + p.wobble, pw, H - (p.topH + p.gap + p.wobble) - 35, rx); ctx.fill();
  ctx.fillStyle = '#388e3c';
  roundRect(ctx, p.x - 5, p.topH - 22 + p.wobble, pw + 10, 24, rx); ctx.fill();
  roundRect(ctx, p.x - 5, p.topH + p.gap + p.wobble, pw + 10, 24, rx); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(p.x + 8, 0, 10, p.topH + p.wobble);
  ctx.fillRect(p.x + 8, p.topH + p.gap + p.wobble, 10, H);
}

// ─── Draw Bird ───────────────────────────────────────────────
function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot * Math.PI / 180);
  ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(0,0,bird.r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e8a800'; ctx.beginPath(); ctx.ellipse(5,5,bird.r-4,bird.r-6,0,0,Math.PI*2); ctx.fill();
  const wingY = bird.flap > 0 ? 5 : -2;
  ctx.fillStyle = '#f5c518'; ctx.beginPath();
  ctx.ellipse(-7, wingY, 13, 8, bird.flap > 0 ? -0.4 : 0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7,-5,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(9,-5,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10,-6,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f08030'; ctx.beginPath();
  ctx.moveTo(17,-2); ctx.lineTo(27,0); ctx.lineTo(17,5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ─── Draw HUD ────────────────────────────────────────────────
function drawHUD() {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(score, W / 2, 52);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('LVL ' + level, W / 2, 82);
  ctx.textAlign = 'left';
}

// ─── Level Up Banner ─────────────────────────────────────────
function drawLevelBanner() {
  if (levelBanner <= 0) return;
  ctx.globalAlpha = Math.min(levelBanner / 20, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 58px sans-serif';
  ctx.fillText('LEVEL ' + level + '!', W / 2, H / 2 - 20);
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Speed UP!  Gap SMALLER!', W / 2, H / 2 + 30);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// ─── Start Screen ────────────────────────────────────────────
function drawStartScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 52px sans-serif';
  ctx.fillText('Flappy Bird', W/2, H/2 - 80);
  ctx.font = '22px sans-serif'; ctx.fillStyle = '#ffe';
  ctx.fillText('Click / Space / Tap to start', W/2, H/2 - 20);
  ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Every 10 pipes = next level  |  Speed increases!', W/2, H/2 + 20);
  if (best > 0) {
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#FFD700';
    ctx.fillText('Best Score: ' + best, W/2, H/2 + 68);
  }
  ctx.textAlign = 'left';
}

// ─── Dead Screen ─────────────────────────────────────────────
function drawDeadScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.48)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign = 'center';
  if (lives <= 0) {
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 50px sans-serif';
    ctx.fillText('Game Over!', W/2, H/2 - 70);
    ctx.fillStyle = '#fff'; ctx.font = '26px sans-serif';
    ctx.fillText('Score: ' + score, W/2, H/2 - 20);
    ctx.fillText('Level Reached: ' + level, W/2, H/2 + 18);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Best Score: ' + best, W/2, H/2 + 60);
    ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Click to play again', W/2, H/2 + 100);
  } else {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText('Oops!', W/2, H/2 - 40);
    ctx.font = '24px sans-serif';
    ctx.fillText(lives + ' lives remaining', W/2, H/2 + 10);
    ctx.font = '16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Click to continue', W/2, H/2 + 55);
  }
  ctx.textAlign = 'left';
}

// ─── Main Draw ───────────────────────────────────────────────
function draw() {
  drawBG();
  pipes.forEach(drawPipe);
  drawBird();
  for (const p of particles) {
    ctx.globalAlpha = p.life / 40;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (state === 'play') { drawHUD(); drawLevelBanner(); }
  if (state === 'start') drawStartScreen();
  if (state === 'dead')  drawDeadScreen();
}

// ─── Game Loop ───────────────────────────────────────────────
function loop() { update(); draw(); raf = requestAnimationFrame(loop); }

initGame();
loop();

// ─── MIC PERMISSION SYSTEM ───────────────────────────────────
let micActive   = false;
let analyser    = null;
let dataArray   = null;
let micStream   = null;
let prevVoice   = false;
let micVolume   = 0;
const THRESHOLD = 18;

function showScreen(id) {
  ['screen-request','screen-listening','screen-denied'].forEach(s => {
    document.getElementById(s).style.display = s === id ? 'block' : 'none';
  });
}

async function requestMic() {
  const btn = document.getElementById('allowBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Intezaar karo...';
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac  = getAudio();
    const src = ac.createMediaStreamSource(micStream);
    analyser  = ac.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    micActive = true;

    // Mark steps done
    ['s1','s2','s3'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = '✓';
      el.classList.add('done');
    });
    document.getElementById('micIconWrap').className = 'mic-icon-wrap success';
    document.getElementById('micEmoji').textContent  = '✅';

    showScreen('screen-listening');
    startVolumeMeter();

    // Update HUD mic status
    document.getElementById('mic-status').textContent = '🎤 ON';
    document.getElementById('mic-status').classList.add('on');
    document.getElementById('msg').textContent = '🎤 Awaaz do — bird upar jayega!';

  } catch(e) {
    document.getElementById('micIconWrap').className = 'mic-icon-wrap error';
    document.getElementById('micEmoji').textContent  = '❌';
    showScreen('screen-denied');
    btn.disabled = false;
    btn.textContent = '🎤 Mic Allow Karo';
  }
}

function startVolumeMeter() {
  function tick() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    micVolume = sum / dataArray.length;

    const pct  = Math.min(Math.round(micVolume * 3), 100);
    const loud = micVolume > THRESHOLD;

    document.getElementById('volFill').style.width     = pct + '%';
    document.getElementById('volFill').style.background = loud ? '#FFD700' : '#43a047';
    document.getElementById('volPct').textContent       = pct + '%';
    document.getElementById('dot').className            = 'dot ' + (loud ? 'loud' : 'active');
    document.getElementById('statusTxt').textContent    = loud
      ? '🎤 Awaaz detect! Bird upar!'
      : 'Awaaz ka intezaar hai...';

    requestAnimationFrame(tick);
  }
  tick();
}

function stopMicPerm() {
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  micActive = false; analyser = null; micStream = null;
  document.getElementById('micIconWrap').className = 'mic-icon-wrap';
  document.getElementById('micEmoji').textContent  = '🎤';
  document.getElementById('mic-status').textContent = '🎤 OFF';
  document.getElementById('mic-status').classList.remove('on');
  showScreen('screen-request');
  const btn = document.getElementById('allowBtn');
  btn.disabled = false;
  btn.textContent = '🎤 Mic Allow Karo';
}

function skipMic() {
  document.getElementById('mic-overlay').classList.add('hidden');
  document.getElementById('msg').textContent = 'Click / Space / Tap to flap!';
}

function closeMicPopup() {
  document.getElementById('mic-overlay').classList.add('hidden');
  if (state === 'start') {
    state = 'play';
    document.getElementById('msg').textContent = '🎤 Awaaz do — bird upar jayega!';
  }
}

// ─── VOICE FLAP IN GAME LOOP ─────────────────────────────────
const _origUpdate = update;
update = function() {
  if (micActive && analyser) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    micVolume = sum / dataArray.length;
    const voiceOn = micVolume > THRESHOLD;
    if (voiceOn && !prevVoice) flap();
    prevVoice = voiceOn;
  }
  _origUpdate();
};
