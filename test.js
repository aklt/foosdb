
var fs = require('fs')
var path = require('path')
var test = require('tape')
var rmrf = require('rimraf')

var Fsdb = require('./index')

var file0 = path.join(__dirname, 'README.md')
var file1 = path.join(__dirname, 'index.js')
var file2 = path.join(__dirname, 'test.js')

var data0 = fs.readFileSync(path.join(__dirname, 'README.md')).toString()
var data1 = fs.readFileSync(path.join(__dirname, 'index.js')).toString()
var data2 = fs.readFileSync(path.join(__dirname, 'test.js')).toString()

function streamToString (s, cb) {
  var result = []
  s.on('data', (data) => {
    result.push(data)
  })
  s.on('end', () => {
    cb(null, Buffer.concat(result).toString())
  })
}

test('open, put, get, close', (t) => {
  t.plan(12)

  rmrf.sync('./tmp/testdb')

  Fsdb.open({
    dir: './tmp/testdb',
    strategy: 'linear'
  }, (err, db) => {
    if (err) throw err

    // Put data
    var s0 = fs.createReadStream(file0)
    db.put(s0, (err, hash, index) => {
      if (err) throw err
      t.equal(hash, '543210')
      t.equal(index, 0)
    })
    var s1 = fs.createReadStream(file1)
    db.put(s1, (err, hash, index) => {
      if (err) throw err
      t.equal(hash, '543201')
      t.equal(index, 1)
    })
    var s2 = fs.createReadStream(file2)
    db.put(s2, (err, hash, index) => {
      if (err) throw err
      t.equal(hash, '543102')
      t.equal(index, 2)
    })

    // Get data with a number
    setTimeout(() => {
      db.get(0, (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data0)
        })
      })
      db.get(1, (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data1)
        })
      })
      db.get(2, (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data2)
        })
      })
    }, 100)

    // Get data with a hash
    setTimeout(() => {
      db.get('543210', (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data0)
        })
      })
      db.get('543201', (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data1)
        })
      })
      db.get('543102', (err, data) => {
        if (err) throw err
        streamToString(data, (err, data) => {
          if (err) throw err
          t.equal(data, data2)
        })
      })
    }, 100)
  })
})
//
// var db1 = fsdb.open({
//   baseDir: './tmp/testdb',
//   strategy: 'linear'
// }, (err, db) => {
//
//   function inserter (i) {
//     var word = words[i]
//     if (i < 1000) {
//       db.put(word, (err, hash, index) => {
//         console.warn(err, hash)
//       })
//       setImmediate(function () {
//         inserter(i + 1)
//       })
//     } else {
//       db.close((err, stats) => {
//         console.warn('stats', err, stats)
//       })
//     }
//   }
//   inserter(0)
// })
//
// function cb (err) {
//   if (err) {
//     console.warn(err, err.stack)
//   }
// }
//
