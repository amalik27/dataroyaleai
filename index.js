var shell = require('shelljs');

//Can use some DSA for the automatic local port assignment within 5000-5010

shell.exec("docker build -t user1 ./dockercontainer")
shell.exec("docker build -t user2 ./dockercontainer")
shell.exec("docker build -t user3 ./dockercontainer")

shell.exec("docker run -d -p 5000:5000 user1") 
shell.exec("docker run -d -p 5001:5000 user2")
shell.exec("docker run -d -p 5002:5000 user3")