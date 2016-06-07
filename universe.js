var Universe = {
	w: 400,
	h: 300,
	time: 0,
	particles: null,
	iProps: null,
	temp: null,
	typeMap: {},
	typeArr: null,
	selected: "sand",
	createSize: 6,

	//when adding/removing baked-in props, make sure to update Universe.setPosType
	ePropMap: {
		"type": 0,
		"moved": 1,
		"sleeping": 2,
		"vel": 3
	},
	ePropArr: null,
	iPropMap: {},
	iPropArr: null,
	niProperties: 0,
	neProperties: 0,
	nHardProps: 4,

	init: function() {
		Universe.niProperties = (Game.particleData["iproperties"].length); //INTENSIVE properties; common to all particles of a type
		Universe.neProperties = (Game.particleData["eproperties"].length + Universe.nHardProps); //EXTENSIVE properties; set on a per-particle basis

		//construct particles array
		Universe.particles = new Uint8Array(Universe.w*Universe.h*(Universe.neProperties));
		Universe.temp = new Uint8Array(Universe.neProperties);

		//prepare type string<->int maps
		var typeIndex = 0;
		for (var type in Game.particleData["types"]) {
			if (Game.particleData["types"].hasOwnProperty(type)) {
				if (!Universe.typeMap.hasOwnProperty(type)) {
					Universe.typeMap[type] = typeIndex++;
				}
			}
		}
		Universe.typeArr = Object.keys(Universe.typeMap);

		//prepare prop string<->int maps
		for (var i=0; i<Game.particleData["eproperties"].length; i++) {
			Universe.ePropMap[Game.particleData["eproperties"][i]] = i + Universe.nHardProps;
		}
		Universe.ePropArr = Object.keys(Universe.ePropMap);
		for (var i=0; i<Game.particleData["iproperties"].length; i++) {
			Universe.iPropMap[Game.particleData["iproperties"][i]] = i;
		}
		Universe.iPropArr = Object.keys(Universe.iPropMap);

		//prepare intensive properties LUT
		Universe.iProps = new Uint8Array(Universe.niProperties*Universe.typeArr.length);
		for (var i=0; i<Universe.typeArr.length-1; i++) {
			for (var j=0,k=Universe.iPropArr.length; j<k; j++) {
				Universe.iProps[i*k + j] = Game.particleData["types"][Universe.typeArr[i]][Universe.iPropArr[j]];
			}
		}

		//fill particles array with air
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

			//make particles at mouse
			Util.applyLine(Mouse.lx, Mouse.ly, Mouse.x+1, Mouse.y+1, function(x,y){
				Universe.quickfill(
					x-Universe.createSize*0.5, 
					y-Universe.createSize*0.5, 
					Universe.createSize, 
					Universe.createSize, 
					Universe.selected, 
					Universe.selected==="sand"||Universe.selected==="silt"?colors:undefined
				);
			}, 2);
		}

		//store mouse position as previous position
		Mouse.lx = Mouse.x;
		Mouse.ly = Mouse.y;

		//mark all particles as not updated
		for (var i=Universe.w*Universe.h-1; i>=0; i--) {
			Universe.particles[i*Universe.neProperties+Universe.ePropMap["moved"]] = 0;
		}

		//update all particles
		var idx, flipflop = 0; //flipflop is used to alternate direction of looping to prevent simulation artifacts
		for (var y=Universe.h-1; y>=0; y--) {
			for (var bx=0; bx<Universe.w; bx++) {
				var x = Math.abs(flipflop - bx);
				idx = Universe.index(x,y);
				var type = Universe.getType(idx);

				//count life and kill particle if life == 0
				if (Universe.particles[idx + Universe.ePropMap["life"]] > 0) {
					if (--Universe.particles[idx + Universe.ePropMap["life"]] <= 0) {
						Universe.setPosType(x, y, "air");
						continue;
					}
				}

				//check to make sure particle hasn't been updated yet
				if (Universe.getProp(false, "moved", idx) === 0) {
					//mark the particle as updated
					// Universe.particles[idx+Universe.propMap["moved"]] = 1;

					//simulate physics-enabled particles
					if (Universe.hasPhysics(type) && !Universe.isSleeping(idx)) {
						var nx = x, ny = y; //when particles move more than once, we need to keep track of new position
						
						//obtain and increase particle velocity (gravity)
						var vel = Universe.getVel(idx);
						Universe.setVel(idx, vel=Math.min(Universe.getVmax(type),vel+1));

						//perform movement
						for (var z=Math.abs(Universe.getVel(idx)); z>=0; z--) {
							idx = Universe.index(nx,ny);

							//propagate fire
							if (Universe.particles[idx] === Universe.typeMap["fire"]) {
								if (Universe.getDensity(type) !== 1) {
									Universe.setPosType(nx, ny, "fire");
									break;
								}
								else {
									var uc = Universe.index(x, y-1),
										cl = Universe.index(x-1, y),
										cr = Universe.index(x+1, y),
										dc = Universe.index(x, y+1),
										flammable = Universe.ePropMap["flammable"],
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
								fell = Universe.getProp(true, "turbulence", type) / 200;
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
								else if (Universe.isLiquid(type)) {
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
								if (Universe.isSolid(type)) Universe.wake(idx);
							}
							if (!Universe.isSolid(type)) Universe.sleep(idx);
						}
					}
				}
			}
			flipflop = Universe.w-1-flipflop; //alternates x looping direction
		}
		Display.update();
		requestAnimationFrame(Universe.step);
	},

	index: function(x, y) {
		x = Math.max(0, Math.min(Universe.w-1, x));
		y = Math.max(0, Math.min(Universe.h-1, y));
		return ((y*Universe.w)+x)*Universe.neProperties;
	},

	getProp: function(isIntensive, name, idx) {
		if (isIntensive)
			return Universe.iProps[idx*Universe.niProperties + Universe.iPropMap[name]];
		return Universe.particles[idx + Universe.ePropMap[name]];
	},

	getType: function(idx) {
		return Universe.particles[idx + Universe.ePropMap["type"]];
	},

	getDensity: function(type) {
		return Universe.iProps[type*Universe.niProperties + Universe.iPropMap["density"]];
	},

	isLiquid: function(type) {
		return Universe.iProps[type*Universe.niProperties + Universe.iPropMap["liquid"]] === 1;
	},

	isSleeping: function(idx) {
		return Universe.particles[idx + Universe.ePropMap["sleeping"]];
	},

	isSolid: function(type) {
		return Universe.iProps[type*Universe.niProperties + Universe.iPropMap["solid"]] === 1;
	},

	hasPhysics: function(type) {
		return Universe.iProps[type*Universe.niProperties + Universe.iPropMap["physics"]] === 1;
	},

	setVel: function(idx, val) {
		return Universe.particles[idx + Universe.ePropMap["vel"]] = val;
	},

	getVel: function(idx) {
		return Universe.particles[idx + Universe.ePropMap["vel"]];
	},

	getVmax: function(type) {
		return signedbyte(Universe.iProps[type*Universe.niProperties + Universe.iPropMap["vmax"]]);
	},

	clearAll: function() {
		Universe.quickfill(0,0,Universe.w,Universe.h,"air");
	},

	quickfill: function(x, y, w, h, type, props) {
		Universe.setPosType(x,y,type,props);
		var i, idx = Universe.index(x,y), np = Universe.neProperties-1;
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
			else if (defaults.hasOwnProperty(prop) && Universe.ePropMap.hasOwnProperty(prop)) {
				properties[prop] = defaults[prop];
			}
		}
		Universe.setPos(x, y, properties);
	},

	setPos: function(x, y, props) {
		var i0 = Universe.index(x,y);
		Universe.wakeAround(x, y);
		var pkeys = Object.keys(props);
		for (var i=Universe.neProperties-1; i>=0; i--) {
			var val = typeof pkeys[i] === "undefined" ? 0 : pkeys[i];
			Universe.particles[i0 + i] = Number(props[val]);
		}
	},

	tryMove: function(x1, y1, x2, y2) {
		var i0 = Universe.index(x1, y1),
			i1 = Universe.index(x2, y2);
		var t0 = Universe.getType(i0),
			t1 = Universe.getType(i1);
		var d0 = Universe.getDensity(t0),
			d1 = Universe.getDensity(t1);

		if (Universe.isSolid(t1)) {
			if (!Universe.isLiquid(t1) || d1 >= d0) {
				Universe.sleep(i0);
				return false;
			}
			else if (FastRandom.next() >= (d0-d1)*0.01) {
				return false;
			}
		}

		Universe.wakeAround(x1, y1);
		Universe.wakeAround(x2, y2);
		Universe.particles[i0 + Universe.ePropMap["moved"]] = 1;
		Universe.swap(i0, i1);
		return true;
	},

	sleep: function(idx) {
		Universe.particles[idx + Universe.ePropMap["sleeping"]] = 1;
	},

	wake: function(idx) {
		Universe.particles[idx + Universe.ePropMap["sleeping"]] = 0;
	},

	wakeAround: function(x, y) {
		Universe.setNearby(x, y, Universe.ePropMap["sleeping"], 0);
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
		var i = Universe.neProperties;
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
