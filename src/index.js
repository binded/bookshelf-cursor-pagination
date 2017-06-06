import { remove, assign } from 'lodash'

const DEFAULT_LIMIT = 10

function ensureIntWithDefault(val, def) {
  if (!val) {
    return def
  }

  const _val = parseInt(val, 10)
  if (Number.isNaN(_val)) {
    return def
  }

  return _val
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
  const fetchCursorPage = (options = {}) => {
    const { limit, ...fetchOptions } = options

    const _limit = ensureIntWithDefault(limit, DEFAULT_LIMIT)

    const tableName = this.constructor.prototype.tableName
    const idAttribute = this.constructor.prototype.idAttribute ?
      this.constructor.prototype.idAttribute : 'id'

    const paginate = () => {
      // const pageQuery = clone(this.query())
      const pager = this.constructor.forge()

      return pager

        .query(qb => {
          assign(qb, this.query().clone())
          qb.limit.apply(qb, [_limit])
          // qb.offset.apply(qb, [_offset])
          return null
        })

      .fetchAll(fetchOptions)
    }

    const count = () => {
      const notNeededQueries = [
        'orderByBasic',
        'orderByRaw',
        'groupByBasic',
        'groupByRaw',
      ]
      const counter = this.constructor.forge()

      return counter.query(qb => {
        assign(qb, this.query().clone())

        // Remove grouping and ordering. Ordering is unnecessary
        // for a count, and grouping returns the entire result set
        // What we want instead is to use `DISTINCT`
        remove(qb._statements, statement => (
          (notNeededQueries.indexOf(statement.type) > -1) ||
            statement.grouping === 'columns'
        ))
        qb.countDistinct.apply(qb, [`${tableName}.${idAttribute}`])
      }).fetchAll().then(result => {
        const metadata = { limit: _limit }

        if (result && result.length === 1) {
          // We shouldn't have to do this, instead it should be
          // result.models[0].get('count')
          // but SQLite uses a really strange key name.
          const modelsCount = result.models[0]
          const keys = Object.keys(modelsCount.attributes)
          if (keys.length === 1) {
            const key = Object.keys(modelsCount.attributes)[0]
            metadata.rowCount = parseInt(modelsCount.attributes[key], 10)
          }
        }

        return metadata
      })
    }

    return Promise.join(paginate(), count())
      .then(([rows, metadata]) => {
        const pageCount = Math.ceil(metadata.rowCount / _limit)
        const pageData = assign(metadata, { pageCount })
        return assign(rows, { pagination: pageData })
      })
  }

  bookshelf.Model.prototype.fetchCursorPage = fetchCursorPage

  bookshelf.Model.fetchCursorPage = function modelFetchCursorPage(...args) {
    return this.forge().fetchCursorPage(...args)
  }

  bookshelf.Collection.prototype.fetchCursorPage = function collectionFetchCursorPage(...args) {
    return fetchCursorPage.apply(this.model.forge(), ...args)
  }
}
