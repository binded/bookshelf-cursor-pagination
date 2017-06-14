import { createdb, dropdb } from 'pgtools'
import initKnex from 'knex'
import initBookshelf from 'bookshelf'

import fetchCursorPagePlugin from '../src'

const createKnex = (database) => initKnex({
  connection: {
    database,
    host: process.env.DATABASE_HOST || 'localhost',
  },
  client: 'pg',
  debug: !!process.env.DEBUG_SQL,
})

export default async (testName) => {
  const database = `cursor_pagination_test_${testName}`
  const config = {
    host: process.env.DATABASE_HOST || 'localhost',
  }
  try {
    await dropdb(config, database)
  } catch (err) {
    if (err.pgErr && err.pgErr.code === '3D000') {
      // ignore 'database does not exist error'
    } else {
      throw err
    }
  }
  await createdb(config, database)

  const knex = createKnex(database)
  const bookshelf = initBookshelf(knex)
  bookshelf.plugin('pagination')
  bookshelf.plugin(fetchCursorPagePlugin)
  return { knex, bookshelf }
}

