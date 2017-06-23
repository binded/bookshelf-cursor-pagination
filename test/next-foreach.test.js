import { assert } from 'chai'
import promisify from 'es6-promisify'
import fs from 'fs'
import path from 'path'

import setup from './common'

const readFile = promisify(fs.readFile)

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

describe('Cursor pagination', () => {
  let Car
  // let knex
  // let bookshelf

  before(async () => {
    const result = await setup('next')
    await setupDb(result.knex)
    const models = initModels(result.bookshelf)
    Car = models.Car
    // bookshelf = result.bookshelf
    // knex = result.knex
  })

  it('next()', async () => {
    const beautify = coll => coll.models.map(m => m.get('description'))
    let coll
    coll = await Car.collection()
      .orderBy('description')
      .orderBy('-id')
      .fetchCursorPage({ limit: 6 })
    assert.equal(typeof coll.next, 'function')
    assert.deepEqual(beautify(coll), [
      '300',
      '3 Series',
      '911',
      'A6',
      'Challenger',
      'Civic',
    ])
    coll = await coll.next()
    assert.deepEqual(beautify(coll), [
      'Cruze',
      'E-Class',
      'Escalade',
      'Focus',
      'GT-R',
      'Impala',
    ])
    coll = await coll.next()
    assert.deepEqual(beautify(coll), [
      'Impreza',
      'Jetta',
      'Lancer',
      'Miata',
      'Model S',
      'Mustang',
    ])
    coll = await coll.next()
    assert.deepEqual(beautify(coll), [
      'NSX',
      'Prius',
      'Q50',
      'Regal',
      'RX',
      'Swift',
    ])
    coll = await coll.next()
    assert.deepEqual(beautify(coll), [
      'Volvo V40',
      'Wrangler',
      'Yukon',
    ])
    assert.equal(coll.next, false)
  })
  it('forEach()', async () => {
    const beautify = coll => coll.models.map(m => m.get('description'))
    const expectedResults = [
      [
        '300',
        '3 Series',
        '911',
        'A6',
        'Challenger',
        'Civic',
      ],
      [
        'Cruze',
        'E-Class',
        'Escalade',
        'Focus',
        'GT-R',
        'Impala',
      ],
      [
        'Impreza',
        'Jetta',
        'Lancer',
        'Miata',
        'Model S',
        'Mustang',
      ],
      [
        'NSX',
        'Prius',
        'Q50',
        'Regal',
        'RX',
        'Swift',
      ],
      [
        'Volvo V40',
        'Wrangler',
        'Yukon',
      ],
    ]

    let i = 0
    await Car.collection()
      .orderBy('description')
      .orderBy('-id')
      .forEach({ limit: 6 }, coll => {
        assert.deepEqual(beautify(coll), expectedResults[i])
        i += 1
      })
  })
})
