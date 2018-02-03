var vec3 = require('gl-vec3');
var Heap = require('heap');
var complex = require('simplicial-complex');

module.exports = function(cells, positions, threshold, maxIterations) {
  cells = Array.from(cells);
  positions = Array.from(positions);
  complex.normalize(cells);

  var scratch = new Array(3);
  var heap = new Heap((a, b) => b.aspectRatio - a.aspectRatio);
  var heapArray = [];
  cells.map(function(cell, i) {
    var heapCell = {
      aspectRatio: computeAspectRatio(cell.map(function(i) {
        return positions[i];
      })),
      cell: cell,
      index: i
    }
    heap.push(heapCell);
    heapArray.push(heapCell);
  });

  if (threshold == null) {
    var meanAspectRatio = 0;
    heap.toArray().map(function(element) {
      meanAspectRatio += element.aspectRatio;
    });
    meanAspectRatio /= heap.size();
    threshold = meanAspectRatio;
  }

  if (threshold < 1) {
    throw "Aspect ratio threshold must be >= 1";
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
  var count = 0;
  while (true) {
    count += 1;
    if ((maxIterations != null) && (count > maxIterations)) {
      break;
    }

    var element = heap.pop();
    if (element.aspectRatio < threshold) {
      break;
    }

    var cell = element.cell;
    var edgeIndices = cellToEdges[element.index];

    var longestEdgeIndex = null;
    var maxLength = 0;
    edgeIndices.forEach(function(edgeIndex) {
      var edge = edges[edgeIndex];
      vec3.subtract(scratch, positions[edge[0]], positions[edge[1]]);
      var length = vec3.length(scratch);

      if (length > maxLength) {
        longestEdgeIndex = edgeIndex;
        maxLength = length;
      }
    });

    var edgeIndicesArray = Array.from(edgeIndices);
    var shortIndex = edgeIndicesArray.indexOf(shortestEdgeIndex);
    // retrieve other two edges, we'll connect their midpoints
    var indexA = edgeIndicesArray[(shortIndex + 1) % 3];
    var indexB = edgeIndicesArray[(shortIndex + 2) % 3];

    var edgeA = edges[indexA];
    var edgeB = edges[indexB];

    vec3.add(scratch, positions[edgeA[0]], positions[edgeA[1]]);
    vec3.scale(scratch, scratch, 0.5);
    var newVertexIndexA = positions.push(scratch.slice()) - 1;

    vec3.add(scratch, positions[edgeB[0]], positions[edgeB[1]]);
    vec3.scale(scratch, scratch, 0.5);
    var newVertexIndexB = positions.push(scratch.slice()) - 1;

    var edgesToBeAdded = [];
    var newCells = [];
    var newCellIndices = [];
    var edgesWithModifiedIncidence = [];
    incidence[longestEdgeIndex].map(function(cellIndex) {
      cellsToBeDeleted.push(cellIndex);
      // this cell has effectively been removed from the heap
      heapArray[cellIndex].aspectRatio = 0;
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
        newCell[newCell.indexOf(edgeA[(i + 1) % 2])] = newVertexIndexA;
        // newCell[newCell.indexOf(edgeB[(i + 1) % 2])] = newVertexIndexB;
        newCells.push(newCell);
        var newCellIndex = cells.push(newCell) - 1;
        cellToEdges.push(new Set());
        newCellIndices.push(newCellIndex);

        var heapCell = {
          aspectRatio: computeAspectRatio(newCell.map(function(p) {
            return positions[p];
          })),
          cell: newCell,
          index: newCellIndex
        };
        heap.push(heapCell);
        heapArray.push(heapCell);
      }

      var crossCut = [newVertexIndexA, newVertexIndexB];
      var halfA_0 = [edgeA[0], newVertexIndexA];
      var halfA_1 = [edgeA[1], newVertexIndexA];
      var halfB_0 = [edgeB[0], newVertexIndexB];
      var halfB_1 = [edgeB[1], newVertexIndexB];
      [crossCut, halfA_0, halfA_1, halfB_0, halfB_1].map(function(newEdge) {
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

function computeAspectRatio(positions) {
  var scratch = new Array(3);
  var lengths = positions.map(function(position, index) {
    vec3.subtract(scratch, position, positions[(index + 1) % 3]);
    return vec3.length(scratch);
  });
  var minLength = Math.min(lengths[0], lengths[1], lengths[2]);
  var maxLength = Math.max(lengths[0], lengths[1], lengths[2]);
  return maxLength / minLength;
}
