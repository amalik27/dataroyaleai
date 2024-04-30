const { PlatformDaemon } = require("./platformDaemon");
const csv = require('csv-parser');
const fs = require('fs');
const unzipper = require('unzipper');
const { PassThrough } = require('stream');  // Import PassThrough from the stream module
var shell = require('shelljs');




class AthenaDaemon extends PlatformDaemon {
    constructor( port, maxCPU, maxMemory, processID, maxUptime) {
        super( port, maxCPU, maxMemory, processID, maxUptime,0,"Athena");
        this.dataRecording = false;
        this.dataRecordingInterval = 0;
        this.queue = [];
        
    }

    async evaluateModel(filePath, containerID, columnNamesX, columnNamesY,metrics) {
        //Throw error any input is undefined
        if (!filePath || !containerID || !columnNamesX || !columnNamesY || !metrics) {
            throw new Error('Missing required input(s)');
        }
        console.log("Beginning Evaluating model process...");
        // while(this.queue[0] != containerID){
        //     //Wait for some time
        // }
        this.dataRecording = true;

        // Unzip the file and then read the 'testing.csv' after it has been extracted
        let csvResults = []; // Declare variable to hold the CSV results

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
            .pipe(unzipper.Parse())
            .on('entry', function (entry) {
                const fileName = entry.path;
                const type = entry.type; // 'Directory' or 'File'
                if (fileName === "testing.csv") {
                    // Pipe the entry directly into a ReadStream for CSV parsing
                    const csvStream = entry.pipe(new PassThrough());
                    const results = [];

                    // Read CSV from stream
                    csvStream
                    .pipe(csv())
                    .on('data', (data) => {
                        //console.log(data['result <number>'])
                        //console.log(columnNamesY,data[columnNamesY[0]]);
                        return results.push(data);
                    })
                    .on('end', () => {
                        csvResults = results; // Save the results to csvResults
                        resolve(); // Resolve the promise after all data is processed
                    })
                    .on('error', error => reject(error));

                } else {
                    entry.autodrain(); // Ignore entries that are not 'testing.csv'
                }
            })
            .on('error', reject) // Handle any errors during unzip
            .on('finish', () => {
                if (!csvResults.length) reject(new Error('No CSV data extracted.'));
            });
        })
        .catch(error => {
            console.error('Failed to process file:', error);
        });
        console.log(`[Athena Daemon - ${this.processID}] Testing Dataset Loaded...Evaluating model...`   )
        //console.log(csvResults);
        //labels equals all values from csvResults  for all column names in columnNamesY
        const labels = csvResults.map(row => columnNamesY.map(columnName => row[columnName]));  
        //console.log(labels);
        // Wrap the entire operation in a promise to be awaited
        let score;
        
        await new Promise(async (resolve, reject) => {
            await this.checkUntilHealthy(containerID, 10000, 6, async () => {
                try {
                    shell.exec(`docker ps | grep ${containerID} | cut -f 1 -d ' '`, { silent: true }, (code, stdout, stderr) => {
                        if (code !== 0 || stderr.trim()) {
                            return reject(new Error(`Error finding running container for tag: ${containerID}`));
                        }
                        const DOCKERID = stdout.trim();
                        this.dataRecordingInterval = 1;
                        this.getContainerStats(DOCKERID);
                    });

                    //Start timer
                    const start = new Date();
                    const predictions = await Promise.all(csvResults.map(row => {
                        
                        const body = this.bodyMapper(row, columnNamesX, columnNamesY).inputs;

                        
                        
                        let out = this.forward({ containerID, body }).then(response => {
                            //console.log(`Result: ${JSON.stringify(body)} is ${response}`);
                            return JSON.parse(response)[columnNamesY[0]]
                        }); 
                        return out;
                    }));
                    this.stopDataRecording(containerID)
                    await this.killContainers([{containerID:containerID}]);
                    this.queue.shift();
                    
                    console.log(`Queue: ${this.queue}`)
                    //Stop Timer
                    const end = new Date();
                    this.timeElapsed = (end - start) / 1000;


                    score = this.model_performance_aggregate(predictions, labels, JSON.parse(metrics));
                    
                    console.log(`Final score ${metrics}: ${score}`);
                    resolve({ score: score }); // Resolve the promise with the score
                } catch (error) {
                    reject(error); // In case of error, reject the promise
                }
            });
        });
        
        if(this.queue.length==0){
            this.emit('queueEmpty');
        }
        return score; // Return the awaited score from the promise
    }



    stopDataRecording() {
        this.dataRecordingInterval = 0;
        clearInterval(this.dataRecordingIntervalId); // Stop the interval
        this.emit('dataRecordingStopped');
    }

    async getContainerStats(containerID) {
        console.log("Getting container stats....");
        this.statsData = []; // Variable to store CPU and memory usage data
        let intervalId; // Variable to hold the interval ID
        // Function to fetch container stats and store them in statsData array
        const fetchStats = () => {
            console.log("Fetch stats loop running....");
            let command = `docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" ${containerID}`;
            let output = shell.exec(command, { silent: true });
            if (output.code !== 0) {
                console.error('Error executing docker stats command:', output.stderr);
                clearInterval(intervalId); // Stop the interval if an error occurs
                return;
            }
    

            let stats = output.stdout.split(' ');
            let cpuUsage = stats[0];
            let memoryUsage = stats[1];
            console.log(`CPU Usage: ${cpuUsage}, Memory Usage: ${memoryUsage}`);
            this.statsData.push({ cpuUsage, memoryUsage }); // Store CPU and memory usage data
        };
    
        // Start fetching container stats every 1 second
        this.dataRecordingIntervalId = setInterval(fetchStats, this.dataRecordingInterval);
           
        // Return a function to stop the interval and return the collected stats
        return () => {
            clearInterval(intervalId); // Stop the interval
            return statsData; // Return the collected stats
        };
    }
    
    async checkUntilHealthy(containerTag, retryInterval = 10000,attempts = 5, fn) {
        if(attempts){
            try {
                const status = await this.checkContainerHealth(containerTag);
                if (status.status=="healthy") {
                    console.log('Container is healthy.');
                    fn();
                } else {
                    console.log('Container is not healthy yet. Retrying...');
                    setTimeout(async () => await this.checkUntilHealthy(containerTag, retryInterval,attempts-=1, fn), retryInterval, );
                }
            } catch (error) {
                console.error('Error checking container health:', error);
                setTimeout(async () => await this.checkUntilHealthy(containerTag, retryInterval,attempts-=1, fn));
            }
        } else{
            console.log('Error checking container health:'); 
        }
    }


    bodyMapper(row, inputColumns, outputColumns) {
        //console.log(`Mapping row to body: ${JSON.stringify(row)}, ${inputColumns}, ${outputColumns}`);
        let requestBody = { inputs: {}, outputs: {} };
        
        // Assuming inputColumns and outputColumns are arrays of column names
        inputColumns.forEach(columnName => {
          requestBody.inputs[columnName] = row[columnName];
        });
      
        outputColumns.forEach(columnName => {
          requestBody.outputs[columnName] = row[columnName];
        });
      
        return requestBody;
    }

    //Aggregate performance calculator. Takes in predictions, labels, and metrics(plural). iterates through and collects the various metrics
    model_performance_aggregate(predictions, labels, metrics){
        //Metrics is a json object with the metrics as keys and the values as the metric weights. Therefore we need to access the keys and iterate through them
        //Numerator are all positively correlated values
        let num = 0;
        let den = 1;
        Object.keys(metrics).forEach((key) => {
            let metric = key;
            let weight = metrics[key];
            console.log(metric,weight);
            if(metric=='speed'|| metric == 'accuracy' || metric == 'precision' || metric == 'recall' || metric == 'f1'){
                num+= this.model_performance(predictions, labels, metric) * weight;
            } else {
                den+= this.model_performance(predictions, labels, metric) * weight;
            }
        });
        console.log(num);
        return num/den
    }

    //calculate performance
    model_performance(predictions, labels, metric){
        //MODEL HARDWARE/INFRASTRUCTURE PERFORMANCE
        //CPU Usage
        if(metric === 'cpu'){
            const cpuUsage = this.statsData.map(data => parseFloat(data.cpuUsage));
            return cpuUsage.reduce((a, b) => a + b) / cpuUsage.length;
        }
        //Memory Usage
        if(metric === 'memory'){
            const memoryUsage = this.statsData.map(data => parseFloat(data.memoryUsage));
            return memoryUsage.reduce((a, b) => a + b) / memoryUsage.length;
        }
        //Speed
        if(metric === 'speed'){
            return this.timeElapsed;
        }

        //MODEL INFERENCE CORRECTNESS
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
            const mean = labels.reduce((a, b) =>  parseFloat(a) + parseFloat(a)) / labels.length;
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

