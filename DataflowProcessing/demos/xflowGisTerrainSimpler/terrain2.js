/*--------------------------------------------*/
//
//  Procedural Xflow Terrain Generator!
//
//  In demo there are two planes. The one at below
//  is based on javascript and the upper one is
//  based on WebCL
//
//
/*--------------------------------------------*/
(function () {
    var webcl = XML3D.webcl,
        kernelManager = webcl.kernels,
        cmdQueue,
        simplex = new SimplexNoise();
        XML3D.debug.loglevel = 1;
        webcl.init("GPU");
        cmdQueue = webcl.createCommandQueue();

    (function () {

        kernelManager.register("clDeform",
            [
"        __kernel void clDeform(",
"                const __global float *vertices,",
"                const __global float *elevation,",
"                __global float *normals,",
"                __global float *output,",
"                uint count)",

"        {",
"                int tx = get_global_id(0);",
"                int ty = get_global_id(1);",
"                int sx = get_global_size(0);",
"                int index = ty * sx + tx;",
"                if(index >= count)",
"                        return;",
"                int2 di = (int2)(tx, ty);",

"                //vstore4_3(vertex, (size_t)index, output);  // mod: sg",
"                int ii = 3*index;",
"                output[ii  ] = vertices[ii];",
"                output[ii+1] = elevation[ii+1];",
"                output[ii+2] = vertices[ii+2];",

"                //vstore4_3(normal, (size_t)index, normals); // mod: sg",
"                //dummy normals",
"                normals[ii  ] = 0;",
"                normals[ii+1] = 1;",
"                normals[ii+2] = 0;",
"        }"

            ].join("\n"));

        var kernel = webcl.kernels.getKernel("clDeform"),
            oldBufSize = 0,
            buffers = {initPosBuffer: null, elevationBuffer: null, curPosBuffer: null, curNorBuffer: null};

        Xflow.registerOperator("xflow.clDeform", {
            outputs: [
                {type: 'float3', name: 'position'},
                {type: 'float3', name: 'normal'}
            ],
            params: [
                {type: 'float3', source: 'position' },
                {type: 'float3',  source: 'normal'},
                {type: 'float3',  source: 'elevation'}

            ],
            evaluate: function (newPos, newNor, position, normal, elevation) {
                //passing xflow operators input data
                var NUM_VERTEX_COMPONENTS = 3,

                //calculate vertices
                    nVertices = Math.floor((position.length)/3),

                // Setup buffers
                    bufSize = nVertices * NUM_VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT, // size in bytes

                    initPosBuffer = buffers.initPosBuffer,
                    elevationBuffer = buffers.elevationBuffer,
                    curPosBuffer = buffers.curPosBuffer,
                    curNorBuffer = buffers.curNorBuffer,

                    globalWorkSize = [],
                    localWorkSize = [];
                console.log("position array", position);
                console.log("elevation array", elevation);

                // InitCLBuffers
                if (bufSize !== oldBufSize) {
                    oldBufSize64 = bufSize;

                    if (initPosBuffer && elevationBuffer && curNorBuffer && curPosBuffer) {
                        initPosBuffer.release();
                        elevationBuffer.release();
                        curNorBuffer.release();
                        curPosBuffer.release();
                    }

                    // Setup WebCL context using the default device of the first available platform
                    initPosBuffer = buffers.initPosBuffer =  webcl.createBuffer(bufSize, "w");
                    elevationBuffer = buffers.elevationBuffer = webcl.createBuffer(3844, "w");
                    curNorBuffer = buffers.curNorBuffer =  webcl.createBuffer(bufSize, "rw");
                    curPosBuffer = buffers.curPosBuffer =  webcl.createBuffer(bufSize, "rw");

                }

                // Get the maximum work group size for executing the kernel on the device
                //
                var workGroupSize = kernel.getWorkGroupInfo(webcl.getDevicesByType("GPU")[0], WebCL.CL_KERNEL_WORK_GROUP_SIZE);

                globalWorkSize[0] = 1;
                globalWorkSize[1] = 1;
                while (globalWorkSize[0] * globalWorkSize[1] < nVertices) {
                    globalWorkSize[0] = globalWorkSize[0] * 2;
                    globalWorkSize[1] = globalWorkSize[1] * 2;
                }

                localWorkSize[0] = globalWorkSize[0];
                localWorkSize[1] = globalWorkSize[1];
                while (localWorkSize[0] * localWorkSize[1] > workGroupSize) {
                    localWorkSize[0] = localWorkSize[0] / 2;
                    localWorkSize[1] = localWorkSize[1] / 2;
                }

                try {
                // Initial load of initial position data
                console.log("position.length", position.length, initPosBuffer.getInfo(WebCL.CL_MEM_SIZE));
                cmdQueue.enqueueWriteBuffer(initPosBuffer, true, 0, bufSize, position, []);
                if (elevation.length > 1) {
                console.log("elevation.length", elevation.length, elevationBuffer.getInfo(WebCL.CL_MEM_SIZE));

                cmdQueue.enqueueWriteBuffer(elevationBuffer, true, 0, 3844, elevation, []);

                }
                cmdQueue.finish();

                kernelManager.setArgs(kernel, initPosBuffer, elevationBuffer, curNorBuffer, curPosBuffer, new Float32Array([nVertices]));

                // Execute (enqueue) kernel
                cmdQueue.enqueueNDRangeKernel(kernel, globalWorkSize.length, [], globalWorkSize, localWorkSize, []);

                cmdQueue.finish();
                console.log(newPos);
                console.log(newNor);
                // Read the result buffer from OpenCL device
                cmdQueue.enqueueReadBuffer(curPosBuffer, true, 0, bufSize, newPos , []);
                cmdQueue.enqueueReadBuffer(curNorBuffer, true, 0, bufSize, newNor, []);
                }catch(e){console.log(e.name, e.message)}

                return true;
            }
        });
    }());

Xflow.registerOperator("xflow.customgrid", {
    outputs: [	{type: 'float3', name: 'position', customAlloc: true},
				{type: 'float3', name: 'normal', customAlloc: true},
				{type: 'float2', name: 'texcoord', customAlloc: true},
				{type: 'int', name: 'index', customAlloc: true}],
    params:  [{type: 'int', source: 'area', array: true}],
    alloc: function(areas, area)
    {
        var s = area[0];
        areas['position'] = s* s;
        areas['normal'] = s* s;
        areas['texcoord'] = s* s;
        areas['index'] = (s-1) * (s-1) * 6;
    },
    evaluate: function(position, normal, texcoord, index, area) {

		var s = area[0];

        // Create Positions
		for(var i = 0; i < position.length / 3; i++) {
			var offset = i*3;
			position[offset] =  (((i % s) / (s-1))-0.5)*100;
			position[offset+1] = 0;
			position[offset+2] = ((Math.floor(i/s) / (s-1))-0.5)*100;
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

}());