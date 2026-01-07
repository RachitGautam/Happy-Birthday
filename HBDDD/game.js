const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const uiEl = document.getElementById("ui");
const dlgEl = document.getElementById("dialogue");
const dlgName = document.getElementById("dialogueName");
const dlgText = document.getElementById("dialogueText");

function resize() {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- Tilemap (0=grass, 1=wall, 2=water) ---
const TILE = 16;          // base pixel size
const SCALE = 3;          // zoom (GBA-ish)
const TS = TILE * SCALE;  // drawn tile size

// Small map for now (edit freely)
const mapW = 28;
const mapH = 18;

// Border walls + some ponds + trees
const map = [];
for (let y = 0; y < mapH; y++) {
  const row = [];
  for (let x = 0; x < mapW; x++) {
    const border = (x === 0 || y === 0 || x === mapW - 1 || y === mapH - 1);
    let t = border ? 1 : 0;

    // ponds
    if ((x > 18 && x < 24 && y > 3 && y < 8) || (x > 5 && x < 9 && y > 10 && y < 14)) t = 2;

    // trees / rocks
    if ((x === 10 && y >= 3 && y <= 6) || (x === 11 && y === 6) || (x === 12 && y === 6)) t = 1;

    row.push(t);
  }
  map.push(row);
}

// Collision helper
function isBlocked(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return true;
  return map[ty][tx] === 1 || map[ty][tx] === 2;
}

// --- Entities ---
const player = {
  tx: 3, ty: 3,          // tile position
  facing: { x: 0, y: 1 }, // down
  moving: false,
  moveCooldown: 0
};

const npcs = [
  {
    name: "Jawaid",
    tx: 6, ty: 6,
    color: "#ff6b6b",
    lines: [
      "Oyeee! Happy Birthday!",
      "May your year be full of wins and good vibes.",
      "Now go talk to the others too!"
    ]
  },
  {
    name: "Ana",
    tx: 14, ty: 5,
    color: "#ffe66d",
    lines: [
      "Hello hello!",
      "Birthday wishes unlocked: +100 happiness.",
      "Stay awesome always!"
    ]
  },
  {
    name: "Rachit",
    tx: 20, ty: 12,
    color: "#00ff88",
    lines: [
      "Mission: Wish you the happiest birthday!",
      "Collect all wishes by talking to everyone.",
      "Party time!"
    ]
  }
];

// --- Dialogue state ---
const dialogue = {
  open: false,
  npc: null,
  index: 0
};

function openDialogue(npc) {
  dialogue.open = true;
  dialogue.npc = npc;
  dialogue.index = 0;
  dlgEl.style.display = "block";
  dlgName.textContent = npc.name;
  dlgText.textContent = npc.lines[0];
  uiEl.textContent = "Talking... (E/Enter to continue)";
}

function advanceDialogue() {
  if (!dialogue.open) return;
  dialogue.index++;
  if (dialogue.index >= dialogue.npc.lines.length) {
    dialogue.open = false;
    dialogue.npc = null;
    dlgEl.style.display = "none";
    uiEl.textContent = "Move: WASD/Arrows | Talk: E/Enter | Goal: Talk to everyone";
    return;
  }
  dlgText.textContent = dialogue.npc.lines[dialogue.index];
}

// --- Input ---
const keys = {};
window.addEventListener("keydown", (e) => {
  // prevent page scroll on arrows
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();

  if (!keys[e.code]) { // edge-trigger for interact
    if (e.code === "KeyE" || e.code === "Enter") {
      if (dialogue.open) advanceDialogue();
      else tryInteract();
    }
  }
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function npcAt(tx, ty) {
  return npcs.find(n => n.tx === tx && n.ty === ty) || null;
}

function tryInteract() {
  const fx = player.tx + player.facing.x;
  const fy = player.ty + player.facing.y;
  const npc = npcAt(fx, fy);
  if (npc) openDialogue(npc);
}

// --- Camera (simple: keep player centered) ---
function getCamera() {
  const viewW = Math.floor(window.innerWidth / TS);
  const viewH = Math.floor(window.innerHeight / TS);
  const camX = Math.floor(player.tx - viewW / 2);
  const camY = Math.floor(player.ty - viewH / 2);
  return { camX, camY, viewW, viewH };
}

// --- Movement (tile-step like GBA) ---
function update(dt) {
  if (dialogue.open) return;

  player.moveCooldown = Math.max(0, player.moveCooldown - dt);
  if (player.moveCooldown > 0) return;

  let dx = 0, dy = 0;

  if (keys["ArrowUp"] || keys["KeyW"]) dy = -1;
  else if (keys["ArrowDown"] || keys["KeyS"]) dy = 1;
  else if (keys["ArrowLeft"] || keys["KeyA"]) dx = -1;
  else if (keys["ArrowRight"] || keys["KeyD"]) dx = 1;

  if (dx === 0 && dy === 0) return;

  player.facing = { x: dx, y: dy };

  const ntx = player.tx + dx;
  const nty = player.ty + dy;

  // block on walls/water or NPC tile
  if (isBlocked(ntx, nty)) return;
  if (npcAt(ntx, nty)) return;

  player.tx = ntx;
  player.ty = nty;
  player.moveCooldown = 110; // ms per step (tweak for speed)
}

// --- Rendering ---
function drawTile(t, x, y) {
  // x,y are screen pixels
  if (t === 0) { // grass
    ctx.fillStyle = "#2f8f4e";
    ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, TS, 2);
  } else if (t === 1) { // wall/tree
    ctx.fillStyle = "#1e3a2a";
    ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = "#2d6a45";
    ctx.fillRect(x + 4, y + 4, TS - 8, TS - 8);
  } else if (t === 2) { // water
    ctx.fillStyle = "#2b6cff";
    ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x, y + TS/2, TS, 2);
  }
}

function drawEntity(tx, ty, color) {
  const { camX, camY } = getCamera();
  const sx = (tx - camX) * TS;
  const sy = (ty - camY) * TS;

  // "pixel person" block
  ctx.fillStyle = color;
  ctx.fillRect(sx + TS*0.25, sy + TS*0.2, TS*0.5, TS*0.55);
  ctx.fillStyle = "#f5d7b2";
  ctx.fillRect(sx + TS*0.33, sy + TS*0.08, TS*0.34, TS*0.20);
}

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const { camX, camY, viewW, viewH } = getCamera();

  // draw visible tiles only
  for (let sy = 0; sy < viewH + 2; sy++) {
    for (let sx = 0; sx < viewW + 2; sx++) {
      const mx = camX + sx;
      const my = camY + sy;
      const screenX = sx * TS;
      const screenY = sy * TS;

      if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) {
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(screenX, screenY, TS, TS);
      } else {
        drawTile(map[my][mx], screenX, screenY);
      }
    }
  }

  // NPCs then player (or player then NPC depending on overlap rules)
  for (const n of npcs) drawEntity(n.tx, n.ty, n.color);
  drawEntity(player.tx, player.ty, "#ffffff");

  // Facing indicator (tiny dot)
  const fx = player.tx + player.facing.x;
  const fy = player.ty + player.facing.y;
  const { camX: cx, camY: cy } = getCamera();
  const dotX = (fx - cx) * TS + TS / 2;
  const dotY = (fy - cy) * TS + TS / 2;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fill();
}

// --- Game loop ---
let last = performance.now();
function loop(now) {
  const dt = now - last;
  last = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
