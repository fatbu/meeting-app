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

function userFreeAtTime(username, time) {
    let user = data.users[username]
    //console.log(new Date(time) + ' ' + time)
    for (let datestr in user.frees) {
        let datetime = new Date(parseInt(datestr))
        //console.log(datetime + ' ' + datestr)
        for (let i = 0; i < 48; i++) {
            if (user.frees[datestr][i]) {
                //console.log(datetime.getTime() + i * 1800000 + ' ' + time)
                let freeslot = datetime.getTime() + i * 1800000
                // console.log('checking ' + new Date(freeslot) + ' vs ' + new Date(time))
                // console.log(freeslot, time)
                // console.log('difference ' + Math.abs(time - freeslot))
                if (datetime.getTime() + i * 1800000 == time) {
                    return true
                }
            }
        }
    }
    return false

}

function calcTimeForEvent(eventId) {
    let event = data.events[eventId]
    let earliestdate = new Date(event.earliest)
    earliestdate.setHours(0)
    let latestdate = new Date(event.latest)
    latestdate.setDate(latestdate.getDate() + 1)
    let earliest = earliestdate.getTime()
    let latest = latestdate.getTime()

    let eventDuration = parseInt(event.duration) * 60 * 1000

    for (let i = earliest; i < latest; i += 1800000) {
        let nFree = 0
        for (let participant of event.participants) {
            // console.log(new Date(i))
            // console.log(i)
            // console.log(userFreeAtTime(participant, i))

            if (eventDuration <= 30) {
                if (userFreeAtTime(participant, i)) {
                    nFree++
                }
            } else {
                let notFree = false
                for (let t = i; t - i < eventDuration; t += 1800000) {
                    if (!userFreeAtTime(participant, t)) {
                        notFree = true
                        break
                    }
                }
                if (!notFree) {
                    nFree++
                }
            }
        }

        if (nFree == event.participants.length) {
            for (let participant of event.participants) {
                data.users[participant].busy = data.users[participant].busy || []


                if (eventDuration <= 30) {
                    data.users[participant].busy.push(i)
                } else {
                    for (let t = i; t - i < eventDuration; t += 1800000) {
                        data.users[participant].busy.push(t)
                    }
                }

            }
            data.events[eventId].time = i
            storeData()
            break
        }
    }
}


calcTimeForEvent('5f1df719-fdfe-4181-874b-95de4b5bf84f')

io.on('connection', function(socket) {
    let signedinas = false
    socket.on('signin', function(cred) {
        console.log(JSON.stringify(cred))

        if (data.users[cred.username] && data.users[cred.username].password === cred.password) {
            // successful sign in
            let userdata = data.users[cred.username]
            userdata.userEvents = {}
            for (let event of userdata.events) {
                userdata.userEvents[event] = data.events[event]
            }
            socket.emit('signedin', userdata)


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
        event.earliest = Date.parse(event.earliest)
        event.latest = Date.parse(event.latest)
        event.participants.push(signedinas)
        if (!data.users[signedinas].events) {
            data.users[signedinas].events = []
        }
        if (!data.events) data.events = {}
        let eventid = getuuid()
        data.events[eventid] = event
        data.users[signedinas].events.push(eventid)
        for (let username of event.participants) {
            if (!username) continue
            data.users[username].events.push(eventid)
        }
        storeData()
        console.log(event)
        calcTimeForEvent(eventid)
    })


})