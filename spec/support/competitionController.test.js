const supertest = require("supertest");
const server = require("./backend/server.js");
const request = supertest(server);

afterAll(() => {
    server.close();
});

describe("Competition Creation Testing", () => {
    test("Can create competition", async () => {
        const testData = {
            userid: "123456",
            title: "A Very Real Competition",
            deadline: "2024-06-06",
            prize: 120,
            metrics: { speed: 1, accuracy: 5, size: 3 },
            desc: "A sample Competition",
            cap: 120,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const expected = { success: true, message: "Competition created successfully." };
        const response = await request.post("/competitions/create")
            .send(testData)
            .set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is invalid user", async () => {
        const testData = {
            userid: "1234567",
            title: "Broken Competition",
            deadline: "2024-07-10",
            prize: 150,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Invalid User ID' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is competitor", async () => {
        const testData = {
            userid: "129834",
            title: "Competitor Competition",
            deadline: "2024-07-10",
            prize: 150,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: User is not an organizer.' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is invalid title", async () => {
        const testData = {
            userid: "123456",
            title: "This is a title that is too long and should not be used as a result. Competition. 60 characters to make this fail. Please fail.",
            deadline: "2024-07-10",
            prize: 150,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Title must be within 60 characters. ' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is invalid prize amount", async () => {
        const testData = {
            userid: "123456",
            title: "Expensive Competition",
            deadline: "2024-04-30",
            prize: 200,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Prize must not exceed available credits. ' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is invalid deadline", async () => {
        const testData = {
            userid: "123456",
            title: "Too Close Competition",
            deadline: "2024-03-30",
            prize: 100,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Deadline must be at least 1 month away. ' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is invalid capacity", async () => {
        const testData = {
            userid: "123456",
            title: "Too Big Competition",
            deadline: "2024-05-30",
            prize: 100,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 600,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Player capacity must not exceed 500. ' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if it is missing information", async () => {
        const testData = {
            userid: "123456",
            title: "Invalid Competition",
            deadline: "2024-05-30",
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 200,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/goodcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Bad Request: Missing competition fields in JSON body' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(expected);
    });
    test("Cannot create competition if csv files for training/testing files is formatted wrong", async () => {
        const testData = {
            userid: "123456",
            title: "Broken Competition",
            deadline: "2024-07-10",
            prize: 150,
            metrics: { speed: 4, accuracy: 8, size: 1 },
            desc: "A competition that doesn't work",
            cap: 100,
            inputs_outputs: { inputs: ["id", "images"], outputs: ["name"] },
            filepath: "./spec/support/badcat.zip"
        };
        const testDataJSON = JSON.stringify(testData);
        const expected = { success: false, message: 'Error creating competition: Check competition datasets. ' };
        const response = await request.post("/competitions/create").send(testDataJSON).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
});
describe("Competition Joining Testing", () => {
    test("Can join competition that exists", async () => {
        const testData = {
            userid: "129834",
            compid: "71393633"
        }
        const expected = { success: true, message: "Competition joined successfully." };
        const response = await request.post("/competitions/join").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot join competition that doesn't exist", async () => {
        const testData = {
            userid: "129834",
            compid: "3"
        }
        const expected = { success: false, message: "Error joining competition: Invalid competition." };
        const response = await request.post("/competitions/join").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot join competition if you are an organizer", async () => {
        const testData = {
            userid: "68",
            compid: "71393633"
        }
        const expected = { success: false, message: "Error joining competition: User is not a competitor." };
        const response = await request.post("/competitions/join").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
    test("Cannot join competition if user doesn't exist", async () => {
        const testData = {
            userid: "1111111",
            compid: "71393633"
        }
        const expected = { success: false, message: "Error joining competition: User ID doesn't exist." };
        const response = await request.post("/competitions/join").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(expected);
    });
});
describe("Competition Updating testing", () => {
    test("Successfully updates a competition", async () => {
        const testData = {
            deadline: "2024-06-13",
            prize: 130,
            userid: "123456"
        
        }
        const expected = { success: true};
        const response = await request.post("/competitions/update").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain(expected);
    });
    test("Deadline has to be further away", async () => {
        const testData = {
            deadline: "2024-06-13",
            newDeadline: "2024-06-12"
        
        }
        const expected = { success: false};
        const response = await request.post("/competitions/update").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain(expected);
    });
    test("Prize has to be  has to be more than the original, but less than the amount in the organizer's account", async () => {
            const testData = {
                id: '123456',
                deadline: '2024-06-13',
                currentPrize: 120,
                newPrize: 100
            }
        const expected = { success: false};
        const response = await request.post("/competitions/update").send(testData).set("Content-Type", "application/json");
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain(expected);
    });
    test("Everything is able to be changed successfully", async () => {
        const testData = {
            id: '123456',
            deadline: "2024-06-13",
            newDeadline: "2024-06-24",
            currentPrize: 120,
            newPrize: 150
        }
    const expected = { success: false};
    const response = await request.post("/competitions/update").send(testData).set("Content-Type", "application/json");
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(expected);
});
});
