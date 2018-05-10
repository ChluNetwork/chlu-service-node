const path = require('path')
const cli = require('commander');
const ServiceNode = require('./reputation')
const log = require('./logger')

let serviceNode
const defaultDirectory = path.join(process.env.HOME, '.chlu-reputation')

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

async function start(cmd) {
    serviceNode = new ServiceNode(cmd.directory || defaultDirectory)
    await serviceNode.start()
    if (cmd.refresh) await serviceNode.refresh()
}

cli
    .name('chlu-reputation-service-node')
    .description('needed to ensure correct functioning of the chlu reputation demo. http://chlu.io')

cli
    .command('start')
    .description('run the Service Node')
    // Chlu specific options
    .option('-d, --directory <path>', 'where to store chlu data, defaults to ~/.chlu-reputation')
    .option('-r, --refresh', 'rerun pinning on all data')
    .action(cmd => {
        start(cmd)
            .catch(function(error) {
                log(error);
                process.exit(1);
            })
    });

function main() {
    cli.parse(process.argv);

    if (!process.argv.slice(2).length) {
        cli.help();
    }
}

module.exports = main