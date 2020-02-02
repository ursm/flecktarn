import app from './app.mjs'

app.set('hmac secret', process.env.HMAC_SECRET)

app.listen(process.env.PORT || 3000)
