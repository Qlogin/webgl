"use strict";

var canvas;
var gl;

var vPosLoc;
var colorLoc;
var mvMatrixLoc;
var projMatrixLoc;

var objects = [];
var sel_id = -1;

var lastPosX = 0;
var lastPosY = 0;

var camera = {
    viewMatrix : mat4(),
    projMatrix : mat4(),
    course     : 0.0,
    pitch      : 0.0,
    distance   : 5.0,
    fov        : 90,
    near       : 0.1,
    far        : 10,

    updateView : function() {
        var r = this.distance;
        var c = radians(this.course);
        var p = radians(this.pitch);

        var eye = vec3(r * Math.cos(p) * Math.cos(c),
                       r * Math.cos(p) * Math.sin(c),
                       r * Math.sin(p));
        this.viewMatrix = lookAt(eye, vec3(0,0,0), vec3(0,0,1));
    },

    updateProjection : function() {
        this.projMatrix = perspective(this.fov, canvas.width/canvas.height,
                                      this.near, this.far);
    }
};

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
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 0.0);

    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    vPosLoc = gl.getAttribLocation( program, "vPos" );
    colorLoc      = gl.getUniformLocation(program, "color");
    mvMatrixLoc   = gl.getUniformLocation(program, "mvMatrix");
    projMatrixLoc = gl.getUniformLocation(program, "projMatrix");

    // Setup camera
    camera.fov  = $('#fov')[0].valueAsNumber;
    camera.near = $('#near-clip')[0].valueAsNumber;
    camera.far  = $('#far-clip')[0].valueAsNumber;
    camera.updateProjection();

    camera.distance = $('#distance')[0].valueAsNumber;
    camera.course   = $('#course')[0].valueAsNumber;
    camera.pitch    = $('#pitch')[0].valueAsNumber;
    camera.updateView();

    $('#fov, #near, #far').bind('input', function(event) {
        camera[this.id] = this.valueAsNumber;
        camera.updateProjection();
        render();
    });

    $('#distance, #course, #pitch').bind('input', function(event) {
        camera[this.id] = this.valueAsNumber;
        camera.updateView();
        render();
    });

    canvas.addEventListener("mousedown", function(event) {
        if (event.buttons != 1)
            return;
        lastPosX = event.offsetX;
        lastPosY = event.offsetY;
    });
    canvas.addEventListener("mousemove", function(event) {
        if (event.buttons != 1)
            return;
        var dx = (lastPosX - event.offsetX) / 5;
        var dy = (lastPosY - event.offsetY) / 5;
        lastPosX = event.offsetX;
        lastPosY = event.offsetY;

        camera.course += dx;
        if (camera.course > 180)
            camera.course -= 360;
        else if (camera.course < -180)
            camera.course += 360;
        camera.pitch -= dy;
        if (camera.pitch > 90)
            camera.pitch = 90;
        else if (camera.pitch < -90)
            camera.pitch = -90;

        $('#course').val(camera.course.toFixed());
        $('#pitch').val(camera.pitch.toFixed());

        camera.updateView();
        render();
    });

    canvas.addEventListener('wheel', function(event) {
        camera.distance += event.deltaY / 5;
        if (camera.distance < 1)
           camera.distance = 1;
        else if (camera.distance > 10)
           camera.distance = 10;
        $('#distance').val(camera.distance);
        camera.updateView();
        render();
        event.stopPropagation();
    });

    // Create button
    $('#create-btn').click(function(event){
        var type = $('#primitive-tabs').tabs('option').active;
        var prim;
        if (type == 0)
        {
           prim = createSphere($('#sphere-radius')[0].valueAsNumber,
                               $('#sphere-hor-subdiv')[0].valueAsNumber,
                               $('#sphere-vert-subdiv')[0].valueAsNumber);
        }
        else if (type == 1)
        {
           prim = createCylinder($('#cylinder-radius')[0].valueAsNumber,
                                 $('#cylinder-height')[0].valueAsNumber,
                                 $('#cylinder-subdiv')[0].valueAsNumber);
        }
        else if (type == 2)
        {
           prim = createCone($('#cone-radius')[0].valueAsNumber,
                             $('#cone-height')[0].valueAsNumber,
                             $('#cone-subdiv')[0].valueAsNumber);
        }
        else
           return;

        var pos = [$('#pos-x')[0].valueAsNumber,
                   $('#pos-y')[0].valueAsNumber,
                   $('#pos-z')[0].valueAsNumber];
        var rot = [$('#rot-x')[0].valueAsNumber,
                   $('#rot-y')[0].valueAsNumber,
                   $('#rot-z')[0].valueAsNumber];
        var color = hexToRGB($('#color')[0].value);
        addObject(pos, rot, color, prim);
        render();
    });

    $('#obj-list').bind('change', function(event){
        sel_id = parseInt(event.target.value, 10);
        render();

        $('#obj-list-prop').removeAttr('hidden');

        var obj = objects[sel_id];
        $('#sel-color')[0].value = rgbToHex(obj.color[0], obj.color[1], obj.color[2]);
        $('#sel-pos-x')[0].value = obj.pos[0];
        $('#sel-pos-y')[0].value = obj.pos[1];
        $('#sel-pos-z')[0].value = obj.pos[2];
        $('#sel-rot-x')[0].value = obj.rot[0];
        $('#sel-rot-y')[0].value = obj.rot[1];
        $('#sel-rot-z')[0].value = obj.rot[2];
    });

    $('#sel-color').bind('change', function(){
        objects[sel_id].color = getColorValue($('#sel-color')[0].value);
        render();
    });

    $('#sel-pos-x, #sel-pos-y, #sel-pos-z').bind('change', function() {
        objects[sel_id].pos = [$('#sel-pos-x')[0].valueAsNumber,
                               $('#sel-pos-y')[0].valueAsNumber,
                               $('#sel-pos-z')[0].valueAsNumber];
        objects[sel_id].update_transform();
        render();
    });

    $('#sel-rot-x, #sel-rot-y, #sel-rot-z').bind('change', function() {
        objects[sel_id].rot = [$('#sel-rot-x')[0].valueAsNumber,
                               $('#sel-rot-y')[0].valueAsNumber,
                               $('#sel-rot-z')[0].valueAsNumber];
        objects[sel_id].update_transform();
        render();
    });

    addObject([0, 0, 1], [0, 0, 0], [1, 0, 0], createSphere(1, 16, 12));
    addObject([1.5, -1.5, 0.5], [0, -30, 0], [0, 1, 0], createCylinder(0.5, 2, 15));

    render();
};

function addObject(position, orientation, color, primitive)
{
    var obj = new Object();
    obj.pos   = position;
    obj.rot   = orientation;
    obj.color = color;

    obj.update_transform = function() {
        var tr = translate(this.pos);
        var rot_x = rotate(this.rot[0], 1, 0, 0);
        var rot_y = rotate(this.rot[1], 0, 1, 0);
        var rot_z = rotate(this.rot[2], 0, 0, 1);
        this.transform = mult(mult(tr, rot_z), mult(rot_y, rot_x));
    }
    obj.update_transform();

    obj.vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, obj.vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(primitive.points), gl.STATIC_DRAW );

    obj.triBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.triBuffer );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(primitive.tris), gl.STATIC_DRAW);
    obj.triNum = primitive.tris.length;

    obj.lineBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, obj.lineBuffer );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(primitive.lines), gl.STATIC_DRAW);
    obj.lineNum = primitive.lines.length;

    objects.push(obj);

    var full_name = primitive.name + ' #' + objects.length;
    $('#obj-list').append("<option value='" + (objects.length - 1) + "'>" + full_name + "</option>");
}

function createSphere(r, hnum, vnum)
{
    var sphere = new Object();
    sphere.name = "Sphere";
    sphere.points = [];

    var i, j;
    for (i = 0; i <= vnum; ++i)
    {
        var p = Math.PI / 2 - Math.PI * i / vnum;
        for (j = 0; j != hnum; ++j)
        {
            var c = 2 * Math.PI * j / hnum;
            sphere.points.push(vec3(r * Math.cos(p) * Math.cos(c),
                                    r * Math.cos(p) * Math.sin(c),
                                    r * Math.sin(p)));
        }
    }

    sphere.tris = [];
    for (i = 0; i != vnum; ++i)
        for (j = 0; j != hnum; ++j)
        {
           sphere.tris.push(i * hnum + j);
           sphere.tris.push(i * hnum + (j + 1) % hnum);
           sphere.tris.push((i + 1) * hnum + (j + 1) % hnum);
           sphere.tris.push((i + 1) * hnum + (j + 1) % hnum);
           sphere.tris.push((i + 1) * hnum + j);
           sphere.tris.push(i * hnum + j);
        }

    sphere.lines = [];
    for (i = 0; i != vnum; ++i)
        for (j = 0; j != hnum; ++j)
        {
           sphere.lines.push(i * hnum + j);
           sphere.lines.push(i * hnum + (j + 1) % hnum);
           sphere.lines.push(i * hnum + j);
           sphere.lines.push((i + 1) * hnum + j);
        }

    return sphere;
}

function createCylinder(r, h, hnum)
{
    var cylinder = new Object();
    cylinder.name = "Cylinder";
    cylinder.points = [];

    var i;
    for (i = 0; i != hnum; ++i)
    {
       var c = 2 * Math.PI * i / hnum;
       cylinder.points.push(vec3(r * Math.cos(c), r * Math.sin(c), h/2));
       cylinder.points.push(vec3(r * Math.cos(c), r * Math.sin(c), -h/2));
    }
    var vcap = cylinder.points.length;
    cylinder.points.push(vec3(0, 0, h/2));
    cylinder.points.push(vec3(0, 0, -h/2));

    cylinder.tris = [];
    for (i = 0; i != hnum; ++i)
    {
        // Side
        cylinder.tris.push(2 * i);
        cylinder.tris.push(2 * ((i + 1) % hnum));
        cylinder.tris.push(2 * ((i + 1) % hnum) + 1);
        cylinder.tris.push(2 * ((i + 1) % hnum) + 1);
        cylinder.tris.push(2 * i + 1);
        cylinder.tris.push(2 * i);

        // Cap
        cylinder.tris.push(vcap);
        cylinder.tris.push(2 * i);
        cylinder.tris.push(2 * ((i + 1) % hnum));
        cylinder.tris.push(vcap + 1);
        cylinder.tris.push(2 * i + 1);
        cylinder.tris.push(2 * ((i + 1) % hnum) + 1);
    }

    cylinder.lines = [];
    for (i = 0; i != hnum; ++i)
    {
        // Side
        cylinder.lines.push(2 * ((i + 1) % hnum));
        cylinder.lines.push(2 * i);
        cylinder.lines.push(2 * i);
        cylinder.lines.push(2 * i + 1);
        cylinder.lines.push(2 * i + 1);
        cylinder.lines.push(2 * ((i + 1) % hnum) + 1);

        // Cap
        cylinder.lines.push(vcap);
        cylinder.lines.push(2 * i);
        cylinder.lines.push(vcap + 1);
        cylinder.lines.push(2 * i + 1);
    }
    return cylinder;
}

function createCone(r, h, hnum)
{
    var cone = new Object();
    cone.name = "Cone";
    cone.points = [];

    var i;
    for (i = 0; i != hnum; ++i)
    {
       var c = 2 * Math.PI * i / hnum;
       cone.points.push(vec3(r * Math.cos(c), r * Math.sin(c), 0));
    }
    var vcap = cone.points.length;
    cone.points.push(vec3(0, 0, h));
    cone.points.push(vec3(0, 0, 0));

    cone.tris = [];
    for (i = 0; i != hnum; ++i)
    {
        // Side
        cone.tris.push(vcap);
        cone.tris.push(i);
        cone.tris.push((i + 1) % hnum);

        // Cap
        cone.tris.push(vcap + 1);
        cone.tris.push(i);
        cone.tris.push((i + 1) % hnum);
    }

    cone.lines = [];
    for (i = 0; i != hnum; ++i)
    {
        cone.lines.push(i);
        cone.lines.push(vcap);
        cone.lines.push(i);
        cone.lines.push(vcap + 1);
        cone.lines.push(i);
        cone.lines.push((i + 1) % hnum);
    }
    return cone;
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv( projMatrixLoc, false, flatten(camera.projMatrix) );

    var i;
    for (i in objects)
    {
        var mvMatrix = mult(camera.viewMatrix, objects[i].transform);
        gl.uniformMatrix4fv( mvMatrixLoc, false, flatten(mvMatrix) );

        // Associate out shader variables with our data buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, objects[i].vBuffer );
        gl.vertexAttribPointer( vPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vPosLoc );

        // Draw
        gl.uniform3fv  ( colorLoc, objects[i].color );
        gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[i].triBuffer );
        gl.drawElements( gl.TRIANGLES, objects[i].triNum, gl.UNSIGNED_SHORT, 0);

        if (i == sel_id)
            gl.uniform3fv( colorLoc, [0, 1, 1] );
        else
            gl.uniform3fv( colorLoc, [0.2, 0.2, 0.2] );

        gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[i].lineBuffer );
        gl.drawElements( gl.LINES, objects[i].lineNum, gl.UNSIGNED_SHORT, 0);
    }
}
