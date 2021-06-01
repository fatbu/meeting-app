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

// creates a random id for events
function getuuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// check if a user is free at a certain time
function userFreeAtTime(username, time) {
    let user = data.users[username]
    // iterate over all user free slots
    for (let datestr in user.frees) {
        // parse date from epoch time
        let datetime = new Date(parseInt(datestr))
        for (let i = 0; i < 48; i++) {
            // iterate over all free slots for this day
            if (user.frees[datestr][i]) {
                // calculate the current free slot time
                let freeslot = datetime.getTime() + i * 1800000
                // check if it is equal to the provided time
                if (datetime.getTime() + i * 1800000 == time) {
                    return true
                }
            }
        }
    }
    return false

}

// calculate and save the time for an event
// ensure that an event is created only when all the participants are free
function calcTimeForEvent(eventId) {
    let event = data.events[eventId]
    let earliestdate = new Date(event.earliest)
    earliestdate.setHours(0)
    let latestdate = new Date(event.latest)
    // increment the latest date by 1, to allow setting an event time on the latest day itself
    latestdate.setDate(latestdate.getDate() + 1)
    let earliest = earliestdate.getTime()
    let latest = latestdate.getTime()

    // event duration in milliseconds
    let eventDuration = parseInt(event.duration) * 60 * 1000

    // iterate over all possible event times
    for (let i = earliest; i < latest; i += 1800000) {
        // counter for the number of participants that are free during this particular timeslot
        let nFree = 0
        for (let participant of event.participants) {
            if (eventDuration <= 30) {
                // if event fits in one time slot, check if the participant is free during that slot
                if (userFreeAtTime(participant, i)) {
                    nFree++
                }
            } else {
                // if the event is longer than one time slot, check the time slots that follow it as well
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
        // if all the participants are free during this timeslot
        if (nFree == event.participants.length) {
            // save event to each user's data
            // add to busy slots
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
            console.log('Time found for event ' + eventId)
            break
        }
    }
}


// server event listeners
io.on('connection', function(socket) {

    let signedinas = false
    // user attempts to sign in
    socket.on('signin', function(cred) {
        console.log(JSON.stringify(cred))

        if (data.users[cred.username] && data.users[cred.username].password === cred.password) {
            // successful sign in
            let userdata = data.users[cred.username]
            if (userdata.events) {
                userdata.userEvents = {}
                for (let event of userdata.events) {
                    userdata.userEvents[event] = data.events[event]
                }
            }
            socket.emit('signedin', userdata)

            // save username for later
            signedinas = cred.username
        } else {
            // unsuccessful sign in
            socket.emit('signinfail')
        }
    })
    // user registers
    socket.on('register', function(cred) {
        data.users[cred.username] = {
            password: cred.password
        }

        storeData()
        socket.emit('registered')
    })

    // since only the event ids are stored in the user objects,
    // need to add the event objects into the user objects
    // before sending it to the client
    var updateUserData = function() {
        let userdata = data.users[signedinas]
        if (userdata && userdata.events) {
            userdata.userEvents = {}
            for (let event of userdata.events) {
                userdata.userEvents[event] = data.events[event]
            }
        }
        socket.emit('update', userdata)
    }

    // update the user data for the client
    socket.on('update', function() {
        updateUserData()
    })

    // toggle free slot
    socket.on('togglefree', function(free) {
        if (!signedinas) return
        let frees = data.users[signedinas].frees
        // initialise free slot objects if they do not exist
        // by default the user is not free in a slot
        frees = frees || {}
        frees[free.date] = frees[free.date] || new Array(48).fill(false)
        frees[free.date][free.index] = !frees[free.date][free.index]
        data.users[signedinas].frees = frees
        storeData()
        updateUserData()
    })

    // add event to users and calculate time
    socket.on('addevent', function(event) {
        event.earliest = Date.parse(event.earliest)
        event.latest = Date.parse(event.latest)
        // the event creator must be a participant in the event
        event.participants.push(signedinas)
        if (!data.users[signedinas].events) {
            data.users[signedinas].events = []
        }
        // initialise events object if it does not exist
        if (!data.events) data.events = {}
        // create random id for event
        let eventid = getuuid()
        data.events[eventid] = event
        data.users[signedinas].events.push(eventid)
        // add event id to each of the participant objects
        for (let username of event.participants) {
            if (!username) continue
            if (!data.users[username].events) data.users[username].events = []
            data.users[username].events.push(eventid)
        }
        storeData()
        console.log(event)
        calcTimeForEvent(eventid)
    })


})