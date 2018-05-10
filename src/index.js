const ServiceNode = require('./reputation')
const log = require('./logger')

process.on('SIGINT', async function() {
    try {
        log('Stopping gracefully');
        if (serviceNode) {
            await serviceNode.stop();
        }
        log('Goodbye!');
        process.exit(0);
    } catch(exception) {
        console.trace(exception);
        process.exit(1);
    }
});

function main(directory) {
    serviceNode = new ServiceNode(directory)
    return serviceNode.start()
        .catch(function(error) {
            log(error);
            process.exit(1);
        })
}

module.exports = main