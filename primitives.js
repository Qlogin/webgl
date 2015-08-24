"use strict";

var gl;

function Primitive(t) {
    return {
        pos   : vec3(),
        rot   : vec3(),
        color : vec3(1, 1, 1),
        transform : mat4(),
        type      : t,
        has_lines : true,
        has_tris  : true,
        params    : {},

        update_transform : function() {
            var tr = translate(this.pos);
            var rot_x = rotate(this.rot[0], 1, 0, 0);
            var rot_y = rotate(this.rot[1], 0, 1, 0);
            var rot_z = rotate(this.rot[2], 0, 0, 1);
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
        }
    };
}

function Sphere(r, hnum, vnum)
{
    var sphere = Primitive("Sphere");
    sphere.r = r;
    sphere.hnum = hnum;
    sphere.vnum = vnum;
    sphere.get_points = function() {
        var i, j;
        var points = [];
        for (i = 0; i <= this.vnum; ++i)
        {
            var p = Math.PI / 2 - Math.PI * i / this.vnum;
            for (j = 0; j != this.hnum; ++j)
            {
                var c = 2 * Math.PI * j / this.hnum;
                points.push(vec3(this.r * Math.cos(p) * Math.cos(c),
                                 this.r * Math.cos(p) * Math.sin(c),
                                 this.r * Math.sin(p)));
            }
        }
        return points;
    };

    sphere.get_normals = function() {
        var i, j;
        var normals = [];
        for (i = 0; i <= this.vnum; ++i)
        {
            var p = Math.PI / 2 - Math.PI * i / this.vnum;
            for (j = 0; j != this.hnum; ++j)
            {
                var c = 2 * Math.PI * j / this.hnum;
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
        for (i = 0; i != this.vnum; ++i)
            for (j = 0; j != this.hnum; ++j)
            {
               indices.push(i * this.hnum + j);
               indices.push(i * this.hnum + (j + 1) % this.hnum);
               indices.push((i + 1) * this.hnum + (j + 1) % this.hnum);
               indices.push((i + 1) * this.hnum + (j + 1) % this.hnum);
               indices.push((i + 1) * this.hnum + j);
               indices.push(i * this.hnum + j);
            }
        return indices;
    };

    sphere.get_lines = function() {
        var indices = [];
        var i, j;
        for (i = 0; i != this.vnum; ++i)
            for (j = 0; j != this.hnum; ++j)
            {
               indices.push(i * this.hnum + j);
               indices.push(i * this.hnum + (j + 1) % this.hnum);
               indices.push(i * this.hnum + j);
               indices.push((i + 1) * this.hnum + j);
            }
        return indices;
    };
    sphere.update_buffers();
    return sphere;
}

function Cylinder(r, h, hnum)
{
    var cylinder = Primitive("Cylinder");
    cylinder.r = r;
    cylinder.h = h;
    cylinder.hnum = hnum;

    cylinder.get_points = function() {
        var points = [];
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.hnum;
           var x = this.r * Math.cos(c);
           var y = this.r * Math.sin(c);
           points.push(vec3(x, y,  this.h/2));
           points.push(vec3(x, y, -this.h/2));
           points.push(vec3(x, y,  this.h/2));
           points.push(vec3(x, y, -this.h/2));
        }
        points.push(vec3(0, 0, this.h/2));
        points.push(vec3(0, 0, -this.h/2));
        return points;
    }

    cylinder.get_normals = function() {
        var normals = [];
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.hnum;
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
        var vcap = 4 * this.hnum;
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
            // Side
            indices.push(4 * i);
            indices.push(4 * ((i + 1) % this.hnum));
            indices.push(4 * ((i + 1) % this.hnum) + 1);
            indices.push(4 * ((i + 1) % this.hnum) + 1);
            indices.push(4 * i + 1);
            indices.push(4 * i);

            // Cap
            indices.push(vcap);
            indices.push(4 * i + 2);
            indices.push(4 * ((i + 1) % this.hnum) + 2);
            indices.push(vcap + 1);
            indices.push(4 * i + 3);
            indices.push(4 * ((i + 1) % this.hnum) + 3);
        }
        return indices;
    };

    cylinder.get_lines = function() {
        var indices = [];
        var vcap = 4 * this.hnum;
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
            // Side
            indices.push(4 * ((i + 1) % this.hnum));
            indices.push(4 * i);
            indices.push(4 * i);
            indices.push(4 * i + 1);
            indices.push(4 * i + 1);
            indices.push(4 * ((i + 1) % this.hnum) + 1);

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

function Cone(r, h, hnum)
{
    var cone = Primitive("Cone");
    cone.r = r;
    cone.h = h;
    cone.hnum = hnum;

    cone.get_points = function() {
        var points = [];
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.hnum;
           points.push(vec3(this.r * Math.cos(c), this.r * Math.sin(c), 0));
           points.push(vec3(0, 0, this.h));
        }
        for (i = 0; i != this.hnum; ++i)
        {
           var c = 2 * Math.PI * i / this.hnum;
           points.push(vec3(this.r * Math.cos(c), this.r * Math.sin(c), 0));
        }
        points.push(vec3(0, 0, 0));
        return points;
    };

    cone.get_normals = function() {
        var normals = [];
        var i;
        for (i = 0; i != this.hnum; i += 0.5)
        {
           var c = 2 * Math.PI * i / this.hnum;
           var x = this.r * Math.cos(c);
           var y = this.r * Math.sin(c);
           var n = normalize(cross(vec3(-y, x, 0), vec3(-x, -y, this.h)));
           normals.push(n);
        }
        for (i = 0; i != this.hnum; ++i)
            normals.push(vec3(0, 0, -1));
        normals.push(vec3(0, 0, -1));
        return normals;
    };

    cone.get_triangles = function() {
        var indices = [];
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
            // Side
            indices.push(2 * i);
            indices.push(2 * i + 1);
            indices.push(2 * ((i + 1) % this.hnum));

            // Cap
            indices.push(3 * this.hnum);
            indices.push(2 * this.hnum + i);
            indices.push(2 * this.hnum + (i + 1) % this.hnum);
        }
        return indices;
    };

    cone.get_lines = function() {
        var indices = [];
        var i;
        for (i = 0; i != this.hnum; ++i)
        {
            indices.push(2 * i);
            indices.push(2 * i + 1);
            indices.push(2 * i);
            indices.push(2 * ((i + 1) % this.hnum));
            indices.push(2 * this.hnum + i);
            indices.push(3 * this.hnum);
        }
        return indices;
    };
    cone.update_buffers();
    return cone;
}
