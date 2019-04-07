import app from './app'

app.set('hmac secret', process.env.HMAC_SECRET)

app.listen(process.env.PORT || 3000)
