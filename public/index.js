var socket = io()

var signin = function() {
    var username = $('#username').val()
    var password = $('#password').val()

    socket.emit('signin', {
        username: username,
        password: password
    })
}

var signedin = false
var signedinas = ''

var userdata = {}

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

var showcreateevent = function() {
    $('#app').hide()
    $('#create').show()
}

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


var dateView = new Date()
dateView.setHours(0)
dateView.setMinutes(0)
dateView.setSeconds(0)
dateView.setMilliseconds(0)

console.log(dateView)
console.log(dateView.getTime())


var updateFree = function(freeSlots) {
    $('#free > td').each(function() {
        if (freeSlots && freeSlots[$(this).index()]) {
            $(this).css('background-color', 'green')
        } else {
            $(this).css('background-color', 'grey')
        }
    })
}

var updateBusy = function(busySlots) {
    if (!busySlots) return
    $('#events > td').each(function() {

        if (busySlots.includes(dateView.getTime() + $(this).index() * 1800000)) {
            $(this).css('background-color', 'blue')
        } else {
            $(this).css('background-color', 'transparent')
        }

    })
}

var updateEvents = function(events) {
    if (!events) return
    for (let eventid in events) {
        let event = events[eventid]
        if (!event.time) continue
        let eventdate = new Date(event.time)
        if (eventdate.getDate() == dateView.getDate()) {
            $('#upcoming_events').append('<p>' + eventdate.getHours() + ':' + eventdate.getMinutes() + ' ' + event.desc + '</p>')
        }
    }
}

$(document).ready(function() {
    $('tr#free td').click(function() {
        this.style.backgroundColor = this.style.backgroundColor == 'green' ? 'grey' : 'green';
        socket.emit('togglefree', {
            date: dateView.getTime(),
            index: $(this).index()
        })
        //console.log($(this).index())
    })

    $('#currentday').text(dateView.toDateString())

    $('#back').click(function() {
        dateView.setDate(dateView.getDate() - 1)
        $('#currentday').text(dateView.toDateString())
        updateFree(userdata.frees[dateView.getTime()])
        updateBusy(userdata.busy)
    })
    $('#forward').click(function() {
        dateView.setDate(dateView.getDate() + 1)
        $('#currentday').text(dateView.toDateString())
        updateFree(userdata.frees[dateView.getTime()])
        updateBusy(userdata.busy)
    })
})



socket.on('signedin', function(user) {
    signedin = true
    signedinas = $('#username').val()
    userdata = user
    updateFree(userdata.frees[dateView.getTime()])
    updateBusy(userdata.busy)

    $('#app').show()
    $('#signin').hide()
})

socket.on('signinfail', function() {
    console.log('sign in fail')
})