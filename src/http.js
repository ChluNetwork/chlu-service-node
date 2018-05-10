const express = require('express')
const { isCID } = require('./ipfs')
const log = require('./logger')
const bodyParser = require('body-parser')
const cors = require('cors')

function getWebServer(serviceNode) {
    const app = express()
    app.use(bodyParser.json())
    app.use(cors());
    app.get('/', (req, res) => res.send('Chlu Reputation Service Node').end())
    app.post('/reputation', async (req, res) => {
        // TODO: use bodyparser
        if (req.body.didDocument && req.body.didDocument.id && Array.isArray(req.body.reviews)) {
            try {
                await serviceNode.saveDidAndReputation(req.body.didDocument, req.body.reviews)
                res.status(200).end()
            } catch (error) {
                log(error)
                res.status(500).send(error.message).end()
            }
        } else {
            res.status(400).send('Invalid request')
        }
    })
    return app
}

module.exports = getWebServer