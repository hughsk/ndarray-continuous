var continuous = require('./')
var cave = require('cave-automata-2d')
var render = require('ndarray-canvas')
var fill = require('ndarray-fill')
var grid = continuous({
  shape: [32, 32]
})

function amplify(array) {
  return fill(array, function(x, y) {
    return array.get(x,y) * 255
  }, {
    debug: true,
    printCode: true
  })
}

function edges(array) {
  return fill(array, function(x, y) {
    if (!(x % 32) || !(y % 32)) return 128 + (array.get(x, y) - 128) * 0.5
    return array.get(x, y)
  })
}

grid.range([64, 64], [128, 128], function(err, array) {
  cave(array)(5)
  amplify(array)
  grid.group([0, 0], [5, 5], function(err, array) {
    if (err) throw err
    edges(array)
    var canvas = render(null, array)
    canvas.style.margin = '20px'
    document.body.appendChild(canvas)
  })
  grid.group([1, 1], [4, 4], function(err, array) {
    if (err) throw err
    var canvas = render(null, array)
    canvas.style.margin = '20px'
    document.body.appendChild(canvas)
  })

  function handle(x, y) {
    grid.chunk([x, y], function(err, array) {
      if (err) throw err
      var canvas = render(null, array)
      canvas.style.margin = '20px'
      document.body.appendChild(canvas)
    })
  }

  handle(2, 2)
  handle(2, 3)
  handle(3, 3)
  handle(3, 2)
})
