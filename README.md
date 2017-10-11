[![Build Status](https://travis-ci.org/binded/bookshelf-cursor-pagination.svg?branch=master)](https://travis-ci.org/binded/bookshelf-cursor-pagination)

# bookshelf-cursor-pagination

Bookshelf plugin that implements [cursor based pagination](https://www.sitepoint.com/paginating-real-time-data-cursor-based-pagination/).

## Install

```bash
npm install bookshelf-cursor-pagination
```

## Usage

`fetchCursorPage` is the same as
[fetchPage](http://bookshelfjs.org/#Model-instance-fetchPage) but with
cursors instead. A cursor is a series of column values that uniquely
identify the position of a row in a result set. If only the primary ID
is sorted a cursor is simply the primary ID of a row.
Arguments:
- *limit*: size of page (defaults to 10)
- *before*: array of values that correspond to sorted columns
- *after*: array of values that correspond to sorted columns

If there is no sorting and the cursor (before or after) has one element,
we implicitly sort by the id attribute.

`before` and `after` are mutually exclusive. `before` means we fetch the
page of results before the row represented by the cursor. `after` means
we fetch the page of results before the row represented by the cursor.

```javascript
import cursorPagination from 'bookshelf-cursor-pagination'

// ...

bookshelf.plugin(cursorPagination)

// ...
class Car extends Bookshelf.Model {
  get tableName() { return 'cars' }
}

const result = await Car.collection()
  .orderBy('manufacturer_id')
  .orderBy('description')
  .fetchCursorPage({
    after: [/* manufacturer_id */ '8', /* description */ 'Cruze'],
  })

console.log(result.models)

// ...

console.log(result.pagination)

/*
{ limit: 10,
  rowCount: 27,
  hasMore: true,
  cursors: { after: [ '17', 'Impreza' ], before: [ '8', 'Impala' ] },
  orderedBy:
   [ { name: 'manufacturer_id', direction: 'asc', tableName: 'cars' },
     { name: 'description', direction: 'asc', tableName: 'cars' } ] }
*/

// A next() method is also available on the collection to fetch the next
// set of result
```

Example of stable iteration with cursors:

```javascript
// will iterate by batches of 5 until the end
const iter = async (doSomething, after) => {
  const coll = await Car.collection()
    .orderBy('id')
    .fetchCursorPage({ after, limit: 5 })
  await doSomething(coll)
  if (coll.pagination.hasMore) {
    return iter(doSomething, coll.pagination.cursors.after)
  }
}

iter((collection) => {
  console.log(collection.models.length)
  // 5
})
```

This plugin also adds a `forEach` method that takes the same arguments
as `fethPage` and a callback which is called for every result set.

For example:

```javascript
const main = async () => {
  await Car
    .collection()
    .orderBy('id')
    .forEach({ limit: 5 }, async (coll) => {
      // do something with collection
    })
  console.log('iterated over all rows!')
}
```

### Joins and/or .format

`fetchCursorPage` will break if one of the sorted columns is not
accessible via `model.get(colName)` (either because the column is not
returned by the select or because the bookshelf object implements a
`.format()` method).

In order to avoid this issue, you can implement a `toCursorValue` on
your model that will handle those edge cases. For example:

```javascript
Car.prototype.toCursorValue = function ({ name, tableName }) {
  if (tableName === this.tableName) return this.get(name)
  if (tableName === 'engines' && name === 'name') {
    return this.get('engine_name')
  }
  throw new Error(`cannot extract cursor for ${tableName}.${name}`)
}
```

