(function () {
    var webcl = XML3D.webcl,
        kernelManager = webcl.kernels;
    XML3D.debug.loglevel = 1;


    (function () {

        webcl.init("GPU");

        kernelManager.register("clParticle",
            ["    __kernel void clParticle(",
                "        __global float* curPos,",
                "        __global float* curVel,",
                "        int numBodies,",
                "        float deltaTime,",
                "        int epsSqr,",
                "        __local float* localPos,",
                "        __global float* nxtPos,",
                "        __global float* nxtVel)",
                "    {",
                "        unsigned int tid = get_local_id(0);",
                "        unsigned int gid = get_global_id(0);",
                "        unsigned int localSize = get_local_size(0);",

                "        // Number of tiles we need to iterate",
                "        unsigned int numTiles = numBodies / localSize;",

                "        // position of this work-item",
                "        float4 myPos = (float4) (curPos[4*gid + 0], curPos[4*gid + 1], curPos[4*gid + 2], curPos[4*gid + 3]);",
                "        float4 acc = (float4) (0.0f, 0.0f, 0.0f, 0.0f);",

                "        for(int i = 0; i < numTiles; ++i)",
                "        {",
                "            // load one tile into local memory",
                "            int idx = i * localSize + tid;",
                "            for(int k=0; k<4; k++)",
                "            {",
                "                    localPos[4*tid+k] = curPos[4*idx+k];",
                "            }",
                "            // Synchronize to make sure data is available for processing",
                "            barrier(CLK_LOCAL_MEM_FENCE);",
                "            // calculate acceleration effect due to each body",
                "            // a[i->j] = m[j] * r[i->j] / (r^2 + epsSqr)^(3/2)",
                "            for(int j = 0; j < localSize; ++j)",
                "            {",
                "                // Calculate acceleration caused by particle j on particle i",
                "                float4 aLocalPos = (float4) (localPos[4*j + 0], localPos[4*j + 1], localPos[4*j + 2], localPos[4*j + 3]);",
                "                float4 r = aLocalPos - myPos;",
                "                float distSqr = r.x * r.x  +  r.y * r.y  +  r.z * r.z;",
                "                float invDist = 1.0f / sqrt(distSqr + epsSqr);",
                "                float invDistCube = invDist * invDist * invDist;",
                "                float s = aLocalPos.w * invDistCube;",
                "                // accumulate effect of all particles",
                "                acc += s * r;",
                "            }",
                "            // Synchronize so that next tile can be loaded",
                "            barrier(CLK_LOCAL_MEM_FENCE);",
                "        }",

                "        float4 oldVel = (float4) (curVel[4*gid + 0], curVel[4*gid + 1], curVel[4*gid + 2], curVel[4*gid + 3]);",

                "        // updated position and velocity",
                "        float4 newPos = myPos + oldVel * deltaTime + acc * 0.5f * deltaTime * deltaTime;",
                "        newPos.w = myPos.w;",
                "        float4 newVel = oldVel + acc * deltaTime;",

                "        // check boundry",
                "        if(newPos.x > 1.0f || newPos.x < -1.0f || newPos.y > 1.0f || newPos.y < -1.0f || newPos.z > 1.0f || newPos.z < -1.0f) {",
                "            float rand = (1.0f * gid) / numBodies;",
                "            float r = 0.05f *  rand;",
                "            float theta = rand;",
                "            float phi = 2 * rand;",
                "            newPos.x = r * sinpi(theta) * cospi(phi);",
                "            newPos.y = r * sinpi(theta) * sinpi(phi);",
                "            newPos.z = r * cospi(theta);",
                "            newVel.x = 0.0f;",
                "            newVel.y = 0.0f;",
                "            newVel.z = 0.0f;",
                "        }",

                "        // write to global memory",
                "        nxtPos[4*gid + 0] = newPos.x;",
                "        nxtPos[4*gid + 1] = newPos.y;",
                "        nxtPos[4*gid + 2] = newPos.z;",
                "        nxtPos[4*gid + 3] = newPos.w;",

                "        nxtVel[4*gid + 0] = newVel.x;",
                "        nxtVel[4*gid + 1] = newVel.y;",
                "        nxtVel[4*gid + 2] = newVel.z;",
                "        nxtVel[4*gid + 3] = newVel.w;",
                "    }"].join("\n"));

        var cmdQueue = webcl.createCommandQueue(),
            kernel = webcl.kernels.getKernel("clParticle"),

            oldBufSize = 0, oldPos, oldVel, i = 0,
            buffers = {curPosBuffer: null, curVelBuffer: null, nxtPosBuffer: null, nxtVelBuffer: null};


        Xflow.registerOperator("xflow.clParticle", {
            outputs: [
                {type: 'float3', name: 'position'},
                {type: 'float3', name: 'velocity'}

            ],
            params: [
                {type: 'float3', source: 'position' },
                {type: 'float3', source: 'velocity' },
                {type: 'float', source: 'phase' }

            ],

            evaluate: function (newPos, newVel, position, velocity, info) {
                var curPosBuffer = buffers.curPosBuffer,
                    curVelBuffer = buffers.curVelBuffer,
                    nxtPosBuffer = buffers.nxtPosBuffer,
                    nxtVelBuffer = buffers.nxtVelBuffer,

                    globalWorkSize = [],
                    localWorkSize = [],

                    POS_ATTRIB_SIZE = 3,
                    DT = 0.05,
                    EPSSQR = 40,

                    particles = (position.length) / 3,
                    bufSize = particles * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT;

                if (!oldPos && !oldVel) {
                    oldPos = new Float32Array(position);
                    oldVel = new Float32Array(velocity);
                    console.log("initial pos", oldPos);
                    console.log("initial vel", oldVel);
                }

                // InitCLBuffers
                if (bufSize !== oldBufSize) {
                    oldBufSize = bufSize;

                    if (curPosBuffer && curVelBuffer && nxtPosBuffer && nxtVelBuffer) {
                        curPosBuffer.release();
                        curVelBuffer.release();
                        nxtPosBuffer.release();
                        nxtVelBuffer.release();
                    }

                    // Setup WebCL context using the default device of the first available platform
                    curPosBuffer = buffers.curPosBuffer = webcl.createBuffer(bufSize, "rw");
                    curVelBuffer = buffers.curVelBuffer = webcl.createBuffer(bufSize, "rw");
                    nxtPosBuffer = buffers.nxtPosBuffer = webcl.createBuffer(bufSize, "rw");
                    nxtVelBuffer = buffers.nxtVelBuffer = webcl.createBuffer(bufSize, "rw");
                }

                // Initial load of initial position data
                cmdQueue.enqueueWriteBuffer(curPosBuffer, true, 0, bufSize, oldPos, []);
                cmdQueue.enqueueWriteBuffer(curVelBuffer, true, 0, bufSize, oldVel, []);

                cmdQueue.finish();


                // Get the maximum work group size for executing the kernel on the device
                //
                var workGroupSize = kernel.getWorkGroupInfo(webcl.getDevicesByType("GPU")[0], WebCL.CL_KERNEL_WORK_GROUP_SIZE);

                globalWorkSize[0] = 1;
                globalWorkSize[1] = 1;
                while (globalWorkSize[0] * globalWorkSize[1] < particles) {
                    globalWorkSize[0] = globalWorkSize[0] * 2;
                    globalWorkSize[1] = globalWorkSize[1] * 2;
                }

                localWorkSize[0] = globalWorkSize[0];
                localWorkSize[1] = globalWorkSize[1];
                while (localWorkSize[0] * localWorkSize[1] > workGroupSize) {
                    localWorkSize[0] = localWorkSize[0] / 2;
                    localWorkSize[1] = localWorkSize[1] / 2;
                }

                var localMemSize = localWorkSize[0] * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT;

                kernelManager.setArgs(kernel, curPosBuffer, curVelBuffer,
                    new Int32Array([particles]), new Float32Array([DT]), new Int32Array([EPSSQR]),
                    new Uint32Array([localMemSize]), nxtPosBuffer, nxtVelBuffer);

                cmdQueue.enqueueNDRangeKernel(kernel, globalWorkSize.length, [], globalWorkSize, localWorkSize, []);

                cmdQueue.finish();

                //curPosBuffer = nxtPosBuffer;
                //curVelBuffer = nxtVelBuffer;
                // enqueueCopyBuffer
                //   cmdQueue.enqueueCopyBuffer(nxtPosBuffer, curPosBuffer, 0, 0, bufSize, []);
                //   cmdQueue.enqueueCopyBuffer(nxtVelBuffer, curVelBuffer, 0, 0, bufSize, []);

                cmdQueue.enqueueReadBuffer(nxtPosBuffer, true, 0, bufSize, newPos, []);
                cmdQueue.enqueueReadBuffer(nxtVelBuffer, true, 0, bufSize, newVel, []);

                cmdQueue.finish();

                oldPos.set(newPos);
                oldVel.set(newVel);

                /*var el = document.getElementById("wave"),
                 pos = el.querySelector("[name='position']"),
                 vel = el.querySelector("[name='velocity']");
                 pos.setScriptValue(newPos);
                 vel.setScriptValue(newVel);
                 console.log(pos);*/

                return true;
            }

        });
    }());


    Xflow.registerOperator("xflow.mygrid", {
        outputs: [
            {type: 'float3', name: 'position', customAlloc: true},
            {type: 'float3', name: 'velocity', customAlloc: true},
            {type: 'float3', name: 'normal', customAlloc: true},
            {type: 'float2', name: 'texcoord', customAlloc: true},
            {type: 'int', name: 'index', customAlloc: true}
        ],
        params: [
            {type: 'int', source: 'size', array: true}
        ],
        alloc: function (sizes, size) {
            var s = size[0];
            sizes['position'] = s * s;
            sizes['velocity'] = s * s;
            sizes['normal'] = s * s;
            sizes['texcoord'] = s * s;
            sizes['index'] = (s - 1) * (s - 1) * 6;
        },
        evaluate: function (position, velocity, normal, texcoord, index, size) {
            var s = size[0], offset, i;

            // Create Positions
            for (i = 0; i < position.length / 3; i++) {
                offset = i * 3;
                position[offset] = (((i % s) / (s - 1)) - 0.5) * 0.25;
                position[offset + 1] = 0;
                position[offset + 2] = ((Math.floor(i / s) / (s - 1)) - 0.5) * 0.25;
            }

            // Create velocity
            for (i = 0; i < velocity.length / 3; i++) {
                offset = i * 3;
                velocity[offset] = 0;
                velocity[offset + 1] = 0;
                velocity[offset + 2] = 0;
            }

            // Create Normals
            for (i = 0; i < normal.length / 3; i++) {
                offset = i * 3;
                normal[offset] = 0;
                normal[offset + 1] = 1;
                normal[offset + 2] = 0;
            }
            // Create Texture Coordinates
            for (i = 0; i < texcoord.length / 3; i++) {
                offset = i * 2;
                texcoord[offset] = (i % s) / (s - 1);
                texcoord[offset + 1] = Math.floor(i / s) / (s - 1);
            }

            // Create Indices
            var length = (s - 1) * (s - 1), base;
            for (i = 0; i < length; i++) {
                offset = i * 6;
                base = i + Math.floor(i / (s - 1));
                index[offset] = base;
                index[offset + 1] = base + 1;
                index[offset + 2] = base + s;
                index[offset + 4] = base + s;
                index[offset + 3] = base + 1;
                index[offset + 5] = base + s + 1;
            }

        }

    });

}());