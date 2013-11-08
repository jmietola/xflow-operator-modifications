(function () {
    var webcl = XML3D.webcl,
        webgl = XML3D.webgl,
        cmdQueue = webcl.cmdQueue,
        ctx = webcl.ctx,
        forwardPipeline, renderI, injectXFlowGLSLPipeline, shaderPass;

    XML3D.debug.loglevel = 4;

    function showDebugImage(pixelData, width, height) {
        var debugCanvas = document.getElementById("debug"), debugCtx, imageData;

        if (!debugCanvas) {
            return;
        }

        debugCtx = debugCanvas.getContext("2d");
        imageData = debugCtx.createImageData(width, height);
        imageData.data.set(new Uint8ClampedArray(pixelData));
        debugCtx.putImageData(imageData, 0, 0);
    }

    injectXFlowGLSLPipeline = function () {
        var xml3ds = document.getElementsByTagName("xml3d");

        if (xml3ds[0]) {
            renderI = xml3ds[0].getRenderInterface();

            //The normal forward rendering pipeline is always available initially
            //It's also available as a render pass under the constructor XML3D.webgl.ForwardRenderPass(context),
            forwardPipeline = renderI.getRenderPipeline();

            shaderPass = new webgl.ShaderPass(forwardPipeline);
            shaderPass.init(forwardPipeline.context);

            /**
             * Initialising grayscale shader
             */

            XML3D.shaders.register("grayscale", {
                vertex: [
                    "attribute vec3 position;",

                    "void main(void) {",
                    "   gl_Position = vec4(position, 0.0);",
                    "}"
                ].join("\n"),

                fragment: [
                    "precision highp float;",
                    "uniform sampler2D inputTexture;",
                    "uniform vec2 quadSize;",
                    "    vec2 texcoord = (gl_FragCoord.xy / quadSize.xy);",

                    "void main(void)",
                    "{",
                    "vec4 frameColor = texture2D(inputTexture, texcoord);",
                    "float luminance = frameColor.r * 0.3 + frameColor.g * 0.59 + frameColor.b * 0.11;",
                    "gl_FragColor = vec4(luminance, luminance, luminance, frameColor.a);",

                    "}"
                ].join("\n")
            });

            forwardPipeline.addShader("grayscaleShader",
                forwardPipeline.context.programFactory.getProgramByName("grayscale"));


            /**
             * Initialising blur shader
             */

            XML3D.shaders.register("blur", {

                vertex: [
                    "attribute vec3 position;",

                    "void main(void) {",
                    "   gl_Position = vec4(position, 0.0);",
                    "}"
                ].join("\n"),

                fragment: [
                    "uniform sampler2D inputTexture;",
                    "uniform vec2 quadSize;",
                    "    vec2 texcoord = (gl_FragCoord.xy / quadSize.xy);",

                    "const float blurSize = 1.0/64.0;",
                    "void main(void)",
                    "{",

                    "vec4 sum = vec4(0.0);",

                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y - 4.0*blurSize)) * 0.05;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y - 3.0*blurSize)) * 0.09;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y - 2.0*blurSize)) * 0.12;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y - blurSize)) * 0.15;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y)) * 0.16;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y + blurSize)) * 0.15;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y + 2.0*blurSize)) * 0.12;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y + 3.0*blurSize)) * 0.09;",
                    "sum += texture2D(inputTexture, vec2(texcoord.x, texcoord.y + 4.0*blurSize)) * 0.05;",

                    "gl_FragColor = sum;",
                    "}"
                ].join("\n")
            });
            forwardPipeline.addShader("blurShader",
                forwardPipeline.context.programFactory.getProgramByName("blur"));
        }
    };

    window.addEventListener("load", injectXFlowGLSLPipeline);

    (function () {

        var ShaderPass = function (pipeline, output, opt) {
            webgl.BaseRenderPass.call(this, pipeline, output, opt);
        };

        XML3D.createClass(ShaderPass, webgl.BaseRenderPass, {
            init: function (context) {
                var gl = this.gl = this.pipeline.context.gl;
                this.screenQuad = new webgl.FullscreenQuad(context);
                this.resultTexture = gl.createTexture();
                this.frameBuffer = gl.createFramebuffer();

                //These variables must be shared with webcl 
                this.initPos = new Float32Array(vertexArray);
                this.initNor = new Float32Array(normalArray);
                this.curPos = vertexArray;
                this.curNor = normalArray;
                this.curPosVBO = webglVertexBuffer;
                this.curNorVBO = webglNormalBuffer;

            },

            draw: function () {
                var gl = this.gl,
                    curPos = this.curPos,
                    curNor = this.curNor,
                    curPosVBO = this.curPosVBO,
                    curNorVBO = this.curNorVBO;

                gl.bindBuffer(gl.ARRAY_BUFFER, curPosVBO);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, curPos);

                gl.bindBuffer(gl.ARRAY_BUFFER, curNorVBO);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, curNor);
                //showDebugImage(textureBuffer, width, height);

            }
        });

        webgl.ShaderPass = ShaderPass;

    }());

    // WebCL section HERE

    (function () {
        webcl.kernels.register("clDisplace",
            ["        __constant int P_MASK = 255;",
"        __constant int P_SIZE = 256;",
"        __constant int P[512] = {151,160,137,91,90,15,",
"          131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,",
"          190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,",
"          88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,",
"          77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,",
"          102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,",
"          135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,",
"          5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,",
"          223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,",
"          129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,",
"          251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,",
"          49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,",
"          138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,",
"          151,160,137,91,90,15,",
"          131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,",
"          190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,",
"          88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,",
"          77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,",
"          102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,",
"          135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,",
"          5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,",
"          223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,",
"          129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,",
"          251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,",
"          49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,",
"          138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,",
"          };",

"        __constant int G_MASK = 15;",
"        __constant int G_SIZE = 16;",
"        __constant int G_VECSIZE = 4;",
"        __constant float G[16*4] = {",
"                 +1.0, +1.0, +0.0, 0.0 ,",
"                 -1.0, +1.0, +0.0, 0.0 ,",
"                 +1.0, -1.0, +0.0, 0.0 ,",
"                 -1.0, -1.0, +0.0, 0.0 ,",
"                 +1.0, +0.0, +1.0, 0.0 ,",
"                 -1.0, +0.0, +1.0, 0.0 ,",
"                 +1.0, +0.0, -1.0, 0.0 ,",
"                 -1.0, +0.0, -1.0, 0.0 ,",
"                 +0.0, +1.0, +1.0, 0.0 ,",
"                 +0.0, -1.0, +1.0, 0.0 ,",
"                 +0.0, +1.0, -1.0, 0.0 ,",
"                 +0.0, -1.0, -1.0, 0.0 ,",
"                 +1.0, +1.0, +0.0, 0.0 ,",
"                 -1.0, +1.0, +0.0, 0.0 ,",
"                 +0.0, -1.0, +1.0, 0.0 ,",
"                 +0.0, -1.0, -1.0, 0.0",
"        };",

"        int mod(int x, int a)",
"        {",
"                int n = (x / a);",
"                int v = v - n * a;",
"                if ( v < 0 )",
"                        v += a;",
"                return v;",
"        }",

"        float mix1d(float a, float b, float t)",
"        {",
"                float ba = b - a;",
"                float tba = t * ba;",
"                float atba = a + tba;",
"                return atba;",
"        }",

"        float2 mix2d(float2 a, float2 b, float t)",
"        {",
"                float2 ba = b - a;",
"                float2 tba = t * ba;",
"                float2 atba = a + tba;",
"                return atba;",
"        }",

"        float4 mix3d(float4 a, float4 b, float t)",
"        {",
"                float4 ba = b - a;",
"                float4 tba = t * ba;",
"                float4 atba = a + tba;",
"                return atba;",
"        }",

"        float smooth(float t)",
"        {",
"                return t*t*t*(t*(t*6.0f-15.0f)+10.0f);",
"        }",

"        int lattice3d(int4 i)",
"        {",
"                return P[i.x + P[i.y + P[i.z]]];",
"        }",

"        float gradient3d(int4 i, float4 v)",
"        {",
"                int index = (lattice3d(i) & G_MASK) * G_VECSIZE;",
"                float4 g = (float4)(G[index + 0], G[index + 1], G[index + 2], 1.0f);",
"                return dot(v, g);",
"        }",

"        float4 normalized(float4 v)",
"        {",
"                float d = sqrt(v.x * v.x + v.y * v.y + v.z * v.z);",
"                d = d > 0.0f ? d : 1.0f;",
"                float4 result = (float4)(v.x, v.y, v.z, 0.0f) / d;",
"                result.w = 1.0f;",
"                return result;",
"        }",

"        float gradient_noise3d(float4 position)",
"        {",

"                float4 p = position;",
"                float4 pf = floor(p);",
"                int4 ip = (int4)((int)pf.x, (int)pf.y, (int)pf.z, 0.0);",
"                float4 fp = p - pf;",
"                ip &= P_MASK;",

"                int4 I000 = (int4)(0, 0, 0, 0);",
"                int4 I001 = (int4)(0, 0, 1, 0);",
"                int4 I010 = (int4)(0, 1, 0, 0);",
"                int4 I011 = (int4)(0, 1, 1, 0);",
"                int4 I100 = (int4)(1, 0, 0, 0);",
"                int4 I101 = (int4)(1, 0, 1, 0);",
"                int4 I110 = (int4)(1, 1, 0, 0);",
"                int4 I111 = (int4)(1, 1, 1, 0);",

"                float4 F000 = (float4)(0.0f, 0.0f, 0.0f, 0.0f);",
"                float4 F001 = (float4)(0.0f, 0.0f, 1.0f, 0.0f);",
"                float4 F010 = (float4)(0.0f, 1.0f, 0.0f, 0.0f);",
"                float4 F011 = (float4)(0.0f, 1.0f, 1.0f, 0.0f);",
"                float4 F100 = (float4)(1.0f, 0.0f, 0.0f, 0.0f);",
"                float4 F101 = (float4)(1.0f, 0.0f, 1.0f, 0.0f);",
"                float4 F110 = (float4)(1.0f, 1.0f, 0.0f, 0.0f);",
"                float4 F111 = (float4)(1.0f, 1.0f, 1.0f, 0.0f);",

"                float n000 = gradient3d(ip + I000, fp - F000);",
"                float n001 = gradient3d(ip + I001, fp - F001);",

"                float n010 = gradient3d(ip + I010, fp - F010);",
"                float n011 = gradient3d(ip + I011, fp - F011);",

"                float n100 = gradient3d(ip + I100, fp - F100);",
"                float n101 = gradient3d(ip + I101, fp - F101);",

"                float n110 = gradient3d(ip + I110, fp - F110);",
"                float n111 = gradient3d(ip + I111, fp - F111);",

"                float4 n40 = (float4)(n000, n001, n010, n011);",
"                float4 n41 = (float4)(n100, n101, n110, n111);",

"                float4 n4 = mix3d(n40, n41, smooth(fp.x));",
"                float2 n2 = mix2d(n4.xy, n4.zw, smooth(fp.y));",
"                float n = 0.5f - 0.5f * mix1d(n2.x, n2.y, smooth(fp.z));",
"                return n;",
"        }",

"        float ridgedmultifractal3d(",
"                float4 position,",
"                float frequency,",
"                float lacunarity,",
"                float increment,",
"                float octaves)",
"        {",
"                int i = 0;",
"                float fi = 0.0f;",
"                float remainder = 0.0f;",
"                float sample = 0.0f;",
"                float value = 0.0f;",
"                int iterations = (int)octaves;",

"                float threshold = 0.5f;",
"                float offset = 1.0f;",
"                float weight = 1.0f;",

"                float signal = fabs( (1.0f - 2.0f * gradient_noise3d(position * frequency)) );",
"                signal = offset - signal;",
"                signal *= signal;",
"                value = signal;",

"                for ( i = 0; i < iterations; i++ )",
"                {",
"                        frequency *= lacunarity;",
"                        weight = clamp( signal * threshold, 0.0f, 1.0f );",
"                        signal = fabs( (1.0f - 2.0f * gradient_noise3d(position * frequency)) );",
"                        signal = offset - signal;",
"                        signal *= signal;",
"                        signal *= weight;",
"                        value += signal * pow( lacunarity, -fi * increment );",

"                }",
"                return value;",
"        }",


"        float4 cross3(float4 va, float4 vb)",
"        {",
"                float4 vc = (float4)(va.y*vb.z - va.z*vb.y,",
"                                                                va.z*vb.x - va.x*vb.z,",
"                                                                va.x*vb.y - va.y*vb.x, 0.0f);",
"                return vc;",
"        }",

"        // mod: sg",
"        /*float4 vload4_3(int index, float *va)",
"        {",
"                int i = 3*index;",
"                float4 vc = (float4) (va[i], va[i+1], va[i+2], 1.0f);",
"                return vc;",
"        }",
"        void vstore4_3(float4 vc, int index, float* va)",
"        {",
"                int i = 3*index;",
"                va[i  ] = vc.x;",
"                va[i+1] = vc.y;",
"                va[i+2] = vc.z;",
"        }*/",

"        // initPos -> vertices  enqueueWrite (before first run)",
"        // normals -> curNor    enqueueRead  (after each run)",
"        // output  -> curPos    enqueueRead  (after each run)",
"        //",

"        __kernel void clDisplace(",
"                const __global float *vertices,",
"                __global float *normals,",
"                __global float *output,",
"                float frequency,",
"                float amplitude,",
"                float phase,",
"                float lacunarity,",
"                float increment,",
"                float octaves,",
"                float roughness,",
"                uint count)",
"        {",
"                int tx = get_global_id(0);",
"                int ty = get_global_id(1);",
"                int sx = get_global_size(0);",
"                int index = ty * sx + tx;",
"                if(index >= count)",
"                        return;",

"                int2 di = (int2)(tx, ty);",

"                //float4 position = vload4_3((size_t)index, vertices);  // mod: sg",
"                int ii = 3*index;",
"                float4 position = (float4) (vertices[ii], vertices[ii+1], vertices[ii+2], 1.0f);",

"                float4 normal = position;",
"                position.w = 1.0f;",

"                roughness /= amplitude;",
"                float4 sample = position + (float4)(phase + 100.0f, phase + 100.0f, phase + 100.0f, 0.0f);",

"                float4 dx = (float4)(roughness, 0.0f, 0.0f, 1.0f);",
"                float4 dy = (float4)(0.0f, roughness, 0.0f, 1.0f);",
"                float4 dz = (float4)(0.0f, 0.0f, roughness, 1.0f);",

"                float f0 = ridgedmultifractal3d(sample, frequency, lacunarity, increment, octaves);",
"                float f1 = ridgedmultifractal3d(sample + dx, frequency, lacunarity, increment, octaves);",
"                float f2 = ridgedmultifractal3d(sample + dy, frequency, lacunarity, increment, octaves);",
"                float f3 = ridgedmultifractal3d(sample + dz, frequency, lacunarity, increment, octaves);",

"                float displacement = (f0 + f1 + f2 + f3) / 4.0;",

"                float4 vertex = position + (amplitude * displacement * normal);",
"                vertex.w = 1.0f;",

"                normal.x -= (f1 - f0);",
"                normal.y -= (f2 - f0);",
"                normal.z -= (f3 - f0);",
"                normal = normalized(normal / roughness);",

"                //vstore4_3(vertex, (size_t)index, output);  // mod: sg",
"                int jj = 3*index;",
"                output[jj  ] = vertex.x;",
"                output[jj+1] = vertex.y;",
"                output[jj+2] = vertex.z;",

"                //vstore4_3(normal, (size_t)index, normals); // mod: sg",
"                normals[jj  ] = normal.x;",
"                normals[jj+1] = normal.y;",
"                normals[jj+2] = normal.z;",
"        }"

            ].join("\n"));


        var kernel = webcl.kernels.getKernel("clDisplace"),
            oldBufSize = 0,
            buffers = {InitPosBuffer: null, curNorBuffer: null, curPosBuffer: null};


        Xflow.registerOperator("xflow.clNoiseKernel", {
            outputs: [
                {type: 'texture', name: 'result', sizeof: 'image'}
            ],
            params: [
                {type: 'texture', source: 'image'}
            ],

            evaluate: function (result, image) {
                //console.time("clThresholdImage");

                //passing xflow operators input data
                var width = image.width,
                    height = image.height,
                    imgSize = width * height,
                    NUM_VERTEX_COMPONENTS = 3,

                // These should be set via initGL
                    initPos = null,   // initial vertex positions
                    initNor = null,   // initial vertex normals (just needed for resetting)
                    curPos = null,    // current vertex positions
                    curNor = null,    // current vertex normals

                // simulation parameters
                    frequency = 1.0,
                    amplitude = 0.35,
                    phase = 0.0,
                    lacunarity = 2.0,
                    increment = 1.5,
                    octaves = 5.5,
                    roughness = 0.025,
                    nVertices = null,
                // Setup buffers
                    bufSize = nVertices * NUM_VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT, // size in bytes

                    initPosBuffer = buffers.initPosBuffer,
                    curPosBuffer = buffers.curPosBuffer,
                    curNorBuffer = buffers.curNorBuffer,

                    globalWorkSize = new Int32Array(2),
                    localWorkSize = new Int32Array(2);

                shaderPass.init();

                if (bufSize !== oldBufSize) {
                    oldBufSize = bufSize;

                    if (initPosBuffer && curNorBuffer && curPosBuffer) {
                        initPosBuffer.releaseCLResources();
                        curNorBuffer.releaseCLResources();
                        curPosBuffer.releaseCLResources();
                    }

                    // Setup WebCL context using the default device of the first available platform
                    initPosBuffer = buffers.initPosBuffer =  ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, bufSize);
                    curNorBuffer = buffers.curNorBuffer = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, bufSize);
                    curPosBuffer = buffers.curPosBuffer = ctx.createBuffer(WebCL.CL_MEM_WRITE_ONLY, bufSize);

                }

                // Initial load of initial position data
                cmdQueue.enqueueWriteBuffer(initPosBuffer, true, 0, bufSize, initPos);

                cmdQueue.finish();

                // Init ends here

                kernel.setArg(0, initPosBuffer);
                kernel.setArg(1, curNorBuffer);
                kernel.setArg(2, curPosBuffer);
                kernel.setArg(3, frequency, kernelArgType.FLOAT);
                kernel.setArg(4, amplitude, kernelArgType.FLOAT);
                kernel.setArg(5, phase, kernelArgType.FLOAT);
                kernel.setArg(6, lacunarity, kernelArgType.FLOAT);
                kernel.setArg(7, increment, kernelArgType.FLOAT);
                kernel.setArg(8, octaves, kernelArgType.FLOAT);
                kernel.setArg(9, roughness, kernelArgType.FLOAT);
                kernel.setArg(10, nVertices, kernelArgType.UINT);

               /* // Init ND-range
                var localWS = [16, 4],
                    globalWS = [Math.ceil(width / localWS[0]) * localWS[0],
                        Math.ceil(height / localWS[1]) * localWS[1]];*/

                // Get the maximum work group size for executing the kernel on the device
                //
                var workGroupSize = kernel.getWorkGroupInfo(device, WebCL.CL.KERNEL_WORK_GROUP_SIZE);

                globalWS[0] = 1;
                globalWS[1] = 1;
                while(globalWS[0] * globalWS[1] < nVertices) {
                    globalWS[0] = globalWS[0] * 2;
                    globalWS[1] = globalWS[1] * 2;
                }

                localWS[0] = globalWS[0];
                localWS[1] = globalWS[1];
                while (localWS[0] * localWS[1] > workGroupSize) {
                    localWS[0] = localWS[0] / 2;
                    localWS[1] = localWS[1] / 2;
                }

                // Execute (enqueue) kernel
           //     cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);
                cmdQueue.enqueueNDRangeKernel(kernel, null, globalWorkSize, localWorkSize);

                cmdQueue.finish();

                // Read the result buffer from OpenCL device
                cmdQueue.enqueueReadBuffer(curPosBuffer, true, 0, bufSize, curPos );
                cmdQueue.enqueueReadBuffer(curNorBuffer, true, 0, bufSize, curNor);

                shaderPass.draw();
                //console.timeEnd("clThresholdImage");

                return true;
            }

        });
    }());
}());