// Aklımda: nokta bulutundan anatomik 3D beyin + çevresinde notlar.
// Parmakla/fareyle 360° çevrilir, iki parmakla ya da tekerlekle yakınlaşır. Dokunulmazsa yavaşça kendi döner.
import * as THREE from '../vendor/three.module.min.js';

// ---------- Gürültü (Perlin 3D) ----------
const perm = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + t * (b - a);
function grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u),
    lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
  lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u),
    lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
// Kıvrımlar (gyri) için "ridged" gürültü: sırtlarda 1, oluklarda (sulci) 0'a yakın
function ridged(x, y, z) {
  let sum = 0, amp = 0.6, f = 1;
  for (let o = 0; o < 3; o++) { sum += amp * (1 - Math.abs(noise(x * f, y * f, z * f))) ** 2; amp *= 0.45; f *= 2.1; }
  return Math.min(1, sum / 0.9);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Beyin şekli ----------
function fib(i, n) {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.399963229728653;
  return [Math.cos(th) * r, y, Math.sin(th) * r];
}
function randDir() {
  const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  return [Math.cos(a) * r, u, Math.sin(a) * r];
}
// Yan profil: alt kenar ortada (şakak lobu) aşağı sarkar, önde ve arkada yükselir
const lowerScale = (z) => 0.5 + 0.42 * Math.exp(-(((z - 0.08) / 0.42) ** 2));

function cerebrumPoint(dx, dy, dz) {
  let x = dx * 0.7, y = dy * 0.64, z = dz * 1.0;
  if (y < 0) y *= lowerScale(z); else y *= 0.96 - 0.08 * Math.max(0, -z); // arka üst biraz basık
  x *= 1 - 0.12 * Math.max(0, z) - 0.06 * Math.max(0, -z - 0.5);          // ön ve arka uç daralır
  const fissure = Math.exp(-((x / 0.05) ** 2)) * Math.min(1, Math.max(0, (y + 0.05) / 0.3));
  const k = 1 - 0.18 * fissure;                                            // yarım küreler arası yarık
  x *= k; y *= k; z *= k;
  // Yan yarık (Sylvian): şakak lobunu ayıran eğik oluk
  const sy = -0.04 + 0.32 * (z - 0.05);
  const sylv = Math.abs(x) > 0.28 && z > -0.35 && z < 0.5 ? Math.exp(-(((y - sy) / 0.035) ** 2)) : 0;
  return { x, y, z, fissure, sylv };
}

function buildBrain(count) {
  const pos = [], bright = [], surface = [];
  const push = (x, y, z, b) => { pos.push(x, y, z); bright.push(b); };

  // Beyin kabuğu: kıvrımların (gyri) sırtları yoğun ve parlak, olukları (sulci) seyrek ve koyu
  const target = Math.floor(count * 0.8);
  let made = 0, guard = 0;
  while (made < target && guard++ < target * 6) {
    const [dx, dy, dz] = randDir();
    const c = cerebrumPoint(dx, dy, dz);
    const n = ridged(c.x * 6.2 + 3, c.y * 6.2, c.z * 6.2);
    const keep = 0.05 + 0.95 * n ** 3.2;
    if (Math.random() > keep * (1 - 0.8 * c.sylv)) continue;
    const d = (n - 0.6) * 0.085 - 0.05 * c.sylv;
    const len = Math.hypot(c.x, c.y, c.z) || 1;
    const x = c.x + (c.x / len) * d, y = c.y + (c.y / len) * d, z = c.z + (c.z / len) * d;
    push(x, y, z, (0.18 + 0.82 * n ** 1.6) * (1 - 0.7 * c.fissure));
    made++;
    if (made % 9 === 0 && y > -0.05) surface.push([x, y, z]);
  }

  // Beyincik: arka altta, ince yatay yapraklar
  const nb = Math.floor(count * 0.14);
  for (let i = 0; i < nb; i++) {
    const [dx, dy, dz] = randDir();
    const x = dx * 0.46, y = -0.36 + dy * 0.2, z = -0.62 + dz * 0.3;
    const inside = cerebrumPoint(x / 0.7, y / 0.64, z);
    if (dy > 0.3 && Math.hypot(inside.x, inside.y, inside.z) > 0.95 * Math.hypot(x, y, z)) continue;
    const leaf = Math.abs(Math.sin((y + dz * 0.15) * 95));
    if (Math.random() > 0.25 + 0.75 * leaf ** 2) continue;
    push(x, y, z, 0.3 + 0.55 * leaf ** 2);
  }

  // Beyin sapı
  const ns = Math.floor(count * 0.05);
  for (let i = 0; i < ns; i++) {
    const t = Math.random(), a = Math.random() * Math.PI * 2, r = 0.12 - t * 0.03;
    push(Math.cos(a) * r, -0.28 - t * 0.6, -0.2 - t * 0.2 + Math.sin(a) * r * 0.8, 0.3 + 0.3 * Math.random());
  }
  return { pos: new Float32Array(pos), bright: new Float32Array(bright), surface };
}

const VERT = `
  attribute float b;
  uniform float uSize, uTime, uPR;
  varying float vB, vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float scanY = mod(uTime * 0.22, 2.2) - 1.1;
    float scan = smoothstep(0.07, 0.0, abs(position.y - scanY));
    vB = b * (0.9 + 0.1 * sin(uTime * 1.3 + position.x * 9.0 + position.z * 7.0)) + scan * 0.35;
    vDepth = -mv.z;
    gl_PointSize = uSize * uPR * (3.6 / -mv.z);
  }`;
const FRAG = `
  varying float vB, vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    float fog = clamp(1.35 - (vDepth - 3.3) * 0.95, 0.18, 1.0);  // arka taraf soluk: derinlik hissi
    gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * vB, a * vB * fog);
  }`;

// ---------- Sahne ----------
export function mountBrain(stage, { onPick } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return null;
  }
  const small = Math.min(innerWidth, innerHeight) < 600;
  const pr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.domElement.className = 'b3-canvas';
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  let dist = 4.0;
  const root = new THREE.Group();
  root.rotation.set(0.12, -0.9, 0);
  scene.add(root);

  const data = buildBrain(small ? 30000 : 42000);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  geo.setAttribute('b', new THREE.BufferAttribute(data.bright, 1));
  const uniforms = { uSize: { value: small ? 2.6 : 2.9 }, uTime: { value: 0 }, uPR: { value: pr } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(new THREE.Points(geo, mat));

  // Not düğümleri: yüzeyde parlayan nokta + dışarı uzanan çizgi + HTML etiket
  const nodeGeo = new THREE.BufferGeometry();
  const nodeMat = new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  const lineGeo = new THREE.BufferGeometry();
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x9aa4b2, transparent: true, opacity: 0.35 }));
  root.add(nodes, lines);

  const layer = document.createElement('div');
  layer.className = 'b3-labels';
  stage.appendChild(layer);
  let items = [];   // { id, el, tip: Vector3 }
  let selected = null;

  function hash(n) { let h = 2166136261; for (const c of String(n)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  function setNotes(list) {
    layer.innerHTML = '';
    const shown = list.slice(0, 16);
    const npos = [], ncol = [], lpos = [];
    items = shown.map((n, i) => {
      // Her not beynin belli bir noktasına "bağlanır" (id'ye göre sabit), etiketi o yönde dışarıda durur
      const s = data.surface[hash(n.id) % data.surface.length];
      const dir = new THREE.Vector3(...s).normalize();
      const tip = dir.clone().multiplyScalar(1.22 + (i % 3) * 0.12);
      tip.y = tip.y * 0.55 + 0.05;
      const late = !!n.late;
      npos.push(...s);
      const c = late ? [0.96, 0.62, 0.04] : [0.2, 0.83, 0.6];
      ncol.push(...c);
      lpos.push(...s, tip.x, tip.y, tip.z);
      const el = document.createElement('button');
      el.className = 'b3-label' + (late ? ' late' : '') + (selected === n.id ? ' sel' : '');
      el.textContent = n.text.length > 26 ? n.text.slice(0, 25) + '…' : n.text;
      el.addEventListener('click', (e) => { e.stopPropagation(); selected = n.id; onPick && onPick(n.id); highlight(); });
      layer.appendChild(el);
      return { id: n.id, el, tip, width: 0 };
    });
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
    nodeGeo.setAttribute('color', new THREE.Float32BufferAttribute(ncol, 3));
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    nodeGeo.computeBoundingSphere(); lineGeo.computeBoundingSphere();
  }
  function highlight() { items.forEach((it) => it.el.classList.toggle('sel', it.id === selected)); }
  function select(id) { selected = id; highlight(); }

  // ---------- Kontroller: sürükle döndür, sıkıştır/tekerlek yakınlaş ----------
  let rotY = root.rotation.y, rotX = root.rotation.x, vy = 0, vx = 0, lastInput = 0;
  const pointers = new Map();
  let pinch = 0;
  const cv = renderer.domElement;
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); lastInput = performance.now(); });
  cv.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    lastInput = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) dist = Math.min(7, Math.max(2.8, dist * (pinch / d)));
      pinch = d;
      return;
    }
    vy = (e.clientX - px) * 0.009; vx = (e.clientY - py) * 0.006;
    rotY += vy; rotX = Math.min(1.1, Math.max(-1.1, rotX + vx));
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(7, Math.max(2.8, dist * (1 + e.deltaY * 0.001))); lastInput = performance.now(); }, { passive: false });

  // ---------- Döngü ----------
  let w = 0, h = 0, running = false, raf = 0, t0 = performance.now(), prev = t0;
  const v = new THREE.Vector3();
  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (!pointers.size) {
      vy *= 0.94; vx *= 0.9; rotY += vy; rotX = Math.min(1.1, Math.max(-1.1, rotX + vx));
      if (now - lastInput > 2500) { rotY += dt * 0.16; rotX += (0.12 - rotX) * dt * 0.6; }
    }
    root.rotation.set(rotX, rotY, 0);
    camera.position.set(0, 0.05, dist);
    camera.lookAt(0, -0.05, 0);
    uniforms.uTime.value = (now - t0) / 1000;
    renderer.render(scene, camera);

    // Etiketleri ekrana yansıt; arkada kalanları soluklaştır
    root.updateMatrixWorld();
    const placed = [];
    for (const it of items) {
      v.copy(it.tip).applyMatrix4(root.matrixWorld);
      const behind = v.z < -0.25;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      // Etiket, noktanın dışa bakan tarafına yazılır ve sahnenin içinde kalır (üstte başlık alanı boş)
      const ew = it.width || (it.width = it.el.offsetWidth);
      const lx = Math.min(w - ew - 8, Math.max(8, v.x < 0 ? x - ew - 6 : x + 6));
      let ly = Math.min(h - 40, Math.max(76, y));
      // Aynı hizadaki etiketler üst üste binmesin: aşağı kaydır
      if (!behind) {
        for (const r of placed) if (lx < r.x + r.w && r.x < lx + ew && Math.abs(ly - r.y) < 26) ly = r.y + 26;
        placed.push({ x: lx, y: ly, w: ew });
      }
      it.el.style.transform = `translate(${lx}px, ${ly}px) translate(0, -50%)`;
      it.el.style.opacity = behind ? 0.28 : 1;
      it.el.style.zIndex = behind ? 1 : 2;
      it.el.style.pointerEvents = behind ? 'none' : 'auto';
    }
  }
  function setVisible(on) {
    if (on && !running) { running = true; resize(); prev = performance.now(); raf = requestAnimationFrame(frame); }
    if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) setVisible(false); });

  return { setNotes, setVisible, select };
}
