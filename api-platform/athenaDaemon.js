const { PrometheusDaemon } = require("./prometheusDaemon");

//Inherit from PrometheusDaemon
class AthenaDaemon extends PrometheusDaemon {
    constructor() {
        super();
    }

    //evaluateModel. A function that will take in a test dataset and repeatedly call forward till every row in that dataset is processed.
    async evaluateModel(filePath) {
        //Assume file is a csv
        const csv = require('csv-parser');
        const fs = require('fs');
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log(results);
                //For each row in the dataset, call forward
                results.forEach(async (row) => {
                    await this.forward(row);
                });
            });
    }
}