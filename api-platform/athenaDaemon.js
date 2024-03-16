const { PrometheusDaemon } = require("./prometheusDaemon");
const csv = require('csv-parser');
const fs = require('fs');

class AthenaDaemon extends PrometheusDaemon {
    constructor() {
        super();
    }

    async evaluateModel(filePath, containerID, bodyMapper, columnNameX, columnNameY) {
        const results = [];
        const readStream = fs.createReadStream(filePath);

        // Promise to read the CSV file
        const readCSV = new Promise((resolve, reject) => {
            readStream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve())
                .on('error', error => reject(error));
        });

        await readCSV;

        let correctPredictions = 0;
        for (let row of results) {
            const body = bodyMapper(row, columnNameX, columnNameY);
            const response = await this.forward({ containerID, body });
            // Assuming the model returns a response with the predicted value in the 'b' field
            if (this.isPredictionCorrect(parseFloat(row[columnNameY]), response.b)) {
                correctPredictions++;
            }
        }

        const accuracy = correctPredictions / results.length;
        console.log(`Final score (accuracy): ${accuracy}`);
    }

    isPredictionCorrect(expected, predicted) {
        const threshold = 0.1;
        return Math.abs(expected - predicted) < threshold;
    }
}

module.exports = AthenaDaemon;
