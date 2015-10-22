// Import assert. Needed in the global scope for lambdas to access it.
var assert = require('assert');

// Import mongo and init
var mongo = require('mongodb');
var mongoClient = mongo.MongoClient;

// Import mongoose
var mongoose = require('mongoose');
var Bathroom;

// Import helpers
var helpers = require('./helpers');

// Example mongoUrl: 'mongodb://127.0.0.1:27017/test'
module.exports = function(mongoUrl) {
    var exports = {};

    // Init mongoose
    mongoose.connect(mongoUrl);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(callback) {
        var bathroomSchema = mongoose.Schema({
            lat: Number,
            lon: Number,
            name: String,
            category: String,
            pending: {
                'type': Boolean,
                'default': false
            }
        });
        Bathroom = mongoose.model('Bathroom', bathroomSchema, 'toilets');
    });

    exports.shutdown = function() {
        db.close();
    };

    exports.getBathrooms = function(pending, callback) {
        console.log('BEGIN: getBathrooms');

        var query = {};
        if (!pending) {
            query = {
                $or: [
                    { pending: { $exists: false }},
                    { pending: false }
                ]
            };
        }

        Bathroom.find(query, function(err, bathroomsResult) {
            var out = {
                result: {
                    ok: (err == null) ? 1 : 0,
                },
                bathrooms: bathroomsResult
            };
            callback(out);
        });

        console.log('END: getBathrooms');
    };

    exports.addBathroom = function(lat /* float */, lon /* float */, name, cat, pending /* bool */, callback) {
        var status = "ok";
        if (!helpers.isNumeric(lat)) {
            status = "latitude invalid";
        } else if (!helpers.isNumeric(lon)) {
            status = "longitude invalid";
        } else if (name == null) {
            status = "no name found";
        } else if (cat == null) {
            status = "no cat found";
        }

        if (status == "ok") {

            console.log('BEGIN: addBathroom ' + bathroomParamsToString(lat, lon, name, cat));

            mongoClient.connect(mongoUrl, function(err, db) {
                assert.equal(null, err);
                db.collection('toilets').insertOne({
                    "lat": lat,
                    "lon": lon,
                    "name": name,
                    "category": cat,
                    "pending": pending
                }, function(err, mongoResult) {
                    assert.equal(err, null);
                    console.log("added!");

                    var out = {
                        result: {
                            ok: 1,
                            text: status
                        },
                        bathroom: mongoResult.ops[0]
                    };
                    callback(out);
                    db.close();
                });
            });

            console.log('END: addBathroom');
        } else {
            var out = {
                result: {
                    ok: 0,
                    text: status
                }
            };
            callback(out);
        }
    };

    exports.removeBathroom = function(id, callback) {
        var status = "ok!";
        if (id != null) {
            console.log('BEGIN: removeBathroom ' + id);

            Bathroom.remove({ _id: id }, function(err) {
                var out = {
                    result: {
                        ok: (err == null) ? 1 : 0
                    }
                };
                callback(out);
            });
        } else {
            var out = {
                result: {
                    ok: 0,
                    text: "no id parameter found"
                }
            };
            callback(out);
        }
    };

    exports.modifyBathroom = function(id, lat, lon, name, cat, pending, callback) {
        Bathroom.find({ _id: id }, function(err, bathroomsResult) {
            if (bathroomsResult.length == 1) {
                var bathroom = bathroomsResult[0];
                if (lat != null) {
                    bathroom.lat = lat;
                }
                if (lon != null) {
                    bathroom.lon = lon;
                }
                if (name != null) {
                    bathroom.name = name;
                }
                if (cat != null) {
                    bathroom.category = cat;
                }
                if (pending != null) {
                    bathroom.pending = pending;
                }
                bathroom.save(function(err, bathroomResult) {
                    var out = {
                        result: {
                            ok: (err == null) ? 1 : 0,
                            text: (err == null) ? "success" : err
                        },
                        bathroom: bathroomResult
                    };
                    callback(out);
                });
            } else {
                var out = {
                    result: {
                        ok: 0,
                        text: "id not found"
                    }
                };
                callback(out);
            }
        });
    };

    exports.clearDatabase = function(callback) {
        mongoClient.connect(mongoUrl, function(err, db) {
            assert.equal(null, err);
            db.dropDatabase(function(err, result) {
                assert.equal(err, null);
                callback(result);
                db.close();
            });
        });
    };
    return exports;
};

function bathroomParamsToString(lat, lon, name, cat) {
    return "[lat = " + lat +
        ", lon = " + lon + 
        ", name = " + name +
        ", cat = " + cat + "]";
}
