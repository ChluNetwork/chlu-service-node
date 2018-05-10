const path = require('path')
const main = require('./src')

let directory = path.join(process.env.HOME, '.chlu-reputation')

main(directory)