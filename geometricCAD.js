"use strict";

var canvas;
var gl;

var vPosLoc;
var vNormLoc;
var uLoc = {};

var objects = [];
var lights  = [];
var sel_id = -1;

var lastPosX = 0;
var lastPosY = 0;
var creaType = '';

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
    eye        : vec3(),
    fog_color  : vec3(),
    fog_density: 0.0,

    updateView : function() {
        var r = this.distance;
        var c = radians(this.course);
        var p = radians(this.pitch);

        this.eye = vec3(r * Math.cos(p) * Math.cos(c),
                        r * Math.cos(p) * Math.sin(c),
                        r * Math.sin(p));
        lights[0].pos = vec4(this.eye[0], this.eye[1], this.eye[2], 0);
        this.viewMatrix = lookAt(this.eye, vec3(0,0,0), vec3(0,0,1));
        this.vpMatrix = mult(this.projMatrix, this.viewMatrix);
    },

    updateProjection : function() {
        this.projMatrix = perspective(this.fov, canvas.width/canvas.height,
                                      this.near, this.far);
        this.vpMatrix = mult(this.projMatrix, this.viewMatrix);
    }
};

function Light(pos, color)
{
    return {
        'pos'      : pos,
        'ambient'  : vec3(0, 0, 0),
        'diffuse'  : color,
        'specular' : color,
    };
}

lights.push(Light(vec4(1, 1, 1, 0)  , vec3(1, 1, 1)));
lights.push(Light(vec4(-1, -1, 1, 0), vec3(1, 1, 1)));
lights.push(Light(vec4(10, 0, 5, 1) , vec3(1, 0, 0)));
lights.push(Light(vec4(-10, 0, 0, 1), vec3(0, 0, 1)));

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //
    camera.fog_color = hexToRGB($('#fog-color')[0].value);
    camera.fog_density = $('#fog-density')[0].valueAsNumber;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(camera.fog_color[0],
                  camera.fog_color[1],
                  camera.fog_color[2], 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 0.0);

    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    vPosLoc  = gl.getAttribLocation(program, "vPos");
    vNormLoc = gl.getAttribLocation(program, "vNorm");
    uLoc.mvProj       = gl.getUniformLocation(program, "mvProj");
    uLoc.modelView    = gl.getUniformLocation(program, "modelView");
    uLoc.normalMatrix = gl.getUniformLocation(program, "normalMatrix");
    uLoc.light_pos    = gl.getUniformLocation(program, "light_pos");
    uLoc.ambient_prod = gl.getUniformLocation(program, "ambient_prod");
    uLoc.diffuse_prod = gl.getUniformLocation(program, "diffuse_prod");
    uLoc.specular_prod = gl.getUniformLocation(program, "specular_prod");
    uLoc.shininess     = gl.getUniformLocation(program, "shininess");
    uLoc.fog_color     = gl.getUniformLocation(program, "fog_color");
    uLoc.fog_density   = gl.getUniformLocation(program, "fog_density");

    // Setup camera
    camera.fov  = $('#fov')[0].valueAsNumber;
    camera.near = $('#near')[0].valueAsNumber;
    camera.far  = $('#far')[0].valueAsNumber;
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

    $('#fog-color').bind('change', function(event) {
        camera.fog_color = hexToRGB(event.target.value);
        render();
    });

    $('#fog-density').bind('input', function(event) {
        camera.fog_density = event.target.valueAsNumber;
        render();
    });

    canvas.addEventListener("mousedown", function(event) {
        if (event.buttons != 1)
            return;
        lastPosX = event.offsetX;
        lastPosY = event.offsetY;

        if (creaType != '')
        {
            var pos = screen2global(lastPosX, lastPosY);
            createObject(creaType, pos);
            $('#gl-canvas, #create-btns, .create-btn').css('cursor', 'auto');
            creaType = '';
        }
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
    $('.create-btn').click(function(event) {
        var type = event.target.value;
        if (!$('#interactive')[0].checked) {
            createObject(type, vec3(0, 0, 0));
        }
        else {
            creaType = type;
            $('#gl-canvas, #create-btns, .create-btn').css('cursor', 'crosshair');
        }
    });
    $('#remove-btn').click(function(event){
        objects.splice(sel_id, 1);
        $('#obj-list-prop').attr('hidden', 'hidden');
        $('.prim-prop').attr('hidden', 'hidden');
        $("#obj-list option:selected").remove();
        render();
    });

    $('#obj-list').bind('change', function(event) {
        sel_id = $("#obj-list option:selected").index();
        on_select();
        render();
    });

    $('#sel-ambient').bind('change', function(event){
        objects[sel_id].ambient = hexToRGB(event.target.value);
        render();
    });

    $('#sel-diffuse').bind('change', function(event){
        objects[sel_id].diffuse = hexToRGB(event.target.value);
        render();
    });

    $('#sel-specular').bind('change', function(event) {
        objects[sel_id].specular = hexToRGB(event.target.value);
        render();
    });

    $('#sel-shininess').bind('input', function(event) {
        objects[sel_id].shininess = event.target.valueAsNumber;
        render();
    });

    $('#sel-sphere-radius, #sel-sphere-hor-subdiv, #sel-sphere-vert-subdiv')
        .bind('input', function() {
            objects[sel_id].r    = $('#sel-sphere-radius')[0].valueAsNumber;
            objects[sel_id].hnum = $('#sel-sphere-hor-subdiv')[0].valueAsNumber;
            objects[sel_id].vnum = $('#sel-sphere-vert-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            render();
        });

    $('#sel-cylinder-radius, #sel-cylinder-height, #sel-cylinder-subdiv')
        .bind('input', function() {
            objects[sel_id].r    = $('#sel-cylinder-radius')[0].valueAsNumber;
            objects[sel_id].h    = $('#sel-cylinder-height')[0].valueAsNumber;
            objects[sel_id].hnum = $('#sel-cylinder-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            render();
        });

    $('#sel-cone-radius, #sel-cone-height, #sel-cone-subdiv')
        .bind('input', function() {
            objects[sel_id].r    = $('#sel-cone-radius')[0].valueAsNumber;
            objects[sel_id].h    = $('#sel-cone-height')[0].valueAsNumber;
            objects[sel_id].hnum = $('#sel-cone-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            render();
        });

    $('#sel-pos-x, #sel-pos-y, #sel-pos-z').bind('spin spinchange', function() {
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

    addObject(Sphere(1, 20, 18), [0, 0, 1], [0, 0, 0], [1, 0, 0]);
    addObject(Cylinder(0.5, 2, 15), [1.5, -1.5, 0.5], [0, -30, 0], [0, 1, 0]);
    addObject(Cone(1, 2, 16), [-5, -8, 0], [0, 0, 0], [0, 0, 1]);

    render();
};

function createObject(type, position)
{
    var prim;
    if (type == "Sphere") {
       prim = Sphere($('#sphere-radius')[0].valueAsNumber,
                     $('#sphere-hor-subdiv')[0].valueAsNumber,
                     $('#sphere-vert-subdiv')[0].valueAsNumber);
    }
    else if (type == "Cylinder") {
       prim = Cylinder($('#cylinder-radius')[0].valueAsNumber,
                       $('#cylinder-height')[0].valueAsNumber,
                       $('#cylinder-subdiv')[0].valueAsNumber);
    }
    else if (type == "Cone") {
       prim = Cone($('#cone-radius')[0].valueAsNumber,
                   $('#cone-height')[0].valueAsNumber,
                   $('#cone-subdiv')[0].valueAsNumber);
    }
    else {
        return;
    }
    addObject(prim, position, vec3(0, 0, 0), hexToRGB($('#color')[0].value));
    sel_id = objects.length - 1;
    $("#obj-list :nth-child(" + (sel_id + 1) + ")").attr("selected", "selected");
    on_select();
    render();
}

function addObject(obj, position, orientation, color)
{
    obj.pos   = position;
    obj.rot   = orientation;
    obj.ambient  = color;
    obj.diffuse  = color;
    obj.specular = vec3(1, 1, 1);
    obj.shininess = 64;
    obj.update_transform();

    objects.push(obj);

    var full_name = obj.type + ' #' + objects.length;
    $('#obj-list').append("<option>" + full_name + "</option>");
}

function on_select()
{
    var obj = objects[sel_id];
    $('#obj-list-prop').removeAttr('hidden');
    $('.prim-prop').attr('hidden', 'hidden');
    $('.prim-prop#' + obj.type).removeAttr('hidden');

    if (obj.type == "Sphere")
    {
        $('#sel-sphere-radius').val(obj.r);
        $('#sel-sphere-hor-subdiv').val(obj.hnum);
        $('#sel-sphere-vert-subdiv').val(obj.vnum);
    }
    else if (obj.type == "Cylinder")
    {
        $('#sel-cylinder-radius').val(obj.r);
        $('#sel-cylinder-height').val(obj.h);
        $('#sel-cylinder-subdiv').val(obj.hnum);
    }
    else if (obj.type == "Cone")
    {
        $('#sel-cone-radius').val(obj.r);
        $('#sel-cone-height').val(obj.h);
        $('#sel-cone-subdiv').val(obj.hnum);
    }

    $('#sel-ambient').val(rgbToHex(obj.ambient[0]  , obj.ambient[1] , obj.ambient[2]));
    $('#sel-diffuse').val(rgbToHex(obj.diffuse[0]  , obj.diffuse[1] , obj.diffuse[2]));
    $('#sel-specular').val(rgbToHex(obj.specular[0], obj.specular[1], obj.specular[2]));

    $('#sel-pos-x').val(obj.pos[0]);
    $('#sel-pos-y').val(obj.pos[1]);
    $('#sel-pos-z').val(obj.pos[2]);
    $('#sel-rot-x').val(obj.rot[0]);
    $('#sel-rot-y').val(obj.rot[1]);
    $('#sel-rot-z').val(obj.rot[2]);
}

function screen2global(x, y)
{
    var k = camera.near * Math.tan(radians(camera.fov) / 2);
    var aratio = canvas.width / canvas.height;
    var dx = (2 * x / canvas.width - 1) * k * aratio;
    var dy = (1 - 2 * y / canvas.height) * k;
    var view  = normalize(negate(camera.eye));
    var right = normalize(cross(view, vec3(0, 0, 1)));
    var up    = normalize(cross(right, view));

    for (var i = 0; i != 3; ++i)
    {
        view[i] *= camera.near;
        right[i] *= dx;
        up[i] *= dy;
    }

    var dir = add(add(view, right), up);
    var t = -camera.eye[2] / dir[2];
    var pos = vec3((camera.eye[0] + t * dir[0]).toFixed(1),
                   (camera.eye[1] + t * dir[1]).toFixed(1), 0);
    return pos;
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(uLoc.fog_color, camera.fog_color);
    gl.uniform1f(uLoc.fog_density, camera.fog_density);

    var i;
    for (i in objects)
    {
        var mvProj = mult(camera.vpMatrix, objects[i].transform);
        gl.uniformMatrix4fv(uLoc.mvProj, false, flatten(mvProj));
        var modelView = mult(camera.viewMatrix, objects[i].transform);
        gl.uniformMatrix4fv(uLoc.modelView, false, flatten(modelView));
        gl.uniformMatrix3fv(uLoc.normalMatrix, false, flatten(normalMatrix(modelView, true)));

        // Associate out shader variables with our data buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, objects[i].vBuffer );
        gl.vertexAttribPointer( vPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vPosLoc );

        gl.bindBuffer( gl.ARRAY_BUFFER, objects[i].nBuffer );
        gl.vertexAttribPointer( vNormLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vNormLoc );

        // Draw
        var pos  = [];
        var amb_prod  = [];
        var diff_prod = [];
        var spec_prod = [];
        for (var j = 0; j != 4; ++j)
        {
            pos = pos.concat(mult(camera.viewMatrix, lights[j].pos));
            amb_prod = amb_prod.concat(mult(lights[j].ambient, objects[i].ambient));
            diff_prod = diff_prod.concat(mult(lights[j].diffuse, objects[i].diffuse));
            spec_prod = spec_prod.concat(mult(lights[j].specular, objects[i].specular));
        }

        gl.uniform4fv  ( uLoc.light_pos, pos );
        gl.uniform3fv  ( uLoc.ambient_prod , amb_prod );
        gl.uniform3fv  ( uLoc.diffuse_prod , diff_prod );
        gl.uniform3fv  ( uLoc.specular_prod, spec_prod );
        gl.uniform1f   ( uLoc.shininess, objects[i].shininess );
        gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[i].triBuffer );
        gl.drawElements( gl.TRIANGLES, objects[i].triNum, gl.UNSIGNED_SHORT, 0);

        //if (i == sel_id)
            //gl.uniform3fv( colorLoc, [0, 1, 1] );
        //else
            //gl.uniform3fv( colorLoc, [0.2, 0.2, 0.2] );

        //gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[i].lineBuffer );
        //gl.drawElements( gl.LINES, objects[i].lineNum, gl.UNSIGNED_SHORT, 0);
    }
}
