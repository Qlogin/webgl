"use strict";

var canvas;
var gl;
var light_program;
var simple_program;

var uLight = {};
var uSimple = {};

var objects = [];
var lights  = [];
var attenuation = [0, 0];
var sel_id = -1;
var light_geom;

var lastPosX = 0;
var lastPosY = 0;
var creaType = '';

var time = 0;

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
    },

    toJSON : function() {
        return {
            course     : this.course,
            pitch      : this.pitch,
            distance   : this.distance,
            fov        : this.fov,
            near       : this.near,
            far        : this.far,
            fog_color  : this.fog_color,
            fog_density: this.fog_density,
        };
    }
};

function Light(pos, color, ambient)
{
    return {
        'pos'      : pos,
        'ambient'  : ambient,
        'diffuse'  : color,
        'specular' : color,
        'enabled'  : true
    };
}

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
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.cullFace(gl.BACK);
    gl.polygonOffset(1.0, 0.0);

    //  Load shaders and initialize attribute buffers
    simple_program = initShaders( gl, "simple-vertex", "simple-fragment");
    gl.useProgram( simple_program );

    uSimple.vPosLoc  = gl.getAttribLocation(simple_program, "vPos");
    uSimple.mvProj   = gl.getUniformLocation(simple_program, "mvProj");
    uSimple.colorLoc = gl.getUniformLocation(simple_program, "color");

    light_program = initShaders( gl, "light-vertex", "light-fragment" );
    gl.useProgram( light_program );

    uLight.vPosLoc  = gl.getAttribLocation(light_program, "vPos");
    uLight.vNormLoc = gl.getAttribLocation(light_program, "vNorm");
    uLight.mvProj       = gl.getUniformLocation(light_program, "mvProj");
    uLight.modelView    = gl.getUniformLocation(light_program, "modelView");
    uLight.normalMatrix = gl.getUniformLocation(light_program, "normalMatrix");
    uLight.light_pos    = gl.getUniformLocation(light_program, "light_pos");
    uLight.ambient_prod = gl.getUniformLocation(light_program, "ambient_prod");
    uLight.diffuse_prod = gl.getUniformLocation(light_program, "diffuse_prod");
    uLight.specular_prod = gl.getUniformLocation(light_program, "specular_prod");
    uLight.shininess     = gl.getUniformLocation(light_program, "shininess");
    uLight.attenuation   = gl.getUniformLocation(light_program, "attenuation");
    uLight.fog_color     = gl.getUniformLocation(light_program, "fog_color");
    uLight.fog_density   = gl.getUniformLocation(light_program, "fog_density");

    // Setup lights
    lights.push(Light([1, 1, 1, 0]  , [0.5, 0.5, 0.5], vec3()));
    lights.push(Light([-1, -1, 1, 0], [0.5, 0.5, 0]  , vec3()));
    lights.push(Light([10, 0, 5, 1] , [0.5, 0.1, 0.1], vec3(0.1, 0.04, 0.02)));
    lights.push(Light([-10, 0, 2, 1], [0.1, 0.1, 0.5], vec3(0.02, 0.1, 0.1)));
    light_geom = Sphere(0.1, 5, 5);

    // Setup camera
    camera.fov  = $('#fov')[0].valueAsNumber;
    camera.near = $('#near')[0].valueAsNumber;
    camera.far  = $('#far')[0].valueAsNumber;
    camera.updateProjection();

    camera.distance = $('#distance')[0].valueAsNumber;
    camera.course   = $('#course')[0].valueAsNumber;
    camera.pitch    = $('#pitch')[0].valueAsNumber;
    camera.updateView();

    attenuation[0] = $('#linear-att').val();
    attenuation[1] = $('#quadr-att').val();

    $('#linear-att, #quadr-att').bind('spin spinchange', function(event) {
        attenuation[0] = $('#linear-att').val();
        attenuation[1] = $('#quadr-att').val();
    });

    $('#light2-course, #light2-pitch').bind('input', function(event) {
        var c = radians($('#light2-course').val());
        var p = radians($('#light2-pitch').val());
        lights[1].pos = vec4(Math.cos(p) * Math.cos(c),
                             Math.cos(p) * Math.sin(c),
                             Math.sin(p), 0);
    });

    $('#fov, #near, #far').bind('input', function(event) {
        camera[this.id] = this.valueAsNumber;
        camera.updateProjection();
        //render();
    });

    $('#distance, #course, #pitch').bind('input', function(event) {
        camera[this.id] = this.valueAsNumber;
        camera.updateView();
        //render();
    });

    $('#fog-color').bind('change', function(event) {
        camera.fog_color = hexToRGB(event.target.value);
        gl.clearColor(camera.fog_color[0],
                      camera.fog_color[1],
                      camera.fog_color[2], 1.0);
        //render();
    });

    $('#fog-density').bind('input', function(event) {
        camera.fog_density = event.target.valueAsNumber;
        //render();
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
        //render();
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
        //render();
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
        sel_id = -1;
        //render();
    });

    $('#save-btn').click(function(event) {
        var scene = {
            'objects' : objects,
            'lights'  : lights,
            'camera'  : camera
        };

        var json = JSON.stringify(scene);
        var blob = new Blob([json], {type: "application/json"});
        var url  = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.download = "scene.json";
        a.href     = url;
        a.click();
    });

    $('#obj-list').bind('change', function(event) {
        sel_id = $("#obj-list option:selected").index();
        on_select();
        //render();
    });

    $('#sel-ambient').bind('change', function(event){
        objects[sel_id].params.ambient = hexToRGB(event.target.value);
        //render();
    });

    $('#sel-diffuse').bind('change', function(event){
        objects[sel_id].params.diffuse = hexToRGB(event.target.value);
        //render();
    });

    $('#sel-specular').bind('change', function(event) {
        objects[sel_id].params.specular = hexToRGB(event.target.value);
        //render();
    });

    $('#sel-shininess').bind('input', function(event) {
        objects[sel_id].params.shininess = event.target.valueAsNumber;
        //render();
    });

    $('#sel-sphere-radius, #sel-sphere-hor-subdiv, #sel-sphere-vert-subdiv')
        .bind('input', function() {
            objects[sel_id].params.r    = $('#sel-sphere-radius')[0].valueAsNumber;
            objects[sel_id].params.hnum = $('#sel-sphere-hor-subdiv')[0].valueAsNumber;
            objects[sel_id].params.vnum = $('#sel-sphere-vert-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            //render();
        });

    $('#sel-cylinder-radius, #sel-cylinder-height, #sel-cylinder-subdiv')
        .bind('input', function() {
            objects[sel_id].params.r    = $('#sel-cylinder-radius')[0].valueAsNumber;
            objects[sel_id].params.h    = $('#sel-cylinder-height')[0].valueAsNumber;
            objects[sel_id].params.hnum = $('#sel-cylinder-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            //render();
        });

    $('#sel-cone-radius, #sel-cone-height, #sel-cone-subdiv')
        .bind('input', function() {
            objects[sel_id].params.r    = $('#sel-cone-radius')[0].valueAsNumber;
            objects[sel_id].params.h    = $('#sel-cone-height')[0].valueAsNumber;
            objects[sel_id].params.hnum = $('#sel-cone-subdiv')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            //render();
        });

    $('#sel-cube-sizex, #sel-cube-sizey, #sel-cube-sizez')
        .bind('input', function() {
            objects[sel_id].params.sx    = $('#sel-cube-sizex')[0].valueAsNumber;
            objects[sel_id].params.sy    = $('#sel-cube-sizey')[0].valueAsNumber;
            objects[sel_id].params.sz    = $('#sel-cube-sizez')[0].valueAsNumber;
            objects[sel_id].update_buffers();
            //render();
        });

    $('#sel-pos-x, #sel-pos-y, #sel-pos-z').bind('spin spinchange', function() {
        objects[sel_id].params.pos = vec3($('#sel-pos-x').spinner("value"),
                                          $('#sel-pos-y').spinner("value"),
                                          $('#sel-pos-z').spinner("value"));
        objects[sel_id].update_transform();
        //render();
    });

    $('#sel-rot-x, #sel-rot-y, #sel-rot-z').bind('spin spinchange', function() {
        objects[sel_id].params.rot = vec3($('#sel-rot-x').spinner("value"),
                                          $('#sel-rot-y').spinner("value"),
                                          $('#sel-rot-z').spinner("value"));
        objects[sel_id].update_transform();
        //render();
    });

    $('.light-enable').bind('change', function(event) {
        lights[parseInt(event.target.name, 10) - 1].enabled = event.target.checked;
    });
    $('.light-ambient').bind('change', function(event) {
        lights[parseInt(event.target.name, 10) - 1].ambient = hexToRGB(event.target.value);
    });
    $('.light-diffuse').bind('change', function(event) {
        lights[parseInt(event.target.name, 10) - 1].diffuse = hexToRGB(event.target.value);
    });
    $('.light-specular').bind('change', function(event) {
        lights[parseInt(event.target.name, 10) - 1].specular = hexToRGB(event.target.value);
    });


    addObject(Sphere(1, 20, 18), [0, 0, 1], [0, 0, 0], [1, 0, 0]);
    addObject(Cylinder(0.5, 2, 15), [1.5, -1.5, 0.9], [0, -30, 0], [0, 1, 0]);
    addObject(Cone(1, 2, 16), [-5, -8, 0], [0, 0, 0], [0, 0, 1]);
    addObject(Cube(20, 20, 0.4), [0, 0, -0.2], [0, 0, 0], [0.5, 0.8, 0.5]);
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
    else if (type == "Cube") {
        prim = Cube($('#cube-sizex')[0].valueAsNumber,
                    $('#cube-sizey')[0].valueAsNumber,
                    $('#cube-sizez')[0].valueAsNumber);
    }
    else {
        return;
    }
    addObject(prim, position, vec3(0, 0, 0), hexToRGB($('#color')[0].value));
    sel_id = objects.length - 1;
    $("#obj-list :nth-child(" + (sel_id + 1) + ")").attr("selected", "selected");
    on_select();
    //render();
}

function addObject(obj, position, orientation, color)
{
    obj.params.pos   = position;
    obj.params.rot   = orientation;
    obj.params.ambient  = color;
    obj.params.diffuse  = color;
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

    if (obj.type == "Sphere") {
        $('#sel-sphere-radius').val(obj.params.r);
        $('#sel-sphere-hor-subdiv').val(obj.params.hnum);
        $('#sel-sphere-vert-subdiv').val(obj.params.vnum);
    }
    else if (obj.type == "Cylinder") {
        $('#sel-cylinder-radius').val(obj.params.r);
        $('#sel-cylinder-height').val(obj.params.h);
        $('#sel-cylinder-subdiv').val(obj.params.hnum);
    }
    else if (obj.type == "Cone") {
        $('#sel-cone-radius').val(obj.params.r);
        $('#sel-cone-height').val(obj.params.h);
        $('#sel-cone-subdiv').val(obj.params.hnum);
    }
    else if (obj.type == "Cube") {
        $('#sel-cube-sizex').val(obj.params.sx);
        $('#sel-cube-sizey').val(obj.params.sy);
        $('#sel-cube-sizez').val(obj.params.sz);
    }

    $('#sel-ambient').val(rgbToHex(obj.params.ambient[0]  , obj.params.ambient[1] , obj.params.ambient[2]));
    $('#sel-diffuse').val(rgbToHex(obj.params.diffuse[0]  , obj.params.diffuse[1] , obj.params.diffuse[2]));
    $('#sel-specular').val(rgbToHex(obj.params.specular[0], obj.params.specular[1], obj.params.specular[2]));
    $('#sel-shininess').val(obj.params.shininess);

    $('#sel-pos-x').val(obj.params.pos[0]);
    $('#sel-pos-y').val(obj.params.pos[1]);
    $('#sel-pos-z').val(obj.params.pos[2]);
    $('#sel-rot-x').val(obj.params.rot[0]);
    $('#sel-rot-y').val(obj.params.rot[1]);
    $('#sel-rot-z').val(obj.params.rot[2]);
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

function update_light_pos()
{
    // Using Lissajous curves
    lights[2].pos[0] = 9 * Math.sin(3 * time);
    lights[2].pos[1] = 9 * Math.sin(2 * time);
    lights[2].pos[2] = 3 * Math.sin(4 * time + Math.PI / 5) + 3;

    lights[3].pos[0] = 8 * Math.sin(1.1 * time);
    lights[3].pos[1] = 8 * Math.sin(time + Math.PI / 2);
    lights[3].pos[2] = 0.5 * Math.sin(4 * time) + 2;
}

function render()
{
    update_light_pos();
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    gl.useProgram(light_program);
    gl.uniform2fv(uLight.attenuation, attenuation);
    gl.uniform3fv(uLight.fog_color, camera.fog_color);
    gl.uniform1f(uLight.fog_density, camera.fog_density);

    for (var i in objects)
    {
        var mvProj = mult(camera.vpMatrix, objects[i].transform);
        gl.uniformMatrix4fv(uLight.mvProj, false, flatten(mvProj));
        var modelView = mult(camera.viewMatrix, objects[i].transform);
        gl.uniformMatrix4fv(uLight.modelView, false, flatten(modelView));
        gl.uniformMatrix3fv(uLight.normalMatrix, false, flatten(normalMatrix(modelView, true)));

        // Associate out shader variables with our data buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, objects[i].vBuffer );
        gl.vertexAttribPointer( uLight.vPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( uLight.vPosLoc );

        gl.bindBuffer( gl.ARRAY_BUFFER, objects[i].nBuffer );
        gl.vertexAttribPointer( uLight.vNormLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( uLight.vNormLoc );

        // Draw
        var pos  = [];
        var amb_prod  = [];
        var diff_prod = [];
        var spec_prod = [];
        for (var j = 0; j != 4; ++j)
        {
            if (lights[j].enabled) {
                pos = pos.concat(mult(camera.viewMatrix, lights[j].pos));
                amb_prod = amb_prod.concat(mult(lights[j].ambient, objects[i].params.ambient));
                diff_prod = diff_prod.concat(mult(lights[j].diffuse, objects[i].params.diffuse));
                spec_prod = spec_prod.concat(mult(lights[j].specular, objects[i].params.specular));
            }
            else {
                pos = pos.concat(0, 0, 0, 0);
                amb_prod = amb_prod.concat(0, 0, 0);
                diff_prod = diff_prod.concat(0, 0, 0);
                spec_prod = spec_prod.concat(0, 0, 0);
            }
        }

        gl.uniform4fv  ( uLight.light_pos, pos );
        gl.uniform3fv  ( uLight.ambient_prod , amb_prod );
        gl.uniform3fv  ( uLight.diffuse_prod , diff_prod );
        gl.uniform3fv  ( uLight.specular_prod, spec_prod );
        gl.uniform1f   ( uLight.shininess, objects[i].params.shininess );
        gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[i].triBuffer );
        gl.drawElements( gl.TRIANGLES, objects[i].triNum, gl.UNSIGNED_SHORT, 0);
    }

    // Draw light sources fake shapes
    gl.useProgram(simple_program);
    gl.bindBuffer( gl.ARRAY_BUFFER, light_geom.vBuffer );
    gl.vertexAttribPointer( uSimple.vPosLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( uSimple.vPosLoc );
    gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, light_geom.triBuffer );

    for (var j = 0; j != 4; ++j)
        if (lights[j].enabled && lights[j].pos[3] != 0) {
            var p = lights[j].pos;
            var mvProj = mult(camera.vpMatrix, translate(p[0], p[1], p[2]));
            gl.uniformMatrix4fv(uSimple.mvProj, false, flatten(mvProj));
            gl.uniform3fv(uSimple.colorLoc, lights[j].diffuse);
            gl.drawElements(gl.TRIANGLES, light_geom.triNum, gl.UNSIGNED_SHORT, 0);
        }

    // Draw selected objects line
    if (sel_id != -1) {
        gl.uniform3fv( uSimple.colorLoc, [0, 1, 1] );
        var mvProj = mult(camera.vpMatrix, objects[sel_id].transform);
        gl.uniformMatrix4fv(uSimple.mvProj, false, flatten(mvProj));

        gl.bindBuffer( gl.ARRAY_BUFFER, objects[sel_id].vBuffer );
        gl.vertexAttribPointer( uSimple.vPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( uSimple.vPosLoc );

        gl.bindBuffer  ( gl.ELEMENT_ARRAY_BUFFER, objects[sel_id].lineBuffer );
        gl.drawElements( gl.LINES, objects[sel_id].lineNum, gl.UNSIGNED_SHORT, 0);
    }

    requestAnimFrame(render);
    time += 0.01;
}
