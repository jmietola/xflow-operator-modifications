(function () {

    function logError(e) {
        document.getElementById("output").innerHTML += "<h3>ERROR:</h3><pre style=\"color:red;\">" + e.message + "</pre>";
    }

    //Let's create these here to gain a lot of performance
    var platforms = WebCL.getPlatformIDs(),
        ctx = WebCL.createContextFromType([WebCL.CL_CONTEXT_PLATFORM, platforms[0]], WebCL.CL_DEVICE_TYPE_DEFAULT),
        devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);

    //console.log(devices[0].getDeviceInfo(WebCL.CL_DEVICE_NAME));

    // First check if the WebCL extension is installed at all
    if (window.WebCL === undefined) {
        alert("Unfortunately your system does not support WebCL. " +
            "Make sure that you have both the OpenCL driver " +
            "and the WebCL browser extension installed.");
        logError(new Error("No WebCL available!"));
        return;
    }

            var clProgramDesaturate = "__kernel void clDesaturate(__global const uchar4* src, __global uchar4* dst, uint width, uint height)" +
                "{" +
                "int x = get_global_id(0);" +
                "int y = get_global_id(1);" +
                "if (x >= width || y >= height) return;" +
                "int i = y * width + x; uchar4 color = src[i];" +
                "uchar lum = (uchar)(0.30f * color.x + 0.59f * color.y + 0.11f * color.z);" +
                "dst[i] = (uchar4)(lum, lum, lum, 255);" +
                "}",


        // Create and build program
            program = ctx.createProgramWithSource(clProgramDesaturate /* loadKernel("clProgramDesaturate")*/),
            devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES),
            kernel;

        try {
            program.buildProgram([devices[0]], "");
        } catch (e) {
            alert("Failed to build WebCL program. Error "
                + program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
                + ": " + program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
            logError(e);
        }

        // Create kernel and set arguments
        try {
            kernel = program.createKernel("clDesaturate");
        } catch (e) {
            alert("Failed to build WebCL program. Error "
                + program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
                + ": " + program.getProgramBuildInfo(devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
            logError(e);
            return;
        }
});


var depthPipeline, forwardPipeline, currentPipeline, renderI;

window.injectDepthPipeline = function() {
	var xml3ds = document.getElementsByTagName("xml3d");
	if (xml3ds[0]) {
		renderI = xml3ds[0].getRenderInterface();
		//The normal forward rendering pipeline is always available initially
		//It's also available as a render pass under the constructor XML3D.webgl.ForwardRenderPass(context), 
		forwardPipeline = renderI.getRenderPipeline();
		XML3D.webgl.renderers[1];
		depthPipeline = new XML3D.webgl.DepthRenderPipeline(renderI.context);
		depthPipeline.init();
		renderI.setRenderPipeline(depthPipeline);
		currentPipeline = "depth";
	}
}
window.swapPipelinesIfNeeded = function(evt) {
	if (evt.keyCode === 112) /* P */ {
		if (currentPipeline === "depth") {
			renderI.setRenderPipeline(forwardPipeline);
			currentPipeline = "forward";
		} else {
			renderI.setRenderPipeline(depthPipeline);
			currentPipeline = "depth";
		}
	}
}
window.addEventListener("keypress", swapPipelinesIfNeeded);
window.addEventListener("load", injectDepthPipeline);

(function (webgl) {

    var DepthRenderPipeline = function (context) {
        webgl.RenderPipeline.call(this, context);
		this.createRenderPasses();
    };

    XML3D.createClass(DepthRenderPipeline, webgl.RenderPipeline);

    XML3D.extend(DepthRenderPipeline.prototype, {
        init: function() {
            var context = this.context;
			//Also available: webgl.GLScaledRenderTarget
			var backBuffer = new webgl.GLRenderTarget(context, {
                width: context.canvasTarget.width,
                height: context.canvasTarget.height,
                colorFormat: context.gl.RGBA,
                depthFormat: context.gl.DEPTH_COMPONENT16,
                stencilFormat: null,
                depthAsRenderbuffer: true
            });

            var backBufferTwo = new webgl.GLRenderTarget(context, {
                width: context.canvasTarget.width,
                height: context.canvasTarget.height,
                colorFormat: context.gl.RGBA,
                depthFormat: context.gl.DEPTH_COMPONENT16,
                stencilFormat: null,
                depthAsRenderbuffer: true
            });

			//Register this target under the name "backBufferOne" so render passes may use it
            this.addRenderTarget("backBufferOne", backBuffer);

			//Register this target under the name "backBufferOne" so render passes may use it
            this.addRenderTarget("backBufferTwo", backBufferTwo);

			//The screen is always available under context.canvastarget
			this.addRenderTarget("screen", context.canvastarget);
			//Remember to initialize each render pass
            this.renderPasses.forEach(function(pass) {
                if (pass.init) {
                    pass.init(context);
                }
            });
        },
		
		createRenderPasses: function() {
			//This is where the render process is defined as a series of render passes. They will be executed in the
			//order that they are added. XML3D.webgl.ForwardRenderPass may be used to draw all visible objects to the given target
			var depthPass = new XML3D.webgl.DepthPass(this, "backBufferOne");
			this.addRenderPass(depthPass);

        	//Blurpass uses backBufferOne as input and simply draws it to the backBufferOne
			var blurPass = new XML3D.webgl.ForwardRenderPass(this, "backBufferTwo", {inputs : { inputTexture:"backBufferOne" }});
			this.addRenderPass(blurPass);

            //Blitpass uses backBufferOne as input and simply draws it to the screen
			var blitPass = new XML3D.webgl.BlitPass(this, "screen", {inputs : { inputTexture:"backBufferTwo" }});
			this.addRenderPass(blitPass);



		}
    });

    webgl.DepthRenderPipeline = DepthRenderPipeline;

})(XML3D.webgl);


(function (webgl) {

    var DepthPass = function(pipeline, output, opt) {
        webgl.BaseRenderPass.call(this, pipeline, output, opt);
    };

    XML3D.createClass(DepthPass, webgl.BaseRenderPass, {
        init: function(context) {
            var shader = context.programFactory.getProgramByName("depthAsColor");
            this.pipeline.addShader("depthShader", shader);
        },

        render: (function() {
            var c_projMat_tmp = XML3D.math.mat4.create();
            var tmpModelViewProjection = XML3D.math.mat4.create();

            return function(scene) {
                var gl = this.pipeline.context.gl;
                var objects = scene.ready;
                var target = this.pipeline.getRenderTarget(this.output);
                target.bind();

                gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
				gl.viewport(0, 0, target.getWidth(), target.getHeight());
                gl.enable(gl.DEPTH_TEST);

                scene.getActiveView().getProjectionMatrix(c_projMat_tmp, target.width / target.height);
                scene.updateReadyObjectsFromActiveView(target.getWidth() / target.getHeight());

                var parameters = {};
                var program = this.pipeline.getShader("depthShader");
                program.bind();

                for (var i = scene.firstOpaqueIndex, n = objects.length; i < n; i++) {
                    var obj = objects[i];
                    if (!obj.isVisible())
                        continue;

                    var mesh = obj.mesh;
                    XML3D.debug.assert(mesh, "We need a mesh at this point.");

                    obj.getModelViewProjectionMatrix(tmpModelViewProjection);
                    parameters["modelViewProjectionMatrix"] = tmpModelViewProjection;
                    program.setUniformVariables(parameters);
                    mesh.draw(program);



                }



                program.unbind();
                target.unbind();
            }
        })()

    });

    webgl.DepthPass = DepthPass;

}(XML3D.webgl));

(function (webgl) {

    var BlurPass = function(pipeline, output, opt) {
        webgl.BaseRenderPass.call(this, pipeline, output, opt);
        this.screenQuad = {};
    };

    XML3D.createClass(BlurPass, webgl.BaseRenderPass, {
        init: function(context) {
            var shader = context.programFactory.getProgramByName("blur");
            this.pipeline.addShader("blurShader", shader);
            this.screenQuad = new XML3D.webgl.FullscreenQuad(context);
            this.canvasSize = new Float32Array([context.canvasTarget.width, context.canvasTarget.height]);
        },

        render: function(scene) {
            var gl = this.pipeline.context.gl;
            var target = this.pipeline.getRenderTarget(this.output);
            target.bind();
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

            var program = this.pipeline.getShader("blurShader");
            program.bind();

			//Request the framebuffer from the render pipeline, using its name (in this case 'backBufferOne')
			var sourceTex = this.pipeline.getRenderTarget(this.inputs.inputTexture);

            program.setUniformVariables({ inputTexture : sourceTex.colorTarget, canvasSize :  this.canvasSize});

            this.screenQuad.draw(program);
                // Reading pixels from framebuffer
                var pixels = new Uint8Array(512 * 512 * 4);
                gl.readPixels( 0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                var pixelsData = new Uint8ClampedArray(pixels);

                canvasImg = document.getElementById("canvasImg");
                var canvasImgCtx = canvasImg.getContext("2d");

                var imageData = canvasImgCtx.createImageData(512, 512);
                imageData.data.set(pixelsData);
                canvasImgCtx.putImageData(imageData, 0, 0);
            program.unbind();
            target.unbind();
        }
    });

    webgl.ForwardRenderPass = BlurPass;

}(XML3D.webgl));

(function (webgl) {

    var BlitPass = function(pipeline, output, opt) {
        webgl.BaseRenderPass.call(this, pipeline, output, opt);
        this.screenQuad = {};
    };

    XML3D.createClass(BlitPass, webgl.BaseRenderPass, {
        init: function(context) {
            var shader = context.programFactory.getProgramByName("colorFromDepth");
            this.pipeline.addShader("blitShader", shader);
            this.screenQuad = new XML3D.webgl.FullscreenQuad(context);
            this.canvasSize = new Float32Array([context.canvasTarget.width, context.canvasTarget.height]);
        },

        render: function(scene) {
            var gl = this.pipeline.context.gl;
            var target = this.pipeline.getRenderTarget(this.output);
            target.bind();
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

            var program = this.pipeline.getShader("blitShader");
            program.bind();

			//Request the framebuffer from the render pipeline, using its name (in this case 'backBufferOne')
			var sourceTex = this.pipeline.getRenderTarget(this.inputs.inputTexture);

            program.setUniformVariables({ inputTexture : sourceTex.colorTarget, canvasSize :  this.canvasSize});

            this.screenQuad.draw(program);

            program.unbind();
            target.unbind();
        }
    });

    webgl.BlitPass = BlitPass;

}(XML3D.webgl));


XML3D.shaders.register("depthAsColor", {

    vertex: [
        "attribute vec3 position;",
        "uniform mat4 modelViewProjectionMatrix;",

        "void main(void) {",
        "   gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);",
        "}"
    ].join("\n"),

    fragment: [
        "const vec4 bitShift = vec4(16777216.0, 65536.0, 256.0, 1.0);",
        "const vec4 bitMask = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);",

        "void main(void) {",
        "    float depth = gl_FragCoord.z;",
        "    vec4 encoded = fract(depth * bitShift);",
        "    encoded = encoded - encoded.xxyz * bitMask;",
        "    gl_FragColor = encoded;",
        "}"
    ].join("\n"),

    uniforms: {
    }
});

XML3D.shaders.register("colorFromDepth", {

    vertex: [
        "attribute vec3 position;",

        "void main(void) {",
        "   gl_Position = vec4(position, 0.0);",
        "}"
    ].join("\n"),

    fragment: [
        "uniform sampler2D inputTexture;",
        "uniform vec2 canvasSize;",

        "const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);",

        "void main(void) {",
        "    vec2 texcoord = (gl_FragCoord.xy / canvasSize.xy);",
        "    float depth = dot(texture2D(inputTexture, texcoord), bitShift);",
        "    gl_FragColor = vec4(depth, depth, depth, 1.0);",
        "}"
    ].join("\n"),

    uniforms: {
        canvasSize : [512, 512]
    },

    samplers: {
        inputTexture : null
    }
});



XML3D.shaders.register("blur", {

    vertex: [
        "attribute vec3 position;",

        "void main(void) {",
        "   gl_Position = vec4(position, 0.0);",
        "}"
    ].join("\n"),

    fragment: [
	"uniform sampler2D inputTexture;",
	"uniform vec2 canvasSize;",
       "    vec2 texcoord = (gl_FragCoord.xy / canvasSize.xy);",

	"const float blurSize = 1.0/512.0;",
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
    ].join("\n"),

    uniforms: {
	canvasSize : [512, 512]
    },

    samplers: {
        inputTexture : null
    }
});
