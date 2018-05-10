const expect = require('chai').expect
const sinon = require('sinon')
const request = require('supertest')
const getWebServer = require('../src/http')

describe('HTTP Server', () => {

    it('POST /reputation', async () => {
        const serviceNode = {
            saveDidAndReputation: sinon.stub().resolves()
        }
        const server = request(getWebServer(serviceNode))
        const req = {
            didDocument: {
                id: 'did:chlu:fake'
            },
            reviews: [
                {
                    text: 'it was just a test'
                }
            ]
        }
        await server
            .post('/reputation')
            .send(req)
            .expect(200)
        expect(serviceNode.saveDidAndReputation.args[0][0]).to.deep.equal(req.didDocument)
        expect(serviceNode.saveDidAndReputation.args[0][1]).to.deep.equal(req.reviews)
    })

})