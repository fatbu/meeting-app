const express = require('express')
const app = express()
const http = require('http').createServer(app)

const dataFileName = './data/persistent.json'
const fs = require('fs')
const fileContents = fs.readFileSync(dataFileName, 'utf8')

// parse data file
var data = JSON.parse(fileContents)

// writes data in the data variable to the data file
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
    // by default webpage date input initialises the time on a day to 8am,
    // so it must be reset to the beginning of the day or it causes problems
    earliestdate.setHours(0)
    let latestdate = new Date(event.latest)
    // increment the latest date by 1, to allow setting an event time on the latest day itself
    latestdate.setDate(latestdate.getDate() + 1)
    // convert the earliest possible time for the event and the latest possible time to epoch time
    let earliest = earliestdate.getTime()
    let latest = latestdate.getTime()

    // convert event duration from minutes to milliseconds
    let eventDuration = parseInt(event.duration) * 60 * 1000

    // iterate over all possible event times, incrementing by 30 minutes each loop
    for (let i = earliest; i < latest; i += 1800000) {
        // counter for the number of participants that are free during this particular timeslot
        let nFree = 0
        for (let participant of event.participants) {
            if (eventDuration <= 30) {
                // if event fits in one time slot, check if the participant is free during that slot
                if (userFreeAtTime(participant, i)) {
                    // increment counter
                    nFree++
                }
            } else {
                // if the event is longer than one time slot, check the time slots that follow it as well
                let notFree = false // assume the user is free
                // iterate through possible timeslots
                for (let t = i; t - i < eventDuration; t += 1800000) {
                    // check if user is free at this time slot
                    if (!userFreeAtTime(participant, t)) {
                        // if user is not free
                        notFree = true
                        break
                    }
                }
                if (!notFree) {
                    // if the user is free, increment counter
                    nFree++
                }
            }
        }
        // if all the participants are free during this timeslot
        if (nFree == event.participants.length) {
            // save event to each user's data
            // add to busy slots
            for (let participant of event.participants) {
                // initialise busy array if it is undefined
                data.users[participant].busy = data.users[participant].busy || []

                if (eventDuration <= 30) {
                    // if event only takes up one timeslot, only need to add one busy slot
                    data.users[participant].busy.push(i)
                } else {
                    // if event takes up multiple timeslots, add multiple busy slots, 30 minutes apart
                    for (let t = i; t - i < eventDuration; t += 1800000) {
                        data.users[participant].busy.push(t)
                    }
                }

            }
            // save time of event to event object
            data.events[eventId].time = i
            // save data to file
            storeData()
            return true
        }
    }
    return false
}

// server event listeners
io.on('connection', function(socket) {

    let signedinas = false
    // user attempts to sign in
    socket.on('signin', function(cred) {
        // check if user password is correct
        if (data.users[cred.username] && data.users[cred.username].password === cred.password) {
            // successful sign in


            let userdata = data.users[cred.username]
            // add events to userdata object temporarily,
            // before it is sent to the client.
            // to minimise the number of unnecessary requests to the server

            // send user object + event objects to client
            socket.emit('signedin', userdata)
            socket.emit('requestUpdate')
            // save username for later
            signedinas = cred.username
        } else {
            // unsuccessful sign in
            socket.emit('signinfail')
        }
    })
    // user registers
    socket.on('register', function(cred) {
        // can't register twice
        if (data.users[cred.username]) return

        // save username and password to datafile

        data.users[cred.username] = {
            password: cred.password,
            frees: {},
            events: [],
            busy: []
        }

        storeData()
        socket.emit('registered')
    })

    // since only the event ids are stored in the user objects,
    // need to add the event objects into the user objects
    // before sending it to the client
    // client has sent an update request
    // update the user data for the client
    socket.on('update', function(username) {
        if (!username) {
            let userdata = data.users[signedinas]
            if (userdata && userdata.events) {
                userdata.userEvents = {}
                for (let event of userdata.events) {
                    userdata.userEvents[event] = data.events[event]
                }
            }

            socket.emit('update', userdata)
            userdata.userEvents = undefined
        } else {
            let userdata = data.users[username]
            if (!userdata) return
            socket.emit('update', userdata)
        }
    })

    // toggle free slot
    socket.on('togglefree', function(free) {
        if (!signedinas) return
        let frees = data.users[signedinas].frees
        // initialise free slot objects if they do not exist
        // by default the user is not free in a slot
        frees = frees || {} // initialise free object if is not defined/filled
        frees[free.date] = frees[free.date] || new Array(48).fill(false)
        frees[free.date][free.index] = !frees[free.date][free.index] // toggle slot
        data.users[signedinas].frees = frees
        storeData()
        // notify client to update ui
        socket.emit('requestUpdate')
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
        let result = calcTimeForEvent(eventid)
        if (result) {
            // notify clients to update ui
            io.emit('requestUpdate')
        } else {
            // creation of event failed
            socket.emit('eventFail')
        }
    })


})