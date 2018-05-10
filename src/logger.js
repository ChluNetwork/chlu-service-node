
module.exports = function() {
    const time = (new Date()).toString()
    if (arguments.length === 1 && arguments[0].message) {
        console.error('Error logged at', time)
        console.error(arguments[0])
    }
    console.log('[' + time + ']', ...arguments)
}