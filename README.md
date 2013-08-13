# ndarray-continuous [![unstable](https://rawgithub.com/hughsk/stability-badges/master/dist/unstable.svg)](http://github.com/hughsk/stability-badges) #

An experiment with creating continuous grids/volumes from "chunked"
[ndarrays](http://github.com/mikolalysenko/ndarray). Ideally, this could make
it easy to work with infinite terrain, or simply splitting a large area into
smaller chunks to conserve memory - while still taking advantage of the modules
designed to work with ndarrays.

The interface supports both asynchronous and synchronous getters, in case you
want to back the chunks with a local storage mechanism such as
[level.js](http://github.com/maxogden/level.js).

## API ##

### `field = require('ndarray-continuous')(options)` ###

Takes an options object, with the following properties:

* `shape`: the shape (dimensions) of each chunk.
* `getter`: a function that is called when a new chunk is required.

The `getter` function takes two arguments, `position` and `done`. The former
is the chunk's position (in chunks, not units), and the latter is a Node-style
callback for returning the new array. If you want to retrieve chunks
synchronously you can return the array as well. All chunks must be the same
shape as specified in the `shape` option.

### `field.chunk(position[, done])` ###

Retrieves a single chunk, by its position in chunkspace.

### `field.group(hi, lo[, done])` ###

Retrieves a [proxy](http://github.com/mikolalysenko/ndarray-proxy) array
combining the chunks between `hi` and `lo` inclusive.

### `field.range(hi, lo[, done])` ###

Retrieve a proxy array that represents the points (in units) between `hi` and
`lo`. Unlike `group` and `chunk`, you can use this to select an arbitrary area
of elements.

### `field.index` ###

The local chunk cache - an object containing each chunk, indexed by their
positions.

### `field.remove(position[, done])` ###

Clears a chunk from the local object cache - you should be doing this when
you're no longer using a chunk to conserve memory.

``` javascript
var field = require('ndarray-continuous')({
    shape: [50, 50, 50]
  , getter: function(position, done) {
    return done(null, zeros([50, 50]))
  }
})

var array = field.group([-5, -5, -5], [5, 5, 5])
require('cave-automata-2d')(array)(10)

// things happen...
setTimeout(function() {
  field.each(function(chunk) {
    field.remove(chunk.position)
  })
}, 1000)
```

### `field.get(position[, done])` ###

A shorthand method for getting individual values directly by their position on
the continuous ndarray.

### `field.set(position, value[, done])` ###

A shorthand method for setting individual values directly by their position on
the continuous ndarray.

### `field.each(iterator)` ###

Calls `iterator` for each currently instantiated chunk, passing the chunk as
the first argument.

### `field.size()` ###

Returns the amount of chunks currently instantiated.

### `field.on('created', callback)` ###

Called when a fresh chunk has been loaded - passing the chunk as an argument to
the callback.

### `field.on('removed', callback)` ###

Called when a chunk has been removed - passing the chunk as an argument to the
callback.
