"use strict";

var canvas;
var gl;

var points = [];

var numTimesToSubdivide = 0;
var mode = 1;
var phi = 0;
var phiLoc;
var theta = 0;
var thetaLoc;

var color = [1.0, 1.0, 1.0];
var colorLoc;

var bufferId;

function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

function storeColorValue(target)
{
    var strcol = target.value;
    color[0] = hexToR(strcol) / 255;
    color[1] = hexToG(strcol) / 255;
    color[2] = hexToB(strcol) / 255;
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

    // Load the data into the GPU

    bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, 4 * 2 * 3 * Math.pow(4, 10), gl.STATIC_DRAW );


    // Associate out shader variables with our data buffer

    var vPos = gl.getAttribLocation( program, "vPos" );
    gl.vertexAttribPointer( vPos, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPos );

    phiLoc = gl.getUniformLocation(program, "phi");
    thetaLoc = gl.getUniformLocation(program, "theta");
    colorLoc = gl.getUniformLocation(program, "color");

    // Controls
    var colEl = document.getElementById("color");
    colEl.onchange = function(event) {
        storeColorValue(event.target);
        render();
    };

    var levelEl = document.getElementById("level");
    levelEl.oninput = function(event) {
        numTimesToSubdivide = event.target.value;
        update();
    };

    var phiEl = document.getElementById("phi");
    phiEl.oninput = function(event) {
        phi = event.target.value;
        render();
    };

    var thetaEl = document.getElementById("theta");
    thetaEl.oninput = function(event) {
        theta = event.target.value;
        render();
    }

    var modeEl = document.getElementById("mode");
    modeEl.onchange = function(event) {
        mode = event.target.value;
        update();
    }

    storeColorValue(colEl);
    numTimesToSubdivide = levelEl.value;
    phi = phiEl.value;
    theta = thetaEl.value;
    mode = modeEl.mode.value;

    update();
};

function triangle( a, b, c )
{
    if (mode == 0) {
        points.push( a, b );
        points.push( b, c );
        points.push( c, a );
    } else {
        points.push( a, b, c );
    }
}

function divideTriangle( a, b, c, count, flag )
{
    // check for end of recursion

    if ( count == 0 ) {
        if ( flag == 1 )
            triangle( a, b, c );
    }
    else {

        //bisect the sides

        var ab = mix( a, b, 0.5 );
        var ac = mix( a, c, 0.5 );
        var bc = mix( b, c, 0.5 );

        --count;

        // four new triangles

        divideTriangle( a , ab, ac, count, flag );
        divideTriangle( c , ac, bc, count, flag );
        divideTriangle( b , bc, ab, count, flag );
        divideTriangle( ab, bc, ac, count, mode == 2 ? flag : 1 - flag );
    }
}

function update()
{
    var R = 0.8;
    var delta = 2.0 * Math.PI / 3.0;

    var vertices = [
        vec2( R * Math.cos(0)     , R * Math.sin(0) ),
        vec2( R * Math.cos(delta) , R * Math.sin(delta) ),
        vec2( R * Math.cos(-delta), R * Math.sin(-delta) )
    ];
    points = [];
    divideTriangle( vertices[0], vertices[1], vertices[2],
                    numTimesToSubdivide, 1 );
    render();
}

function render()
{
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(points));
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.uniform1f( phiLoc, phi );
    gl.uniform1f( thetaLoc, theta );
    gl.uniform3fv( colorLoc, color );
    gl.drawArrays( mode == 0 ? gl.LINES : gl.TRIANGLES, 0, points.length );
}
