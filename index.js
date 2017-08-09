var vec3 = require('gl-vec3');
var Heap = require('heap');
var complex = require('simplicial-complex');

module.exports = function(cells, positions, threshold, maxIterations) {
  complex.normalize(cells);

  var scratch = new Array(3);
  var heap = new Heap((a, b) => b.squaredArea - a.squaredArea);
  var heapArray = [];
  cells.map(function(cell, i) {
    var heapCell = {
      squaredArea: computeSquaredArea(cell.map(function(i) {
        return positions[i];
      })),
      cell: cell,
      index: i
    }
    heap.push(heapCell);
    heapArray.push(heapCell);
  });

  if (threshold == null) {
    var meanCellArea = 0;
    heap.toArray().map(function(element) {
      meanCellArea += Math.sqrt(element.squaredArea);
    });
    meanCellArea /= heap.size();
    threshold = meanCellArea;
  }

  var edges = complex.unique(complex.skeleton(cells, 1));
  var incidence = complex.incidence(edges, cells);
  var cellToEdges = new Array(cells.length);
  incidence.map(function(cellIndices, edgeIndex) {
    cellIndices.map(function(cellIndex) {
      if (cellToEdges[cellIndex]) {
        cellToEdges[cellIndex].add(edgeIndex);
      } else {
        cellToEdges[cellIndex] = new Set([edgeIndex]);
      }
    });
  });

  var cellsToBeDeleted = [];
  var squaredThreshold = threshold * threshold;
  var count = 0;
  while (true) {
    count += 1;
    if ((maxIterations != null) && (count > maxIterations)) {
      break;
    }

    var element = heap.pop();
    if (element.squaredArea < squaredThreshold) {
      break;
    }

    var cell = element.cell;
    var edgeIndices = cellToEdges[element.index];

    var maxLength = 0;
    var longestEdgeIndex = null;
    edgeIndices.forEach(function(edgeIndex) {
      var edge = edges[edgeIndex];
      vec3.subtract(scratch, positions[edge[0]], positions[edge[1]]);
      var length = vec3.squaredLength(scratch);
      if (length > maxLength) {
        longestEdgeIndex = edgeIndex;
        maxLength = length;
      }
    });

    var edge = edges[longestEdgeIndex];
    vec3.add(scratch, positions[edge[0]], positions[edge[1]]);
    vec3.scale(scratch, scratch, 0.5);
    var newVertexIndex = positions.push(scratch.slice()) - 1;

    var edgesToBeAdded = [];
    var newCells = [];
    var newCellIndices = [];
    var edgesWithModifiedIncidence = [];
    incidence[longestEdgeIndex].map(function(cellIndex) {
      cellsToBeDeleted.push(cellIndex);
      // this cell has effectively been removed from the heap
      heapArray[cellIndex].squaredArea = 0;
      heap.updateItem(heapArray[cellIndex]);

      var deleteCell = cells[cellIndex];
      var oppositeVertex = deleteCell.find(function(index) {
        return !edge.includes(index);
      });

      if (typeof oppositeVertex == 'undefined') {
        throw `Degenerate cell in complex ${deleteCell}, index ${cellIndex}`;
      }

      for (var i = 0; i < 2; i++) {
        // preserve orientation
        var newCell = deleteCell.slice();
        newCell[newCell.indexOf(edge[(i + 1) % 2])] = newVertexIndex;
        newCells.push(newCell);
        var newCellIndex = cells.push(newCell) - 1;
        cellToEdges.push(new Set());
        newCellIndices.push(newCellIndex);

        var heapCell = {
          squaredArea: computeSquaredArea(newCell.map(function(i) {
            return positions[i];
          })),
          cell: newCell,
          index: newCellIndex
        };
        heap.push(heapCell);
        heapArray.push(heapCell);
      }

      var hypotenuse = [oppositeVertex, newVertexIndex];
      var halfA = [edge[0], newVertexIndex];
      var halfB = [edge[1], newVertexIndex];
      [hypotenuse, halfA, halfB].map(function(newEdge) {
        edgesToBeAdded.push(newEdge);
      });
    });

    complex.unique(complex.normalize(edgesToBeAdded));
    var edgesWithModifiedIncidence = complex.unique(complex.skeleton(newCells, 1));
    var incidentCells = complex.incidence(edgesWithModifiedIncidence, newCells);

    edgesWithModifiedIncidence.map(function(modifiedEdge, i) {
      var edgeToCellIncidence = incidentCells[i].map(function(cellIndex) {
        return newCellIndices[cellIndex];
      });

      if (complex.findCell(edgesToBeAdded, modifiedEdge) >= 0) {
        // this edge is not yet in the incidence table
        var edgeIndex = incidence.push(edgeToCellIncidence) - 1;
        edges.push(modifiedEdge);
        edgeToCellIncidence.map(function(globalCellIndex) {
          cellToEdges[globalCellIndex].add(edgeIndex);
        });
      } else {
        // this edge is in the incidence table, and we must modify the existing entry
        var edgeIndex = -1;
        for (var i = 0; i < edges.length; i++) {
          if ((modifiedEdge.indexOf(edges[i][0]) !== -1) &&
              (modifiedEdge.indexOf(edges[i][1]) !== -1)) {
            edgeIndex = i;
            break;
          }
        }

        if (edgeIndex === -1) {
          return;
        }

        edgeToCellIncidence.map(function(cell) {
          cellToEdges[cell].add(edgeIndex);
          incidence[edgeIndex].push(cell);
        });

        incidence[edgeIndex] = incidence[edgeIndex].filter(function(cell) {
          return cellsToBeDeleted.indexOf(cell) === -1;
        });
      }
    });
  }

  cellsToBeDeleted.sort(function(a, b) {
    return b - a;
  }).map(function(cellIndex) {
    cells.splice(cellIndex, 1);
  });

  return {
    positions: positions,
    cells: cells
  };
}

function computeSquaredArea(positions) {
  var edgeA = vec3.subtract([], positions[0], positions[1]);
  var edgeB = vec3.subtract([], positions[1], positions[2]);
  var crossed = vec3.cross([], edgeA, edgeB);
  return vec3.squaredLength(crossed);
}
