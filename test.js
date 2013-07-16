var continuous = require('./')
  , unpack = require('ndarray-unpack')
  , fill = require('ndarray-fill')
  , isndarray = require('isndarray')
  , zeros = require('zeros')
  , test = require('tape')

function getter(position, next) {
  var shape = this.shape

  next(null, fill(zeros(shape), function(x, y) {
    x += position[0] * shape[0]
    y += position[1] * shape[1]

    return x + y * 2
  }))
}

test('continuous#chunk', function(t) {
  t.plan(6)

  var field = continuous({
      shape: [5, 5]
    , getter: getter
  })

  field.chunk([0, 0], function(err, chunk) {
    t.ifError(err)
    chunk = chunk.transpose(1, 0)
    t.deepEqual(chunk.shape, [5, 5])
    t.deepEqual(unpack(chunk), [
        [0, 1, 2, 3, 4]
      , [2, 3, 4, 5, 6]
      , [4, 5, 6, 7, 8]
      , [6, 7, 8, 9,10]
      , [8, 9,10,11,12]
    ])
  })

  field.chunk([1, 1], function(err, chunk) {
    t.ifError(err)
    chunk = chunk.transpose(1, 0)
    t.deepEqual(chunk.shape, [5, 5])
    t.deepEqual(unpack(chunk), [
        [15, 16, 17, 18, 19]
      , [17, 18, 19, 20, 21]
      , [19, 20, 21, 22, 23]
      , [21, 22, 23, 24, 25]
      , [23, 24, 25, 26, 27]
    ])
  })
})

test('continuous#group', function(t) {
  t.plan(6)

  var field = continuous({
    shape: [5, 5],
    getter: getter
  })

  field.group([-1, -1], [1, 1], function(err, chunk) {
    t.ifError(err)
    t.deepEqual(chunk.shape, [15, 15])
    t.equal(chunk.get(0, 0), -15)
    t.equal(chunk.get(1, 0), -14)
    t.equal(chunk.get(0, 1), -13)
    t.equal(chunk.get(1, 1), -12)
  })
})

test('continuous#get', function(t) {
  var field = continuous({
    shape: [5, 5],
    getter: getter
  })

  t.equal(field.get([0, 0]), 0)
  t.equal(field.get([1, 0]), 1)
  t.equal(field.get([0, 1]), 2)
  t.equal(field.get([1, 1]), 3)
  t.end()
})

test('continuous#set', function(t) {
  var field = continuous({
    shape: [5, 5],
    getter: getter
  })

  t.equal(field.get([0, 0]), 0)
  t.equal(field.get([1, 1]), 3)
  field.set([0, 0], 100)
  field.set([1, 1], 900)
  field.set([2, 2], 400)
  t.equal(field.get([0, 0]), 100)
  t.equal(field.get([1, 1]), 900)
  t.equal(field.get([2, 2]), 400)
  t.end()
})

test('data shared across the instances of the same chunk', function(t) {
  t.plan(10)

  var field = continuous({
    shape: [5, 5],
    getter: getter
  })

  field.chunk([0, 0], function(err, chunk) {
    t.ifError(err)
    t.equal(chunk.get(0, 0), 0)
    t.equal(chunk.get(0, 1), 2)
    chunk.set(0, 0, 100)
    t.equal(chunk.get(0, 0), 100)

    field.chunk([0, 1], function(err, chunk) {
      t.ifError(err)
      t.equal(chunk.get(0, 0), 10)
      chunk.set(0, 0, 900)
      t.equal(chunk.get(0, 0), 900)

      field.group([0, -1], [0, 1], function(err, chunk) {
        t.ifError(err)
        t.equal(chunk.get(0, 5),  100)
        t.equal(chunk.get(0, 10), 900)
      })
    })
  })
})

test('continuous#range', function(t) {
  t.plan(14)

  var field = continuous({
      shape: [5, 5]
    , getter: getter
  })

  field.range([-1, -1], [1, 1], function(err, chunk) {
    t.ifError(err)
    t.deepEqual(chunk.shape, [3, 3])
    chunk = chunk.transpose(1, 0)
    t.deepEqual(unpack(chunk), [
        [-3, -2, -1]
      , [-1,  0,  1]
      , [ 1,  2,  3]
    ])
  })

  field.range([1, 1], [25, 25], function(err, chunk) {
    t.ifError(err)
    t.deepEqual(chunk.shape, [25, 25])
    t.deepEqual(chunk.get(0, 0), 3)
    t.deepEqual(chunk.get(1, 0), 4)
    t.deepEqual(chunk.get(0, 1), 5)
  })

  field.range([1, 1], [25, 42], function(err, chunk) {
    t.ifError(err)
    t.deepEqual(chunk.shape, [25, 42])
    t.deepEqual(chunk.get(0, 0), 3)
  })

  field.range([-21, -23], [26, 28], function(err, chunk) {
    t.ifError(err)
    t.deepEqual(chunk.shape, [21+26+1, 23+28+1])
    t.deepEqual(chunk.get(0, 0), -21-23*2)
  })
})

test('Synchronous API', function(t) {
  var field = continuous({
    shape: [5, 5],
    getter: getter
  })

  var range = field.range([-10, -10], [10, 10])
  var group = field.group([-1, -1], [1, 1])
  var chunk = field.chunk([0, 0])

  t.ok(chunk, 'chunk() returned truthy')
  t.ok(group, 'group() returned truthy')
  t.ok(range, 'range() returned truthy')
  t.ok(isndarray(chunk), 'chunk() returned ndarray')
  t.ok(isndarray(group), 'group() returned ndarray')
  t.ok(isndarray(range), 'range() returned ndarray')
  t.end()
})

test('Emits events', function(t) {
  var count = 0
  var field = continuous({
    shape: [5, 5],
    getter: getter
  }).on('created', function() {
    count += 1
  }).on('removed', function() {
    count -= 1
  })

  field.chunk([0, 0])
  t.equal(count, 1)
  // Not if it already exists...
  field.chunk([0, 0])
  t.equal(count, 1)

  field.group([-1, -1], [1, 1])
  t.equal(count, 9)

  t.end()
})
