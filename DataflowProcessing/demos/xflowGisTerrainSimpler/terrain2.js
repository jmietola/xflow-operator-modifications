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

        kernelManager.register("clElevation",
            [
                "        __kernel void clElevation(",
                "                const __global float *positions,",
                "                const __global float *elevation,",
                "                const __global int *indices,",
                "                __global float *normals,",
                "                __global float *output,",
                "                uint count)",


                "        {",
                "                int tx = get_global_id(0)*3;",

                "                if(tx >= count*3)",
                "                        return;",
                "               int i = indices[tx]*3;",
                "               int ii = indices[tx+1]*3;",
                "               int iii = indices[tx+2]*3;",

                "                if(i >= count*3 || ii >= count*3 || iii >= count*3)",
                "                        return;",

                "                //Vertex v0;   ",
                "                output[i] = positions[i];",
                "                output[i+1] = elevation[indices[tx]];",
                "                output[i+2] = positions[i+2];",

                "                //Vertex v1;   ",
                "                output[ii] = positions[ii];",
                "                output[ii+1] = elevation[indices[tx+1]];",
                "                output[ii+2] = positions[ii+2];",

                "                //Vertex v2;   ",
                "                output[iii] = positions[iii];",
                "                output[iii+1] = elevation[indices[tx+2]];",
                "                output[iii+2] = positions[iii+2];",

                "                float4 v0 = (float4) (output[i], output[i+1], output[i+2], 1.0f);",
                "                float4 v1 = (float4) (output[ii], output[ii+1], output[ii+2], 1.0f);",
                "                float4 v2 = (float4) (output[iii], output[iii+1], output[iii+2], 1.0f);",
                "                float4 normal = cross(v2-v0, v1-v0);",

                "                normals[i] = normal.x;",
                "                normals[i+1] = normal.y;",
                "                normals[i+2] = normal.z;",

                "                normals[ii] = normal.x;",
                "                normals[ii+1] = normal.y;",
                "                normals[ii+2] = normal.z;",

                "                normals[iii] = normal.x;",
                "                normals[iii+1] = normal.y;",
                "                normals[iii+2] = normal.z;",

                "        }"
            ].join("\n"));

        kernelManager.register("clNormalize",
            [
                "        __kernel void clNormalize(",
                "                const __global int *normals,",
                "                __global float *nout,",
                "                uint count)",


                "        {",



                "        }"
            ].join("\n"));


        var kernel = webcl.kernels.getKernel("clElevation"),
            kernel2 = webcl.kernels.getKernel("clNormalize"),
            oldBufSize = 0,
            buffers = {initPosBuffer: null, elevationBuffer: null, indexBuffer: null, curPosBuffer: null, curNorBuffer: null};

        Xflow.registerOperator("xflow.clElevation", {
            outputs: [
                {type: 'float3', name: 'position', customAlloc: true},
                {type: 'float3', name: 'normal', customAlloc: true}
            ],
            params: [
                {type: 'float3', source: 'position' },
                {type: 'float3', source: 'normal'},
                {type: 'int', source: 'index'},
                {type: 'float3', source: 'elevation'}

            ],

            evaluate: function (newPos, newNor, position, normal, index, elevation) {
                //passing xflow operators input data

                //calculate vertices
                var nVertices = Math.floor((position.length)),
                    nIndices = Math.floor((index.length)),
                    nElevation = Math.floor((elevation.length)),

                // Setup buffers
                    bufSize = nVertices * Float32Array.BYTES_PER_ELEMENT, // size in bytes
                    bufSizeIndices = nIndices * Int32Array.BYTES_PER_ELEMENT, // size in bytes
                    bufSizeElevation = nElevation * Float32Array.BYTES_PER_ELEMENT, // size in bytes

                    initPosBuffer = buffers.initPosBuffer,
                    elevationBuffer = buffers.elevationBuffer,
                    indexBuffer = buffers.indexBuffer,
                    curPosBuffer = buffers.curPosBuffer,
                    curNorBuffer = buffers.curNorBuffer,

                    globalWorkSize = [],
                    localWorkSize = [];

                console.log("buffer size:", bufSize);
                console.log("position array", position.length, position);
                console.log("elevation array", elevation.length, elevation);
                console.log("index array", index.length, index);
                console.log("Num of Vertices: ", nVertices);

                // InitCLBuffers
                if (bufSize !== oldBufSize) {
                    oldBufSize64 = bufSize;

                    if (initPosBuffer && elevationBuffer && indexBuffer && curNorBuffer && curPosBuffer) {
                        initPosBuffer.release();
                        elevationBuffer.release();
                        indexBuffer.release();
                        curNorBuffer.release();
                        curPosBuffer.release();
                    }

                    // Setup WebCL context using the default device of the first available platform
                    initPosBuffer = buffers.initPosBuffer = webcl.createBuffer(bufSize, "r");
                    elevationBuffer = buffers.elevationBuffer = webcl.createBuffer(bufSizeElevation, "r");
                    indexBuffer = buffers.indexBuffer = webcl.createBuffer(bufSizeIndices, "r");
                    curNorBuffer = buffers.curNorBuffer = webcl.createBuffer(bufSize, "rw");
                    curPosBuffer = buffers.curPosBuffer = webcl.createBuffer(bufSize, "rw");

                }

                try {
                    // Initial load of initial position data
                    cmdQueue.enqueueWriteBuffer(initPosBuffer, false, 0, bufSize, position, []);

                    //Write elevation data
                    cmdQueue.enqueueWriteBuffer(elevationBuffer, false, 0, bufSizeElevation, elevation, []);

                    //Write indices
                    cmdQueue.enqueueWriteBuffer(indexBuffer, false, 0, bufSizeIndices, index, []);

                    cmdQueue.finish();

                    kernelManager.setArgs(kernel, initPosBuffer, elevationBuffer, indexBuffer, curNorBuffer, curPosBuffer, new Int32Array([Math.floor(index.length / 3)]));

                    var localWS = [2];
                    var globalWS = [Math.ceil((index.length) / localWS[0]) * localWS[0]];

                    console.log(localWS);
                    console.log(globalWS);
                    // Execute (enqueue) kernel
                    cmdQueue.enqueueNDRangeKernel(kernel, 1, [], globalWS, localWS, []);

                    // Read the result buffer from OpenCL device
                    cmdQueue.finish();

                    console.log("newPos: ", newPos.length, newPos);
                    console.log("newNor", newNor.length, newNor);

                    cmdQueue.enqueueReadBuffer(curPosBuffer, false, 0, bufSize, newPos, []);
                    cmdQueue.enqueueReadBuffer(curNorBuffer, false, 0, bufSize, newNor, []);

                    cmdQueue.finish();

                } catch (e) {
                    console.log(e.name, e.message);
                }

                return true;
            }
        });
    }());

    Xflow.registerOperator("xflow.customgrid", {
        outputs: [
            {type: 'float3', name: 'position', customAlloc: true},
            {type: 'float3', name: 'normal', customAlloc: true},
            {type: 'float2', name: 'texcoord', customAlloc: true},
            {type: 'int', name: 'index', customAlloc: true}
        ],
        params: [
            {type: 'int', source: 'area', array: true}
        ],
        alloc: function (areas, area) {
            var s = area[0];
            areas['position'] = s * s;
            areas['normal'] = s * s;
            areas['texcoord'] = s * s;
            areas['index'] = (s - 1) * (s - 1) * 6;
        },
        evaluate: function (position, normal, texcoord, index, area) {

            var s = area[0];

            // Create Positions
            for (var i = 0; i < position.length / 3; i++) {
                var offset = i * 3;
                position[offset] = (((i % s) / (s - 1)) - 0.5) * 1000;
                position[offset + 1] = 0;
                position[offset + 2] = ((Math.floor(i / s) / (s - 1)) - 0.5) * 1000;
            }

            // Create Normals
            for (var i = 0; i < normal.length / 3; i++) {
                var offset = i * 3;
                normal[offset] = 0;
                normal[offset + 1] = 1;
                normal[offset + 2] = 0;
            }
            // Create Texture Coordinates
            for (var i = 0; i < texcoord.length / 2; i++) {
                var offset = i * 2;
                texcoord[offset] = (i % s) / (s - 1);
                texcoord[offset + 1] = Math.floor(i / s) / (s - 1);
            }

            // Create Indices
            var length = (s - 1) * (s - 1);
            for (var i = 0; i < length; i++) {
                var offset = i * 6;
                var base = i + Math.floor(i / (s - 1));
                index[offset + 0] = base;
                index[offset + 1] = base + 1;
                index[offset + 2] = base + s;
                index[offset + 4] = base + s;
                index[offset + 3] = base + 1;
                index[offset + 5] = base + s + 1;
            }
        }
    });

}());