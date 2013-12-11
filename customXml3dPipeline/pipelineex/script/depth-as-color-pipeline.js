(function () {
    var PostProcessingPipeline, forwardPipeline, currentPipeline, renderI, injectDepthPipeline, swapPipelines;

    injectDepthPipeline = function () {
        var xml3ds = document.getElementsByTagName("xml3d");

        if (xml3ds[0]) {
            renderI = xml3ds[0].getRenderInterface();

            //The normal forward rendering pipeline is always available initially
            //It's also available as a render pass under the constructor XML3D.webgl.ForwardRenderPass(context),
            forwardPipeline = renderI.getRenderPipeline();

            PostProcessingPipeline = new XML3D.webgl.PostProcessingPipeline(renderI.context);
            PostProcessingPipeline.init();
            renderI.setRenderPipeline(PostProcessingPipeline);
            currentPipeline = "depth";
        }
    };

    swapPipelines = function (evt) {
        if (evt.keyCode === 112) /* P */ {
            if (currentPipeline === "depth") {
                renderI.setRenderPipeline(forwardPipeline);
                currentPipeline = "forward";
            } else {
                renderI.setRenderPipeline(PostProcessingPipeline);
                currentPipeline = "depth";
            }
        }
    };

    window.addEventListener("keypress", swapPipelines);
    window.addEventListener("load", injectDepthPipeline);

    (function (webgl) {

        var PostProcessingPipeline = function (context) {
            webgl.RenderPipeline.call(this, context);
            this.createRenderPasses();
        };

        XML3D.createClass(PostProcessingPipeline, webgl.RenderPipeline);

        XML3D.extend(PostProcessingPipeline.prototype, {
            init: function () {
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

                //Register this target under the name "backBufferOne" so render passes may use it
                this.addRenderTarget("backBufferOne", backBuffer);

                //The screen is always available under context.canvastarget
                this.addRenderTarget("screen", context.canvastarget);

                //Remember to initialize each render pass
                this.renderPasses.forEach(function (pass) {
                    if (pass.init) {
                        pass.init(context);
                    }
                });
            },

            createRenderPasses: function () {
                //This is where the render process is defined as a series of render passes. They will be executed in the
                //order that they are added. XML3D.webgl.ForwardRenderPass may be used to draw all visible objects to the given target

                var forwardPass1 = new XML3D.webgl.ForwardRenderPass(this, "backBufferOne"),
                    webCLPass = new XML3D.webgl.WebCLPass(this, "backBufferOne", {inputs: { inputTexture: "backBufferOne" }}),
                    BlitPass = new XML3D.webgl.BlitPass(this, "screen", {inputs: { inputTexture: "backBufferOne" }});

                this.addRenderPass(forwardPass1);
                this.addRenderPass(webCLPass);
                this.addRenderPass(BlitPass);
            }
        });

        webgl.PostProcessingPipeline = PostProcessingPipeline;

    })(XML3D.webgl);


    (function (webgl) {

        var WebCLPass = function (pipeline, output, opt) {
            webgl.BaseRenderPass.call(this, pipeline, output, opt);
        };

        XML3D.createClass(WebCLPass, webgl.BaseRenderPass, {
            init: function (context) {
                this.debugCanvas = document.getElementById("debug");
                this.debugCtx = this.debugCanvas.getContext("2d");
                this.textureBuffer = new Uint8Array(context.canvasTarget.width * context.canvasTarget.height * 4);
                this.gl = this.pipeline.context.gl;
            },

            render: function (scene) {
                var gl = this.gl, sourceTex, pixelData, imageData;

                //Request the framebuffer from the render pipeline, using its name (in this case 'backBufferOne')
                sourceTex = this.pipeline.getRenderTarget(this.inputs.inputTexture);

                sourceTex.bind();
                gl.readPixels(0, 0, sourceTex.height, sourceTex.width, gl.RGBA, gl.UNSIGNED_BYTE, this.textureBuffer);
                sourceTex.unbind();

                // Debug code ---
                pixelData = new Uint8ClampedArray(this.textureBuffer);
                imageData = this.debugCtx.createImageData(sourceTex.height, sourceTex.width);
                imageData.data.set(pixelData);
                this.debugCtx.putImageData(imageData, 0, 0);

                // --- Debug end

                // TODO: Do something cool with WebCL here by modifying the texturebuffer in WebCL context.

                // We are giving input directly to output for now...
                console.log("this.output: " + sourceTex);

                this.output = sourceTex;

            }
        });

        webgl.WebCLPass = WebCLPass;

    }(XML3D.webgl));


    (function (webgl) {

        var BlitPass = function (pipeline, output, opt) {
            webgl.BaseRenderPass.call(this, pipeline, output, opt);
            this.screenQuad = {};
        };

        XML3D.createClass(BlitPass, webgl.BaseRenderPass, {
            init: function (context) {
                var shader = context.programFactory.getProgramByName("grayscale");
                this.pipeline.addShader("blitShader", shader);
                this.screenQuad = new XML3D.webgl.FullscreenQuad(context);
                this.canvasSize = new Float32Array([context.canvasTarget.width, context.canvasTarget.height]);
            },

            render: function (scene) {
                var gl = this.pipeline.context.gl;
                var target = this.pipeline.getRenderTarget(this.output);
                target.bind();
                gl.clear(gl.DEPTH_BUFFER_BIT || gl.COLOR_BUFFER_BIT);

                var program = this.pipeline.getShader("blitShader");
                program.bind();
                //Request the framebuffer from the render pipeline, using its name (in this case 'backBufferOne')
                var sourceTex = this.pipeline.getRenderTarget(this.inputs.inputTexture);
                console.log(sourceTex.colorTarget);

                program.setUniformVariables({ inputTexture: sourceTex.colorTarget, canvasSize: this.canvasSize});

                this.screenQuad.draw(program);

                program.unbind();
                target.unbind();
            }
        });

        webgl.BlitPass = BlitPass;

    }(XML3D.webgl));

    XML3D.shaders.register("drawTexture", {

        vertex: [
            "attribute vec3 position;",

            "void main(void) {",
            "   gl_Position = vec4(position, 0.0);",
            "}"
        ].join("\n"),

        fragment: [
            "uniform sampler2D inputTexture;",
            "uniform vec2 canvasSize;",

            "void main(void) {",
            "    vec2 texCoord = (gl_FragCoord.xy / canvasSize.xy);",
            "    gl_FragColor = texture2D(inputTexture, texCoord);",
            "}"
        ].join("\n"),

        uniforms: {
            canvasSize: [512, 512]
        },

        samplers: {
            inputTexture: null
        }
    });

}());



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
	"uniform vec2 canvasSize;",
    "    vec2 texcoord = (gl_FragCoord.xy / canvasSize.xy);",

	"void main(void)",
	"{",
    "vec4 frameColor = texture2D(inputTexture, texcoord);",
    "float luminance = frameColor.r * 0.3 + frameColor.g * 0.59 + frameColor.b * 0.11;",
    "gl_FragColor = vec4(luminance, luminance, luminance, frameColor.a);",

	"}"
    ].join("\n"),

    uniforms: {
	textureCoord : [512, 512]
    },

    samplers: {
        inputTexture : null
    }
});