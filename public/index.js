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

var createevent = function() {
    if (!signedin) return



    let eventdesc = $('#description').val()
    let eventdur = $('#duration').val()
    let earliestdate = $('#earliest').val()
    let latestdate = $('#latest').val()
    let participants = $('#participants').val().split(' ')

    socket.emit('addevent', {
        desc: eventdesc,
        duration: eventdur,
        earliest: earliestdate,
        latest: latestdate,
        participants: participants,
    })
}


var dateView = new Date()

var updateFree = function(freeSlots) {
    $('#free > td').each(function() {
        if (freeSlots && freeSlots[$(this).index()]) {
            $(this).css('background-color', 'green')
        } else {
            $(this).css('background-color', 'grey')
        }
    })
}
$(document).ready(function() {
    $('tr#free td').click(function() {
        this.style.backgroundColor = this.style.backgroundColor == 'green' ? 'grey' : 'green';
        socket.emit('togglefree', {
            date: dateView.toDateString(),
            index: $(this).index()
        })
        //console.log($(this).index())
    })

    $('#currentday').text(dateView.toDateString())

    $('#back').click(function() {
        dateView.setDate(dateView.getDate() - 1)
        $('#currentday').text(dateView.toDateString())
        updateFree(userdata.frees[dateView.toDateString()])
    })
    $('#forward').click(function() {
        dateView.setDate(dateView.getDate() + 1)
        $('#currentday').text(dateView.toDateString())
        updateFree(userdata.frees[dateView.toDateString()])
    })
})



socket.on('signedin', function(user) {
    signedin = true
    signedinas = $('#username').val()
    userdata = user
    updateFree(userdata.frees[dateView.toDateString()])

})

socket.on('signinfail', function() {
    console.log('sign in fail')
})