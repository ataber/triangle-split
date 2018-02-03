// var bunny = require('bunny');
var mesh = require('primitive-cylinder')(10, 10, 50, 10, 1);
var split = require('./index');
var normals = require('normals');
console.time('refine');
var refined = split(mesh.cells, mesh.positions, null, 1);
console.log(refined.cells.length, mesh.cells.length, refined.positions.length, mesh.positions.length)
console.timeEnd('refine');
var norms = normals.vertexNormals(refined.cells, refined.positions);

var regl = require('regl')()
var mat4 = require('gl-mat4')
var wire = require('gl-wireframe')
var camera = require('regl-camera')(regl, {
  center: [0, 0, 0],
  theta: Math.PI / 2,
  distance: 4
})

var drawWires = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  varying vec3 vNorm;
  uniform mat4 projection;
  uniform mat4 view;
  void main() {
    vNorm = normal;
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `, frag: `
  precision mediump float;
  varying vec3 vNorm;
  void main() {
    vec3 lightDir = normalize(vec3(1., 1., 0.));
    gl_FragColor = vec4(vec3(0.8), 1.0);
  }
  `,
  attributes: {
    position: refined.positions,
    normal: norms
  },
  elements: wire(refined.cells),
  primitive: 'lines'
})

var drawOuter = regl({
  vert: `
  precision mediump float;

  attribute vec3 position, normal;
  varying vec3 vNorm;
  uniform mat4 projection;
  uniform mat4 view;
  void main() {
    vNorm = normal;
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `
  , frag: `
  precision mediump float;
  varying vec3 vNorm;
  void main() {
    vec3 lightDir = normalize(vec3(1., 1., 0.));
    gl_FragColor = vec4(vec3(0.) + vNorm, 1.0);
  }
  `,
  attributes: {
    position: refined.positions,
    normal: norms
  },
  elements: refined.cells,
  primitive: 'triangles'
})

regl.frame(() => {
  regl.clear({
    color: [1, 1, 1, 1],
    depth: 1
  })
  camera(() => {
    drawWires({
      view: mat4.create()
    })
    drawOuter({
      view: mat4.create()
    })
  })
})
