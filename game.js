window.addEventListener("load", function(){
	Util.loadJSON("particles.json", function(data){
		Game.particleData = data;
		Game.start();
	}); 
}, false);

var Game = {
	particleData: null,
	start: function() {
		FastRandom.init(2048);
		Universe.init();
		Display.init();

		var selector = document.createElement("select");
		for (var i=0; i<Universe.typeArr.length; i++) {
			var opt = document.createElement("option");
			opt.value = Universe.typeArr[i];
			opt.innerHTML = Universe.typeArr[i];
			selector.appendChild(opt);
		}
		selector.addEventListener("change", function(event){
			Universe.selected = Universe.typeArr[selector.selectedIndex];
		}, false);
		selector.selectedIndex = Universe.typeMap[Universe.selected];
		Display.container.appendChild(selector);

		var clearBtn = document.createElement("button");
		clearBtn.innerHTML = "clear all";
		clearBtn.addEventListener("click", Universe.clearAll, false);
		Display.container.appendChild(clearBtn);

		var dmode = document.createElement("select");
		for (var i=0; i<Display.modes.length; i++) {
			var opt = document.createElement("option");
			opt.value = Display.modes[i];
			opt.innerHTML = Display.modes[i];
			dmode.appendChild(opt);
		}
		dmode.addEventListener("change", function(event){
			Display.mode = Display.modes[dmode.selectedIndex];
		}, false);
		dmode.selectedIndex = Display.modes[0];
		Display.container.appendChild(dmode);

		setInterval(Universe.step, 1000/60);

		Display.canvas.addEventListener("mousedown", function(event){
			event.preventDefault();
			Mouse.down = true;
		}, false);
		Display.container.addEventListener("mousemove", function(event){
			event.preventDefault();
			var ol = Display.canvas.offsetLeft + Display.container.offsetLeft,
				ot = Display.canvas.offsetTop + Display.container.offsetTop;
			Mouse.x = ~~((event.pageX - ol) / Display.scale);
			Mouse.y = ~~((event.pageY - ot) / Display.scale);
		}, false);
		document.addEventListener("mouseup", function(event){
			Mouse.down = false;
		}, false);
	}
};

var Mouse = {
	x: 0,
	y: 0,
	lx: 0,
	ly: 0,
	down: false
};

var Util = {
	loadJSON: function(url, callback) {
		var req = new XMLHttpRequest();
		req.onload = function() {
			if (req.status === 200 && req.responseText) {
				var json = JSON.parse(req.responseText);
				callback(json);
			}
		};
		req.open("GET", url+"?"+Date.now(), true);
		try {
			if (url === "") callback(false);
			req.send();
		}
		catch (error) {
			callback(false);
		}
	},

	applyLine: function(x1,y1,x2,y2,callback,resolution) {
	    var resolution = resolution||1;
	    var dX,dY,iSteps;
	    var xInc,yInc,iCount,x,y;

	    dX = x1 - x2;
	    dY = y1 - y2;

	    if (Math.abs(dX) > Math.abs(dY)) {
	        iSteps = Math.abs(dX);
	    }
	    else {
	        iSteps = Math.abs(dY);
	    }

	    xInc = dX/(iSteps/resolution);
	    yInc = dY/(iSteps/resolution);
	    x = x1;
	    y = y1;

	    for (iCount=1; iCount<=iSteps; iCount+=resolution) {
	        callback(Math.floor(x),Math.floor(y));
	        x -= xInc;
	        y -= yInc;
	    }
	},

	hue2rgb: function(v1, v2, vH) {
		if (vH < 0) {
			vH += 1;
		} else if (vH > 1) {
			vH -= 1;
		}
		if ((6 * vH) < 1) {
			return (v1 + (v2 - v1) * 6 * vH);
		} else if (2 * vH < 1) {
			return v2;
		} else if (3 * vH < 2) {
			return (v1 + (v2 - v1) * ((2 / 3) - vH) * 6);
		}
		return v1;
	},

	hslToRgb: function(h, s, l) {
		var r = 0;
		var g = 0;
		var b = 0;
		var normH = h / 360; // normalize h to fall in [0, 1]

		if (s == 0) {
			r = g = b = l * 255;
		} else {
			var temp1 = 0;
			var temp2 = 0;
			if (l < 0.5) {
				temp2 = l * (1 + s);
			} else {
				temp2 = l + s - (s * l);
			}
			temp1 = 2 * l - temp2;
			r = 255 * Util.hue2rgb(temp1, temp2, normH + (1 / 3));
			g = 255 * Util.hue2rgb(temp1, temp2, normH);
			b = 255 * Util.hue2rgb(temp1, temp2, normH - (1 / 3));
		}

		return [Math.round(r), Math.round(g), Math.round(b)];
	}
};

var FastRandom = {
	randoms: [],
	_idx: 0,
	init: function(len) {
		FastRandom.len = len;
		for (var i=0; i<len; i++) {
			FastRandom.randoms.push(Math.random());
		}
	},
	next: function() {
		if (++FastRandom._idx >= FastRandom.randoms.length) FastRandom._idx = 0;
		return FastRandom.randoms[FastRandom._idx];
	}
};