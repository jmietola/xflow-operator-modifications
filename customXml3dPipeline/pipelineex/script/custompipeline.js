var customPipeline, forwardPipeline, currentPipeline, renderI;

window.injectCustomPipeline = function(){
	var xml3ds = document.getElementsByTagName("xml3d");
	if (xml3ds[0]) {
		renderI = xml3ds[0].getRenderInterface();
		//The normal forward rendering pipeline is always available initially
		//It's also available as a render pass under the constructor XML3D.webgl.ForwardRenderPass(context), 
		forwardPipeline = renderI.getRenderPipeline();

		customPipeline = new XML3D.webgl.RenderPipeline(renderI.context);
		customPipeline.init();
		renderI.setRenderPipeline(customPipeline);
		currentPipeline = "custom";
	}

}


(function (webgl) {

    var CustomRenderPipeline = function (context) {
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
			//Register this target under the name "backBufferOne" so render passes may use it
            this.addRenderTarget("backBufferOne", backBuffer);
			
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
			
			//Blitpass uses backBufferOne as input and simply draws it to the screen
			var blitPass = new XML3D.webgl.BlitPass(this, "screen", {inputs : { inputTexture:"backBufferOne" }});
			this.addRenderPass(blitPass);
		}
    });

    webgl.DepthRenderPipeline = DepthRenderPipeline;

})(XML3D.webgl);
