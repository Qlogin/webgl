"use strict";

var canvas;
var gl;

var vPosLoc;
var colorLoc;
var mvpMatrixLoc;

var objects = [];
var sel_id = -1;

var lastPosX = 0;
var lastPosY = 0;

var camera = {
    viewMatrix : mat4(),
    projMatrix : mat4(),
    vpMatrix   : mat4(),
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
        this.vpMatrix = mult(this.projMatrix, this.viewMatrix);
    },

    updateProjection : function() {
        this.projMatrix = perspective(this.fov, canvas.width/canvas.height,
                                      this.near, this.far);
        this.vpMatrix = mult(this.projMatrix, this.viewMatrix);
    }
};

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.25, 0.25, 0.25, 1.0 );
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 0.0);

    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    vPosLoc = gl.getAttribLocation( program, "vPos" );
    colorLoc      = gl.getUniformLocation(program, "color");
    mvpMatrixLoc   = gl.getUniformLocation(program, "mvpMatrix");

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
        $('output').filter( function( index, el ) {
            return $( this ).attr( "for" ) === "course";
        }).val(camera.course.toFixed());
        $('output').filter( function( index, el ) {
            return $( this ).attr( "for" ) === "pitch";
        }).val(camera.pitch.toFixed());

        camera.updateView();
        render();
    });

    canvas.addEventListener('wheel', function(event) {
        camera.distance += (event.deltaX || event.deltaY) < 0 ? -0.2 : 0.2;
        if (camera.distance < 1)
           camera.distance = 1;
        else if (camera.distance > 30)
           camera.distance = 30;
        $('#distance').val(camera.distance);
        $('output').filter( function( index, el ) {
            return $( this ).attr( "for" ) === "distance";
        }).val(camera.distance.toFixed(1));

        camera.updateView();
        render();
        event.preventDefault();
    });

    // Create button
    $('#create-btn').click(function(event){
        var type = $('#primitive-tabs').tabs('option').active;
        var prim;
        if (type == 0)
        {
           prim = Sphere($('#sphere-radius')[0].valueAsNumber,
                         $('#sphere-hor-subdiv')[0].valueAsNumber,
                         $('#sphere-vert-subdiv')[0].valueAsNumber);
        }
        else if (type == 1)
        {
           prim = Cylinder($('#cylinder-radius')[0].valueAsNumber,
                           $('#cylinder-height')[0].valueAsNumber,
                           $('#cylinder-subdiv')[0].valueAsNumber);
        }
        else if (type == 2)
        {
           prim = Cone($('#cone-radius')[0].valueAsNumber,
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
        addObject(prim, pos, rot, color);
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

    $('#sel-pos-x, #sel-pos-y, #sel-pos-z').on('spin spinchange', function() {
        objects[sel_id].pos = vec3($('#sel-pos-x').spinner("value"),
                                   $('#sel-pos-y').spinner("value"),
                                   $('#sel-pos-z').spinner("value"));
        objects[sel_id].update_transform();
        render();
    });

    $('#sel-rot-x, #sel-rot-y, #sel-rot-z').bind('spin spinchange', function() {
        objects[sel_id].rot = vec3($('#sel-rot-x').spinner("value"),
                                   $('#sel-rot-y').spinner("value"),
                                   $('#sel-rot-z').spinner("value"));
        objects[sel_id].update_transform();
        render();
    });

    addObject(Sphere(1, 16, 12), [0, 0, 1], [0, 0, 0], [1, 0, 0]);
    addObject(Cylinder(0.5, 2, 15), [1.5, -1.5, 0.5], [0, -30, 0], [0, 1, 0]);

    render();
};

function addObject(obj, position, orientation, color)
{
    obj.pos   = position;
    obj.rot   = orientation;
    obj.color = color;
    obj.update_transform();

    objects.push(obj);

    var full_name = obj.type + ' #' + objects.length;
    $('#obj-list').append("<option value='" + (objects.length - 1) + "'>" + full_name + "</option>");
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    var i;
    for (i in objects)
    {
        var mvpMatrix = mult(camera.vpMatrix, objects[i].transform);
        gl.uniformMatrix4fv(mvpMatrixLoc, false, flatten(mvpMatrix));

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
