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
   [ { name: 'manufacturer_id', direction: 'asc' },
     { name: 'description', direction: 'asc' } ] }
*/
```

## TODO

- `fetchCursorPage` will break if one of the sorted columns is not
    accessible via `model.get(colName)` (either because the column is
    not returned by the select or because the bookshelf object
    implements a `.format()` method).
