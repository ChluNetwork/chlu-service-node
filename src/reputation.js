const { prepareIPFS, prepareOrbitDB, pin, isCID, dagGetResultToObject } = require('./ipfs')
const log = require('./logger')

class ReputationServiceNode {
    constructor(directory) {
        this.directory = directory
        this.ipfs = null
        this.orbitDb = null
        this.db = null
        this.httpServer = null
    }

    async start() {
        if (!this.ipfs) {
            this.ipfs = await prepareIPFS(this.directory)
        }
        if (!this.db) {
            const distributedServices = await prepareOrbitDB(this.ipfs, this.directory)
            this.orbitDb = distributedServices.orbitDb
            this.db = distributedServices.db
            const self = this
            await this.db.load()
            this.db._index.events.on('new', k => self.checkDBKey(k))
            this.db._index.events.on('changed', k => self.checkDBKey(k))
            log('Waiting for new content')
        }
    }

    async stop() {
        log('Stopping Service Node')
        if (this.orbitDb) await this.orbitDb.stop()
        if (this.ipfs) await this.ipfs.stop()
        log('Stopped Service Node')
    }
    
    async pin(cid) {
        return pin(this.ipfs, cid)
    }

    async refresh() {
        try {
            const keys = Object.keys(this.db._index._index);
            const total = keys.length
            log('Checking', total, 'keys')
            for (const i in keys) {
                const k = keys[i]
                const ii = parseInt(i) + 1
                log('Checking key ' + ii + '/' + total, k)
                const wentOk = await this.checkDBKey(k)
                if (wentOk) log('Checked key ' + ii + '/' + total, k)
                else log('Key ' + ii + '/' + total, k, 'caused an error')
            }
        } catch (error) {
            log(error)
        }
    }

    async checkDBKey(k) {
        try {
            log('Checking key', k)
            if (typeof k === 'string' && k.indexOf('did:chlu:') === 0) {
                log('Key ' + k + ' is a DID ID')
                const cid = await this.db.get(k)
                if (isCID(cid)) {
                    log('Key ' + k + ' Value ' + cid + ' is an IPFS CID')
                    await this.pin(cid)
                    log('Key ' + k + ' Value ' + cid + ' has been pinned')
                }
            }
            log('Checked key successfully', k)
            return true
        } catch (error) {
            log('Key', k, 'caused an error')
            log(error)
            return false
        }
    }
}

module.exports = ReputationServiceNode