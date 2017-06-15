# Disk stored key value database

Store data into files in a nested directory structure.  Files will be uniquely
enumerated using a pseudo randomly generated hash value which can be used to
retrieve the file later.

## API

### Fsdb.open({dir: '', strategy: 'linear'}, function (db) {})

Open an existing dir using a specific strategy for how to create files.  The
default strategy is 'linear' which will create more files.  The 'random'
strategy will create more directories.

If data has already been written to dir the strategy of this dir will be used
and the strategy argument will be ignored.

The return value db can be used to put and get data.

### db.put(streamOrString, cb(err, hash, index))

Put a stream or string of data into the store and return a 6 character long
hash value and an index which can both be used to retrieve the stored data.

### db.get(hashOrIndex, cb(err, stream))

Get an open file stream to the data stored at hashOrIndex.

### db.close([cb(err, info)])

Close the database and call the optional callback function with info about the
data in the store:

    {
      files: ...,     // How many files are in the store
      bytes: ...,     // How many bytes are stored
      strategy: ...,  // 'linear' of 'random'
      created: ...    // When this store was created
    }

This info is also written to dir/info.json
