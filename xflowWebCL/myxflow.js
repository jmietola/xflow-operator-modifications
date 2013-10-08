	 //Let's create these here to gain a lot of performance
    	 var platforms = WebCL.getPlatformIDs();  
	 var ctx = WebCL.createContextFromType ([WebCL.CL_CONTEXT_PLATFORM, platforms[0]],
											  WebCL.CL_DEVICE_TYPE_DEFAULT);                 	

/**
 * WebCL accelerated Grayscale
 */
Xflow.registerOperator("xflow.webclGrayscaleImages", {
    outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
    params:  [ {type: 'texture', source : 'image'} ],
    evaluate: function(result, image) {

	console.time("dataflowtimeWebCL"); 

        var s = image.data;
        var d = result;

	 var clprogramgrayscale =  "__kernel void clGrayscale(__global const uchar4* src, __global uchar4* dst, uint width, uint height) { int x = get_global_id(0); int y = get_global_id(1); if (x >= width || y >= height) return; int i = y * width + x;  uchar4 color = src[i];  uchar lum = (uchar)(0.30f * color.x + 0.59f * color.y + 0.11f * color.z); dst[i] = (uchar4)(lum, lum, lum, 255);}";

	try {

	  // First check if the WebCL extension is installed at all 
	  if (window.WebCL == undefined) {
		alert("Unfortunately your system does not support WebCL. " +
			  "Make sure that you have both the OpenCL driver " +
			  "and the WebCL browser extension installed.");
		return false;
	  }

	  //passing xflow operators input data
      	  var width = image.width;
          var height = image.height;
	  var pixels = image;
	  
	  // Setup buffers
	  var imgSize = width * height;
	  var bufSize = imgSize * 4; // size in bytes

	  // Setup WebCL context using the default device of the first available platform
	  var bufIn = ctx.createBuffer (WebCL.CL_MEM_READ_ONLY, bufSize);
	  var bufOut = ctx.createBuffer (WebCL.CL_MEM_WRITE_ONLY, bufSize);

	  // Create and build program
	  // var kernelSrc = loadKernel("clProgramDesaturate");
	  var kernelSrc = clprogramgrayscale; 
	  var program = ctx.createProgramWithSource(kernelSrc);
	  var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	
//	  console.log(devices[0].getDeviceInfo(WebCL.CL_DEVICE_NAME));

	  try {
		program.buildProgram ([devices[0]], "");
	  } catch(e) {
		alert ("Failed to build WebCL program. Error "
			   + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
			   + ":  " + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
		throw e;
	  }

	  // Create kernel and set arguments
	  var kernel = program.createKernel ("clGrayscale");
	  kernel.setKernelArg (0, bufIn);
	  kernel.setKernelArg (1, bufOut);
	  kernel.setKernelArg (2, width, WebCL.types.UINT);
	  kernel.setKernelArg (3, height, WebCL.types.UINT);

	  // Create command queue using the first available device
	  var cmdQueue = ctx.createCommandQueue (devices[0], 0);

	  // Write the buffer to OpenCL device memory
	  cmdQueue.enqueueWriteBuffer (bufIn, false, 0, bufSize, pixels.data, []);

	  // Init ND-range 
	  var localWS = [16,4];  
	  var globalWS = [Math.ceil (width / localWS[0]) * localWS[0], 
					  Math.ceil (height / localWS[1]) * localWS[1]];
						
	  // Execute (enqueue) kernel
	
	  cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);

	  // Read the result buffer from OpenCL device
	  cmdQueue.enqueueReadBuffer (bufOut, false, 0, bufSize, d.data, []);

	  cmdQueue.finish (); //Finish all the operations
	 
	} catch(e) {
	  document.getElementById("output").innerHTML += "<h3>ERROR:</h3><pre style=\"color:red;\">" + e.message + "</pre>";
	  throw e;
	}

	console.timeEnd("dataflowtimeWebCL");

        return true;
    }
  
});


/**
 * WebCL accelerated Grayscale
 */
Xflow.registerOperator("xflow.webclGrayscaleImagesSecond", {
    outputs: [ {type: 'texture', name : 'result', sizeof : 'image'} ],
    params:  [ {type: 'texture', source : 'image'} ],
    evaluate: function(result, image) {
	console.time("dataflowtimeWebclSecond"); 
      //  var width = image.width;
       // var height = image.height;
        var s = image.data;
        var d = result;


	 var clprogramdesaturate =  "__kernel void clDesaturate(__global const uchar4* src, __global uchar4* dst, uint width, uint height) { int x = get_global_id(0); int y = get_global_id(1); if (x >= width || y >= height) return; int i = y * width + x;  uchar4 color = src[i];  uchar lum = (uchar)(0.30f * color.x + 0.59f * color.y + 0.11f * color.z); dst[i] = (uchar4)(lum, lum, lum, 255);}";
                	
	// All output is written to element by id "output"
	var output = document.getElementById("output");
	output.innerHTML = "";

	try {

	  // First check if the WebCL extension is installed at all 
	  if (window.WebCL == undefined) {
		alert("Unfortunately your system does not support WebCL. " +
			  "Make sure that you have both the OpenCL driver " +
			  "and the WebCL browser extension installed.");
		return false;
	  }

	  //passing xflow operators input data
      	  var width = image.width;
          var height = image.height;
	  var pixels = image;
	  
	  // Setup buffers
	  var imgSize = width * height;
	  var bufSize = imgSize * 4; // size in bytes
	  
	  var bufIn = ctx.createBuffer (WebCL.CL_MEM_READ_ONLY, bufSize);
	  var bufOut = ctx.createBuffer (WebCL.CL_MEM_WRITE_ONLY, bufSize);

	   // Create and build program
	 // var kernelSrc = loadKernel("clProgramDesaturate");
	  var kernelSrc = clprogramdesaturate; 
	  var program = ctx.createProgramWithSource(kernelSrc);
	  var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	  try {
		program.buildProgram ([devices[0]], "");
	  } catch(e) {
		alert ("Failed to build WebCL program. Error "
			   + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
			   + ":  " + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
		throw e;
	  }

	  // Create kernel and set arguments
	  var kernel = program.createKernel ("clDesaturate");
	  kernel.setKernelArg (0, bufIn);
	  kernel.setKernelArg (1, bufOut);
	  kernel.setKernelArg (2, width, WebCL.types.UINT);
	  kernel.setKernelArg (3, height, WebCL.types.UINT);

	  // Create command queue using the first available device
	  var cmdQueue = ctx.createCommandQueue (devices[0], 0);

	  // Write the buffer to OpenCL device memory
	  cmdQueue.enqueueWriteBuffer (bufIn, false, 0, bufSize, pixels.data, []);

	  // Init ND-range 
	  var localWS = [16,4];  
	  var globalWS = [Math.ceil (width / localWS[0]) * localWS[0], 
					  Math.ceil (height / localWS[1]) * localWS[1]];
						
	  // Execute (enqueue) kernel
	
	  cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);

	  // Read the result buffer from OpenCL device
	  cmdQueue.enqueueReadBuffer (bufOut, false, 0, bufSize, d.data, []);

	  cmdQueue.finish (); //Finish all the operations
	  
	} catch(e) {
	  document.getElementById("output").innerHTML += "<h3>ERROR:</h3><pre style=\"color:red;\">" + e.message + "</pre>";
	  throw e;
	}
	console.timeEnd("dataflowtimeWebclSecond");
        return true;
    }
});


