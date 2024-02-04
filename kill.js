var shell = require('shelljs');

let containers = ["user1","user2","user3"]//Can be replaced with a command to search results of docker ps and filtering by pattern user*
containers.forEach((user)=>{
    let userID = shell.exec(`docker ps | grep ${user} | cut -f 1 -d ' ' `)
    shell.exec(`docker stop ${userID}`)
    shell.exec(`docker rmi ${userID}`)
    
})