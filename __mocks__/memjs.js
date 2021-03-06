const data = new Map()

module.exports = {
  Client: {
    create() {
      return {
        async get(key) {
          return {
            value: data.get(key)
          }
        },

        async set(key, val) {
          data.set(key, Buffer.from(val))
        }
      }
    }
  },

  clear() {
    data.clear()
  }
}
