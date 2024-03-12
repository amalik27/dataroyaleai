const db = require('../db');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const userController = require('./userController');

async function createCourseProgressByApiToken(api_token, course_id) {
    try {
        const sql = `INSERT INTO course_progress (user_id, api_token, course_id, progress) VALUES (?, ?, ?, ?)`;
        const progress = 0;
        user = await userController.readUserByApiToken(api_token);
        user_id = user.id;
        await db.query(sql, [user_id, api_token, course_id, progress]);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function readAllCoursesThatUserCanBuyOrAccessByApiToken(api_token) {
    try {
        const allCourses = await retrieveCourseMetadata();
        const allCourseIds = allCourses.map(course => parseInt(course.id));
        const userBoughtCourses = await readAllCoursesOfUserByApiToken(api_token);
        const userBoughtCourseIds = userBoughtCourses.map(course => parseInt(course.course_id));
        let notBoughtCourseIds = [];
        for (const courseId of allCourseIds) {
            if (!userBoughtCourseIds.includes(courseId)) {
                notBoughtCourseIds.push(courseId);
            }
        }
        return notBoughtCourseIds;
    } catch (error) {
        console.error('Error reading courses for the user:', error);
        throw error;
    }
}


async function readAllCoursesOfUserByApiToken(api_token) {
    try {
        const sql = 'SELECT * FROM course_progress WHERE api_token = ?';
        return new Promise((resolve, reject) => {
            db.query(sql, api_token, function (err, results, fields) {
                if (err) {
                    console.error('Error getting course progress by API token:', err);
                    return reject(err);
                }
                if (!results || results.length === 0) {
                    const error = new Error('No course progress found for the user');
                    console.error(error.message);
                    return reject(error);
                }
                const courseProgressList = results.map(result => {
                    return {
                        user_id: result.user_id,
                        api_token: result.api_token,
                        course_id: result.course_id,
                        course_progress: result.course_progress
                    };
                });
                resolve(courseProgressList);
            });
        });
    } catch (error) {
        console.error('Error getting course progress by API token:', error);
        throw error;
    }
}

async function retrieveCourseMetadata() {
    const courseMetadata = [];
    const courseFiles = ['test-course1.html', 'test-course2.html', 'test-course3.html']; // List of course HTML files
    for (const file of courseFiles) {
        try {
            const filePath = './frontend/public/courses/' + file; // Construct file path
            const htmlText = await fs.readFile(filePath, 'utf-8'); // Read file contents
            // Parse HTML using jsdom
            const dom = new JSDOM(htmlText);
            const document = dom.window.document;
            const courseId = document.querySelector('meta[name="course-id"]').getAttribute('content');
            const courseName = document.querySelector('meta[name="course-name"]').getAttribute('content');
            const courseDescription = document.querySelector('meta[name="course-description"]').getAttribute('content');
            courseMetadata.push({ id: courseId, name: courseName, description: courseDescription });
        } catch (error) {
            console.error('Error fetching course file:', error);
        }
    }
    return courseMetadata;
}

function filterCourses(userBoughtCourses, allCourses) {
    return allCourses.filter(course => !userBoughtCourses.includes(course.id));
}

module.exports = {
    readAllCoursesThatUserCanBuyOrAccessByApiToken,
    readAllCoursesOfUserByApiToken,
    createCourseProgressByApiToken
};