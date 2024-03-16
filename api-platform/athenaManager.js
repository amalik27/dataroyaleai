const { PrometheusDaemonManager } = require('./prometheusManager');

//Inherit from PrometheusManager

class AthenaManager extends PrometheusDaemonManager {
    constructor() {
        super();
    }


}