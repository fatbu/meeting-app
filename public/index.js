var socket = io()

var signin = function() {
    var username = $('#username').val()
    var password = $('#password').val()

    socket.emit('signin', {
        username: username,
        password: password
    })
}



var register = function() {
    var username = $('#username').val()
    var password = $('#password').val()

    socket.emit('register', {
        username: username,
        password: password
    })
}