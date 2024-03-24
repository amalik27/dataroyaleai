const db = require('../db');
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const userController = require('./userController');

// Function to create course progress for a user.
async function createCourseProgress(api_token, course_id) {
    try {
        const sql = `INSERT INTO course_progress (user_id, api_token, course_id, progress) VALUES (?, ?, ?, ?)`;
        const progress = 1;
        user = await userController.readUserByApiToken(api_token);
        user_id = user.id;
        await db.query(sql, [user_id, api_token, course_id, progress]);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Function to update course progress for a user.
async function updateCourseProgress(progress, api_token, course_id) {
    try {
        const sql = `UPDATE course_progress SET progress = ? WHERE api_token = ? AND course_id = ?`;
        await db.query(sql, [progress, api_token, course_id]);
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// Function to retrieve IDs of courses that a user can buy or access.
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

// Function to retrieve all courses of a user by API token.
async function readAllCoursesOfUserByApiToken(api_token) {
    try {
        const sql = 'SELECT * FROM course_progress WHERE api_token = ?';
        return new Promise((resolve, reject) => {
            db.query(sql, api_token, function (err, results, fields) {
                if (err) {
                    console.error('Error getting course progress by API token:', err);
                    return reject(err);
                }
                const courseProgressList = results.map(result => {
                    return {
                        user_id: result.user_id,
                        api_token: result.api_token,
                        course_id: result.course_id,
                        progress: result.progress
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

// Function to retrieve the file path for opening a course.
async function openCourse(course_id, courseProgress, api_token) {
    try {
        const sql = 'SELECT * FROM course_progress WHERE api_token = ? AND course_id = ?';
        return new Promise((resolve, reject) => {
            db.query(sql, [api_token, parseInt(course_id)], function (err, results, fields) {
                if (err) {
                    console.error('Error getting course progress by API token and course ID:', err);
                    return reject(err);
                }
                if (!results || results.length === 0) {
                    const error = new Error('No course progress found for the user');
                    console.error(error.message);
                    return reject(error);
                }
                const filePath = '/frontend/public/courses/' + course_id + '/' + courseProgress + '.html';
                resolve(filePath);
            });
        });
    } catch (error) {
        console.error('Error reading courses for the user:', error);
        throw error;
    }
}

// Function to retrieve the default page for a course.
async function getDefaultPage(course_id, api_token) {
    try {
        const sql = 'SELECT * FROM course_progress WHERE api_token = ? AND course_id = ?';
        return new Promise((resolve, reject) => {
            db.query(sql, [api_token, course_id], function (err, results, fields) {
                if (err) {
                    console.error('Error getting course progress by API token and course ID:', err);
                    return reject(err);
                }
                if (!results || results.length === 0) {
                    const error = new Error('No course progress found for the user');
                    console.error(error.message);
                    return reject(error);
                }
                const courseProgress = results[0].progress;
                resolve(courseProgress);
            });
        });
    } catch (error) {
        console.error('Error reading courses for the user:', error);
        throw error;
    }
}

// Function to retrieve metadata of courses.
async function retrieveCourseMetadata() {
    const courseMetadata = [];
    const courseFiles = ['1.html', '1.html', '1.html']; // List of course HTML files WITH METADATA
    let i = 1;
    for (const file of courseFiles) {
        try {
            const filePath = './frontend/public/courses/' + i + '/' + file; // Construct file path
            const htmlText = await fs.readFile(filePath, 'utf-8'); // Read file contents
            // Parse HTML using jsdom
            const dom = new JSDOM(htmlText);
            const document = dom.window.document;
            const courseId = document.querySelector('meta[name="course-id"]').getAttribute('content');
            const courseName = document.querySelector('meta[name="course-name"]').getAttribute('content');
            const courseDescription = document.querySelector('meta[name="course-description"]').getAttribute('content');
            courseMetadata.push({ id: courseId, name: courseName, description: courseDescription });
            i++;
        } catch (error) {
            console.error('Error fetching course file:', error);
        }
    }
    return courseMetadata;
}
// Function to getCourseDetailsByCourseID
async function getCourseDetailsById(course_id) {
    try {
        const courseDetails = await db.query('SELECT * FROM courses WHERE id = ?', [course_id]);
        return courseDetails;
    } catch (error) {
        console.error('Error fetching course details:', error);
        throw error;
    }
}

module.exports = {
    readAllCoursesThatUserCanBuyOrAccessByApiToken,
    readAllCoursesOfUserByApiToken,
    createCourseProgress,
    updateCourseProgress,
    openCourse,
    getDefaultPage,
    getCourseDetailsById
};
