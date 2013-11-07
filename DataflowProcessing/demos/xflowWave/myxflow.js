/**
 * Grid Generation
 */

(function () {
var simplex = new SimplexNoise();
  var canvas = document.getElementById('debug');
   var ctx = canvas.getContext('2d'),
    imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height),

    data = imgdata.data,
    t = 0;

window.setInterval(function(){
for (var x = 0; x < 256; x++) {
    for (var y = 0; y < 256; y++) {
        var r = simplex.noise3D(x / 16, y / 16, t/16) * 0.5 + 0.5;
     //   var g = simplex.noise3D(x / 8, y / 8, t/16) * 0.5 + 0.5;
    //    var b = simplex.noise3D(x / 4, y / 4, t/16) * 0.5 + 0.5;
        data[(x + y * 256) * 4 + 0] = r * 255;
    //    data[(x + y * 256) * 4 + 1] = (r + g) * 200;
      //  data[(x + y * 256) * 4 + 2] = (r + g + b) * 200;
        data[(x + y * 256) * 4 + 3] = 255;
    }
}
    t++;

ctx.putImageData(imgdata, 0, 0);
}, 1000/60);

Xflow.registerOperator("xflow.mygrid", {
    outputs: [	{type: 'float3', name: 'position', customAlloc: true},
				{type: 'float3', name: 'normal', customAlloc: true},
				{type: 'float2', name: 'texcoord', customAlloc: true},
				{type: 'int', name: 'index', customAlloc: true}],
    params:  [{type: 'int', source: 'size', array: true}],
    alloc: function(sizes, size)
    {
        var s = size[0];
        sizes['position'] = s* s;
        sizes['normal'] = s* s;
        sizes['texcoord'] = s* s;
        sizes['index'] = (s-1) * (s-1) * 6;
    },
    evaluate: function(position, normal, texcoord, index, size) {
		var s = size[0];

        // Create Positions
		for(var i = 0; i < position.length / 3; i++) {
			var offset = i*3;
			position[offset] =  (((i % s) / (s-1))-0.5)*2;
			position[offset+1] = 0;
			position[offset+2] = ((Math.floor(i/s) / (s-1))-0.5)*2;
		}

        // Create Normals
		for(var i = 0; i < normal.length / 3; i++) {
			var offset = i*3;
			normal[offset] =  0;
			normal[offset+1] = 1;
			normal[offset+2] = 0;
		}
        // Create Texture Coordinates
		for(var i = 0; i < texcoord.length / 2; i++) {
			var offset = i*2;
            texcoord[offset] = (i%s) / (s-1);
            texcoord[offset+1] = Math.floor(i/s) / (s-1);
		}

        // Create Indices
		var length = (s-1) * (s-1);
		for(var i = 0; i < length; i++) {
			var offset = i*6;
			var base = i + Math.floor(i / (s-1));
			index[offset+0] = base;
			index[offset+1] = base + 1;
			index[offset+2] = base + s;
			index[offset+4] = base + s;
			index[offset+3] = base + 1;
			index[offset+5] = base + s + 1;
		}
	}
});

/**
 * Wave Transformation
 */
Xflow.registerOperator("xflow.mywave", {
	outputs: [	{type: 'float3', name: 'position'},
				{type: 'float3', name: 'normal'} ],
    params:  [  {type: 'float3', source: 'position' },
                {type: 'float3', source: 'normal' },
                {type: 'float',  source: 'strength'},
                {type: 'float',  source: 'wavelength'},
                {type: 'float',  source: 'phase'}],
    evaluate: function(newpos, newnormal, position, normal, strength, wavelength, phase, info) {

		for(var i = 0; i < info.iterateCount; i++) {
			var offset = i*3;
			var dist = Math.sqrt(position[offset]*position[offset]+position[offset+2]*position[offset+2]);
			newpos[offset] = position[offset];
			newpos[offset+1] = simplex.noise3D(position[offset] / 1, position[offset+1] / 1, position[offset+2]/1) - dist;
			newpos[offset+2] = position[offset+2];

			var tmp = simplex.noise3D(position[offset] / 1, position[offset+1] / 1, t/256)*0.1;
            var dx = position[offset] / dist * tmp;
			var dz = position[offset+2] / dist * tmp;

			var v = XML3D.math.vec3.create();
            v[0] = dx; v[1] = 1; v[2] = dz;
            XML3D.math.vec3.normalize(v, v);
			newnormal[offset] = v[0];
			newnormal[offset+1] = v[1];
			newnormal[offset+2] = v[2];
		}

	}
});

}());