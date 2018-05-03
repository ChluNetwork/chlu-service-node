const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const path = require('path')

let ipfs, orbitDb, db, directory = path.join(process.env.HOME, '.chlu-reputation')

async function prepareIPFS() {
  if (!ipfs || !orbitDb || !db) {
    await new Promise(function(resolve){
      ipfs = new IPFS({
        EXPERIMENTAL: {
            pubsub: true
        },
        repo: path.join(directory, 'js-ipfs'),
        config: {
          Addresses: {
            Swarm: [
              // Connect to Chlu rendezvous server
              '/dns4/ren.chlu.io/tcp/443/wss/p2p-websocket-star'
            ]
          }
        }
      });
      ipfs.on('ready', function(){ resolve(ipfs) });
    })
    await ipfs.pubsub.subscribe('chlu-reputation-experimental', function(message){
    console.log('Pubsub Message:', message)
    })
    orbitDb = new OrbitDB(ipfs, path.join(directory, 'orbit-db'));
    db = await orbitDb.kvstore('chlu-reputation-experimental', {
        write: ['*']
    });
  }
}

process.on('SIGINT', async function() {
    try {
        console.log('Stopping gracefully');
        if (orbitDb) {
            await orbitDb.stop();
        }
        if (ipfs) {
            await ipfs.stop();
        }
        console.log('Goodbye!');
        process.exit(0);
    } catch(exception) {
        console.trace(exception);
        process.exit(1);
    }
});

async function pin(m) {
    if (ipfs.pin && ipfs.pin.add) {
        console.log('Pinning', m)
        try {
            await ipfs.pin.add(m, { recursive: true })
            console.log('Pinned', m)
        } catch (error) {
            console.log(error);
        }
    } else {
        console.log('Replicating', m)
        try {
            //await ipfs.dag.tree(m);
            await ipfs.dag.get(m);
            console.log('Replicated', m)
        } catch (error) {
            console.log(error);
        }
    }
}

async function onReplicated() {
    const keys = Object.keys(db._index._index);
    console.log('Have keys', keys)
    for (const k of keys) {
        console.log('Checking key', k)
        await pin(k);
        const v = await db.get(k);
        await pin(v);
    }
}

function main() {
    prepareIPFS()
        .then(function(){
            db.events.on('replicated', onReplicated);
            console.log('Ready')
        })
        .catch(function(error) {
            console.log('Error')
            console.log(error);
            process.exit(1);
        })
}

main()