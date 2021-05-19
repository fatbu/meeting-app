const express = require('express')
const app = express()
const http = require('http').createServer(app)

const dataFileName = './data/persistent.json'
const fs = require('fs')
const fileContents = fs.readFileSync(dataFileName, 'utf8')

var data = JSON.parse(fileContents)

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

function getuuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function calcTimeForEvent() {

}

io.on('connection', function(socket) {
    let signedinas = false
    socket.on('signin', function(cred) {
        console.log(JSON.stringify(cred))

        if (data.users[cred.username] && data.users[cred.username].password === cred.password) {
            // successful sign in
            socket.emit('signedin', data.users[cred.username])
            signedinas = cred.username
        } else {
            // unsuccessful sign in
            socket.emit('signinfail')
        }
    })

    socket.on('register', function(cred) {
        data.users[cred.username] = {
            password: cred.password
        }
        storeData()
    })

    socket.on('togglefree', function(free) {
        if (!signedinas) return
        console.log(free)
        let frees = data.users[signedinas].frees
        frees = frees || {}
        frees[free.date] = frees[free.date] || new Array(48).fill(false)
        frees[free.date][free.index] = !frees[free.date][free.index]
        data.users[signedinas].frees = frees
        storeData()
    })


    socket.on('addevent', function(event) {
        console.log(event)
        event.earliest = Date.parse(event.earliest)
        event.latest = Date.parse(event.latest)

        if (!data.users[signedinas].events) {
            data.users[signedinas].events = []
        }
        if (!data.events) data.events = {}
        let eventid = getuuid()
        data.events[eventid] = event
        data.users[signedinas].events.push(eventid)
        for (let username of event.participants) {
            data.users[username].events.push(eventid)
        }
        storeData()
    })


})