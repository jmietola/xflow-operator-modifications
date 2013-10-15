(function () {
    var PostProcessingPipeline, forwardPipeline, currentPipeline, renderI, injectDepthPipeline, swapPipelines;
    var webgl = XML3D.webgl;
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
                    depthFormat: null,
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
                    BlitPass = new XML3D.webgl.BlitPass(this, "screen", {inputs: { inputTexture: "backBufferOne" }});

                this.addRenderPass(forwardPass1);
                this.addRenderPass(BlitPass);
            }
        });

        webgl.PostProcessingPipeline = PostProcessingPipeline;

    })(XML3D.webgl);


    /**
     * GLSL accelerated Grayscale operator
     */
    Xflow.registerOperator("xflow.glslGrayscale", {
        outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
        params:  [ {type: 'texture', source : 'image' } ],
        evaluate: function(result, image) {
        var resultTemp = result.data;



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

                program.setUniformVariables({ inputTexture: sourceTex.colorTarget, canvasSize: this.canvasSize});

                this.screenQuad.draw(program);

                program.unbind();
                target.unbind();

                // Reading pixels from framebuffer
                var pixels = new Uint8Array(256 * 256 * 4);
                gl.readPixels( 0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                var pixelsData = new Uint8ClampedArray(pixels);

                canvasImg = document.getElementById("debug");
                var canvasImgCtx = canvasImg.getContext("2d");

                var imageData = canvasImgCtx.createImageData(256, 256);
                imageData.data.set(pixelsData);
                canvasImgCtx.putImageData(imageData, 0, 0);
                resultTemp.set(pixelsData);

            }
        });

        webgl.BlitPass = BlitPass;

        }
    });

    /**
     * GLSL accelerated Invert operator
     */
    Xflow.registerOperator("xflow.glslInvert", {
        outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
        params:  [ {type: 'texture', source : 'image'} ],
        evaluate: function(result, image) {
    //	console.time("dataflowtimeSecond");
    //       var d = result.data;

    //	d = start(image,d);
    //	console.timeEnd("dataflowtimeSecond");
        }
    });


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

}());













