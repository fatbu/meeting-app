var socket = io()

// called when the user clicks the sign in button
var signin = function() {
    var username = $('#username').val()
    var password = $('#password').val()

    socket.emit('signin', {
        username: username,
        password: password
    })
}

var signedin = false
var signedinas = '' // username of signed in user

// stores user information after they are signed in
var userdata = {}

// called when the user clicks the register button
var register = function() {
    var username = $('#username').val()
    var password = $('#password').val()

    if (username.indexOf(' ') >= 0) {
        alert('Username cannot contain spaces')
        return
    }


    socket.emit('register', {
        username: username,
        password: password
    })
}

// show the create event form and hide rest of page
var showcreateevent = function() {
    $('#app').hide()
    $('#create').show()
}

// called when the create event form button is clicked
var createevent = function() {
    if (!signedin) return



    let eventdesc = $('#description').val()
    let eventdur = $('#duration').val()
    let earliestdate = $('#earliest').val()
    let latestdate = $('#latest').val()
    let participants = $('#participants').val().split(' ')
    if (participants[0] === '') participants = []
    socket.emit('addevent', {
        desc: eventdesc,
        duration: eventdur,
        earliest: earliestdate,
        latest: latestdate,
        participants: participants,
    })

    $('#create').hide()
    $('#app').show()
}

// the day that is currently being viewed
var dateView = new Date()
dateView.setHours(0)
dateView.setMinutes(0)
dateView.setSeconds(0)
dateView.setMilliseconds(0)

// display the user's free slots
var updateFree = function(freeSlots) {
    $('#free > td').each(function() {
        if (freeSlots && freeSlots[$(this).index()]) {
            $(this).css('background-color', 'green')
        } else {
            $(this).css('background-color', 'grey')
        }
    })
}
// display the user's busy slots
var updateBusy = function(busySlots) {
    $('#events > td').each(function() {
        // check each busy slot and see if the user is busy at that time
        if (busySlots && busySlots.includes(dateView.getTime() + $(this).index() * 1800000)) {
            $(this).css('background-color', 'blue')
        } else {
            $(this).css('background-color', 'transparent')
        }

    })
}
// display the user's events on the currently viewed day
var updateEvents = function(events) {

    function pad2(number) {

        return (number < 10 ? '0' : '') + number
    }
    $('#upcoming_events').empty()
    if (!events) return
    for (let eventid in events) {
        let event = events[eventid]
        if (!event.time) continue
        let eventdate = new Date(event.time)
        if (eventdate.getDate() == dateView.getDate()) {
            $('#upcoming_events').append('<p>' + pad2(eventdate.getHours()) + ':' + pad2(eventdate.getMinutes()) + ' ' + event.desc + '</p>')
        }
    }
}

// refreshes busy and free slots and the events displayed for the current day
var updateAll = function() {
    if (!userdata) return
    if (userdata.frees) updateFree(userdata.frees[dateView.getTime()])
    if (userdata.busy) updateBusy(userdata.busy)
    if (userdata.userEvents) updateEvents(userdata.userEvents)
}
// when an update event is sent from the server, refresh what is being viewed
socket.on('update', function(data) {
    userdata = data
    updateAll()
})

// update every second
setInterval(function() {
    socket.emit('update')
}, 1000)

// add event listeners
$(document).ready(function() {
    // when free slot is clicked
    $('tr#free td').click(function() {
        this.style.backgroundColor = this.style.backgroundColor == 'green' ? 'grey' : 'green';
        socket.emit('togglefree', {
            date: dateView.getTime(),
            index: $(this).index()
        })
        //console.log($(this).index())
    })

    // display the current day as a formatted string
    $('#currentday').text(dateView.toDateString())

    // when back button is clicked
    $('#back').click(function() {
        dateView.setDate(dateView.getDate() - 1)
        $('#currentday').text(dateView.toDateString())
        updateAll()
    })
    // when forward button is clicked
    $('#forward').click(function() {
        dateView.setDate(dateView.getDate() + 1)
        $('#currentday').text(dateView.toDateString())
        updateAll()
    })
})


// when received confirmation that signed in
socket.on('signedin', function(user) {
    signedin = true
    signedinas = $('#username').val()
    userdata = user
    updateAll()
    $('#app').show()
    $('#signin').hide()
})

socket.on('signinfail', function() {
    alert('Sign in fail')
})

socket.on('registered', function() {
    alert('Registered')
})