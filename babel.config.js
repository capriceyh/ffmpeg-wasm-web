module.exports = {
  presets: [
    ['@vue/cli-plugin-babel/preset', { jsx: false }]
  ],
  plugins: [
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-private-methods', { loose: true }]
  ]
}