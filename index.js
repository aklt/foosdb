
var fs = require('fs')
var path = require('path')
var stream = require('stream')
var mkdirp = require('mkdirp')

function Foosdb (o) {
  this.dir = o.dir
  this.infoFile = o.infoFile
  this.files = o.files
  this.bytes = o.bytes
  this.created = o.created
  this.limit = o.limit || 10  // simultaneous writers
  this.pending = []
  this.running = 0
  this.putCount = 0
  this.strategy = o.strategy || 'linear'
  this.perm = new Perm(this.files, this.strategy)
}

module.exports = Foosdb

Foosdb.open = function (o, cb) {
  if (!o.dir) throw new Error('Need o.dir')
  mkdirp(o.dir, (err) => {
    if (err) return cb(err)
    var infoFile = path.join(o.dir, 'info.json')
    readInfoFile(infoFile, (err, info) => {
      if (err) return cb(err)

      var db = new Foosdb({
        dir: o.dir,
        infoFile: infoFile,
        files: info.files,
        bytes: info.bytes,
        created: info.created,
        limit: o.limit,
        strategy: info.strategy || o.strategy
      })
      cb(null, db)
    })
  })
}

Foosdb.prototype = {
  put: function (readStreamOrString, cb) {
    this.pending.push([readStreamOrString, cb])
    this.putCount += 1
    this._process()
  },
  _process: function () {
    setImmediate(() => {
      if (this.running > this.limit) return this._process()
      var fn = this.pending.shift()
      this.running += 1
      this._put(fn[0], (err, data, index) => {
        this.running -= 1
        this.putCount -= 1
        fn[1](err, data, index)
      })
    })
  },
  _put: function (readStreamOrString, cb) {
    if (typeof readStreamOrString === 'string') {
      readStreamOrString = stringToStream(readStreamOrString)
    }
    var index = this.perm.index
    var hash = this.perm.next()
    var dest = pathArray(this.dir, hash)
    var destFile = dest.pop()
    var destPath = path.join.apply(null, dest)
    mkdirp(destPath, (err) => {
      if (err) return cb(err)
      var filePath = path.join(destPath, destFile)
      var outStream = fs.createWriteStream(filePath)
      readStreamOrString
        .on('data', (chunk) => {
          this.bytes += chunk.byteLength
          outStream.write(chunk)
        })
        .on('end', () => {
          this.files += 1
          cb(null, hash, index)
        })
        .on('error', (err) => {
          cb(err)
        })
    })
  },
  get: function (hashOrIndex, cb) {
    if (typeof hashOrIndex === 'number') hashOrIndex = this.perm.get(hashOrIndex)
    var filePath = path.join.apply(null, pathArray(this.dir, hashOrIndex))
    fs.access(filePath, (err) => {
      if (err) {
        return cb(new Error('No data at ' + hashOrIndex))
      }
      return cb(null, fs.createReadStream(filePath))
    })
  },
  close: function (cb) {
    cb = cb || function () {}
    // wait for pending put operations
    // TODO wait for gets too
    if (this.putCount > 0) {
      return setImmediate(() => {
        this.close(cb)
      })
    }
    var info = {
      files: this.files,
      bytes: this.bytes,
      strategy: this.strategy,
      created: this.created
    }
    var data = JSON.stringify(info)
    fs.writeFile(this.infoFile, data, (err) => {
      if (err) return cb(err)
      cb(null, info)
    })
  }
}

function readInfoFile (infoFile, cb) {
  fs.readFile(infoFile, (err, info) => {
    if (err) {
      if (err.code !== 'ENOENT') return cb(err)
      info = {
        files: 0,
        bytes: 0,
        created: Date.now()
      }
    } else {
      info = JSON.parse(info.toString())
    }
    cb(null, info)
  })
}

// see http://preshing.com/20121224/how-to-generate-a-sequence-of-unique-random-integers/
const prime = 4294967291 // Math.pow(62, 6) > 4294967291
const prime2 = prime / 2
function permuteQPR (x) {
  if (x >= prime) throw new Error('Too  big')
  var residue = (x * x) % prime
  return ((x <= prime2) ? residue : prime - residue) >>> 0
}

function uniquePermuter (x) {
  return (permuteQPR(permuteQPR(x) + 10927) ^ 0x5bf03635) >>> 0
}

function id (x) {
  return x
}

const permSize = 6
const permAlpha =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function Perm (index, strategy) {
  this.index = index || 0
  if (strategy === 'linear') this.getIndex = id
  else this.getIndex = uniquePermuter
}

Perm.prototype = {
  next: function () {
    var hash = this.get(this.index)
    this.index += 1
    return hash
  },
  get: function (index) {
    var src = permAlpha.slice()
    var result = []
    var item
    index = this.getIndex(index)
    for (var i = 0; i < permSize; i += 1) {
      item = index % src.length
      index = Math.floor(index / src.length)
      result.unshift(src[item])
      src.splice(item, 1)
    }
    return result.join('')
  }
}

function pathArray (base, hash) {
  return [base, hash.slice(0, 2), hash.slice(2, 4), hash.slice(4)]
}

function stringToStream (str) {
  var s = new stream.Readable()
  s._read = function noop () {}
  s.push(str)
  s.push(null)
  return s
}
