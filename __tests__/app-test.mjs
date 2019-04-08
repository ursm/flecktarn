import fetch from 'node-fetch'
import memjs from 'memjs'
import querystring from 'querystring'
import request from 'supertest'

import app from '../app'
import { createSignature } from '../util'

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
    expect(res.body.toString()).toBe('BODY')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(source)
  })

  test('cache', async () => {
    fetch.mockResolvedValue(new Response('BODY'))

    const res1 = await get(path)

    expect(res1.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)

    const res2 = await get(path)

    expect(res2.statusCode).toBe(200)
    expect(res2.body.toString()).toBe('BODY')
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

    const res1 = await get(path)

    expect(res1.statusCode).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)

    const res2 = await get(path, {
      headers: {
        'If-Modified-Since': 'Sun, 01 Apr 2019 00:00:00 GMT'
      }
    })

    expect(res2.statusCode).toBe(304)
    expect(fetch).toHaveBeenCalledTimes(1)

    const res3 = await get(path, {
      headers: {
        'If-None-Match': 'ETAG'
      }
    })

    expect(res3.statusCode).toBe(304)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('signature is invalid', async () => {
    const res = await get(`/INVALID/${querystring.escape(source)}`)

    expect(res.statusCode).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
