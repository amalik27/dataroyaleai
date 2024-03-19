const mockDb = {
    query: jasmine.createSpy()
};
const record  = require('../../backend/controllers/userController.js');
record.db = mockDb;


describe('registerUser function', () => {
    let mockZxcvbn;
    let mockPasswordUtils;
    let mockDb;


    beforeEach(() => {
        mockZxcvbn = jasmine.createSpy().and.returnValue({ score: 3 }); 
        mockPasswordUtils = jasmine.createSpyObj('passwordUtils', ['encrypt']); // Mock password utils
        mockDb = jasmine.createSpyObj('db', ['query']); // Mock database
    });

    //checks for weak password - returns Error
    it('should not register a new user with weak password', async () => {
        const username = 'testuser';
        const email = 'test@example.com';
        const password = 'weak'; // Weak password
        const role = 'user';

        await expectAsync(record.registerUser(username, email, password, role)).toBeRejectedWithError('Weak password'); 
    });
    //checks for invalid email - returns Invalid
    it('should throw an error if email is not valid', async () => {
        const username = 'testuser';
        const email = 'invalidemail'; // Invalid email address
        const password = 'StrongPassword123';
        const role = 'user';

        spyOn(record, 'isValidEmail').and.returnValue(false);

        await expectAsync(record.registerUser(username, email, password, role)).toBeRejectedWithError('Invalid email address');
    });
});

describe('createUser', () => {
    it('should create a new user successfully', async () => {
        const newUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'strongpassword',
            role: 'user'
        };
        const result = await record.createUser(newUser.username, newUser.email, newUser.password, newUser.role);
        expect(result).toBeUndefined();
    });
});

describe('readUserById function', () => {
    let userId;

    beforeEach(async () => {
        userId = 1;
    });

    it('should return user by ID', async () => {
    //Mock Database
        const mockUser = {
            id: userId,
            username: 'testuser',
            email: 'test@example.com',
            role: 'user'
        };

        spyOn(record, 'readUserById').and.returnValue(mockUser);
        const user = await record.readUserById(userId);

        expect(user).toBeDefined();
        expect(user.id).toEqual(userId);
        expect(user.username).toEqual('testuser');
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

describe('readUserByUsername function', () => {
    let username;

    beforeEach(() => {    
        username = 'testuser';
    });

    it('should return user by username', async () => {
        // Mocking database
        const mockUser = {
            id: 1,
            username: username,
            email: 'test@example.com',
            role: 'user'
        };

        spyOn(record, 'readUserByUsername').and.returnValue(mockUser);
        const user = await record.readUserByUsername(username);

        expect(user).toBeDefined();
        expect(user.username).toEqual(username);
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

describe('readUserByApiToken function', () => {
    let apiToken;

    beforeEach(() => {
        
        apiToken = 'sampleApiToken123';
    });

    it('should return user by API token', async () => {
        //Mocking Database
        const mockUser = {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            role: 'user'
        };

        spyOn(record, 'readUserByApiToken').and.returnValue(mockUser);

        const user = await record.readUserByApiToken(apiToken);

        expect(user).toBeDefined();
        expect(user.username).toEqual('testuser');
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

describe('updateUserById function', () => {
    let userId;

    beforeEach(async () => {
        
        userId = 1;
    });

    it('should update user by ID', async () => {
        const newUserData = {
            username: 'updatedUsername',
            email: 'updated@example.com',
            role: 'admin'
        };

        spyOn(record, 'updateUserById').and.returnValue({ success: true });

        const result = await record.updateUserById(userId, newUserData);
        expect(result.success).toBeTrue();

       });
});

describe('generateRandomString function', () => {
    //should generate a random string
    it('should generate a random string of specified length', () => {
        const length = 10;
        const randomString = record.generateRandomString(length);
        expect(randomString).toBeDefined();
        expect(randomString.length).toEqual(length);
    });
//should be randomized and giving different strings
    it('should generate a different string on each call', () => {
        const length = 10;
        const randomString1 = record.generateRandomString(length);
        const randomString2 = record.generateRandomString(length);
        expect(randomString1).not.toEqual(randomString2);
    });

    it('should generate a string containing only alphanumeric characters', () => {
        const length = 10;
        const randomString = record.generateRandomString(length);
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;
        expect(alphanumericRegex.test(randomString)).toBeTrue();
    });
//should throw error if a length 0 string or less is created
    it('should throw an error when length is less than or equal to 0', () => {
        expect(() => generateRandomString(-1)).toThrowError();
        expect(() => generateRandomString(0)).toThrowError();
    });
});

describe('readUserByEmail function', () => {
    let email;

    beforeEach(() => {
        
        email = 'test@example.com';
    });

    it('should return user by email', async () => {
        // Mocking Database
        const mockUser = {
            id: 1,
            username: 'testuser',
            email: email,
            role: 'user'
        };

        spyOn(record, 'readUserByEmail').and.returnValue(mockUser);

        const user = await record.readUserByEmail(email);

        expect(user).toBeDefined();
        expect(user.email).toEqual(email);
        expect(user.username).toEqual('testuser');
        expect(user.role).toEqual('user');
    });
});

describe('updateEmail function', () => {
    let userId;

    beforeEach(() => {
        
        userId = 1;
    });

    it('should update user email by user ID', async () => {
        const newEmail = 'newemail@example.com';

        spyOn(record, 'updateUserById').and.returnValue({ success: true, message: 'User updated successfully' });

        const result = await record.updateEmail(userId, newEmail);

        // 
        expect(result).toEqual({ success: true, message: 'The new email given was updated successfully' });
    });
});

