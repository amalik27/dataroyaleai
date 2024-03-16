const { PlatformDaemon } = require("./platformDaemon");
const csv = require('csv-parser');
const fs = require('fs');

class AthenaDaemon extends PlatformDaemon {
    constructor( port, maxCPU, maxMemory, processID, maxUptime) {
        super( port, maxCPU, maxMemory, processID, maxUptime,0,"Athena");
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
        let predictions = [];
        //Get labels as row
        const labels = results.map(row => row[columnNameY]);
        for (let row of results) {
            const body = bodyMapper(row, columnNameX, columnNameY);
            const response = await this.forward({ containerID, body });
            // Assuming the model returns a response with the predicted value in the 'b' field
            predictions.push(JSON.parse(response).result);
            if (this.isPredictionCorrect(parseFloat(row[columnNameY]), response.result)) {
                correctPredictions++;
            }
        }
        let metric= 'mse';
        const accuracy = this.model_performance(predictions,labels, metric);
        console.log(`Final score ${metric}: ${accuracy}`);
    }

    //calculate performance
    model_performance(predictions, labels,metric){
        //Regression Metrics

        //MAE
        if(metric === 'mae'){
            let sum = 0;
            for (let i = 0; i < predictions.length; i++) {
                sum += Math.abs(labels[i] - predictions[i]);
            }
            return sum / predictions.length;
        }
        //MSE
        if(metric === 'mse'){
            let sum = 0;
            for (let i = 0; i < predictions.length; i++) {
                sum += Math.pow(labels[i] - predictions[i], 2);
            }
            return sum / predictions.length;
        }
        //RMSE
        if(metric === 'rmse'){
            let sum = 0;
            for (let i = 0; i < predictions.length; i++) {
                sum += Math.pow(labels[i] - predictions[i], 2);
            }
            return Math.sqrt(sum / predictions.length);
        }
        //R-squared
        if(metric === 'r2'){
            const mean = labels.reduce((a, b) => a + b) / labels.length;
            const ssTot = labels.reduce((acc, cur) => acc + Math.pow(cur - mean, 2), 0);
            const ssRes = predictions.reduce((acc, cur, i) => acc + Math.pow(cur - labels[i], 2), 0);
            return 1 - (ssRes / ssTot);
        }
        //Classification Metrics(DO LATER)
        //Accuracy
        if(metric === 'accuracy'){
            let correct = 0;
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i] === labels[i]) {
                    correct++;
                }
            }
            return correct / predictions.length;
        }
        //Precision
        if(metric === 'precision'){
            const truePositives = 0;
            const falsePositives = 0;
            return truePositives / (truePositives + falsePositives);
        }
        //Recall
        if(metric === 'recall'){
            const truePositives = 0;
            const falseNegatives = 0;
            return truePositives / (truePositives + falseNegatives);
        }
        //F1 score
        if(metric === 'f1'){
            const truePositives = 0;
            const falsePositives = 0;
            const falseNegatives = 0;
            const precision = truePositives / (truePositives + falsePositives);
            const recall = truePositives / (truePositives + falseNegatives);
            return 2 * (precision * recall) / (precision + recall);
        }

    }


    isPredictionCorrect(expected, predicted) {
        const threshold = 0.1;
        return Math.abs(expected - predicted) < threshold;
    }
}

module.exports = AthenaDaemon;
