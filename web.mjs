import crypto from 'crypto'
import express from 'express'
import fetch from 'node-fetch'
import memjs from 'memjs'

const app   = express()
const cache = memjs.Client.create()

app.get('/images/:digest/:url', async (req, res) => {
  const {digest, url} = req.params

  if (digest !== hmac(url)) {
    res.sendStatus(400)
    return
  }

  const key     = md5(req.params.url)
  const headers = await getJSONFromCache(cache, `${key}:headers`)

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      res.set(k, v)
    }

    if (req.fresh) {
      res.sendStatus(304)
      return
    }

    const {value: body} = await cache.get(`${key}:body`)

    if (body) {
      res.status(200).set(headers).send(body)
      return
    }
  }

  const r = await fetch(req.params.url)

  if (!r.ok) {
    console.error(r)
    res.sendStatus(r.status)
    return
  }

  const newHeaders = getHeaders(r.headers, 'Content-Type', 'Last-Modified', 'ETag')

  const [body1, body2] = await Promise.all([
    r.clone().buffer(),
    r.buffer()
  ])

  await Promise.all([
    cache.set(`${key}:headers`, JSON.stringify(newHeaders), {}),
    cache.set(`${key}:body`, body1, {})
  ])

  res.status(r.status).set(newHeaders).send(body2)
})

app.listen(process.env.PORT || 3000)

function hmac(url) {
  const hash = crypto.createHmac('sha224', process.env.HMAC_SECRET)
  hash.update(url)
  return hash.digest('hex')
}

function md5(url) {
  const hash = crypto.createHash('md5')
  hash.update(url)
  return hash.digest('hex')
}

async function getJSONFromCache(cache, key) {
  const {value: buf} = await cache.get(key)

  if (!buf) { return null }

  const json = buf.toString()

  if (json.length === 0) { return null }

  return JSON.parse(json)
}

function getHeaders(headers, ...keys) {
  return keys.reduce((acc, key) => (
    headers.has(key) ? {...acc, [key]: headers.get(key)} : acc
  ), {})
}
