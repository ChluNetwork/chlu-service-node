
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const CID = require('cids')
const multihashes = require('multihashes')
const log = require('./logger')
const path = require('path')
const ChluReputationStoreKVIndex = require('./orbitindex')

async function prepareIPFS(directory) {
    log('Creating IPFS with directory', directory)
    const ipfs = await new Promise(function(resolve){
        const ipfs = new IPFS({
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
    log('IPFS ID', (await ipfs.id()).id)
    return ipfs
}

async function prepareOrbitDB(ipfs, directory) {
    log('Creating OrbitDB with directory', directory)
    const orbitDb = new OrbitDB(ipfs, path.join(directory, 'orbit-db'));
    const db = await orbitDb.kvstore('chlu-reputation-experimental-3', {
        write: ['*'],
        Index: ChluReputationStoreKVIndex
    });
    db.events.on('replicated', () => {
        log('OrbitDB replicated from another peer. Oplog size:', db._oplog.length)
    })
    db.events.on('load', () => log('OrbitDB: Load'))
    db.events.on('load.progress', (address, hash, entry, progress, total) => log('OrbitDB Load Progress ' + progress + '/' + total))
    log('OrbitDB address', db.address.toString())
    return { orbitDb, db }
}

async function pin(ipfs, m) {
    if (ipfs.pin && ipfs.pin.add) {
        log('Pinning', m)
        try {
            await ipfs.pin.add(m, { recursive: true })
            log('Pinned', m)
        } catch (error) {
            log(error);
        }
    } else {
        log('Caching', m)
        try {
            //await ipfs.dag.tree(m);
            await ipfs.dag.get(m);
            log('Cached', m)
        } catch (error) {
            log(error);
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

function dagGetResultToObject(result) {
    // This normalizes what you get when the obj was in a protobuf node vs encoded as CBOR
    log('Resolving JS Object from IPFS')
    if (result.value && result.value.data && result.value.data.toString) {
        log('Found PB, extracting string')
        const string = result.value.data.toString()
        try {
            log('Parsing JSON...')
            return JSON.parse(string)
        } catch (error) {
            log('Parsing JSON FAILED. Returning plain string')
            return string
        }
    } else {
        log('Found IPLD Object, returning JS value')
        return result.value
    }
}

module.exports = { prepareIPFS, prepareOrbitDB, pin, isCID, dagGetResultToObject }