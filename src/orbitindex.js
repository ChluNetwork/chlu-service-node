const EventEmitter = require('events');

class ChluReputationKVStoreIndex {
    constructor() {
      this._index = {}
      this.events = new EventEmitter()
    }
    
    get(key) {
      return this._index[key]
    }
    
    updateIndex(oplog) {
      oplog.values
        .slice()
        .reverse()
        .reduce((handled, item) => {
            if(!handled.includes(item.payload.key)) {
                    handled.push(item.payload.key)
                    if(item.payload.op === 'PUT') {
                        const oldValue = this._index[item.payload.key]
                        this._index[item.payload.key] = item.payload.value
                        if (this.isKeyNew(item.payload.key)) {
                            this.events.emit('new', item.payload.key)
                        } else {
                            this.events.emit('changed', item.payload.key, oldValue)
                        }
                    } else if(item.payload.op === 'DEL') {
                        const value = this._index[item.payload.key]
                        delete this._index[item.payload.key]
                        this.events.emit('deleted', item.payload.key, value)
                    }
            }
            return handled
        }, [])
    }

    isKeyNew(key) {
        return !Boolean(this._index[key])
    }
}

module.exports = ChluReputationKVStoreIndex