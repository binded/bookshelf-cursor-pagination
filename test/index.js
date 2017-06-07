import initKnex from 'knex'
import initBookshelf from 'bookshelf'
import { assert } from 'chai'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { createdb, dropdb } from 'pgtools'

import fetchCursorPagePlugin from '../src'

const readFile = promisify(fs.readFile)

const recreateDatabase = async () => {
  const config = {
    host: process.env.DATABASE_HOST || 'localhost',
  }
  await dropdb(config, 'cursor_pagination_test')
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
  bookshelf.plugin(fetchCursorPagePlugin)
  const models = initModels(bookshelf)
  await setupDb(knex)
  return { models, bookshelf, knex }
}

describe('Cursor pagination', () => {
  let models
  let knex
  let bookshelf

  before(async () => {
    const result = await setup()
    models = result.models
    bookshelf = result.bookshelf
    knex = result.knex
  })

  it('should have fetchCursorPage function', () => {
    assert.equal(typeof bookshelf.Model.prototype.fetchCursorPage, 'function')
  })
})
