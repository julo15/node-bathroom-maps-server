// Import assert. Needed in the global scope for lambdas to access it.
var assert = require('assert');

// Import mongo and init
var mongo = require('mongodb');
var mongoClient = mongo.MongoClient;

// Import mongoose
var mongoose = require('mongoose');
var Bathroom;

// Import winston logging
var winston = require('winston');

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
            },
            rating: {
                avg: {
                    'type': Number,
                    'default': 0
                },
                count: {
                    'type': Number,
                    'default': 0
                },
                reviews: [{
                    rating: Number,
                    text: String,
                    date: Date
                }]
            }
        });
        Bathroom = mongoose.model('Bathroom', bathroomSchema, 'toilets');
    });

    exports.shutdown = function() {
        db.close();
    };

    exports.getBathrooms = function(pending, callback) {
        winston.info('getBathrooms start');
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

            var bathroom = new Bathroom({
                lat: lat,
                lon: lon,
                name: name,
                category: cat,
                pending: pending});

            bathroom.save(function(err, bathroom) {
                if (err) {
                    var out = {
                        result: {
                            ok: 0,
                            text: err
                        }
                    };
                    callback(out);
                } else {
                    var out = {
                        result: {
                            ok: 1
                        },
                        bathroom: bathroom
                    };
                    callback(out);
                }
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

    exports.addReview = function(id, rating, text, callback) {

        var out = {
            result: {
                ok: 0
            }
        };

        if (id == null) {
            out.result.text = 'id param missing';
        } else if (!helpers.isNumeric(rating)) {
            out.result.text = 'rating param missing or not numeric';
        } else if (text == null) {
            out.result.text = 'text param missing';
        } else {
            out.result.ok = 1;
        }

        if (out.result.ok) {
            Bathroom.find({ _id: id }, function(err, bathroomsResult) {
                if (bathroomsResult.length == 1) {
                    var bathroom = bathroomsResult[0];
                    bathroom.rating.reviews.push({
                        rating: rating,
                        text: text,
                        date: new Date()
                    });

                    // Re-calculate avg and count
                    bathroom.rating.avg = 0;
                    bathroom.rating.count = bathroom.rating.reviews.length;
                    if (bathroom.rating.count > 0) {
                        for (var i = 0; i < bathroom.rating.reviews.length; i++) {
                            bathroom.rating.avg += bathroom.rating.reviews[i].rating;
                        }
                        bathroom.rating.avg /= bathroom.rating.count;
                    }

                    bathroom.save(function(err) {
                        out.result.ok = (err == null) ? 1 : 0;
                        out.bathroom = bathroom;
                        callback(out);
                    });
                } else {
                    out.result.ok = 0;
                    out.result.text = 'id not found';
                    callback(out);
                }
            });
        } else {
            callback(out);
        }
    };

    exports.removeReview = function(bathroomId, reviewId, callback) {
        // TODO: Null check
        Bathroom.update({ _id: bathroomId }, 
            { $pull: { "rating.reviews": { _id: reviewId } } },
            null, function(err, numAffected) {
                var out = {
                    result: { ok: (err == null) ? 1 : 0 }
                };
                if (out.result.ok) {
                    updateRatingsDocument(bathroomId, null, null, callback);
                } else {
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

function updateRatingsDocument(id, newRating, newText, callback) {
    var out = { result: { ok: 0 } };
    Bathroom.find({ _id: id }, function(err, bathroomsResult) {
        if (bathroomsResult.length == 1) {
            var bathroom = bathroomsResult[0];

            if (newRating != null) {
                bathroom.rating.reviews.push({
                    rating: rating,
                    text: text,
                    date: new Date()
                });
            }

            // Re-calculate avg and count
            bathroom.rating.avg = 0;
            bathroom.rating.count = bathroom.rating.reviews.length;
            if (bathroom.rating.count > 0) {
                for (var i = 0; i < bathroom.rating.reviews.length; i++) {
                    bathroom.rating.avg += bathroom.rating.reviews[i].rating;
                }
                bathroom.rating.avg /= bathroom.rating.count;
            }

            bathroom.save(function(err) {
                out.result.ok = (err == null) ? 1 : 0;
                out.bathroom = bathroom;
                callback(out);
            });
        } else {
            out.result.ok = 0;
            out.result.text = 'id not found';
            callback(out);
        }
    });
}
