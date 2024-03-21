//Author: Neha Murthy
const mockDb = {
    query: jasmine.createSpy()
};
const userController  = require('../../backend/controllers/userController.js');
userController.db = mockDb;

const passwordUtils = require('../../backend/utils/passwordUtils.js'); 



describe('registerUser function', () => {
    let mockZxcvbn;
    let mockPasswordUtils;
    let mockDb;


    beforeEach(() => {
        mockZxcvbn = jasmine.createSpy().and.returnValue({ score: 3 }); 
        mockPasswordUtils = jasmine.createSpyObj('passwordUtils', ['encrypt']); // Mock password utils
        mockDb = jasmine.createSpyObj('db', ['query']); // Mock database
    });

//Test Case 1: Should throw "Weak Password" error if the password is not strong
it('should not register a new user with weak password', async () => {
        const username = 'testuser';
        const email = 'test@example.com';
        const password = 'weak'; // Weak password
        const role = 'user';

        await expectAsync(userController.registerUser(username, email, password, role)).toBeRejectedWithError('Weak password'); 
    });

    

//Test Case 2 : Show throw error if email is invalid  
 it('should throw an error if email is not valid', async () => {
        const username = 'testuser';
        const email = 'invalidemail'; // Invalid email address
        const password = 'StrongPassword123';
        const role = 'user';

        spyOn(userController, 'isValidEmail').and.returnValue(false);

        await expectAsync(userController.registerUser(username, email, password, role)).toBeRejectedWithError('Invalid email address');
    });

   
});

// Test Case 3 : Checks if creating a new user is done successfully 
describe('createUser', () => {
    it('should create a new user successfully', async () => {
        const newUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'strongpassword',
            role: 'user'
        };
        const result = await userController.createUser(newUser.username, newUser.email, newUser.password, newUser.role);
        expect(result).toBeUndefined();
    });
});

//Test Case 4 : Read user information through ID number
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

        spyOn(userController, 'readUserById').and.returnValue(mockUser);
        const user = await userController.readUserById(userId);

        expect(user).toBeDefined();
        expect(user.id).toEqual(userId);
        expect(user.username).toEqual('testuser');
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

//Test Case 5 : Read user information through Username
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

        spyOn(userController, 'readUserByUsername').and.returnValue(mockUser);
        const user = await userController.readUserByUsername(username);

        expect(user).toBeDefined();
        expect(user.username).toEqual(username);
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

//Test Case 6 : Read user information through API Token
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

        spyOn(userController, 'readUserByApiToken').and.returnValue(mockUser);

        const user = await userController.readUserByApiToken(apiToken);

        expect(user).toBeDefined();
        expect(user.username).toEqual('testuser');
        expect(user.email).toEqual('test@example.com');
        expect(user.role).toEqual('user');
    });
});

//Test Case 7 : Update user information through ID number
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

        spyOn(userController, 'updateUserById').and.returnValue({ success: true });

        const result = await userController.updateUserById(userId, newUserData);
        expect(result.success).toBeTrue();

       });
});

describe('generateRandomString function', () => {
// Test Case 8 : Should enerate random string
it('should generate a random string of specified length', () => {
        const length = 10;
        const randomString = userController.generateRandomString(length);
        expect(randomString).toBeDefined();
        expect(randomString.length).toEqual(length);
    });
//Test Case 9 : Should be randomized and giving different strings
    it('should generate a different string on each call', () => {
        const length = 10;
        const randomString1 = userController.generateRandomString(length);
        const randomString2 = userController.generateRandomString(length);
        expect(randomString1).not.toEqual(randomString2);
    });
// Test Case 10 : Should generate alphanumeric characters, no special characters
    it('should generate a string containing only alphanumeric characters', () => {
        const length = 10;
        const randomString = userController.generateRandomString(length);
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;
        expect(alphanumericRegex.test(randomString)).toBeTrue();
    });
// Test Case 11 : Should throw error if a length 0 string or less is created
    it('should throw an error when length is less than or equal to 0', () => {
        expect(() => generateRandomString(-1)).toThrowError();
        expect(() => generateRandomString(0)).toThrowError();
    });
});

//Test Case 12 : Read user information through user email
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

        spyOn(userController, 'readUserByEmail').and.returnValue(mockUser);

        const user = await userController.readUserByEmail(email);

        expect(user).toBeDefined();
        expect(user.email).toEqual(email);
        expect(user.username).toEqual('testuser');
        expect(user.role).toEqual('user');
    });
});
 
//Test Case 13 : Checks if user can update their email
describe('updateEmail function', () => {
    let userId;

    beforeEach(() => {
        
        userId = 1;
    });

    it('should update user email by user ID', async () => {
        const newEmail = 'newemail@example.com';

        spyOn(userController, 'updateUserById').and.returnValue({ success: true, message: 'User updated successfully' });

        const result = await userController.updateEmail(userId, newEmail);

        // 
        expect(result).toEqual({ success: true, message: 'The new email given was updated successfully' });
    });
});

 // Test Case 14 : Delete user information through ID number
describe('deleteUserById function', () => {
    let userId;

    beforeEach(() => {
        userId = 1;
    });

    it('should delete user by ID', async () => {
        spyOn(userController, 'deleteUserById').and.returnValue({ success: true, message: 'User deleted successfully' });

        const result = await userController.deleteUserById(userId);
        expect(result.success).toBeTrue();
    });
});

//Tests PasswordUtils.js functions

// Test Case 15 : Tests the functionality of encryptSHA1 function
describe('encryptSHA1 function', () => {
    it('should return the SHA-1 hash of the password', () => {
        const password = 'password123';
        const expectedHash = 'cbfdac6008f9cab4083784cbd1874f76618d2a97'; // This is the SHA-1 hash for "password123"
        const actualHash = passwordUtils.encryptSHA1(password);
        expect(actualHash).toEqual(expectedHash);
    });
});

// Test Case 16 : Tests functionality of encrypt function
describe('encrypt function', () => {
    it('should return the SHA-256 hash of the password concatenated with the salt', () => {
        const password = 'password123';
        const salt = 'randomsalt';
        const expectedHash = '00c12708d816f8066cf1ba57259deb5719992afdeaa6f4149ba66c225d52da1f'; // This is the SHA-256 hash for "password123randomsalt"
        const actualHash = passwordUtils.encrypt(password, salt);
        expect(actualHash).toEqual(expectedHash);
    });
// Test Case 17 : Test functionality to make sure even with same password, different salts will create different hash
    it('should return a different hash for the same password with different salts', () => {
        const password = 'password123'; //same password
        const salt1 = 'randomsalt1'; //different salt 
        const salt2 = 'randomsalt2'; // different salt
        const hash1 = passwordUtils.encrypt(password, salt1);
        const hash2 = passwordUtils.encrypt(password, salt2);
        expect(hash1).not.toEqual(hash2);
    });
// Test Case 18 : Test functionality to make sure even with different password and same salt, different hashes will be created
    it('should return a different hash for different passwords with the same salt', () => {
        const password1 = 'password123';
        const password2 = 'password456';
        const salt = 'randomsalt'; 
        const hash1 = passwordUtils.encrypt(password1, salt);
        const hash2 = passwordUtils.encrypt(password2, salt);
        expect(hash1).not.toEqual(hash2);
    });
});

// Test Case 19 : Test Functionality of deleteAccount function
describe('deleteAccount function', () => {
    it('should delete user account successfully', async () => {
        // Sample User Data to Use 
        const username = 'testuser';
        const password = 'TestPassword123';
    
        spyOn(userController, 'deleteAccount').and.returnValue({ success: true, message: 'Account deleted successfully' });
    
        const deleteResult = await userController.deleteAccount(username, password);
    
        expect(deleteResult.success).toBe(true);
        expect(deleteResult.message).toBe('Account deleted successfully');
    });
});
