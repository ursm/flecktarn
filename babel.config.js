module.exports = {
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          modules: false,
          exclude: ['transform-regenerator']
        }],
      ],
      plugins: [
        ['@babel/plugin-transform-modules-commonjs', {spec: true}]
      ]
    }
  }
}
