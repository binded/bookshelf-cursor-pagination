import initKnex from 'knex'
import initBookshelf from 'bookshelf'
import { assert } from 'chai'
import promisify from 'es6-promisify'
import fs from 'fs'
import path from 'path'
import { createdb, dropdb } from 'pgtools'

import fetchCursorPagePlugin from '../src'

const readFile = promisify(fs.readFile)

const recreateDatabase = async () => {
  const config = {
    host: process.env.DATABASE_HOST || 'localhost',
  }
  try {
    await dropdb(config, 'cursor_pagination_test')
  } catch (err) {
    if (err.pgErr && err.pgErr.code === '3D000') {
      // ignore 'database does not exist error'
    } else {
      throw err
    }
  }
  await createdb(config, 'cursor_pagination_test')
}

const createKnex = () => initKnex({
  connection: {
    database: 'cursor_pagination_test',
    host: process.env.DATABASE_HOST || 'localhost',
  },
  client: 'pg',
  debug: !!process.env.DEBUG_SQL,
})

const initModels = (bookshelf) => {
  class Car extends bookshelf.Model {
    get tableName() { return 'cars' }
  }

  return { Car }
}

const setupDb = async (knex) => {
  const [
    schemaSql,
    dataSql,
  ] = await Promise.all([
    path.join(__dirname, 'fixtures/schema.sql'),
    path.join(__dirname, 'fixtures/data.sql'),
  ].map((filePath) => readFile(filePath, 'utf8')))
  await knex.raw(schemaSql)
  await knex.raw(dataSql)
}

const setup = async () => {
  await recreateDatabase()
  const knex = createKnex()
  const bookshelf = initBookshelf(knex)
  bookshelf.plugin('pagination')
  bookshelf.plugin(fetchCursorPagePlugin)
  const models = initModels(bookshelf)
  await setupDb(knex)
  return { models, bookshelf, knex }
}

describe('Cursor pagination', () => {
  let models
  let Car
  // let knex
  let bookshelf

  before(async () => {
    const result = await setup()
    models = result.models
    Car = models.Car
    bookshelf = result.bookshelf
    // knex = result.knex
  })

  it('should have fetchCursorPage function', () => {
    assert.equal(typeof bookshelf.Model.prototype.fetchCursorPage, 'function')
  })

  it('Model#fetchCursorPage() with no opts', async () => {
    const result = await Car.collection().fetchCursorPage()
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 10)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['1'])
    assert.deepEqual(cursors.after, ['10'])
    assert.deepEqual(orderedBy, [
      { name: 'id', direction: 'asc' },
    ])
  })

  it('Model#fetchCursorPage() with where clause', async () => {
    const result = await Car.collection()
      .query(qb => {
        qb.where('engine_id', '=', 3)
      })
      .fetchCursorPage()
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 25)
    assert.equal(result.pagination.limit, 10)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['1'])
    assert.deepEqual(cursors.after, ['10'])
    assert.deepEqual(orderedBy, [
      { name: 'id', direction: 'asc' },
    ])
  })

  it.only('Model#fetchCursorPage() with where clause and before', async () => {
    const result = await Car.collection()
      .query(qb => {
        qb.where('engine_id', '=', 3)
      })
      .fetchCursorPage({ after: ['25'] })
    assert.equal(result.models.length, 0)
    assert.equal(result.pagination.rowCount, 25)
    assert.equal(result.pagination.limit, 10)
  })

  it('Model#fetchCursorPage() with limit', async () => {
    const result = await Car.collection().fetchCursorPage({
      limit: 5,
    })
    assert.equal(result.models.length, 5)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 5)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['1'])
    assert.deepEqual(cursors.after, ['5'])
    assert.deepEqual(orderedBy, [
      { name: 'id', direction: 'asc' },
    ])
  })

  it('Model#fetchCursorPage() with orderBy and after', async () => {
    const result = await Car.collection()
      .orderBy('manufacturer_id')
      .orderBy('description')
      .fetchCursorPage({
        after: ['8', 'Cruze'],
      })
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 10)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['8', 'Impala'])
    assert.deepEqual(cursors.after, ['17', 'Impreza'])
    assert.deepEqual(orderedBy, [
      { name: 'manufacturer_id', direction: 'asc' },
      { name: 'description', direction: 'asc' },
    ])
  })

  it('Model#fetchCursorPage() with after', async () => {
    const result = await Car.collection().fetchCursorPage({
      after: ['5'],
    })
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 10)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(result.models.map(m => m.get('id')), [
      '6', '7', '8', '9', '10', '11', '12', '13', '14', '15',
    ])
    assert.deepEqual(cursors.before, ['6'])
    assert.deepEqual(cursors.after, ['15'])
    assert.deepEqual(orderedBy, [
      { name: 'id', direction: 'asc' },
    ])
  })

  it('Model#fetchCursorPage() with before', async () => {
    const result = await Car.collection().fetchCursorPage({
      before: ['12'],
    })
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 10)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(result.models.map(m => m.get('id')), [
      '11', '10', '9', '8', '7', '6', '5', '4', '3', '2',
    ])
    assert.deepEqual(cursors.before, ['2'])
    assert.deepEqual(cursors.after, ['11'])
    assert.deepEqual(orderedBy, [
      { name: 'id', direction: 'asc' },
    ])
  })

  /**
   * select "cars".* from "cars" where ("manufacturer_id" > ?) or
   * ("manufacturer_id" = ? and "description" < ?) order by
   * "cars"."manufacturer_id" ASC, "cars"."description" DESC limit ?
   */
  it('Model#fetchCursorPage() with DESC orderBy and after', async () => {
    const result = await Car.collection()
      .orderBy('manufacturer_id')
      .orderBy('-description')
      .fetchCursorPage({
        limit: 2,
        after: ['8', 'Impala'],
      })
    assert.equal(result.models.length, 2)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 2)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['8', 'Cruze'])
    assert.deepEqual(cursors.after, ['9', 'Escalade'])
    assert.deepEqual(orderedBy, [
      { name: 'manufacturer_id', direction: 'asc' },
      { name: 'description', direction: 'desc' },
    ])
  })

  /**
   * select "cars".* from "cars" where ("manufacturer_id" < ?) or
   * ("manufacturer_id" = ? and "description" > ?) order by
   * "cars"."manufacturer_id" ASC, "cars"."description" DESC limit ?
   */
  it('Model#fetchCursorPage() with orderBy and before', async () => {
    const result = await Car.collection()
      .orderBy('manufacturer_id')
      .orderBy('-description')
      .fetchCursorPage({
        limit: 2,
        before: ['8', 'Impala'],
      })
    assert.equal(result.models.length, 2)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 2)
    const { cursors, orderedBy } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['6', 'Yukon'])
    assert.deepEqual(cursors.after, ['7', '300'])
    assert.deepEqual(orderedBy, [
      { name: 'manufacturer_id', direction: 'asc' },
      { name: 'description', direction: 'desc' },
    ])
  })

  it('Model#fetchCursorPage() iterate over all rows', async () => {
    let i = 0
    let iterCount = 0
    const iter = async (after) => {
      const coll = await Car.collection()
        .orderBy('manufacturer_id')
        .orderBy('description')
        .fetchCursorPage({ after, limit: 5 })
      i += coll.length
      iterCount += 1
      if (coll.pagination.hasMore) {
        return iter(coll.pagination.cursors.after)
      }
      return coll
    }
    const backIter = async (before) => {
      const coll = await Car.collection()
        .orderBy('manufacturer_id')
        .orderBy('description')
        .fetchCursorPage({ before, limit: 5 })
      i += coll.length
      iterCount += 1
      if (coll.pagination.hasMore) {
        return backIter(coll.pagination.cursors.before)
      }
      return coll
    }

    const lastColl = await iter()
    assert.equal(i, 27)
    assert.equal(iterCount, 6)
    i = 0
    iterCount = 0
    await backIter(lastColl.pagination.cursors.before)
    assert.equal(i, 27 - lastColl.length /* 25 */)
    // TODO: last iteration returns empty result.. maybe
    // we should overfetch by limit + 1 and only set hasMore if
    // the result set has limit + 1 elements? the last element would
    // be truncated from the response
    assert.equal(iterCount, 6)
  })
})
