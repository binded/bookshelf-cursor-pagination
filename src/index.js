import { remove, assign } from 'lodash'

const DEFAULT_LIMIT = 10

const ensurePositiveIntWithDefault = (val, def) => {
  if (!val) return def
  const _val = parseInt(val, 10)
  if (Number.isNaN(_val)) {
    return def
  }
  return _val
}


const count = (origQuery, Model, tableName, idAttribute, limit) => {
  const notNeededQueries = [
    'orderByBasic',
    'orderByRaw',
    'groupByBasic',
    'groupByRaw',
  ]
  const counter = Model.forge()

  return counter.query(qb => {
    assign(qb, origQuery)

    // Remove grouping and ordering. Ordering is unnecessary
    // for a count, and grouping returns the entire result set
    // What we want instead is to use `DISTINCT`
    remove(qb._statements, statement => (
      (notNeededQueries.indexOf(statement.type) > -1) ||
        statement.grouping === 'columns'
    ))
    qb.countDistinct.apply(qb, [`${tableName}.${idAttribute}`])
  }).fetchAll().then(result => {
    const metadata = { limit }

    if (result && result.length === 1) {
      // We shouldn't have to do this, instead it should be
      // result.models[0].get('count')
      // but SQLite uses a really strange key name.
      const modelsCount = result.models[0]
      const keys = Object.keys(modelsCount.attributes)
      if (keys.length === 1) {
        const key = Object.keys(modelsCount.attributes)[0]
        metadata.rowCount = parseInt(modelsCount.attributes[key], 10)
      } else {
        // some keys were probably added due to a custom .parse method on the model
        // fallback to using the "count" attribute
        metadata.rowCount = parseInt(modelsCount.get('count'), 10)
      }
    }

    return metadata
  })
}

const isDesc = str => typeof str === 'string' && str.toLowerCase() === 'desc'

const reverseDirection = d => (isDesc(d) ? 'ASC' : 'DESC')

const reverseOrderBy = (qb) => {
  qb._statements
    .filter(s => s.type === 'orderByBasic')
    .forEach(s => {
      s.direction = reverseDirection(s.direction)
    })
}

const reverseSign = (sign) => ({ '>': '<', '<': '>' }[sign])

const applyCursor = (qb, cursor, mainTableName, idAttribute) => {
  const isNotSorted = qb._statements
    .filter(s => s.type === 'orderByBasic')
    .length === 0

  // We implicitly sort by ID asc
  if (isNotSorted) {
    qb.orderBy(`${mainTableName}.${idAttribute}`, 'asc')
  }

  const sortedColumns = qb._statements
    .filter(s => s.type === 'orderByBasic')
    .map(({ value, direction: _direction }) => {
      const direction = isDesc(_direction) ? 'desc' : 'asc'
      const [tableName, colName] = value.split('.')
      if (typeof colName === 'undefined') {
        // not prefixed by table name
        return { name: tableName, direction, tableName: mainTableName }
      }
      return { name: colName, direction, tableName }
    })

  const buildWhere = (chain, [currentCol, ...remainingCols], visitedCols = []) => {
    const { direction } = currentCol
    const index = visitedCols.length
    const cursorValue = cursor.columnValues[index]
    const cursorType = cursor.type
    let sign = isDesc(direction) ? '<' : '>'
    if (cursorType === 'before') {
      sign = reverseSign(sign)
    }
    const colRef = (col) => `${col.tableName}.${col.name}`

    // TODO: null cursor needs to be handled specially,
    // e.g. where somecol > 'someval'
    // will not show rows where somecol is null

    /* eslint-disable func-names */
    chain.orWhere(function () {
      this.andWhere(function () {
        if (cursorValue !== null) {
          this.where(colRef(currentCol), sign, cursorValue)
          if (sign === '>') {
            // In PostgreSQL, `where somecol > 'abc'` does not return
            // rows where somecol is null. We must explicitly include them
            // with `where somecol is null`
            this.orWhere(colRef(currentCol), 'is', null)
          }
        } else if (sign === '<') {
          // `col < null` does not work as expected,
          // we use `IS NOT null` instead
          this.where(colRef(currentCol), 'is not', cursorValue)
        } else {
          this.where(colRef(currentCol), '>', cursorValue)
        }
      })
      visitedCols.forEach((visitedCol, idx) => {
        const colValue = cursor.columnValues[idx]
        // If column is null, we have to use "IS" instead of "="
        const operand = colValue === null ? 'is' : '='
        this.andWhere(colRef(visitedCol), operand, colValue)
      })
    })
    if (!remainingCols.length) return
    return buildWhere(chain, remainingCols, [...visitedCols, currentCol])
  }

  if (cursor) {
    if (sortedColumns.length !== cursor.columnValues.length) {
      throw new Error('sort/cursor mismatch')
    }

    qb.andWhere(function () {
      buildWhere(this, sortedColumns)
    })

    // "before" is just like after if we reverse the sort order
    if (cursor.type === 'before') {
      reverseOrderBy(qb)
    }
  }

  // This will only work if column name === attribute name
  const model2cursor = (model) => {
    if (typeof model.toCursorValue === 'function') {
      return sortedColumns.map(c => model.toCursorValue(c))
    }
    return sortedColumns.map(({ name }) => model.get(name))
  }

  const extractCursors = (coll) => {
    if (!coll.length) return {}
    const before = model2cursor(coll.models[0])
    const after = model2cursor(coll.models[coll.length - 1])
    if (cursor && cursor.type === 'before') {
      // sort is reversed so after is before and before is after
      return { after: before, before: after }
    }
    return { after, before }
  }
  return (coll) => ({
    cursors: extractCursors(coll),
    orderedBy: sortedColumns,
  })
}

const ensureArray = (val) => {
  if (!Array.isArray(val)) {
    throw new Error(`${val} is not an array`)
  }
}

/**
 * Exports a plugin to pass into the bookshelf instance, i.e.:
 *
 *      import config from './knexfile'
 *      import knex from 'knex'
 *      import bookshelf from 'bookshelf'
 *
 *      const ORM = bookshelf(knex(config))
 *
 *      ORM.plugin('bookshelf-cursor-pagination')
 *
 *      export default ORM
 *
 * The plugin attaches an instance methods to the bookshelf
 * Model object: fetchCursorPage.
 *
 * Model#fetchCursorPage works like Model#fetchAll, but returns a single page of
 * results instead of all results, as well as the pagination information
 *
 * See methods below for details.
 */
export default (bookshelf) => {
  /**
   * @method Model#fetchCursorPage
   * @belongsTo Model
   *
   * Similar to {@link Model#fetchAll}, but fetches a single page of results
   * as specified by the limit (page size) and cursor (before or after).
   *
   * Any options that may be passed to {@link Model#fetchAll} may also be passed
   * in the options to this method.
   *
   * To perform pagination, you may include *either* an `after` or `before`
   * cursor.
   *
   * By default, with no parameters or missing parameters, `fetchCursorPage` will use an
   * options object of `{limit: 1}`
   *
   * Below is an example showing the user of a JOIN query with sort/ordering,
   * pagination, and related models.
   *
   * @example
   *
   * Car
   * .query(function (qb) {
   *    qb.innerJoin('manufacturers', 'cars.manufacturer_id', 'manufacturers.id')
   *    qb.groupBy('cars.id')
   *    qb.where('manufacturers.country', '=', 'Sweden')
   * })
   * .orderBy('-productionYear') // Same as .orderBy('cars.productionYear', 'DESC')
   * .fetchCursorPage({
   *    limit: 15, // Defaults to 10 if not specified
   *    after: 3,
   *
   *    withRelated: ['engine'] // Passed to Model#fetchAll
   * })
   * .then(function (results) {
   *    console.log(results) // Paginated results object with metadata example below
   * })
   *
   * // Pagination results:
   *
   * {
   *    models: [<Car>], // Regular bookshelf Collection
   *    // other standard Collection attributes
   *    ...
   *    pagination: {
   *        rowCount: 53, // Total number of rows found for the query before pagination
   *        limit: 15, // The requested number of rows per page
   *    }
   * }
   *
   * @param options {object}
   *    The pagination options, plus any additional options that will be passed to
   *    {@link Model#fetchAll}
   * @returns {Promise<Model|null>}
   */
  const fetchCursorPage = ({
    self,
    collection,
    Model,
  }, options = {}) => {
    const { limit, ...fetchOptions } = options

    const origQuery = self.query().clone()

    const cursor = (() => {
      if (options.after) {
        ensureArray(options.after)
        return { type: 'after', columnValues: options.after }
      } else if (options.before) {
        ensureArray(options.before)
        return { type: 'before', columnValues: options.before }
      }
      return null
    })()

    const _limit = ensurePositiveIntWithDefault(limit, DEFAULT_LIMIT)

    const tableName = Model.prototype.tableName
    const idAttribute = Model.prototype.idAttribute ?
      Model.prototype.idAttribute : 'id'

    const paginate = () => {
      // const pageQuery = clone(model.query())
      const pager = collection.clone()

      let extractCursorMetadata
      return pager
        .query(qb => {
          assign(qb, origQuery.clone())
          extractCursorMetadata = applyCursor(qb, cursor, tableName, idAttribute)
          qb.limit(_limit)
        })
        .fetch(fetchOptions)
        .then(coll => ({ coll, ...extractCursorMetadata(coll) }))
    }

    return Promise.all([
      paginate(),
      count(origQuery.clone(), Model, tableName, idAttribute, _limit),
    ])
    .then(([{ coll, cursors, orderedBy }, metadata]) => {
      // const pageCount = Math.ceil(metadata.rowCount / _limit)
      // const pageData = assign(metadata, { pageCount })
      const hasMore = coll.length === limit
      const pageData = assign(metadata, { hasMore })


      const next = () => {
        if (!hasMore) {
          return false
        }
        const newOptions = options.before ? {
          ...options,
          before: cursors.before,
        } : {
          ...options,
          after: cursors.after,
        }
        return fetchCursorPage({ self, collection, Model }, newOptions)
      }

      return assign(coll, {
        next: hasMore ? next : false,
        pagination: {
          ...pageData,
          cursors,
          orderedBy,
        },
      })
    })
  }

  bookshelf.Model.prototype.fetchCursorPage = function modelFetchCursorPage(...args) {
    return fetchCursorPage({
      self: this,
      Model: this.constructor,
      collection: () => this.collection(),
    }, ...args)
  }

  bookshelf.Model.fetchCursorPage = function staticModelFetchCursorPage(...args) {
    return this.forge().fetchCursorPage(...args)
  }

  bookshelf.Collection.prototype.fetchCursorPage = function collectionFetchCursorPage(...args) {
    return fetchCursorPage({
      self: this,
      Model: this.model,
      collection: this,
    }, ...args)
  }
}
