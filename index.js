const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const path = require('path')
const CID = require('cids')
const multihashes = require('multihashes')

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
    orbitDb = new OrbitDB(ipfs, path.join(directory, 'orbit-db'));
    db = await orbitDb.kvstore('chlu-reputation-experimental', {
        write: ['*']
    });
    await db.load()
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
        console.log('Caching', m)
        try {
            //await ipfs.dag.tree(m);
            await ipfs.dag.get(m);
            console.log('Cached', m)
        } catch (error) {
            console.log(error);
        }
    }
}

function isCID(cid) {
    if (CID.isCID(cid)) return true
    try {
        multihashes.fromB58String(cid);
        return true;
    } catch (error) {
        return false;
    }
}

async function mapDIDidToIPFSAddress(didAddress) {
    console.log('Trying to map DID UUID for DID at', didAddress)
    const result = await ipfs.dag.get(didAddress)
    let did
    if (result.value && result.value.data && result.value.data.toString) {
        const string = result.value.data.toString()
        try {
            did = JSON.parse(string)
        } catch (error) {
            did = null
        }
    } else {
        did = result.value
    }
    if (did && did.id) {
        const existing = await db.get(did.id)
        if (existing) {
            console.log('DID', did.id, 'already mapped to', existing)
        } else {
            console.log('Mapping DID', did.id, 'to', didAddress)
            await db.set(did.id, didAddress)
        }
    } else {
        console.log('DID at', didAddress, 'does not look valid')
    }
}

async function onReplicated() {
    return refresh()
}

async function refresh() {
    const keys = Object.keys(db._index._index);
    console.log('Have keys', keys)
    for (const k of keys) {
        console.log('Checking key', k)
        if (isCID(k)) await pin(k);
        const v = await db.get(k);
        if (isCID(v)) await pin(v);
        if (isCID(k)) await mapDIDidToIPFSAddress(k)
    }
}

function main() {
    prepareIPFS()
        .then(() => refresh())
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