// Import winston and configure logger
var log = require('./log')();
var filename = log.createBaseFilename();
var logger = log.createLogger(filename);

// Import express
var express = require('express');
var app = express();

// Import server code
var mongoUrl = 'mongodb://127.0.0.1:27017/' + ((process.argv.length == 3) ? process.argv[2] : 'test');
var impl = require('./impl')(mongoUrl, filename + '.impl');
var helpers = require('./helpers');

// Middleware
app.use(function(req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    
    next();
});

// Routing
app.get('/', function(req, res) {
    res.send('Up and running!');
}).get('/bathrooms', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var lat = parseFloat(query.lat);
    var lon = parseFloat(query.lon);
    var distance = parseFloat(query.distance);
    impl.getNearbyBathrooms(lat, lon, distance, function(doc) {
        res.json(doc);
    });
}).get('/pendingbathrooms', function(req, res) {
    impl.getBathrooms(true /* pending */, function(doc) {
        res.json(doc);
    });
}).get('/addbathroom', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var lat = parseFloat(query.lat);
    var lon = parseFloat(query.lon);
    var name = query.name;
    var cat = query.cat;
    var pending = (query.admin == null);

    impl.addBathroom(lat, lon, name, cat, pending, function(result) {
        res.json(result);
    });
}).get('/removeBathroom', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var id = query.id;
    impl.removeBathroom(id, function(result) {
        res.json(result);
    });
}).get('/modifyBathroom', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var id = query.id;
    var lat = (query.lat != null) ? parseFloat(query.lat) : null;
    var lon = (query.lat != null) ? parseFloat(query.lon) : null;
    var name = query.name;
    var cat = query.cat;
    var pending = (query.pending == "true");

    impl.modifyBathroom(id, lat, lon, name, cat, pending, function(result) {
        res.json(result);
    });
}).get('/addReview', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var id = query.id;
    var rating = (query.rating != null) ? parseInt(query.rating) : null;
    var text = query.text;
    impl.addReview(id, rating, text, function(result) {
        res.json(result);
    });
}).get('/removeReview', function(req, res) {
    var query = helpers.getQueryParameters(req);
    var id = query.id;
    var reviewId = query.reviewId;
    impl.removeReview(id, reviewId, function(result) {
        res.json(result);
    });
}).get('/testparam', function(req, res) {
    testParam(req, res);
});

impl.start(function() {
    // Start server
    var portNumber = 8080;
    var server = app.listen(portNumber, function() {
        var host = server.address().address;
        var port = server.address().port;

        logger.info('Server listening at http://%s:%s', host, port);
    });
});

function testParam(req, res) {
    var query = helpers.getQueryParameters(req);

    console.log(query);

    var outstring = "";
    if (query.admin != null) {
        outstring = "non null!";
    } else {
        outstring = "null!";
    }
    
    res.writeHead(200);
    res.end(outstring);
}

