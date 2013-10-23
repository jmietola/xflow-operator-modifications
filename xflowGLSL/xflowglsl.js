(function () {


    XML3D.debug.loglevel = 4;
    var PostProcessingPipeline, forwardPipeline, currentPipeline, renderI, injectDepthPipeline, swapPipelines, blitPass;
    var buffers = {bufIn: null, bufOut: null};
    var webgl = XML3D.webgl;
    injectDepthPipeline = function () {
        var xml3ds = document.getElementsByTagName("xml3d");

        if (xml3ds[0]) {
            renderI = xml3ds[0].getRenderInterface();

            //The normal forward rendering pipeline is always available initially
            //It's also available as a render pass under the constructor XML3D.webgl.ForwardRenderPass(context),
            forwardPipeline = renderI.getRenderPipeline();

        //    renderI.setRenderPipeline(PostProcessingPipeline);
        //    currentPipeline = "depth";
            blitPass = new webgl.BlitPass(forwardPipeline);
            blitPass.init(forwardPipeline.context);

        }
    };

    window.addEventListener("load", injectDepthPipeline);

 (function () {

        var BlitPass = function (pipeline, output, opt) {
            webgl.BaseRenderPass.call(this, pipeline, output, opt);
        };

        XML3D.createClass(BlitPass, webgl.BaseRenderPass, {
            init: function (context) {

                var shader = context.programFactory.getProgramByName("grayscale");
                forwardPipeline.addShader("blitShader", shader);

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

            renderOnce: function (image) {
                var gl = this.gl,
                  //  width = this.canvasWidth,
                  //  height = this.canvasHeight,
                    program = forwardPipeline.getShader("blitShader"),
                    screenQuad = this.screenQuad,
                    textureBuffer = this.textureBuffer,
                    texture = this.resultTexture,
                    renderbuffer = this.renderBuffer,
                    framebuffer = this.frameBuffer,
                    debugCtx = this.debugCtx,

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
               //     gl.clearColor(1,0,0,0);
                //    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, texture);

                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 800, 600, 0, gl.RGBA, gl.UNSIGNED_BYTE, testData);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                    program.setUniformVariables({ inputTexture: texture, canvasSize: this.canvasSize});
                    screenQuad.draw(program);
                    gl.bindTexture(gl.TEXTURE_2D, null);

                    gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, textureBuffer);

                    // Debug code start ---
                    pixelData = new Uint8ClampedArray(textureBuffer);
                    imageData = debugCtx.createImageData(800, 600);
                    imageData.data.set(pixelData);
                    debugCtx.putImageData(imageData, 0, 0);

                    // --- Debug end

                    program.unbind();
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                return textureBuffer;
            }
        });

        webgl.BlitPass = BlitPass;

    }());

           /**
     * GLSL accelerated Grayscale operator
     */


    Xflow.registerOperator("xflow.glslGrayscale", {
        outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
        params:  [ {type: 'texture', source : 'image' } ],
        evaluate: function(result, image) {

        result.data.set(blitPass.renderOnce(image));

        return true;
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
           var d = result.data;
            d = image.data;
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
