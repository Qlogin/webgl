"use strict";

var canvas;
var gl;

var color1Ctrl;
var color2Ctrl;
var widthCtrl;
var repeatCtrl;

var color1Loc;
var color2Loc;
var repeatLenLoc;

var vPosLoc;
var vLenLoc;

var lines = [];

var lastPosX = 0;
var lastPosY = 0;

function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

function getColorValue(strcol)
{
    var color = [1.0, 1.0, 1.0];
    color[0] = hexToR(strcol) / 255;
    color[1] = hexToG(strcol) / 255;
    color[2] = hexToB(strcol) / 255;
    return color;
}

function getCoord(x, y)
{
   return vec2(2 * (x / canvas.width - 0.5),
               2 * (0.5 - y / canvas.height));
}

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Initialize our data for the Sierpinski Gasket
    //

    // First, initialize the corners of our gasket with three points.

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.91, 0.86, 0.79, 1.0 );

    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    vPosLoc = gl.getAttribLocation( program, "vPos" );
    vLenLoc = gl.getAttribLocation( program, "vLen" );

    color1Loc = gl.getUniformLocation(program, "color1");
    color2Loc = gl.getUniformLocation(program, "color2");
    repeatLenLoc = gl.getUniformLocation(program, "repeatLen");

    // Controls
    color1Ctrl = document.getElementById("color1");
    color2Ctrl = document.getElementById("color2");
    widthCtrl = document.getElementById("pen-width");
    repeatCtrl = document.getElementById("repeat");

    var clearBtn = document.getElementById("clear-btn");
    clearBtn.onclick = function(event) {
       lines = [];
       render();
    };

    // Drawing events
    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);
};

function mouseDown(event)
{
   if (event.buttons != 1)
      return;

   lastPosX = event.offsetX;
   lastPosY = event.offsetY;

   var new_line = new Object();
   new_line.color1 = getColorValue(color1Ctrl.value);
   new_line.color2 = getColorValue(color2Ctrl.value);
   new_line.repeat = parseInt(repeatCtrl.value, 10);
   new_line.total = 0;

   new_line.width = parseInt(widthCtrl.value, 10);
   new_line.points = [getCoord(event.offsetX, event.offsetY)];
   new_line.lens   = [0];

   new_line.vBuffer = gl.createBuffer();
   gl.bindBuffer( gl.ARRAY_BUFFER, new_line.vBuffer );
   gl.bufferData( gl.ARRAY_BUFFER, flatten(new_line.points), gl.DYNAMIC_DRAW );

   new_line.lBuffer = gl.createBuffer();
   gl.bindBuffer( gl.ARRAY_BUFFER, new_line.lBuffer );
   gl.bufferData( gl.ARRAY_BUFFER, flatten(new_line.lens), gl.DYNAMIC_DRAW );

   lines.push(new_line);
}

function mouseMove(event)
{
   if (event.buttons != 1)
      return;

   var dx = lastPosX - event.offsetX;
   var dy = lastPosY - event.offsetY;
   var len = Math.sqrt(dx * dx + dy * dy);
   if (len < 5)
      return;

   lastPosX = event.offsetX;
   lastPosY = event.offsetY;

   var last = lines.length - 1;
   lines[last].total += len;
   lines[last].points.push(getCoord(event.offsetX, event.offsetY));
   lines[last].lens.push(lines[last].total);

   gl.bindBuffer( gl.ARRAY_BUFFER, lines[last].vBuffer );
   gl.bufferData( gl.ARRAY_BUFFER, flatten(lines[last].points), gl.DYNAMIC_DRAW );

   gl.bindBuffer( gl.ARRAY_BUFFER, lines[last].lBuffer );
   gl.bufferData( gl.ARRAY_BUFFER, flatten(lines[last].lens), gl.DYNAMIC_DRAW );

   render();
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT );

    var i;
    for (i in lines)
    {
        gl.uniform3fv( color1Loc, lines[i].color1 );
        gl.uniform3fv( color2Loc, lines[i].color2 );
        gl.uniform1f( repeatLenLoc, lines[i].repeat );

        // Associate out shader variables with our data buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, lines[i].vBuffer );
        gl.vertexAttribPointer( vPosLoc, 2, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vPosLoc );

        gl.bindBuffer( gl.ARRAY_BUFFER, lines[i].lBuffer );
        gl.vertexAttribPointer( vLenLoc, 1, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vLenLoc );

        // Draw
        gl.lineWidth( lines[i].width );
        gl.drawArrays( gl.LINE_STRIP, 0, lines[i].points.length );
    }
}
