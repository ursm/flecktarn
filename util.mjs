import base64url from 'base64url'
import crypto from 'crypto'

export function createSignature(url, secret) {
  return base64url.encode(crypto.createHmac('sha224', secret).update(url).digest())
}

export function createCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('base64')
}
