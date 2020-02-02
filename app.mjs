import crypto from 'crypto'
import express from 'express'
import fetch from 'node-fetch'
import logger from 'morgan'
import memjs from 'memjs'

import { createSignature } from './util.mjs'

const _status = logger.status

logger.token('status', (req, res) => {
  const status = _status(req, res)
  const cache  = res.get('x-cache')

  return cache ? `${status} ${cache}` : status
})

const app   = express()
const cache = memjs.Client.create()

app.use(logger('dev', {
  skip() {
    return process.env.NODE_ENV === 'test'
  }
}))

app.get('/:signature/:url', async (req, res) => {
  const {url, signature} = req.params

  if (createSignature(url, app.get('hmac secret')) !== signature) {
    res.sendStatus(400)
    return
  }

  const key     = crypto.createHash('md5').update(url).digest('base64')
  const headers = await getJSONFromCache(cache, `${key}:headers`)

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      res.set(k, v)
    }

    if (req.fresh) {
      res.set('X-Cache', 'hit').sendStatus(304)
      return
    }

    const {value: body} = await cache.get(`${key}:body`)

    if (body) {
      res.status(200).set('X-Cache', 'hit').set(headers).send(body)
      return
    }
  }

  const r = await fetch(url)

  if (!r.ok) {
    console.error(r)
    res.sendStatus(r.status)
    return
  }

  const newHeaders = ['Content-Type', 'Last-Modified', 'ETag'].reduce((acc, key) => (
    r.headers.has(key) ? {...acc, [key]: r.headers.get(key)} : acc
  ), {})

  const [body1, body2] = await Promise.all([
    r.clone().buffer(),
    r.buffer()
  ])

  await Promise.all([
    cache.set(`${key}:headers`, JSON.stringify(newHeaders), {}),
    cache.set(`${key}:body`, body1, {})
  ])

  res.status(r.status).set('X-Cache', 'miss').set(newHeaders).send(body2)
})

export default app

async function getJSONFromCache(cache, key) {
  const {value: buf} = await cache.get(key)

  return buf ? JSON.parse(buf.toString()) : null
}
