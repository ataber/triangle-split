# triangle-split

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Mesh refinement via triangle-splitting. Does not change the surface normals. This package is useful if you want to refine your tessellation in order to more finely sample some field, but still preserve sharp corners in your mesh.

This is very similar to the edge-split algorithm [here](https://www.npmjs.com/package/edge-split), except this package uses cell area as the heap priority rather than edge length. For use-cases where minimizing triangle area is the goal, this package is a better choice.

## Usage

[![NPM](https://nodei.co/npm/triangle-split.png)](https://www.npmjs.com/package/triangle-split)

```javascript
var bunny          = require('bunny')
var split          = require('./index');
var refined        = split(bunny.positions, bunny.cells, 0.01, 1000);
console.log(refined) # <- {positions: [[0.5,0.2,0.1], ...], cells: [[0,1,2],...]}
```

`require("triangle-split")(cells, positions[, areaThreshold, maxIterations])`
----------------------------------------------------
This returns a simplicial complex that has maximum cell area less than `areaThreshold`. By default, `areaThreshold` is set to the mean triangle area. By default it will split indefinitely, which can be customized by the `maxIterations` argument. Note: this function modifies `cells` and `positions` in-place, so create a copy before using if needed.

## Contributing

See [stackgl/contributing](https://github.com/stackgl/contributing) for details.

## License

MIT. See [LICENSE.md](http://github.com/ataber/mesh-simplify/blob/master/LICENSE.md) for details.
