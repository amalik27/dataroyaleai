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
    test('POST /stripe_auth with 200, json', async () => {
        let send_obj = {
            "credits_purchased": 100,
            "user_id": 3,
            "currency": "usd"
        }
        const response = await request(server).post('/stripe_auth').send(send_obj);
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.success).toBeDefined()
        expect(response.body.success).toBe(true)
        expect(response.body.message).toBeDefined() // returns a random ID, impossible to check
    });
    test('POST /stripe_auth with 400, Invalid json', async () => {
        let send_obj = {
            "credits_purchased": 100,
            // "user_id": 3, // MISSING USER ID
            "currency": "usd"
        }
        let return_obj = {
            "success": false,
            "message": "Incomplete JSON"
        }
        const response = await request(server).post('/stripe_auth').send(send_obj);
        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.message).toBeDefined()
        expect(response.body).toStrictEqual(return_obj)
    });
    test('GET /payment endpoint with 200, json', async () => {
        let send_obj = {
            "client_id": "pi_3Ovk6tKs4KNfqfgs0mupFzBi"
        }
        let return_obj = {
            "success": true,
            "message": "Payment succeeded!"
        }
        const response = await request(server).get('/payment').send(send_obj);
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.message).toBeDefined()
        expect(response.body).toStrictEqual(return_obj)
    });
    test('GET /payment endpoint with 500 (unknown Stripe ID)', async () => {
        let send_obj = {
            "client_id": "blahblah"
        }
        let return_obj = {
            "success": false,
            "message": "Server error with checking status"
        }
        const response = await request(server).get('/payment').send(send_obj);
        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.message).toBeDefined()
        expect(response.body).toStrictEqual(return_obj)
    });
    test('POST /payment with 500, already submitted ID (once per payment session)', async () => {
        let send_obj = {
            "client_id": "pi_3Ovk6tKs4KNfqfgs0mupFzBi",
            "payment_method": "pm_card_visa"
        }
        let return_obj = {
            "success": false,
            "message": "Error with submitting purchase"
        }
        const response = await request(server).post('/payment').send(send_obj);
        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json');
        expect(response.body.message).toBeDefined()
        expect(response.body).toStrictEqual(return_obj)
    });
}

describe('NodeJS Endpoints', () => {
    test_suite()

});