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
    const { cursors } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['1'])
    assert.deepEqual(cursors.after, ['10'])
  })

  it('Model#fetchCursorPage() with limit', async () => {
    const result = await Car.collection().fetchCursorPage({
      limit: 5,
    })
    assert.equal(result.models.length, 5)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 5)
    const { cursors } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['1'])
    assert.deepEqual(cursors.after, ['5'])
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
    const { cursors } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['8', 'Impala'])
    assert.deepEqual(cursors.after, ['17', 'Impreza'])
  })

  it('Model#fetchCursorPage() with after', async () => {
    const result = await Car.collection().fetchCursorPage({
      after: ['5'],
    })
    assert.equal(result.models.length, 10)
    assert.equal(result.pagination.rowCount, 27)
    assert.equal(result.pagination.limit, 10)
    const { cursors } = result.pagination
    assert.equal(typeof cursors, 'object')
    assert.deepEqual(cursors.before, ['6'])
    assert.deepEqual(cursors.after, ['15'])
  })
})
