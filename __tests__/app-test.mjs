import fetch from 'node-fetch'
import memjs from 'memjs'
import querystring from 'querystring'
import request from 'supertest'

import app from '../app.mjs'
import { createSignature } from '../util.mjs'

const {Response} = jest.requireActual('node-fetch')

jest.mock('memjs')
jest.mock('node-fetch')

app.set('hmac secret', 'SECRET')

describe('GET /:signature/:url', () => {
  async function get(path, opts = {}) {
    let req = request(app).get(path)

    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        req = req.set(k, v)
      }
    }

    return await req
  }

  const source    = 'http://example.com/foo.png'
  const signature = createSignature(source, 'SECRET')
  const path      = `/${signature}/${querystring.escape(source)}`

  beforeEach(() => {
    fetch.mockClear()
    memjs.clear()
  })

  test('simple', async () => {
    fetch.mockResolvedValue(new Response('BODY'))

    const res = await get(path)
    expect(res.statusCode).toBe(200)
    expect(res.text).toBe('BODY')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(source)
  })

  test('cache', async () => {
    fetch.mockResolvedValue(new Response('BODY'))

    const first = await get(path)
    expect(first.statusCode).toBe(200)

    const second = await get(path)
    expect(second.statusCode).toBe(200)
    expect(second.text).toBe('BODY')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('fresh', async () => {
    fetch.mockResolvedValue(
      new Response('BODY', {
        headers: {
          'Last-Modified': 'Sun, 01 Apr 2019 00:00:00 GMT',
          'ETag':          'ETAG'
        }
      })
    )

    const first = await get(path)
    expect(first.statusCode).toBe(200)

    const second = await get(path, {headers: {'If-Modified-Since': 'Sun, 01 Apr 2019 00:00:00 GMT'}})
    expect(second.statusCode).toBe(304)

    const third = await get(path, {headers: {'If-None-Match': 'ETAG'}})
    expect(third.statusCode).toBe(304)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('signature is invalid', async () => {
    const res = await get(`/INVALID/${querystring.escape(source)}`)

    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
