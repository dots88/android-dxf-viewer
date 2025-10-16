(function(){
	'use strict';

	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	const info = document.getElementById('info');
	const layersDiv = document.getElementById('layers');
	const zoomInBtn = document.getElementById('zoomIn');
	const zoomOutBtn = document.getElementById('zoomOut');
	const resetBtn = document.getElementById('reset');

	let entities = []; // {type:'LINE', x1,y1,x2,y2, layer}
	let layerVisibility = new Map();
	let view = { scale: 1, tx: 0, ty: 0 };
	let bbox = { minX:0, minY:0, maxX:1, maxY:1 };
	let isPanning = false;
	let lastPan = { x:0, y:0 };

	function resize(){
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight - document.getElementById('toolbar').offsetHeight;
		render();
	}
	window.addEventListener('resize', resize);
	resize();

	canvas.addEventListener('mousedown', e => { isPanning = true; lastPan = {x:e.clientX, y:e.clientY}; });
	canvas.addEventListener('mousemove', e => {
		if(!isPanning) return;
		const dx = e.clientX - lastPan.x; const dy = e.clientY - lastPan.y;
		lastPan = {x:e.clientX, y:e.clientY};
		view.tx += dx; view.ty += dy; render();
	});
	canvas.addEventListener('mouseup', () => { isPanning = false; });
	canvas.addEventListener('mouseleave', () => { isPanning = false; });
	canvas.addEventListener('wheel', e => {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.1 : 0.9;
		zoomAt(e.clientX, e.clientY, factor);
	}, { passive:false });

	zoomInBtn.addEventListener('click', () => zoomAt(canvas.width/2, canvas.height/2, 1.2));
	zoomOutBtn.addEventListener('click', () => zoomAt(canvas.width/2, canvas.height/2, 0.8));
	resetBtn.addEventListener('click', fitToExtents);

	function zoomAt(cx, cy, factor){
		const x = (cx - view.tx)/view.scale;
		const y = (cy - view.ty)/view.scale;
		view.scale *= factor;
		view.tx = cx - x*view.scale;
		view.ty = cy - y*view.scale;
		render();
	}

	function fitToExtents(){
		const w = bbox.maxX - bbox.minX;
		const h = bbox.maxY - bbox.minY;
		if(w <= 0 || h <= 0){ view.scale = 1; view.tx = 0; view.ty = 0; render(); return; }
		const sx = canvas.width / w; const sy = canvas.height / h;
		view.scale = Math.min(sx, sy) * 0.9;
		const cx = (bbox.minX + bbox.maxX) / 2;
		const cy = (bbox.minY + bbox.maxY) / 2;
		view.tx = canvas.width/2 - cx*view.scale;
		view.ty = canvas.height/2 + cy*view.scale; // flip Y
		render();
	}

	function updateLayersUI(){
		layersDiv.innerHTML = '';
		Array.from(layerVisibility.keys()).sort().forEach(layer => {
			const label = document.createElement('label');
			label.style.marginRight = '12px';
			const cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = layerVisibility.get(layer);
			cb.addEventListener('change', () => { layerVisibility.set(layer, cb.checked); render(); });
			label.appendChild(cb);
			label.appendChild(document.createTextNode(' ' + layer));
			layersDiv.appendChild(label);
		});
	}

	function render(){
		ctx.setTransform(1,0,0,1,0,0);
		ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,canvas.width,canvas.height);
		ctx.setTransform(view.scale, 0, 0, -view.scale, view.tx, view.ty);
		ctx.lineWidth = 1 / view.scale;
		ctx.strokeStyle = '#e0e0e0';
		for(const e of entities){
			if(e.type === 'LINE'){
				if(!layerVisibility.get(e.layer)) continue;
				ctx.beginPath();
				ctx.moveTo(e.x1, e.y1);
				ctx.lineTo(e.x2, e.y2);
				ctx.stroke();
			}
		}
	}

	function parseDXF(text){
		const lines = text.split(/\r?\n/);
		let i = 0; let section = '';
		entities = []; layerVisibility.clear();
		bbox = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
		function readPair(){
			if(i+1 >= lines.length) return null;
			const code = lines[i++].trim();
			const value = lines[i++];
			return { code: parseInt(code, 10), value };
		}
		while(true){
			const pair = readPair(); if(!pair) break;
			if(pair.code === 0 && pair.value.trim() === 'SECTION'){
				const name = readUntil(2);
				section = name.trim();
			}else if(pair.code === 0 && pair.value.trim() === 'ENDSEC'){
				section = '';
			}else if(section === 'ENTITIES' && pair.code === 0){
				const type = pair.value.trim();
				if(type === 'LINE') readLineEntity(); else skipEntity();
			}
		}
		if(!isFinite(bbox.minX)) bbox = {minX:0,minY:0,maxX:1,maxY:1};
		updateLayersUI();
		fitToExtents();

		function readUntil(targetCode){
			while(true){ const p = readPair(); if(!p) return ''; if(p.code === targetCode) return p.value; }
		}
		function skipEntity(){
			// read pairs until next 0 or ENDSEC (simplified)
			while(true){
				const pos = i;
				const p = readPair(); if(!p) return;
				if(p.code === 0){ i = pos; return; }
			}
		}
		function readLineEntity(){
			let x1=0,y1=0,x2=0,y2=0, layer='0';
			while(true){
				const pos = i;
				const p = readPair(); if(!p) break;
				if(p.code === 0){ i = pos; break; }
				switch(p.code){
					case 8: layer = p.value.trim(); break;
					case 10: x1 = parseFloat(p.value); break;
					case 20: y1 = parseFloat(p.value); break;
					case 11: x2 = parseFloat(p.value); break;
					case 21: y2 = parseFloat(p.value); break;
				}
			}
			entities.push({type:'LINE', x1,y1,x2,y2, layer});
			layerVisibility.set(layer, layerVisibility.get(layer) ?? true);
			bbox.minX = Math.min(bbox.minX, x1, x2);
			bbox.minY = Math.min(bbox.minY, y1, y2);
			bbox.maxX = Math.max(bbox.maxX, x1, x2);
			bbox.maxY = Math.max(bbox.maxY, y1, y2);
		}
	}

	window.loadDxfBase64 = function(b64){
		try{
			const text = atob(b64);
			info.textContent = 'Loaded ' + (text.length/1024).toFixed(1) + ' KB';
			parseDXF(text);
		}catch(e){
			info.textContent = 'Failed to load DXF';
			console.error(e);
		}
	}
})();
