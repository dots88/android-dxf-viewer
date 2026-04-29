(function(){
'use strict';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const info   = document.getElementById('info');
const layersDiv  = document.getElementById('layers');
const zoomInBtn  = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetBtn   = document.getElementById('reset');

let entities = [];
let layerVisibility = new Map();
let view = { scale: 1, tx: 0, ty: 0 };
let bbox = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

// ── pan state ──────────────────────────────────────────────────────────────
let isPanning = false;
let lastPan   = { x: 0, y: 0 };

// ── pinch state ────────────────────────────────────────────────────────────
let lastPinchDist = 0;
let lastPinchMid  = { x: 0, y: 0 };

// ── resize ─────────────────────────────────────────────────────────────────
function resize() {
    const tb = document.getElementById('toolbar');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - tb.offsetHeight;
    render();
}
window.addEventListener('resize', resize);

// ── mouse ──────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
    isPanning = true;
    lastPan = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mousemove', e => {
    if (!isPanning) return;
    view.tx += e.clientX - lastPan.x;
    view.ty += e.clientY - lastPan.y;
    lastPan = { x: e.clientX, y: e.clientY };
    render();
});
canvas.addEventListener('mouseup',    () => { isPanning = false; });
canvas.addEventListener('mouseleave', () => { isPanning = false; });
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
}, { passive: false });

// ── touch ──────────────────────────────────────────────────────────────────
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isPanning = true;
        lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        isPanning = false;
        lastPinchDist = pinchDist(e.touches);
        lastPinchMid  = pinchMid(e.touches);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
        view.tx += e.touches[0].clientX - lastPan.x;
        view.ty += e.touches[0].clientY - lastPan.y;
        lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        render();
    } else if (e.touches.length === 2) {
        const d   = pinchDist(e.touches);
        const mid = pinchMid(e.touches);
        if (lastPinchDist > 0) zoomAt(mid.x, mid.y, d / lastPinchDist);
        lastPinchDist = d;
        lastPinchMid  = mid;
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    lastPinchDist = 0;
    if (e.touches.length === 1) {
        isPanning = true;
        lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 0) {
        isPanning = false;
    }
}, { passive: false });

function pinchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
}
function pinchMid(t) {
    return { x: (t[0].clientX + t[1].clientX) / 2,
             y: (t[0].clientY + t[1].clientY) / 2 };
}

// ── zoom buttons ───────────────────────────────────────────────────────────
zoomInBtn .addEventListener('click', () => zoomAt(canvas.width/2, canvas.height/2, 1.25));
zoomOutBtn.addEventListener('click', () => zoomAt(canvas.width/2, canvas.height/2, 0.8));
resetBtn  .addEventListener('click', fitToExtents);

function zoomAt(cx, cy, factor) {
    const wx = (cx - view.tx) / view.scale;
    const wy = (cy - view.ty) / view.scale;
    view.scale *= factor;
    view.tx = cx - wx * view.scale;
    view.ty = cy - wy * view.scale;
    render();
}

function fitToExtents() {
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    if (w <= 0 || h <= 0) { view = { scale:1, tx:0, ty:canvas.height }; render(); return; }
    const sx = canvas.width  / w;
    const sy = canvas.height / h;
    view.scale = Math.min(sx, sy) * 0.9;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    view.tx = canvas.width  / 2 - cx * view.scale;
    view.ty = canvas.height / 2 + cy * view.scale; // flip Y
    render();
}

// ── render ─────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;

function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Y-axis flipped: DXF Y-up maps to screen Y-down
    ctx.setTransform(view.scale, 0, 0, -view.scale, view.tx, view.ty);
    ctx.lineWidth   = 1 / view.scale;
    ctx.strokeStyle = '#e0e0e0';
    ctx.fillStyle   = '#e0e0e0';

    for (const e of entities) {
        if (!layerVisibility.get(e.layer)) continue;
        ctx.beginPath();
        switch (e.type) {
            case 'LINE':
                ctx.moveTo(e.x1, e.y1);
                ctx.lineTo(e.x2, e.y2);
                ctx.stroke();
                break;
            case 'CIRCLE':
                // arc() angles are in the transformed (Y-up) space: same as DXF degrees
                ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'ARC':
                // Under Y-flip, ctx.arc clockwise in screen = CCW in world = DXF convention
                ctx.arc(e.cx, e.cy, e.r, e.sa * DEG, e.ea * DEG);
                ctx.stroke();
                break;
            case 'LWPOLYLINE':
            case 'POLYLINE': {
                const pts = e.points;
                if (pts.length < 2) break;
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
                if (e.closed) ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'POINT':
                // draw a small cross
                ctx.arc(e.x, e.y, 2 / view.scale, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }
}

// ── layer UI ───────────────────────────────────────────────────────────────
function updateLayersUI() {
    layersDiv.innerHTML = '';
    Array.from(layerVisibility.keys()).sort().forEach(layer => {
        const label = document.createElement('label');
        const cb    = document.createElement('input');
        cb.type    = 'checkbox';
        cb.checked = layerVisibility.get(layer);
        cb.addEventListener('change', () => { layerVisibility.set(layer, cb.checked); render(); });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + (layer || '0')));
        layersDiv.appendChild(label);
    });
    resize(); // toolbar height may have changed
}

// ── bbox helpers ───────────────────────────────────────────────────────────
function expandBbox(x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < bbox.minX) bbox.minX = x;
    if (y < bbox.minY) bbox.minY = y;
    if (x > bbox.maxX) bbox.maxX = x;
    if (y > bbox.maxY) bbox.maxY = y;
}

// ── DXF parser ─────────────────────────────────────────────────────────────
function parseDXF(text) {
    const lines = text.split(/\r?\n/);
    let i = 0;

    entities = [];
    layerVisibility.clear();
    bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    function readPair() {
        while (i < lines.length && lines[i].trim() === '') i++;
        if (i + 1 >= lines.length) return null;
        const code  = parseInt(lines[i].trim(), 10);
        const value = lines[i + 1];
        i += 2;
        return { code, value };
    }

    function peek() {
        let j = i;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j + 1 >= lines.length) return null;
        return { code: parseInt(lines[j].trim(), 10), value: lines[j + 1] };
    }

    // reads group pairs calling cb(pair) until the next code-0 pair (leaves it unread)
    function readEntityPairs(cb) {
        while (true) {
            const next = peek();
            if (!next || next.code === 0) return;
            const p = readPair();
            if (p) cb(p);
        }
    }

    function setLayer(layer) {
        if (!layerVisibility.has(layer)) layerVisibility.set(layer, true);
    }

    function parseEntity(type) {
        if (type === 'LINE') {
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0, layer = '0';
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer = p.value.trim(); break;
                    case 10: x1 = parseFloat(p.value); break;
                    case 20: y1 = parseFloat(p.value); break;
                    case 11: x2 = parseFloat(p.value); break;
                    case 21: y2 = parseFloat(p.value); break;
                }
            });
            setLayer(layer);
            expandBbox(x1, y1); expandBbox(x2, y2);
            entities.push({ type: 'LINE', layer, x1, y1, x2, y2 });

        } else if (type === 'CIRCLE') {
            let cx = 0, cy = 0, r = 1, layer = '0';
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer = p.value.trim(); break;
                    case 10: cx = parseFloat(p.value); break;
                    case 20: cy = parseFloat(p.value); break;
                    case 40: r  = parseFloat(p.value); break;
                }
            });
            setLayer(layer);
            expandBbox(cx - r, cy - r); expandBbox(cx + r, cy + r);
            entities.push({ type: 'CIRCLE', layer, cx, cy, r });

        } else if (type === 'ARC') {
            let cx = 0, cy = 0, r = 1, sa = 0, ea = 360, layer = '0';
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer = p.value.trim(); break;
                    case 10: cx = parseFloat(p.value); break;
                    case 20: cy = parseFloat(p.value); break;
                    case 40: r  = parseFloat(p.value); break;
                    case 50: sa = parseFloat(p.value); break;
                    case 51: ea = parseFloat(p.value); break;
                }
            });
            setLayer(layer);
            expandBbox(cx - r, cy - r); expandBbox(cx + r, cy + r);
            entities.push({ type: 'ARC', layer, cx, cy, r, sa, ea });

        } else if (type === 'LWPOLYLINE') {
            let layer = '0', closed = false;
            const points = [];
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer  = p.value.trim(); break;
                    case 70: closed = (parseInt(p.value, 10) & 1) !== 0; break;
                    case 10: points.push({ x: parseFloat(p.value), y: 0 }); break;
                    case 20: if (points.length > 0) points[points.length - 1].y = parseFloat(p.value); break;
                }
            });
            setLayer(layer);
            for (const pt of points) expandBbox(pt.x, pt.y);
            if (points.length > 0) entities.push({ type: 'LWPOLYLINE', layer, points, closed });

        } else if (type === 'POLYLINE') {
            let layer = '0', closed = false;
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer  = p.value.trim(); break;
                    case 70: closed = (parseInt(p.value, 10) & 1) !== 0; break;
                }
            });
            setLayer(layer);
            const points = [];
            while (true) {
                const next = peek();
                if (!next) break;
                const t = next.value.trim();
                if (next.code === 0 && t === 'SEQEND') {
                    readPair();
                    readEntityPairs(() => {});
                    break;
                }
                if (next.code === 0 && t === 'VERTEX') {
                    readPair(); // consume "0\nVERTEX"
                    let vx = 0, vy = 0;
                    readEntityPairs(p => {
                        if (p.code === 10) vx = parseFloat(p.value);
                        if (p.code === 20) vy = parseFloat(p.value);
                    });
                    points.push({ x: vx, y: vy });
                    expandBbox(vx, vy);
                } else {
                    break;
                }
            }
            if (points.length > 0) entities.push({ type: 'POLYLINE', layer, points, closed });

        } else if (type === 'POINT') {
            let x = 0, y = 0, layer = '0';
            readEntityPairs(p => {
                switch (p.code) {
                    case  8: layer = p.value.trim(); break;
                    case 10: x = parseFloat(p.value); break;
                    case 20: y = parseFloat(p.value); break;
                }
            });
            setLayer(layer);
            expandBbox(x, y);
            entities.push({ type: 'POINT', layer, x, y });

        } else {
            readEntityPairs(() => {}); // skip unknown entity
        }
    }

    // main parse loop
    let section = '';
    while (true) {
        const p = readPair();
        if (!p) break;
        if (p.code === 0) {
            const t = p.value.trim();
            if (t === 'SECTION') {
                const n = readPair();
                if (n && n.code === 2) section = n.value.trim();
            } else if (t === 'ENDSEC') {
                section = '';
            } else if (section === 'ENTITIES') {
                parseEntity(t);
            }
        }
    }

    if (!isFinite(bbox.minX)) bbox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    updateLayersUI();
    fitToExtents();
}

// ── public API (called from Android via evaluateJavascript) ────────────────
window.loadDxfBase64 = function(b64) {
    info.textContent = 'Loading…';
    try {
        const raw   = atob(b64);
        const bytes = new Uint8Array(raw.length);
        for (let k = 0; k < raw.length; k++) bytes[k] = raw.charCodeAt(k);
        let text;
        try {
            text = new TextDecoder('utf-8').decode(bytes);
        } catch (_) {
            text = raw; // fallback: treat as Latin-1
        }
        parseDXF(text);
        info.textContent = (raw.length / 1024).toFixed(1) + ' KB · ' + entities.length + ' entities';
    } catch (e) {
        info.textContent = 'Error: ' + e.message;
        console.error(e);
    }
};

// initial sizing
resize();
})();
