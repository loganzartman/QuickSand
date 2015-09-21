var Display = {
	canvas: null,
	buffer: null,
	ctx: null,
	octx: null,
	imgdata: null,
	data: null,
	imgtemp: null,
	temp: null,
	softwareAA: false,
	canvasAA: false,
	scale: 2,
	container: null,
	mode: "normal",
	modes: ["normal", "sleeping", "density"],
	init: function() {
		//generate canvas
		Display.canvas = document.getElementById("display");
		Display.canvas.width = Universe.w*Display.scale;
		Display.canvas.height = Universe.h*Display.scale;

		Display.buffer = document.createElement("canvas");
		Display.buffer.width = Universe.w;
		Display.buffer.height = Universe.h;

		Display.octx = Display.canvas.getContext("2d", {alpha: false});
		Display.ctx = Display.buffer.getContext("2d", {alpha: false});
		Display.imgdata = Display.ctx.getImageData(0,0,Universe.w,Universe.h);
		Display.data = Display.imgdata.data;
		Display.imgtemp = Display.ctx.createImageData(Universe.w, Universe.h);
		Display.temp = Display.imgtemp.data;

		if (!Display.canvasAA) {
			Display.octx["imageSmoothingEnabled"] = false;
			Display.octx["mozImageSmoothingEnabled"] = false;
			Display.octx["webkitImageSmoothingEnabled"] = false;
		}

		Display.container = document.getElementById("container");
		Display.container.style.marginLeft = ~~(-Display.container.offsetWidth*0.5) + "px";
		Display.container.style.marginTop = ~~(-Display.container.offsetHeight*0.5) + "px";
	},

	update: function() {
		var idx, type;
		var data = Display.data;
		for (var i=Universe.w*Universe.h-1; i>=0; i--) {
			idx = i*Universe.neProperties;

			if (Display.mode === "sleeping" || Display.mode === "normal") {
				data[i*4+0] = Universe.particles[idx + Universe.ePropMap["r"]];
				data[i*4+1] = Universe.particles[idx + Universe.ePropMap["g"]];
				data[i*4+2] = Universe.particles[idx + Universe.ePropMap["b"]];
				data[i*4+3] = 255;

				if (Display.mode === "sleeping" && Universe.isSleeping(idx)) {
					data[i*4]=0;
					data[i*4+1]=0;
					data[i*4+2]=0;
				}
			}
			else if (Display.mode === "density") {
				data[i*4+0] = ~~(255 * (Universe.particles[idx + Universe.propMap["density"]] * 0.01));
				data[i*4+1] = 0;
				data[i*4+2] = 255 - ~~(255 * (Universe.particles[idx + Universe.propMap["density"]] * 0.01));
				data[i*4+3] = 255;
			}
		}
		if (Display.softwareAA) {
			var w = Universe.w, w4=w*4;
			var i = Universe.w*Universe.h-1-Universe.w*3;
			for (; i>=w*3; i--) {
				var ind = i*4;
				for (var j=2; j>=0; j--) {
					var p = ind+j;
					var sum = data[p] + ((data[p-4] + data[p+4] + data[p-w4] + data[p+w4])>>>3);
					sum += (data[p-4+w4] + data[p-4-w4] + data[p+4+w4] + data[p+4-w4]>>>2);
					Display.temp[p] = ~~(sum * 0.4);
				}
				Display.temp[ind+3] = 255;
			}
			Display.ctx.putImageData(Display.imgtemp, 0, 0);
		}
		else {
			Display.ctx.putImageData(Display.imgdata, 0, 0);
		}

		Display.octx.drawImage(Display.buffer, 0, 0, Display.scale*Display.buffer.width, Display.scale*Display.buffer.height);
	}
};
