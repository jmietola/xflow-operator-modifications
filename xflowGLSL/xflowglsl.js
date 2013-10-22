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


    (function () {

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

                var forwardPass1 = new webgl.ForwardRenderPass(this, "screen"),
                  BlitPass = new webgl.BlitPass(this);

                this.addRenderPass(forwardPass1);
                this.addRenderPass(BlitPass);
            }
        });

        webgl.PostProcessingPipeline = PostProcessingPipeline;

    }());

    /**
     * GLSL accelerated Grayscale operator
     */
    Xflow.registerOperator("xflow.glslGrayscale", {
        outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
        params:  [ {type: 'texture', source : 'image' } ],
        evaluate: function(result, image) {
        var resultTemp = result.data;

    (function () {

        var BlitPass = function (pipeline, output, opt) {
            webgl.BaseRenderPass.call(this, pipeline, output, opt);
        };

        XML3D.createClass(BlitPass, webgl.BaseRenderPass, {
            init: function (context) {

                var shader = context.programFactory.getProgramByName("grayscale");
                this.pipeline.addShader("blitShader", shader);

                // WebGL
                this.gl = this.pipeline.context.gl;
                this.debugCanvas = document.getElementById("debug");
                this.debugCtx = this.debugCanvas.getContext("2d");
                this.canvasWidth = context.canvasTarget.width;
                this.canvasHeight = context.canvasTarget.height;
                this.canvasSize = new Float32Array([this.canvasWidth, this.canvasHeight]);
                this.screenQuad = new webgl.FullscreenQuad(context);
                this.resultTexture = this.gl.createTexture();
                this.renderBuffer = this.gl.createRenderbuffer();
                this.frameBuffer = this.gl.createFramebuffer();
                this.textureBuffer = new Uint8Array(context.canvasTarget.width * context.canvasTarget.height * 4);


            },

            render: function (scene) {
                var gl = this.gl,
                  //  width = this.canvasWidth,
                  //  height = this.canvasHeight,
                    program = this.pipeline.getShader("blitShader"),
                    renderTarget = this.pipeline.getRenderTarget(this.output),
                    screenQuad = this.screenQuad,
                    textureBuffer = new Uint8Array(800 * 600 * 4),
                    texture = this.resultTexture,
                    renderbuffer = this.renderBuffer,
                    framebuffer = this.frameBuffer,
                    debugCtx = this.debugCanvas.getContext("2d"),
                    //Variables for debugging
                    pixelData, imageData;

                    var width = 800;
                    var height = 600;

                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
               //     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    var testData = new Uint8Array(image.data);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 800, 600, 0, gl.RGBA, gl.UNSIGNED_BYTE, testData);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);



                    gl.bindTexture(gl.TEXTURE_2D, null);

                    //2. Init Render Buffer
                    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 800, 600);

                    //3. Init Frame Buffer
                    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                    // Attach the texture to the framebuffer
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

                    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

                    //4. Clean up
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


                    // Render scene to fbo
                    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

                    program.bind();
                    gl.clearColor(1,0,0,0);
            //        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, texture);

                    // Creating texture from pixel data

                    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);


                //    gl.uniform1i(gl.getUniformLocation(program.program.handle, "inputTexture"), 0);
                    program.setUniformVariables({ inputTexture: texture, canvasSize: this.canvasSize});
                    screenQuad.draw(program);
                    gl.bindTexture(gl.TEXTURE_2D, null);

                    gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, textureBuffer);


                    program.unbind();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


                    // Debug code start ---
                    pixelData = new Uint8ClampedArray(textureBuffer);
                    imageData = debugCtx.createImageData(800, 600);
                    imageData.data.set(pixelData);
                    debugCtx.putImageData(imageData, 0, 0);
                    resultTemp.set(pixelData);
                    // --- Debug end

            }
        });

        webgl.BlitPass = BlitPass;

    }());


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

    XML3D.shaders.register("grayscaletest", {

    vertex: [
        "attribute vec3 position;",

        "void main(void) {",
        "   gl_Position = vec4(position, 0.0);",
        "}"

    ].join("\n"),

    fragment: [
     " #ifdef GL_ES",
	  "precision highp float;",
	  "#endif",

	  "varying highp vec2 vTextureCoord;",

      "uniform sampler2D uSampler;",

      "void main(void) {",

		"// Convert to grayscale",
		"vec3 color = texture2D(uSampler, vTextureCoord).rgb;",
		"float gray = (color.r + color.g + color.b) / 3.0;",
		"vec3 grayscale = vec3(gray);",

		"gl_FragColor = vec4(grayscale, 1.0);",
        "}"
    ].join("\n")

});

}());
