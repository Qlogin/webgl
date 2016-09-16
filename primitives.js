"use strict";

var gl;

function Primitive(t, init_params) {
    var prim = {
        params    : {
            pos       : vec3(),
            rot       : vec3(),
            ambient   : vec3(1, 1, 1),
            diffuse   : vec3(1, 1, 1),
            specular  : vec3(1, 1, 1),
            shininess : 64
        },

        type      : t,
        transform : mat4(),
        has_lines : true,
        has_tris  : true,

        update_transform : function() {
            var tr = translate(this.params.pos);
            var rot_x = rotate(this.params.rot[0], 1, 0, 0);
            var rot_y = rotate(this.params.rot[1], 0, 1, 0);
            var rot_z = rotate(this.params.rot[2], 0, 0, 1);
            this.transform = mult(mult(tr, rot_z), mult(rot_y, rot_x));
        },

        vBuffer    : gl.createBuffer(),
        nBuffer    : gl.createBuffer(),
        triBuffer  : gl.createBuffer(),
        lineBuffer : gl.createBuffer(),

        update_buffers : function() {
            var points = this.get_points();
            gl.bindBuffer( gl.ARRAY_BUFFER, this.vBuffer );
            gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.DYNAMIC_DRAW );

            var normals = this.get_normals();
            gl.bindBuffer( gl.ARRAY_BUFFER, this.nBuffer );
            gl.bufferData( gl.ARRAY_BUFFER, flatten(normals), gl.DYNAMIC_DRAW );

            if (this.has_tris) {
                var tris = this.get_triangles();
                gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.triBuffer );
                gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), gl.DYNAMIC_DRAW);
                this.triNum = tris.length;
            }

            if (this.has_lines) {
                var lines = this.get_lines();
                gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.lineBuffer );
                gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lines), gl.DYNAMIC_DRAW);
                this.lineNum = lines.length;
            }
        },

        toJSON : function() {
            var json = {};
            json[t] = this.params;
            return json;
        }
    };

    for (var k in init_params) {
        prim.params[k] = init_params[k];
    }
    return prim;
}

function _CreateSphere(params)
{
    var sphere = Primitive("Sphere", params);

    sphere.get_points = function() {
        var i, j;
        var points = [];
        for (i = 0; i <= this.params.vnum; ++i)
        {
            var p = Math.PI / 2 - Math.PI * i / this.params.vnum;
            for (j = 0; j != this.params.hnum; ++j)
            {
                var c = 2 * Math.PI * j / this.params.hnum;
                points.push(vec3(this.params.r * Math.cos(p) * Math.cos(c),
                                 this.params.r * Math.cos(p) * Math.sin(c),
                                 this.params.r * Math.sin(p)));
            }
        }
        return points;
    };

    sphere.get_normals = function() {
        var i, j;
        var normals = [];
        for (i = 0; i <= this.params.vnum; ++i)
        {
            var p = Math.PI / 2 - Math.PI * i / this.params.vnum;
            for (j = 0; j != this.params.hnum; ++j)
            {
                var c = 2 * Math.PI * j / this.params.hnum;
                normals.push(vec3(Math.cos(p) * Math.cos(c),
                                  Math.cos(p) * Math.sin(c),
                                  Math.sin(p)));
            }
        }
        return normals;
    };

    sphere.get_triangles = function() {
        var indices = [];
        var i, j;
        for (i = 0; i != this.params.vnum; ++i)
            for (j = 0; j != this.params.hnum; ++j)
            {
               indices.push(i * this.params.hnum + j);
               indices.push((i + 1) * this.params.hnum + (j + 1) % this.params.hnum);
               indices.push(i * this.params.hnum + (j + 1) % this.params.hnum);
               indices.push((i + 1) * this.params.hnum + j);
               indices.push((i + 1) * this.params.hnum + (j + 1) % this.params.hnum);
               indices.push(i * this.params.hnum + j);
            }
        return indices;
    };

    sphere.get_lines = function() {
        var indices = [];
        var i, j;
        for (i = 0; i != this.params.vnum; ++i)
            for (j = 0; j != this.params.hnum; ++j)
            {
               indices.push(i * this.params.hnum + j);
               indices.push(i * this.params.hnum + (j + 1) % this.params.hnum);
               indices.push(i * this.params.hnum + j);
               indices.push((i + 1) * this.params.hnum + j);
            }
        return indices;
    };

    sphere.update_buffers();
    return sphere;
}

function _CreateCylinder(params)
{
    var cylinder = Primitive("Cylinder", params);

    cylinder.get_points = function() {
        var points = [];
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.params.hnum;
           var x = this.params.r * Math.cos(c);
           var y = this.params.r * Math.sin(c);
           points.push(vec3(x, y,  this.params.h/2));
           points.push(vec3(x, y, -this.params.h/2));
           points.push(vec3(x, y,  this.params.h/2));
           points.push(vec3(x, y, -this.params.h/2));
        }
        points.push(vec3(0, 0, this.params.h/2));
        points.push(vec3(0, 0, -this.params.h/2));
        return points;
    }

    cylinder.get_normals = function() {
        var normals = [];
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.params.hnum;
           normals.push(vec3(Math.cos(c), Math.sin(c), 0));
           normals.push(vec3(Math.cos(c), Math.sin(c), 0));
           normals.push(vec3(0, 0, 1));
           normals.push(vec3(0, 0, -1));
        }
        normals.push(vec3(0, 0, 1));
        normals.push(vec3(0, 0, -1));
        return normals;
    }

    cylinder.get_triangles = function() {
        var indices = [];
        var vcap = 4 * this.params.hnum;
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
            // Side
            indices.push(4 * i);
            indices.push(4 * ((i + 1) % this.params.hnum) + 1);
            indices.push(4 * ((i + 1) % this.params.hnum));
            indices.push(4 * i + 1);
            indices.push(4 * ((i + 1) % this.params.hnum) + 1);
            indices.push(4 * i);

            // Cap
            indices.push(vcap);
            indices.push(4 * i + 2);
            indices.push(4 * ((i + 1) % this.params.hnum) + 2);
            indices.push(4 * ((i + 1) % this.params.hnum) + 3);
            indices.push(4 * i + 3);
            indices.push(vcap + 1);
        }
        return indices;
    };

    cylinder.get_lines = function() {
        var indices = [];
        var vcap = 4 * this.params.hnum;
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
            // Side
            indices.push(4 * ((i + 1) % this.params.hnum));
            indices.push(4 * i);
            indices.push(4 * i);
            indices.push(4 * i + 1);
            indices.push(4 * i + 1);
            indices.push(4 * ((i + 1) % this.params.hnum) + 1);

            // Cap
            indices.push(vcap);
            indices.push(4 * i);
            indices.push(vcap + 1);
            indices.push(4 * i + 1);
        }
        return indices;
    };
    cylinder.update_buffers();
    return cylinder;
}

function _CreateCone(params)
{
    var cone = Primitive("Cone", params);

    cone.get_points = function() {
        var points = [];
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.params.hnum;
           points.push(vec3(this.params.r * Math.cos(c), this.params.r * Math.sin(c), 0));
           points.push(vec3(0, 0, this.params.h));
        }
        for (i = 0; i != this.params.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.params.hnum;
           points.push(vec3(this.params.r * Math.cos(c), this.params.r * Math.sin(c), 0));
        }
        points.push(vec3(0, 0, 0));
        return points;
    };

    cone.get_normals = function() {
        var normals = [];
        var i;
        for (i = 0; i != this.params.hnum; i += 0.5)
        {
           var c = 2 * Math.PI * i / this.params.hnum;
           var x = this.params.r * Math.cos(c);
           var y = this.params.r * Math.sin(c);
           var n = normalize(cross(vec3(-y, x, 0), vec3(-x, -y, this.params.h)));
           normals.push(n);
        }
        for (i = 0; i != this.params.hnum; ++i)
            normals.push(vec3(0, 0, -1));
        normals.push(vec3(0, 0, -1));
        return normals;
    };

    cone.get_triangles = function() {
        var indices = [];
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
            // Side
            indices.push(2 * i);
            indices.push(2 * ((i + 1) % this.params.hnum));
            indices.push(2 * i + 1);

            // Cap
            indices.push(3 * this.params.hnum);
            indices.push(2 * this.params.hnum + (i + 1) % this.params.hnum);
            indices.push(2 * this.params.hnum + i);
        }
        return indices;
    };

    cone.get_lines = function() {
        var indices = [];
        var i;
        for (i = 0; i != this.params.hnum; ++i)
        {
            indices.push(2 * i);
            indices.push(2 * i + 1);
            indices.push(2 * i);
            indices.push(2 * ((i + 1) % this.params.hnum));
            indices.push(2 * this.params.hnum + i);
            indices.push(3 * this.params.hnum);
        }
        return indices;
    };

    cone.update_buffers();
    return cone;
}

function _CreateCube(params)
{
    var cube = Primitive("Cube", params);

    cube.get_points = function() {
        var points = [];
        for (var i = -1; i < 2; i += 2)
            for (var j = -1; j < 2; j += 2)
                for (var k = -1; k < 2; k += 2)
                {
                    var p = [i * this.params.sx / 2, j * this.params.sy / 2, k * this.params.sz / 2];
                    points.push(p);
                    points.push(p);
                    points.push(p);
                }
        return points;
    };

    cube.get_normals = function() {
        var normals = [];
        for (var i = -1; i < 2; i += 2)
            for (var j = -1; j < 2; j += 2)
                for (var k = -1; k < 2; k += 2)
                {
                    normals.push([i, 0, 0]);
                    normals.push([0, j, 0]);
                    normals.push([0, 0, k]);
                }
        return normals;
    };

    cube.get_triangles = function() {
        var indices = [];
        function put_index(axe, i, j, k) {
            var vals = [0, 0, 0];
            vals[axe] = i;
            vals[(axe + 1) % 3] = j;
            vals[(axe + 2) % 3] = k;
            indices.push(3 * (4 * vals[0] + 2 * vals[1] + vals[2]) + axe);
        }

        for (var axe = 0; axe < 3; ++axe)
            for (var val = 0; val < 2; ++val)
            {
                put_index(axe, val,  0, 0);
                put_index(axe, val,  1, 1 - val);
                put_index(axe, val,  1, val);
                put_index(axe, val,  val, 1);
                put_index(axe, val,  1 - val, 1);
                put_index(axe, val,  0, 0);
            }

        return indices;
    };

    cube.get_lines = function() {
        var indices = [];
        function put_index(i, j, k) {
            indices.push(3 * (4 * i + 2 * j + k));
        }
        function put_corner(i, j, k) {
            put_index(i, j, k);
            put_index(1 - i, j, k);
            put_index(i, j, k);
            put_index(i, 1 - j, k);
            put_index(i, j, k);
            put_index(i, j, 1 - k);
        }
        put_corner(0, 0, 0);
        put_corner(1, 1, 0);
        put_corner(1, 0, 1);
        put_corner(0, 1, 1);
        return indices;
    };

    cube.update_buffers();
    return cube;
}

function Sphere(r, hnum, vnum) {
    return _CreateSphere( { r : r, hnum : hnum, vnum : vnum } );
}

function Cylinder(r, h, hnum) {
    return _CreateCylinder( { r : r, h : h, hnum : hnum } );
}

function Cube(sx, sy, sz) {
    return _CreateCube( { sx : sx, sy : sy, sz : sz } );
}

function Cone(r, h, hnum) {
    return _CreateCone( { r : r, h : h, hnum : hnum } );
}

function CreatePrimitive( type, params )
{
    if      (type == 'Sphere')   { return _CreateSphere(params); }
    else if (type == 'Cylinder') { return _CreateCylinder(params); }
    else if (type == 'Cone')     { return _CreateCone(params); }
    else if (type == 'Cube')     { return _CreateCube(params); }
}
