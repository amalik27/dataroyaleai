var shell = require('shelljs');

shell.exec("sudo docker build -t flask ./dockercontainer")
shell.exec("sudo docker run -d -p 5000:5000 flask")
