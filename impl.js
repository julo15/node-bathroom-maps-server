// Import assert. Needed in the global scope for lambdas to access it.
var assert = require('assert');

// Import mongo and init
var mongo = require('mongodb');
var mongoClient = mongo.MongoClient;

// Import mongoose
var mongoose = require('mongoose');
var Bathroom;

// Import logging
var log = require('./log')();

// Import helpers
var helpers = require('./helpers');

// Example mongoUrl: 'mongodb://127.0.0.1:27017/test'
module.exports = function(mongoUrl, baseLogFilename) {
    var exports = {};

    // Init logger
    var logger = log.createLogger(baseLogFilename);

    exports.start = function(callback) {
        // Init mongoose
        mongoose.connect(mongoUrl);
        var db = mongoose.connection;
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function() {
            var bathroomSchema = mongoose.Schema({
                loc: {
                    type: { type: String },
                    coordinates: {
                        type: [Number],
                        default: [0, 0]
                    }
                },
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

            bathroomSchema.index({'loc': '2dsphere'});

            var transform = function(doc, ret, options) {
                ret.lat = ret.loc.coordinates[1];
                ret.lon = ret.loc.coordinates[0];
                delete ret.__v;
                delete ret.loc;
            };

            if (bathroomSchema.options.toObject == null) {
                bathroomSchema.options.toObject = {};
            }
            bathroomSchema.options.toObject.transform = transform;
            if (bathroomSchema.options.toJSON == null) {
                bathroomSchema.options.toJSON = {};
            }
            bathroomSchema.options.toJSON.transform = transform;

            Bathroom = mongoose.model('Bathroom', bathroomSchema);
            callback();
        });
    };

    exports.shutdown = function() {
        mongoose.connection.close();
    };

    exports.getNearbyBathrooms = function(lat, lon, distance, callback) {
        logger.info('BEGIN: getNearbyBathrooms');

        var status = "ok";
        if (!helpers.isNumeric(lat)) {
            status = "latitude invalid";
        } else if (!helpers.isNumeric(lon)) {
            status = "longitude invalid";
        } else if (!helpers.isNumeric(distance)) {
            status = "distance invalid";
        } 

        if (status == "ok") {
            var query = {
                loc: {
                    $near: {
                        $geometry: helpers.create2dSphere(lat, lon),
                        $maxDistance: distance
                    }
                },
                $or: [
                    { pending: { $exists: false }},
                    { pending: false }
                ]
            };
            Bathroom.find(query, function(err, bathroomsResult) {
                doApiCallback((err == null), null, { bathrooms: bathroomsResult }, true, callback);
            });
        } else {
            doFailureApiCallback(status, callback);
        }

       logger.info('END: getNearbyBathrooms');
    };

    exports.getBathrooms = function(pending, callback) {
        logger.info('BEGIN: getBathrooms');

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
            doApiCallback((err == null), null, { bathrooms: bathroomsResult }, true, callback);
        });

       logger.info('END: getBathrooms');
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

            logger.info('BEGIN: addBathroom ' + bathroomParamsToString(lat, lon, name, cat));

            var bathroom = new Bathroom({
                loc: helpers.create2dSphere(lat, lon),
                name: name,
                category: cat,
                pending: pending});

            bathroom.save(function(err, bathroom) {
                doApiCallback((err == null), err, (err == null) ? { bathroom: bathroom } : null, true, callback);
            });

            logger.info('END: addBathroom');
        } else {
            doFailureApiCallback(status, callback);
        }
    };

    exports.removeBathroom = function(id, callback) {
        var status = "ok!";
        if (id != null) {
            logger.info('BEGIN: removeBathroom ' + id);

            Bathroom.remove({ _id: id }, function(err) {
                doApiCallback((err == null), null, null, false, callback);
            });
        } else {
            doFailureApiCallback("no id parameter found", callback);
        }
    };

    exports.modifyBathroom = function(id, lat, lon, name, cat, pending, callback) {
        Bathroom.find({ _id: id }, function(err, bathroomsResult) {
            if (bathroomsResult.length == 1) {
                var bathroom = bathroomsResult[0];
                if ((lat != null) && (lon != null)) {
                    bathroom.loc = helpers.create2dSphere(lat, lon);
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
                    doApiCallback((err == null), err, { bathroom: bathroomResult }, true, callback);
                });
            } else {
                doFailureApiCallback("id not found", callback);
            }
        });
    };

    exports.addReview = function(id, rating, text, callback) {

        if (id == null) {
            doFailureApiCallback('id param missing', callback);
        } else if (!helpers.isNumeric(rating)) {
            doFailureApiCallback('rating param missing or not numeric');
        } else if (text == null) {
            doFailureApiCallback('text param missing');
        }

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
                    doApiCallback((err == null), err, { bathroom: bathroom }, true, callback);
                });
            } else {
                doFailureApiCallback('id not found', callback);
            }
        });
    };

    exports.removeReview = function(bathroomId, reviewId, callback) {
        // TODO: Null check
        Bathroom.update({ _id: bathroomId }, 
            { $pull: { "rating.reviews": { _id: reviewId } } },
            null, function(err, numAffected) {
                if (err == null) {
                    updateRatingsDocument(bathroomId, null, null, callback);
                } else {
                    doFailureApiCallback(err, callback);
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

function sanitizeMongooseResult(doc) {
    // There is a subtle bug with transforms.. Not sure how to explain it yet, but
    // this workaround forces the transform to be applied in stringify, and we
    // get an object that contains the transform after we parse it again.
    return JSON.parse(JSON.stringify(doc));
}

function doApiCallback(success, message, data, sanitize, callback) {
    var out = {
        result: {
            ok: success ? 1 : 0,
        }
    };

    if (message != null) {
        out.result.text = message;
    }

    for (var prop in data) {
        out[prop] = sanitize ? sanitizeMongooseResult(data[prop]) : data[prop];
    }

    callback(out);
}

function doFailureApiCallback(message, callback) {
    doApiCallback(false, message, null, false, callback);
}

function updateRatingsDocument(id, newRating, newText, callback) {
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
                doApiCallback((err == null), err, { bathroom: bathroom }, true, callback);
            });
        } else {
            doFailureApiCallback('id not found', callback);
        }
    });
}
