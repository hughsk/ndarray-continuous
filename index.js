var EventEmitter = require('events').EventEmitter
var group = require('ndarray-group')
var morton = require('morton-page')
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

  this.offsets = []
  this.shape = options.shape
  this.dims = this.shape.length
  this.index = morton(this.dims, 4, null, 'position')
  this.pending = morton(this.dims, 4, null, 'position')

  var size = 1
  for (var i = 0; i < this.shape.length; i += 1) {
    this.offsets[i] = size
    size *= this.shape[i]
  }
}

Continuous.prototype.each = function(iterator) {
  var pages = this.index.pages
  for (var p = 0; p < pages.length; p += 1)
  for (var c = 0; c < pages[p].length; c += 1) {
    iterator.call(this, pages[p][c])
  }
}

Continuous.prototype.size = function() {
  var pages = this.index.pages
  var c = 0
  for (var p = 0; p < pages.length; p += 1) {
    c += pages[p].length
  }
  return c
}

Continuous.prototype.chunk = function(position, done) {
  var chunk = this.index.get.apply(this.index, position)
  var self = this

  done = done || noop
  if (chunk) return done(null, chunk), chunk

  // Queue already exists: we're in the middle
  // of getting this chunk, so add it to the
  // queue
  var pending = this.pending.get.apply(this.pending, position)
  if (pending) {
    pending.push(done)
    return null
  }

  // Create a queue for any chunk queries
  // that come through while we retrieve
  // this one.
  var queue = []
  queue.position = position
  this.pending.add(queue)

  this.getter.call(this, position, finished)

  var result = null
  function finished(err, chunk) {
    var i = 0

    // Clear the queue we created before.
    self.pending.remove.apply(self.pending, position)

    if (err) {
      done(err)
      for (;i < queue.length; i += 1) queue[i](err)
      return queue.length = 0
    }

    result = chunk
    chunk.position = position.slice(0)
    self.index.add(chunk)
    self.emit('created', chunk)

    done(null, chunk)
    for (;i < queue.length; i += 1) {
      queue[i](null, chunk)
    }

    queue.length = 0

    return chunk
  }

  return result
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

Continuous.prototype.get = function(position, done) {
  var rounded = []
  var result = 0
  var dims = this.dims
  var shape = this.shape
  var d = dims

  while (d--) rounded[d] = Math.floor(position[d] / shape[d])

  done = done || function(){}

  this.chunk(rounded, function(err, chunk) {
    if (err) return done(err)

    var d = dims
    while (d--) rounded[d] = position[d] - rounded[d] * shape[d]

    result = chunk.get.apply(chunk, rounded)
    return done(null, result), result
  })

  return result
}

Continuous.prototype.set = function(position, value, done) {
  var rounded = []
  var shape = this.shape
  var dims = this.dims
  var d = dims

  while (d--) rounded[d] = Math.floor(position[d] / shape[d])

  done = done || function() {}

  this.chunk(rounded, function(err, chunk) {
    if (err) return done(err)

    var d = dims
    while (d--) rounded[d] = position[d] - rounded[d] * shape[d]
    rounded[dims] = value

    chunk.set.apply(chunk, rounded)
    return done(null)
  })
}

Continuous.prototype.remove = function(position, done) {
  var chunk = this.index.get.apply(this.index, position)

  done = done || noop
  if (!chunk) return done(null), false

  this.emit('removed', chunk)
  this.index.remove.apply(this.index, position)
  return done(null, chunk), true
}

Continuous.prototype.getter = function(position, done) {
  return done(null, zeros(this.shape))
}
