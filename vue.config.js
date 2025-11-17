const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')

module.exports = {
  devServer: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    port: 8083,
    open: true
  },
  transpileDependencies: ['@ffmpeg/util'],
  configureWebpack: {
    resolve: {
      mainFields: ['browser', 'module', 'main']
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'node_modules/@ffmpeg/core/dist/umd'),
            to: 'ffmpeg'
          }
          ,
          {
            from: path.resolve(__dirname, 'node_modules/@ffmpeg/ffmpeg/dist/umd'),
            to: 'ffmpeg-lib'
          }
        ]
      })
    ]
  }
}