var EventEmitter = require('events').EventEmitter
var group = require('ndarray-group')
var inherits = require('inherits')
var cells = require('cell-range')
var map = require('map-async')
var zeros = require('zeros')

function noop(){}

module.exports = Continuous

inherits(Continuous, EventEmitter)
function Continuous(options) {
  if (!(this instanceof Continuous)) return new Continuous(options)
  EventEmitter.call(this)

  options = options || {}
  if (Array.isArray(options)) {
    options = { shape: options }
  }

  if (options.getter) this.getter = options.getter
  if (!options.shape) throw new Error(
    'You need to provide a default shape for your ndarrays'
  )

  this.index = {}
  this.shape = options.shape
  this.dims = this.shape.length
  this.offsets = []

  var size = 1
  for (var i = 0; i < this.shape.length; i += 1) {
    this.offsets[i] = size
    size *= this.shape[i]
  }
}

Continuous.prototype.chunkIndex = function(position) {
  return position.join('|')
}

Continuous.prototype.chunk = function(position, done) {
  var index = this.chunkIndex(position)
  var chunk = this.index[index]
  var self = this

  done = done || noop
  if (chunk) return done(null, chunk), chunk

  this.getter.call(this, position, function(err, chunk) {
    if (err) return done(err)

    self.index[index] = chunk
    chunk.position = position.slice(0)
    self.emit('created', chunk)

    done(null, chunk)
    return chunk
  })

  return this.index[index] || null
}

Continuous.prototype.group = function(hi, lo, done) {
  var positions = cells(hi, lo)
  var offsets = this.offsets
  var shape = this.shape
  var dims = this.dims
  var arrays = []
  var self = this

  done = done || noop

  positions.sort(function(a, b) {
    var aidx = 0
    var bidx = 0

    for (var i = 0; i < dims; i += 1) {
      aidx += a[i] * offsets[i]
      bidx += b[i] * offsets[i]
    }

    return aidx - bidx
  })

  var grouped = null

  map(positions, function(position, next) {
    self.chunk(position, next)
  }, function(err, arrays) {
    if (err) return done(err)
    var shape = []

    for (var i = 0; i < hi.length; i += 1) {
      shape[i] = lo[i] - hi[i] + 1
    }

    grouped = group(shape, arrays)
    done(null, grouped)
  })

  return grouped
}

Continuous.prototype.range = function(hi, lo, done) {
  var hiChunk = []
  var loChunk = []
  var dims = this.dims
  var self = this
  var tl = []
  var br = []

  done = done || noop

  for (var i = 0; i < dims; i += 1) {
    hiChunk[i] = Math.floor(hi[i] / this.shape[i])
    loChunk[i] = Math.ceil(lo[i] / this.shape[i])

    tl[i] = -hiChunk[i] * this.shape[i] + hi[i]
    br[i] = -hiChunk[i] * this.shape[i] + lo[i] + 1
  }

  var finished = null

  this.group(hiChunk, loChunk, function(err, array) {
    if (err) return done(err)
    array = array.hi.apply(array, br)
    array = array.lo.apply(array, tl)
    done(null, finished = array)
  })

  return finished
}

Continuous.prototype.remove = function(position, done) {
  var index = this.chunkIndex(position)
  var chunk = this.index[index]

  done = done || noop
  if (!chunk) return done(null), false

  self.emit('removed', chunk)
  return delete this.index[index]
}

Continuous.prototype.getter = function(position, done) {
  return done(null, zeros(this.shape))
}
