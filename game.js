const C   = document.getElementById('gc');
const ctx = C.getContext('2d');
const W = 700, H = 650;

// ── High Score ───────────────────────────────────────────────
let best = parseInt(localStorage.getItem('flappy_best') || '0');

// ── Game State ───────────────────────────────────────────────
let bird, pipes, particles, score, lives, state, frame;
let level, pipeSpeed, pipeInterval, pipeGap, levelBanner;

// ── Mic State ────────────────────────────────────────────────
let micActive  = false;
let analyser   = null;
let dataArray  = null;
let micStream  = null;
let prevVoice  = false;
let popupDone  = false;          // popup sirf ek baar
const VOL_THRESHOLD = 18;

// ── Audio ────────────────────────────────────────────────────
let AC = null;
function getAC() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  return AC;
}
function beep(freq, type, dur, vol) {
  try {
    const ac = getAC(), o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
  } catch(e) {}
}
function playFlap()    { beep(700,  'sine',     0.1,  0.25); }
function playDie()     { beep(200,  'sawtooth', 0.4,  0.35); }
function playScore()   {
  [523,659,784].forEach((f,i) => setTimeout(() => beep(f,'triangle',0.15,0.2), i*80));
}
function playLevelUp() {
  [392,523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f,'square',0.15,0.18), i*100));
}

// ── Level Config ─────────────────────────────────────────────
function getLevelCfg(lvl) {
  return {
    speed:    Math.min(1.4 + (lvl-1)*0.25, 4.0),
    interval: Math.max(130 - (lvl-1)*8,    70),
    gap:      Math.max(175 - (lvl-1)*8,    110),
  };
}
function applyLevel(lvl) {
  const c  = getLevelCfg(lvl);
  pipeSpeed    = c.speed;
  pipeInterval = c.interval;
  pipeGap      = c.gap;
}

// ── HUD ──────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('sc').textContent   = score;
  document.getElementById('best').textContent = best;
  document.getElementById('lv').textContent   = level;
  document.getElementById('li').textContent   = lives;
}

// ── Init Game ────────────────────────────────────────────────
function initGame() {
  level = 1; levelBanner = 0;
  applyLevel(1);
  bird      = { x:100, y:300, vy:0, r:20, rot:0, flap:0 };
  pipes     = []; particles = [];
  score     = 0; lives = 3; frame = 0;
  state     = 'start';
  updateHUD();

  // Popup sirf PEHLI baar
  if (!popupDone) {
    document.getElementById('micOverlay').classList.remove('hide');
  } else {
    document.getElementById('micOverlay').classList.add('hide');
    document.getElementById('msg').textContent = micActive
      ? '🎤 Awaaz do — bird upar jayega!'
      : 'Click / Space / Tap to flap!';
  }
  spawnPipe();
}

// ── Pipes ────────────────────────────────────────────────────
function spawnPipe() {
  const minT = 80, maxT = H - pipeGap - 100;
  const topH = Math.floor(Math.random()*(maxT-minT)+minT);
  pipes.push({ x: W+10, topH, gap: pipeGap, scored: false, wobble: 0 });
}

// ── Flap ─────────────────────────────────────────────────────
function flap() {
  if (state === 'start') { state = 'play'; }
  if (state === 'play')  { bird.vy = -7; bird.flap = 10; playFlap(); }
  if (state === 'dead')  {
    if (lives > 0) {
      bird  = { x:100, y:300, vy:0, r:20, rot:0, flap:0 };
      pipes = []; frame = 0; particles = [];
      state = 'play';
      document.getElementById('msg').textContent = '';
      spawnPipe();
    } else { initGame(); }
  }
}

// ── Input ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});
C.addEventListener('click', flap);
C.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive:false });

// ── Particles ────────────────────────────────────────────────
function spawnParticles(x, y, col) {
  for (let i=0; i<10; i++)
    particles.push({ x, y, vx:(Math.random()-.5)*7, vy:(Math.random()-.5)*7, life:40, col });
}

// ── Update ───────────────────────────────────────────────────
function update() {
  // Voice detection
  if (micActive && analyser) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i=0; i<dataArray.length; i++) sum += dataArray[i];
    const vol = sum / dataArray.length;
    const voiceOn = vol > VOL_THRESHOLD;
    if (voiceOn && !prevVoice) flap();
    prevVoice = voiceOn;
  }

  if (state !== 'play') return;
  frame++;

  bird.vy  = Math.min(bird.vy + 0.28, 9);
  bird.y  += bird.vy;
  bird.rot = Math.max(-25, Math.min(80, bird.vy*4));
  if (bird.flap > 0) bird.flap--;

  if (frame % pipeInterval === 0) spawnPipe();

  for (let i = pipes.length-1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= pipeSpeed;
    p.wobble = Math.sin(frame*0.05)*1.5;
    if (p.x+62 < 0) { pipes.splice(i,1); continue; }

    if (!p.scored && p.x+62 < bird.x) {
      p.scored = true; score++;
      if (score > best) { best = score; localStorage.setItem('flappy_best', best); }
      updateHUD();
      checkLevelUp();
      spawnParticles(bird.x, bird.y, '#FFD700');
      playScore();
    }

    const bx=bird.x-bird.r+5, by=bird.y-bird.r+5;
    const bw=bird.r*2-10,     bh=bird.r*2-10;
    if ((bx < p.x+62 && bx+bw > p.x) &&
        (by < p.topH+p.wobble || by+bh > p.topH+p.gap+p.wobble)) {
      die(); return;
    }
  }

  if (bird.y+bird.r > H-35) { die(); return; }
  if (bird.y-bird.r < 0)    { bird.y = bird.r; bird.vy = 0; }

  for (let i=particles.length-1; i>=0; i--) {
    const p = particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life--;
    if (p.life<=0) particles.splice(i,1);
  }
  if (levelBanner > 0) levelBanner--;
}

function checkLevelUp() {
  const n = Math.floor(score/10)+1;
  if (n > level) {
    level = n; applyLevel(level);
    document.getElementById('lv').textContent = level;
    levelBanner = 90; playLevelUp();
    spawnParticles(W/2, H/2, '#FFD700');
    spawnParticles(W/2, H/2, '#00ffff');
  }
}

function die() {
  spawnParticles(bird.x, bird.y, '#ff4444');
  playDie(); lives--;
  document.getElementById('li').textContent = Math.max(0, lives);
  state = 'dead';
  document.getElementById('msg').textContent = lives <= 0
    ? 'Game Over! Best: '+best+' — Click to restart.'
    : 'Ouch! '+lives+' lives bache. Click to continue.';
}

// ── Draw ─────────────────────────────────────────────────────
function rr(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
function cloud(x,y,s){
  ctx.beginPath();
  ctx.arc(x,y,s,0,Math.PI*2);
  ctx.arc(x+s*1.1,y-s*.2,s*.75,0,Math.PI*2);
  ctx.arc(x+s*2,y,s*.85,0,Math.PI*2);
  ctx.fill();
}
const skies=['#70c5ce','#5ba8d4','#7b6db5','#c07840','#3a7a5c','#1a2a5c'];

function drawBG(){
  ctx.fillStyle=skies[Math.min(level-1,skies.length-1)]; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.72)';
  cloud(80,90,36); cloud(280,60,28); cloud(460,110,32); cloud(600,75,24);
  for(let i=0;i<W;i+=50){ ctx.fillStyle=i%100===0?'#deb887':'#c8a276'; ctx.fillRect(i,H-35,50,35); }
  ctx.fillStyle='#8B6914'; ctx.fillRect(0,H-38,W,5);
}

function drawPipe(p){
  const pw=62,rx=7;
  ctx.fillStyle='#4caf50';
  rr(p.x,0,pw,p.topH+p.wobble,rx); ctx.fill();
  rr(p.x,p.topH+p.gap+p.wobble,pw,H-(p.topH+p.gap+p.wobble)-35,rx); ctx.fill();
  ctx.fillStyle='#388e3c';
  rr(p.x-5,p.topH-22+p.wobble,pw+10,24,rx); ctx.fill();
  rr(p.x-5,p.topH+p.gap+p.wobble,pw+10,24,rx); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.15)';
  ctx.fillRect(p.x+8,0,10,p.topH+p.wobble);
  ctx.fillRect(p.x+8,p.topH+p.gap+p.wobble,10,H);
}

function drawBird(){
  ctx.save();
  ctx.translate(bird.x,bird.y);
  ctx.rotate(bird.rot*Math.PI/180);
  ctx.fillStyle='#f5c518'; ctx.beginPath(); ctx.arc(0,0,bird.r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e8a800'; ctx.beginPath(); ctx.ellipse(5,5,bird.r-4,bird.r-6,0,0,Math.PI*2); ctx.fill();
  const wy=bird.flap>0?5:-2;
  ctx.fillStyle='#f5c518'; ctx.beginPath(); ctx.ellipse(-7,wy,13,8,bird.flap>0?-.4:.3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(7,-5,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(9,-5,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(10,-6,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f08030'; ctx.beginPath(); ctx.moveTo(17,-2); ctx.lineTo(27,0); ctx.lineTo(17,5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawHUDCanvas(){
  ctx.textAlign='center';
  ctx.fillStyle='#fff'; ctx.font='bold 38px sans-serif'; ctx.fillText(score,W/2,50);
  ctx.fillStyle='#FFD700'; ctx.font='bold 20px sans-serif'; ctx.fillText('LVL '+level,W/2,80);
  ctx.textAlign='left';
}

function drawLevelBanner(){
  if(levelBanner<=0) return;
  ctx.globalAlpha=Math.min(levelBanner/20,1);
  ctx.textAlign='center';
  ctx.fillStyle='#FFD700'; ctx.font='bold 58px sans-serif'; ctx.fillText('LEVEL '+level+'!',W/2,H/2-20);
  ctx.fillStyle='#fff'; ctx.font='24px sans-serif'; ctx.fillText('Speed UP!',W/2,H/2+30);
  ctx.textAlign='left'; ctx.globalAlpha=1;
}

function drawStart(){
  ctx.fillStyle='rgba(0,0,0,0.42)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#fff'; ctx.font='bold 52px sans-serif'; ctx.fillText('Flappy Bird',W/2,H/2-80);
  ctx.font='22px sans-serif'; ctx.fillStyle='#ffe';
  ctx.fillText(micActive?'🎤 Awaaz do — bird upar jayega!':'Click / Space / Tap to start',W/2,H/2-20);
  ctx.font='16px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.65)';
  ctx.fillText('Har 10 pipes = next level!',W/2,H/2+20);
  if(best>0){ ctx.font='bold 20px sans-serif'; ctx.fillStyle='#FFD700'; ctx.fillText('Best: '+best,W/2,H/2+65); }
  ctx.textAlign='left';
}

function drawDead(){
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  if(lives<=0){
    ctx.fillStyle='#ff6b6b'; ctx.font='bold 50px sans-serif'; ctx.fillText('Game Over!',W/2,H/2-70);
    ctx.fillStyle='#fff'; ctx.font='26px sans-serif';
    ctx.fillText('Score: '+score,W/2,H/2-20);
    ctx.fillText('Level: '+level,W/2,H/2+18);
    ctx.fillStyle='#FFD700'; ctx.font='bold 24px sans-serif';
    ctx.fillText('Best: '+best,W/2,H/2+60);
    ctx.font='16px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.65)';
    ctx.fillText('Click to restart',W/2,H/2+100);
  } else {
    ctx.fillStyle='#fff'; ctx.font='bold 40px sans-serif'; ctx.fillText('Oops!',W/2,H/2-40);
    ctx.font='24px sans-serif'; ctx.fillText(lives+' lives bache hain',W/2,H/2+10);
    ctx.font='16px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fillText('Click to continue',W/2,H/2+55);
  }
  ctx.textAlign='left';
}

function draw(){
  drawBG();
  pipes.forEach(drawPipe);
  drawBird();
  for(const p of particles){
    ctx.globalAlpha=p.life/40; ctx.fillStyle=p.col;
    ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  if(state==='play'){ drawHUDCanvas(); drawLevelBanner(); }
  if(state==='start') drawStart();
  if(state==='dead')  drawDead();
}

function loop(){ update(); draw(); requestAnimationFrame(loop); }

// ── MIC POPUP FUNCTIONS ──────────────────────────────────────
function showScr(id){
  ['scrRequest','scrListening','scrDenied'].forEach(s=>{
    document.getElementById(s).style.display = s===id?'block':'none';
  });
}

async function requestMic(){
  const btn=document.getElementById('allowBtn');
  btn.disabled=true; btn.textContent='⏳ Intezaar karo...';
  try{
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ac  = getAC();
    const src = ac.createMediaStreamSource(micStream);
    analyser  = ac.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    micActive = true;
    document.getElementById('micEmoji').textContent='✅';
    document.getElementById('micStatus').textContent='🎤 ON';
    document.getElementById('micStatus').classList.add('on');
    showScr('scrListening');
    runVolMeter();
  }catch(e){
    document.getElementById('micEmoji').textContent='❌';
    showScr('scrDenied');
    btn.disabled=false; btn.textContent='🎤 Mic Allow Karo';
  }
}

function runVolMeter(){
  function tick(){
    if(!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    let sum=0; for(let i=0;i<dataArray.length;i++) sum+=dataArray[i];
    const vol=sum/dataArray.length;
    const pct=Math.min(Math.round(vol*3),100);
    const loud=vol>VOL_THRESHOLD;
    document.getElementById('volFill').style.width=pct+'%';
    document.getElementById('volFill').style.background=loud?'#FFD700':'#43a047';
    document.getElementById('volPct').textContent=pct+'%';
    document.getElementById('dot').className='dot '+(loud?'loud':'on');
    document.getElementById('statusTxt').textContent=loud?'🎤 Awaaz detect! Bird upar!':'Awaaz ka intezaar hai...';
    requestAnimationFrame(tick);
  }
  tick();
}

function closePopup(){
  popupDone=true;
  document.getElementById('micOverlay').classList.add('hide');
  document.getElementById('msg').textContent='🎤 Awaaz do — bird upar jayega!';
  if(state==='start'){ state='play'; }
}

function skipMic(){
  popupDone=true;
  document.getElementById('micOverlay').classList.add('hide');
  document.getElementById('msg').textContent='Click / Space / Tap to flap!';
}

function stopMicBtn(){
  if(micStream) micStream.getTracks().forEach(t=>t.stop());
  micActive=false; analyser=null; micStream=null;
  document.getElementById('micEmoji').textContent='🎤';
  document.getElementById('micStatus').textContent='🎤 OFF';
  document.getElementById('micStatus').classList.remove('on');
  showScr('scrRequest');
  const btn=document.getElementById('allowBtn');
  btn.disabled=false; btn.textContent='🎤 Mic Allow Karo';
}

// ── Start ────────────────────────────────────────────────────
initGame();
loop();
