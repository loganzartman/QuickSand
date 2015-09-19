var Universe = {
	w: 500,
	h: 300,
	time: 0,
	particles: null,
	temp: null,
	typeMap: {},
	typeArr: null,
	selected: "sand",
	createSize: 8,

	//when adding/removing baked-in props, make sure to update Universe.setPosType
	propMap: {
		"type": 0,
		"moved": 1,
		"sleeping": 2,
		"vel": 3
	},
	propArr: null,
	nProperties: 0,
	nHardProps: 4,

	init: function() {
		Universe.nProperties = (Game.particleData["properties"].length + Universe.nHardProps); //need type and moved also

		//construct particles array
		Universe.particles = new Uint8Array(Universe.w*Universe.h*(Universe.nProperties));
		Universe.temp = new Uint8Array(Universe.nProperties);

		//prepare type->int map
		var typeIndex = 0;
		for (var type in Game.particleData["types"]) {
			if (Game.particleData["types"].hasOwnProperty(type)) {
				if (!Universe.typeMap.hasOwnProperty(type)) {
					Universe.typeMap[type] = typeIndex++;
				}
			}
		}
		Universe.typeArr = Object.keys(Universe.typeMap);

		//prepare prop->int map
		for (var i=0; i<Game.particleData["properties"].length; i++) {
			Universe.propMap[Game.particleData["properties"][i]] = i + Universe.nHardProps;
		}
		Universe.propArr = Object.keys(Universe.propMap);

		Universe.clearAll();
	},

	step: function() {
		Universe.time++;

		// Universe.quickfill(Universe.w*0.5-32,0,64,1,"sand");

		if (Mouse.down) {
			//rainbow colors
			var h=(Universe.time*3)%360,s=0.7,l=0.4;
			switch (Universe.selected) {
				case "sand":
					s = 0.7;
					l = 0.4;
				break;
				case "silt":
					s = 0.1;
					l = 0.6;
				break;
			}
			var rgb = Util.hslToRgb(h, s, l);
			var colors = {
				"r": rgb[0],
				"g": rgb[1],
				"b": rgb[2]
			};

			//make particles
			Util.applyLine(Mouse.lx, Mouse.ly, Mouse.x+1, Mouse.y+1, function(x,y){
				Universe.quickfill(x-Universe.createSize*0.5, y-Universe.createSize*0.5, Universe.createSize, Universe.createSize, Universe.selected, Universe.selected==="sand"||Universe.selected==="silt"?colors:undefined);
			}, 2);
		}
		Mouse.lx = Mouse.x;
		Mouse.ly = Mouse.y;

		//mark all particles as not updated
		for (var i=Universe.w*Universe.h-1; i>=0; i--) {
			Universe.particles[i*Universe.nProperties+Universe.propMap["moved"]] = 0;
		}

		//update all particles
		var idx, flipflop = 0;
		for (var y=Universe.h-1; y>=0; y--) {
			for (var bx=0; bx<Universe.w; bx++) {
				var x = Math.abs(flipflop - bx);
				idx = Universe.index(x,y);

				//life
				if (Universe.particles[idx + Universe.propMap["life"]] > 0) {
					if (--Universe.particles[idx + Universe.propMap["life"]] <= 0) {
						Universe.setPosType(x, y, "air");
						continue;
					}
				}

				//check to make sure particle hasn't been updated yet
				if (Universe.particles[idx+Universe.propMap["moved"]] === 0) {
					//mark the particle as updated
					// Universe.particles[idx+Universe.propMap["moved"]] = 1;

					//simulate physics-enabled particles
					if (Universe.particles[idx+Universe.propMap["physics"]] === 1 && !Universe.isSleeping(idx)) {
						var nx = x, ny = y; //when particles move more than once, we need to store position
						var vel = Universe.getVel(idx);
						Universe.setVel(idx, vel=Math.min(signedbyte(Universe.particles[idx+Universe.propMap["vmax"]]),vel+1));
						for (var z=Math.abs(Universe.getVel(idx)); z>=0; z--) {
							idx = Universe.index(nx,ny);

							//propagate fire
							if (Universe.particles[idx] === Universe.typeMap["fire"]) {
								if (Universe.particles[idx + Universe.propMap["density"]] !== 1) {
									Universe.setPosType(nx, ny, "fire");
									break;
								}
								else {
									var uc = Universe.index(x, y-1),
										cl = Universe.index(x-1, y),
										cr = Universe.index(x+1, y),
										dc = Universe.index(x, y+1),
										flammable = Universe.propMap["flammable"],
										fire = Universe.typeMap["fire"];
									if (Universe.particles[uc + flammable] === 1) Universe.particles[uc] = fire;
									if (Universe.particles[cl + flammable] === 1) Universe.particles[cl] = fire;
									if (Universe.particles[cr + flammable] === 1) Universe.particles[cr] = fire;
									if (Universe.particles[dc + flammable] === 1) Universe.particles[dc] = fire;
								}
							}

							//fall down
							var fell = 1.0;
							var vdir = vel < 0 ? -1 : 1;
							if (Universe.tryMove(nx, ny, nx, ny+vdir)) {
								fell = 0.05;
								ny += vdir;
							}

							//randomly fall left or right
							if (FastRandom.next()<0.5*fell) {
								var dir = FastRandom.next()<0.5?-1:1;
								if (Universe.tryMove(nx, ny, nx-dir, ny+vdir)) {
									nx -= dir;
									ny += vdir;
								}
								else if (Universe.tryMove(nx, ny, nx+dir, ny+vdir)) {
									nx += dir;
									ny += vdir;
								}
								else if (Universe.isLiquid(idx)) {
									//liquid particles move randomly
									if (Universe.tryMove(nx, ny, nx-dir, ny)) {
										nx -= dir;
										if (Universe.tryMove(nx, ny, nx-dir, ny)) {
											nx -= dir;
										}
									}
									else if (Universe.tryMove(nx, ny, nx+dir, ny)) {
										nx += dir;
										if (Universe.tryMove(nx, ny, nx+dir, ny)) {
											nx += dir;
										}
									}
								}
							}
							else {
								// if (Universe.particles[idx] === Universe.typeMap["fire"]) {
								// 	Universe.setPosType(nx, ny, "air");
								// }
								Universe.setVel(idx, 0);
								if (Universe.particles[idx+Universe.propMap["solid"]] === 1) Universe.wake(idx);
							}
							if (Universe.particles[idx+Universe.propMap["solid"]] === 0) Universe.sleep(idx);
						}
					}
				}
			}
			flipflop = Universe.w-1-flipflop;
		}
		Display.update();
		requestAnimationFrame(Universe.step);
	},

	index: function(x, y) {
		x = Math.max(0, Math.min(Universe.w-1, x));
		y = Math.max(0, Math.min(Universe.h-1, y));
		return ((y*Universe.w)+x)*Universe.nProperties;
	},

	isLiquid: function(idx) {
		return Universe.particles[idx + Universe.propMap["liquid"]] === 1;
	},

	isSleeping: function(idx) {
		return Universe.particles[idx + Universe.propMap["sleeping"]] === 1;
	},

	setVel: function(idx, val) {
		return Universe.particles[idx + Universe.propMap["vel"]] = val;
	},

	getVel: function(idx) {
		return Universe.particles[idx + Universe.propMap["vel"]];
	},

	clearAll: function() {
		//clear particles array
		Universe.quickfill(0,0,Universe.w,Universe.h,"air");
		// for (var i=0; i<Universe.w*Universe.h; i++) {
		// 	Universe.setPosType(i%Universe.w, ~~(i/Universe.w), "air");
		// }
	},

	quickfill: function(x, y, w, h, type, props) {
		Universe.setPosType(x,y,type,props);
		var i, idx = Universe.index(x,y), np = Universe.nProperties-1;
		for (i=np; i>=0; i--) {
			Universe.temp[i] = Universe.particles[idx+i];
		}
		for (var xx=x; xx<x+w; xx++) {
			for (var yy=y; yy<y+h; yy++) {
				idx = Universe.index(xx, yy);
				for (i=np; i>=0; i--) {
					Universe.particles[idx+i] = Universe.temp[i];
				}
			}
		}
	},

	setBoxType: function(x, y, w, h, type, props) {
		if (typeof props !== "object") props = {};
		for (var xx=x; xx<x+w; xx++) {
			for (var yy=y; yy<y+h; yy++) {
				Universe.setPosType(xx,yy,type,props);
			}
		}
	},

	setPosType: function(x, y, type, props) {
		if (x<0 || y<0 || x>=Universe.w || y>=Universe.h) return;
		if (typeof props !== "object") props = {};
		var properties = {"type": Universe.typeMap[type], "moved": false, "sleeping": false, "vel": 0};
		var defaults = Game.particleData["types"][type];
		for (var prop in defaults) {
			if (props.hasOwnProperty(prop)) {
				properties[prop] = props[prop];
			}
			else if (defaults.hasOwnProperty(prop)) {
				properties[prop] = defaults[prop];
			}
		}
		Universe.setPos(x, y, properties);
	},

	setPos: function(x, y, props) {
		var i0 = Universe.index(x,y);
		Universe.wakeAround(x, y);
		var pkeys = Object.keys(props);
		for (var i=Universe.nProperties-1; i>=0; i--) {
			var val = typeof pkeys[i] === "undefined" ? 0 : pkeys[i];
			Universe.particles[i0 + i] = Number(props[val]);
		}
	},

	tryMove: function(x1, y1, x2, y2) {
		var i0 = Universe.index(x1, y1),
			i1 = Universe.index(x2, y2);
		var d0 = Universe.particles[i0 + Universe.propMap["density"]],
			d1 = Universe.particles[i1 + Universe.propMap["density"]];

		if (Universe.particles[i1 + Universe.propMap["solid"]] === 1) {
			if (d1 >= d0) {
				Universe.sleep(i0);
				return false;
			}
			else if (FastRandom.next() >= (d0-d1)*0.01) {
				return false;
			}
		}

		Universe.wakeAround(x1, y1);
		Universe.wakeAround(x2, y2);
		Universe.particles[i0 + Universe.propMap["moved"]] = 1;
		Universe.swap(i0, i1);
		return true;
	},

	sleep: function(idx) {
		Universe.particles[idx + Universe.propMap["sleeping"]] = 1;
	},

	wake: function(idx) {
		Universe.particles[idx + Universe.propMap["sleeping"]] = 0;
	},

	wakeAround: function(x, y) {
		Universe.setNearby(x, y, Universe.propMap["sleeping"], 0);
	},

	setNearby: function(x, y, propOffset, val) {
		var ul = Universe.index(x-1, y-1),
			uc = Universe.index(x, y-1),
			ur = Universe.index(x+1, y-1),
			cl = Universe.index(x-1, y),
			cr = Universe.index(x+1, y),
			dl = Universe.index(x-1, y+1),
			dc = Universe.index(x, y+1),
			dr = Universe.index(x+1, y+1);
		Universe.particles[ul + propOffset] = val;
		Universe.particles[uc + propOffset] = val;
		Universe.particles[ur + propOffset] = val;
		Universe.particles[cl + propOffset] = val;
		Universe.particles[cr + propOffset] = val;
		Universe.particles[dl + propOffset] = val;
		Universe.particles[dc + propOffset] = val;
		Universe.particles[dr + propOffset] = val;
	},

	swap: function(i0, i1) {
		var i = Universe.nProperties;
		while (i--) {
			Universe.temp[i] = Universe.particles[i0+i];
			Universe.particles[i0+i] = Universe.particles[i1+i];
			Universe.particles[i1+i] = Universe.temp[i];
		}
	}
};

var signedbyte = function(x) {
	if (x < 128) return x;
	return -254+x;
};
