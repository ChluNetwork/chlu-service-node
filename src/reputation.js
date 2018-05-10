const { prepareIPFS, prepareOrbitDB, pin, isCID, dagGetResultToObject } = require('./ipfs')
const log = require('./logger')

class ReputationServiceNode {
    constructor(directory) {
        this.directory = directory
        this.ipfs = null
        this.orbitDb = null
        this.db = null
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
            this.db.events.on('replicated', () => {
                log('OrbitDB replicated from another peer. Oplog size:', this.db._oplog.length)
            })
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

    async mapDIDidToIPFSAddress(didAddress) {
        log('Trying to map DID UUID for DID at', didAddress)
        const did = dagGetResultToObject(await this.ipfs.dag.get(didAddress))
        if (did && did.id) {
            const existing = await this.db.get(did.id)
            if (existing) {
                log('DID', did.id, 'already mapped to', existing)
            } else {
                log('Mapping DID', did.id, 'to', didAddress)
                await this.db.set(did.id, didAddress)
            }
        } else {
            log('DID at', didAddress, 'does not look valid')
        }
    }

    async getDIDAddress(didId) {
        let didAddress = null
        if (didId && didId.indexOf('did:chlu:') === 0) {
            log('DID ID is a DID UUID', didId)
            didAddress = await this.db.get(didId)
            log('DID UUID', didId, 'resolved to Address', didAddress)
        } else if (isCID(didId)) {
            log('DID ID is a DID IPFS Address', didId)
            didAddress = didId
        } else {
            throw new Error('Invalid DID ID ' + didId)
        }
        return didAddress
    }

    async getDIDInfo(didId) {
        const address = await this.getDIDAddress(didId)
        const ddoAddress = await this.db.get(address)
        return { address, ddoAddress }
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
            if (isCID(k)) await this.mapDIDidToIPFSAddress(k)
            const didInfo = await this.getDIDInfo(k)
            await Promise.all([
                this.pin(didInfo.address),
                this.pin(didInfo.ddoAddress)
            ])
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