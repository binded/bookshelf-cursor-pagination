import { assert } from 'chai'

import setup from './common'

const schemaSql = `
CREATE TABLE movies (
  id bigserial primary key,
  name text,
  description text
);
`
const dataSql = `
INSERT INTO movies(name, description) VALUES
('Moon', 'Some movie about the moon'),
('Terminator', 'Movie about a terminator'),
('The Avengers 2', null),
('The Avengers 1', null),
('A Beautiful Mind', null),
('Forrest Gump', null),
('Some Empty Movie', '')
;
`

const initModels = (bookshelf) => {
  class Movie extends bookshelf.Model { get tableName() { return 'movies' } }
  return { Movie }
}

const setupDb = async () => {
  const { bookshelf, knex } = await setup('nullvals')
  await knex.raw(schemaSql)
  await knex.raw(dataSql)
  const models = initModels(bookshelf)
  return { models, bookshelf, knex }
}

describe('Cursor pagination', () => {
  let Movie
  // let knex
  // let bookshelf

  before(async () => {
    const result = await setupDb()
    Movie = result.models.Movie
    // bookshelf = result.bookshelf
    // knex = result.knex
  })

  it('Model#fetchCursorPage() works with null value cursors', async () => {
    const result = await Movie.collection()
      .orderBy('description')
      .orderBy('name')
      .fetchCursorPage({
        limit: 2,
      })
    assert.equal(result.models.length, 2)
    assert.equal(result.pagination.rowCount, 7)
    assert.equal(result.pagination.limit, 2)
    const { cursors, orderedBy } = result.pagination
    assert.deepEqual(cursors.before, [
      '',
      'Some Empty Movie',
    ])
    assert.deepEqual(cursors.after, [
      'Movie about a terminator',
      'Terminator',
    ])
    // why is this inversed?
    assert.deepEqual(orderedBy, [
      { name: 'description', direction: 'asc', tableName: 'movies' },
      { name: 'name', direction: 'asc', tableName: 'movies' },
    ])
    assert.deepEqual(result.models.map(m => m.get('name')), [
      'Some Empty Movie',
      'Terminator',
    ])
    const { after } = cursors
    const result2 = await Movie.collection()
      .orderBy('description')
      .orderBy('name')
      .fetchCursorPage({
        limit: 2,
        after,
      })
    assert.deepEqual(result2.models.map(m => m.get('name')), [
      'Moon',
      'A Beautiful Mind',
    ])
    const result3 = await Movie.collection()
      .orderBy('description')
      .orderBy('name')
      .fetchCursorPage({
        limit: 2,
        after: result2.pagination.cursors.after,
      })
    assert.deepEqual(result3.models.map(m => m.get('name')), [
      'Forrest Gump',
      'The Avengers 1',
    ])
    const result4 = await Movie.collection()
      .orderBy('description')
      .orderBy('name')
      .fetchCursorPage({
        limit: 2,
        after: result3.pagination.cursors.after,
      })
    assert.deepEqual(result4.models.map(m => m.get('name')), [
      'The Avengers 2',
    ])
  })
})
