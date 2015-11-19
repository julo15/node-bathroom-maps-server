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

        new Promise(function(resolve, reject) {
            if (!helpers.isNumeric(lat)) {
                throw new Error("latitude invalid");
            }
            if (!helpers.isNumeric(lon)) {
                throw new Error("longitude invalid");
            }
            if (!helpers.isNumeric(distance)) {
                throw new Error("distance invalid");
            } 

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
                err ? reject(err) : resolve({ bathrooms: bathroomsResult });
            });
        })
        .then(function(data) {
            doSuccessApiCallback(data, true, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(error, callback);
        });

       logger.info('END: getNearbyBathrooms');
    };

    exports.getBathrooms = function(pending, callback) {
        logger.info('BEGIN: getBathroomsPromise');

        new Promise(function(resolve, reject) {
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
                err ? reject(err) : resolve({ bathrooms: bathroomsResult });
            });
        })
        .then(function(bathroomsResult) {
            doSuccessApiCallback(bathroomsResult, true /* sanitize */, callback);
        })
        .catch(function(err) {
            doFailureApiCallback(err, callback);
        });

       logger.info('END: getBathroomsPromise');
    };

    exports.addBathroom = function(lat /* float */, lon /* float */, name, cat, pending /* bool */, callback) {

        new Promise(function(resolve, reject) {
            if (!helpers.isNumeric(lat)) {
                throw new Error("latitude invalid");
            }
            if (!helpers.isNumeric(lon)) {
                throw new Error("longitude invalid");
            }
            if (name == null) {
                throw new Error("no name found");
            }
            if (cat == null) {
                throw new Error("no cat found");
            }

            logger.info('BEGIN: addBathroom ' + bathroomParamsToString(lat, lon, name, cat));

            var bathroom = new Bathroom({
                loc: helpers.create2dSphere(lat, lon),
                name: name,
                category: cat,
                pending: pending});

            bathroom.save(function(err, bathroom) {
                err ? reject(err) : resolve({ bathroom: bathroom });
            });
        })
        .then(function(data) {
            doSuccessApiCallback(data, true /* sanitize */, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(error, callback);
        });
    };

    exports.removeBathroom = function(id, callback) {
        new Promise(function(resolve, reject) {
            if (id != null) {
                logger.info('BEGIN: removeBathroom ' + id);

                Bathroom.remove({ _id: id }, function(err) {
                    err ? reject(err) : resolve();
                });
            } else {
                throw new Error("no id parameter found");
            }
        })
        .then(function() {
            doSuccessApiCallback(null, false, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(error, callback);
        });
    };

    exports.modifyBathroom = function(id, lat, lon, name, cat, pending, callback) {
        // Find the bathroom
        return findBathroom(id)
        // Update the bathroom and save
        .then(function(bathroom) {
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

            return new Promise(function(resolve, reject) {
                bathroom.save(function(err, bathroomResult) {
                    err ? reject(err) : resolve({bathroom: bathroomResult});
                });
            });
        })
        .then(function(data) {
            doSuccessApiCallback(data, true, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(error, callback);
        });
    };

    exports.addReview = function(id, rating, text, callback) {
        // First validate the parameters
        return new Promise(function(resolve, reject) {
            if (id == null) {
                throw new Error('id param missing');
            }
            if (!helpers.isNumeric(rating)) {
                throw new Error('rating param missing or not numeric');
            }
            if (text == null) {
                throw new Error('text param missing');
            }
            resolve();
        })
        // Then find the bathroom
        .then(function() {
            return findBathroom(id);
        })
        // Add the review and update the review average
        .then(function(bathroom) {
            console.log('line1');
            bathroom.rating.reviews.push({
                rating: rating,
                text: text,
                date: new Date()
            });

            return updateBathroomRatingAverage(bathroom);
        })
        .then(function(bathroom) {
            doSuccessApiCallback({ bathroom: bathroom }, true, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(error, callback);
        });
    };

    exports.removeReview = function(bathroomId, reviewId, callback) {
        // Remove the review
        new Promise(function(resolve, reject) {
            Bathroom.update({ _id: bathroomId }, 
                { $pull: { "rating.reviews": { _id: reviewId } } },
                null, function(err, numAffected) {
                    err ? reject(err) : resolve(bathroomId);
                });
        })
        // Find the bathroom
        .then(function(bathroomId) {
            return findBathroom(bathroomId);
        })
        // Update the review average
        .then(function(bathroom) {
            return updateBathroomRatingAverage(bathroom);
        })
        .then(function(bathroom) {
            doSuccessApiCallback({ bathroom: bathroom }, true, callback);
        })
        .catch(function(error) {
            doFailureApiCallback(err, callback);
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

function createApiReturn(success, message, data, sanitize) {
    console.log('before api return');
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
    console.log('after api return');
    return out;
}

function doApiCallback(success, message, data, sanitize, callback) {
    var out = createApiReturn(success, message, data, sanitize);
    callback(out);
}

function doSuccessApiCallback(data, sanitize, callback) {
    doApiCallback(true, null, data, sanitize, callback);
}

function doFailureApiCallback(message, callback) {
    doApiCallback(false, message, null, false, callback);
}

function findBathroom(bathroomId) {
    return new Promise(function(resolve, reject) {
        Bathroom.find({ _id: bathroomId }, function(err, bathroomsResult) {
            if (bathroomsResult.length === 1) {
                resolve(bathroomsResult[0]);
            } else {
                reject(new Error('id not found'));
            }
        });
    });
}

function updateBathroomRatingAverage(bathroom) {
    return new Promise(function(resolve, reject) {
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
            err ?  reject(err) : resolve(bathroom);
        });
    });
}
