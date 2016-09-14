"use strict";

var canvas;
var gl;

var points = [];

var params = {
  sierpinski : false,
  level      : 0,
  mode       : 1,
  phi        : 0,
  theta      : 0,
  color      : vec3(1.0, 1.0, 1.0),

  toString : function() {
    return 'level='  + this.level
         + '&mode='  + this.mode
         + '&phi='   + this.phi
         + '&theta=' + this.theta
         + '&color=' + rgbToQuery(this.color)
         + '&sierpinski=' + this.sierpinski;
  }
};

// Shader uniform locations
var phiLoc;
var thetaLoc;
var colorLoc;

var bufferId;

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
        params.color = hexToRGB(event.target.value);
        render();
    };

    var levelEl = document.getElementById("level");
    levelEl.oninput = function(event) {
        params.level = event.target.value;
        update();
    };

    var phiEl = document.getElementById("phi");
    phiEl.oninput = function(event) {
        params.phi = event.target.value;
        render();
    };

    var thetaEl = document.getElementById("theta");
    thetaEl.oninput = function(event) {
        params.theta = event.target.value;
        render();
    }

    var sierEl = document.getElementById("sierpinski");
    sierEl.onchange = function(event) {
        params.sierpinski = event.target.checked;
        update();
    }

    var modeEl = document.getElementById("mode");
    modeEl.onchange = function(event) {
        params.mode = event.target.value;
        sierEl.checked = params.sierpinski = (params.sierpinski && params.mode != 2);
        sierEl.disabled = (params.mode == 2);
        update();
    }

    setParamFromQuery(colEl  , "color", function(x) { return rgbToHex.apply([], queryToRGB(x)); });
    setParamFromQuery(levelEl, "level");
    setParamFromQuery(phiEl  , "phi");
    setParamFromQuery(thetaEl, "theta");

    params.color = hexToRGB(colEl.value);
    params.level = levelEl.value;
    params.phi = phiEl.value;
    params.theta = thetaEl.value;
    params.mode = modeEl.mode.value;
    params.sierpinski = sierEl.checked;

    update();
};

function triangle( a, b, c )
{
    if (params.mode == 0) {
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
        if (!params.sierpinski)
            divideTriangle( ab, bc, ac, count, params.mode == 2 ? flag : 1 - flag );
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
                    params.level, 1 );
    render();
}

function render()
{
    document.location.hash = params.toString();

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(points));
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.uniform1f( phiLoc, params.phi );
    gl.uniform1f( thetaLoc, params.theta );
    gl.uniform3fv( colorLoc, params.color );
    gl.drawArrays( params.mode == 0 ? gl.LINES : gl.TRIANGLES, 0, points.length );
}

function setParamFromQuery(element, name, lambda)
{
    var val = getQueryString(name);
    if (val)
        element.value = lambda ? lambda(val) : val;
}
