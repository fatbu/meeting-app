const express = require('express')
const app = express()
const http = require('http').createServer(app)

const dataFileName = './data/persistent.json'
const fs = require('fs')
const fileContents = fs.readFileSync(dataFileName, 'utf8')

const data = JSON.parse(fileContents)

var storeData = function() {
    fs.writeFileSync(dataFileName, JSON.stringify(data), 'utf8')
}

app.use(express.static('public'))

let port = 8000

// socket.io
const io = require('socket.io')(http)


http.listen(port, () => {
    console.log('listening on *:' + port)
})



io.on('connection', function(socket) {
    socket.on('signin', function(cred) {
        console.log(JSON.stringify(cred))
    })

    socket.on('register', function(cred) {
        console.log(JSON.stringify(cred))
        data.users[cred.username] = {
            password: cred.password
        }
        storeData()
    })
})