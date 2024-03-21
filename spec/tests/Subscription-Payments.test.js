const request = require('supertest');
const server = require('../../backend/server');

function test_suite() {
    test('GET Test Endpoint / with 200, json', async () => {
        let return_obj = { success: true, message: "Hi \ud83d\ude00" }
        const response = await request(server).get('/').send();
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.message).toBeDefined()
        expect(response.body).toStrictEqual(return_obj)
    });
    test('POST / with 405, json', async () => {
        let send_obj = {
            "credits_purchased": 100,
            "user_id": 3,
            "currency": "usd"
        }
        let return_obj = { success: false, message: 'Method Not Allowed' }
        const response = await request(server).post('/').send(send_obj);
        expect(response.statusCode).toBe(405);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body).toStrictEqual(return_obj)
    });
    // let client_key;
    // test('POST /stripe_auth with 200, json', async () => {
    //     let send_obj = {
    //         test: "value"
    //     }
    //     let return_obj = { success: false, message: 'Method Not Allowed' }
    //     const response = await request(server).post('/stripe_auth').send(send_obj);
    //     expect(response.statusCode).toBe(405);
    //     expect(response.headers['content-type']).toBe('application/json');
    //     expect(response.body.success).toBeDefined()
    //     expect(response.body.success).toBe(true)
    //     expect(response.body.message).toBeDefined()
    // });
}

describe('NodeJS Endpoints', () => {
    test_suite()

});