var helpers = require('./helpers');
var impl = require('./impl')('mongodb://127.0.0.1:27017/unittest', null);

var idToRemove;
var reviewIdToRemove;

var id2;

var lat = 45;
var lon = 145;
var name = "Worst bathroom";
var cat = "Fake category";

// distance is 3373km
var lat2 = 50;
var lon2 = 100;
var name2 = "Pending bathroom";
var cat2 = "Public";

var reviews = [
    {
        rating: 3,
        text: "This bathroom is okay"
    },
    {
        rating: 5,
        text: "This bathroom ROCKS!"
    }
];

exports.testBathrooms = {

    setupTest: function(test) {
        test.expect(3);

        impl.clearDatabase(function(result) {
            test.ok(result == true, 'Check clearDatabase result');
            impl.start(function() {
                impl.getBathrooms(false /* pending */, function(result) {
                    test.ok(result.result.ok == 1, 'Check getBathrooms succeeds');
                    test.ok(result.bathrooms.length == 0, 'Check bathrooms list is empty');
                    test.done();
                });
            });
        });
    },

    addFirst: function(test) {
        debugger;

        impl.addBathroom(lat, lon, name, cat, false, function(result) {
            console.log("ADD BATHROOM RESULT");
            console.log(result);
            test.ok(result.result.ok == 1, 'Check addBathroom succeeds');
            
            var bathroom = result.bathroom;
            test.equal(bathroom.lat, lat);
            test.equal(bathroom.lon, lon);
            test.ok(bathroom.name == name);
            test.ok(bathroom.category == cat);
            test.ok(bathroom.rating != null, 'Check added bathroom has rating element');
            test.ok(bathroom.rating.count == 0, 'Check added bathroom has 0 review count');
            test.ok(bathroom.rating.avg == 0, 'Check added bathroom has 0 review avg');

            impl.getBathrooms(false , function(result) {
                console.log("GET BATHROOM RESULT:");
                console.log(result);

                test.ok(result.result.ok == 1, 'Check getBathroom succeeds (after add)');
                test.ok(result.bathrooms.length == 1, 'Check bathroom list is length 1');

                var bathroom = result.bathrooms[0];
                console.log(bathroom.lat);
                console.log(lat);
                test.equal(bathroom.lat, lat);
                test.equal(bathroom.lon, lon);
                test.ok(bathroom.name == name);
                test.ok(bathroom.category == cat);
                test.ok(bathroom.rating.count == 0);
                test.ok(bathroom.rating.reviews.length == 0);

                idToRemove = bathroom._id;

                test.done();
            });
        });
    },

    addNullLat: function(test) {
        testAddBathroomHelper(test, null, 45, "Foo", "Bar", true, false);
    },
    addStringLon: function(test) {
        testAddBathroomHelper(test, "asdf", 45, "Foo", "Bar", true, false);
    },
    addNullName: function(test) {
        testAddBathroomHelper(test, 50, 45, null, "Bar", true, false);
    },
    addNullCat: function(test) {
        testAddBathroomHelper(test, 50, 45, "Foo", null, true, false);
    },

    addPending: function(test) {
        // Add a pending bathroom. Remember that there is already an active bathroom in the db.
        impl.addBathroom(lat2, lon2, name2, cat2, true, function(result) {
            test.ok(result.result.ok == 1, 'Check addBathroom pending succeeds');

            console.log('FOFOFOFOOF');
            console.log(result);
            
            var bathroom = result.bathroom;
            console.log(bathroom.loc);
            console.log(typeof bathroom);
            id2 = bathroom._id;
            test.equal(bathroom.lat, lat2);
            test.equal(bathroom.lon, lon2);
            test.ok(bathroom.name == name2);
            test.ok(bathroom.category == cat2);
            test.ok(bathroom.reviews == null);

            // Check that active bathroom count equals 1
            impl.getBathrooms(false, function(result) {
                test.ok(result.result.ok);
                test.equal(result.bathrooms.length, 1);

                // Check that active + pending bathroom count equals 2
                impl.getBathrooms(true, function(result) {
                    test.ok(result.result.ok);
                    test.equal(result.bathrooms.length, 2);
                    test.done();
                });
            });
        });
    },

    reviewSuccess: function(test) {

        impl.addReview(idToRemove, reviews[0].rating, reviews[0].text, function(result) {
            test.equal(result.result.ok, 1);
            test.equal(result.bathroom.lat, lat);

            impl.getBathrooms(false, function(result) {
                test.ok(result.result.ok);
                test.equal(result.bathrooms.length, 1);

                var bathroom = result.bathrooms[0];
                test.equal(bathroom.lat, lat);
                //test.ok(bathroom.rating.reviews.length == 0, 'Check review does not get returned in getBathrooms');
                test.ok(bathroom.rating.reviews.length == 1);
                test.ok(bathroom.rating.reviews[0].rating == reviews[0].rating);
                test.ok(bathroom.rating.reviews[0].text == reviews[0].text);
                test.equal(bathroom.rating.avg, reviews[0].rating);
                test.equal(bathroom.rating.count, 1);

                impl.addReview(idToRemove, reviews[1].rating, reviews[1].text, function(result) {
                    test.equal(result.result.ok, 1);
                    impl.getBathrooms(false, function(result) {
                        test.ok(result.result.ok);
                        test.equal(result.bathrooms.length, 1);

                        var bathroom = result.bathrooms[0];
                        test.ok(bathroom.rating.reviews.length == 2);
                        test.ok(bathroom.rating.reviews[1].rating == reviews[1].rating);
                        test.ok(bathroom.rating.reviews[1].text == reviews[1].text);
                        test.equal(bathroom.rating.avg, (reviews[0].rating + reviews[1].rating) / 2);
                        test.equal(bathroom.rating.count, 2);

                        reviewIdToRemove = bathroom.rating.reviews[1]._id;

                        test.done();
                    });
                });
            });
        });
    },

    reviewRemove: function(test) {

        impl.removeReview(idToRemove, reviewIdToRemove, function(result) {
            test.equal(result.result.ok, 1, 'Check removeReview succeeded');

            impl.getBathrooms(true, function(result) {
                test.ok(result.result.ok);
                test.equal(result.bathrooms.length, 2, 'Check review was removed');

                var found = false;
                for (var i = 0; !found && (i < result.bathrooms.length); i++) {
                    var bathroom = result.bathrooms[i];
                    if (bathroom._id.toString() === idToRemove.toString()) {
                        found = true;

                        test.equal(bathroom.lat, lat);
                        test.equal(bathroom.lon, lon);
                        test.equal(bathroom.rating.reviews.length, 1, 'Check reviews array is length 1');
                        test.equal(bathroom.rating.reviews[0].rating, reviews[0].rating, 'Check review rating is correct');
                        test.equal(bathroom.rating.count, 1, 'Check rating count');
                        test.equal(bathroom.rating.avg, reviews[0].rating, 'Check rating avg');
                        console.log(bathroom);
                    }
                }

                test.ok(found, 'Ensuring we found the bathroom that had its review removed');
                test.done();
            });
        });
    },

    modifyPending: function(test) {
        impl.modifyBathroom(idToRemove, null, null, null, null, false, function(result) {
            console.log(result);
            test.equal(result.result.ok, 1);
            test.equal(result.bathroom.pending, false);
            test.equal(result.bathroom.name, name);
            test.equal(result.bathroom.lat, lat);
            test.equal(result.bathroom.lon, lon);
            test.equal(result.bathroom.category, cat);
            test.done();
        });
    },

    modifyNull: function(test) {
        impl.modifyBathroom(null, 123, 123, "name", "cat", false, function(result) {
            test.equal(result.result.ok, 0);
            test.done();
        });
    },

    modifyPendingTrue: function(test) {
        impl.modifyBathroom(idToRemove, null, null, null, null, true, function(result) {
            console.log(result);
            test.equal(result.result.ok, 1);
            test.equal(result.bathroom.pending, true);
            test.equal(result.bathroom.name, name);
            test.equal(result.bathroom.lat, lat);
            test.equal(result.bathroom.lon, lon);
            test.equal(result.bathroom.category, cat);
            test.done();
        });
    },

    modifyName: function(test) {
        var modifiedName = "Best name";
        impl.modifyBathroom(idToRemove, null, null, modifiedName, null, null, function(result) {
            console.log('MODIFYNAME');
            console.log(result);
            test.equal(result.result.ok, 1);
            test.equal(result.bathroom.pending, true);
            test.equal(result.bathroom.name, modifiedName);
            test.equal(result.bathroom.lat, lat);
            test.equal(result.bathroom.lon, lon);
            test.equal(result.bathroom.category, cat);
            test.done();
        });
    },

    getNearbyBathroomsTest: function(test) {
        impl.modifyBathroom(idToRemove, null, null, null, null, false, function(result) {
            test.equal(result.result.ok, 1);
            test.ok(result.bathroom != null);
            test.ok(result.bathroom._id.toString() === idToRemove.toString());
            test.equal(result.bathroom.pending, false);

            impl.getNearbyBathrooms(44.999, 144.999, 150, function(result2) {
                console.log(result2);
                test.equal(result2.result.ok, 1);
                test.equal(result2.bathrooms.length, 1, 'Ensure only one nearby bathroom returned');
                test.ok(result2.bathrooms[0]._id.toString() === idToRemove.toString(), 'Ensure id1 was returned');

                impl.getNearbyBathrooms(44.999, 144.999, 4000000, function(result3) {
                    test.equal(result3.result.ok, 1);
                    test.equal(result3.bathrooms.length, 1, 'Ensure the pending bathromo was filtered out');

                    impl.modifyBathroom(id2, null, null, null, null, false, function(result4) {
                        test.equal(result4.result.ok, 1);
                        test.ok(result4.bathroom != null);
                        test.ok(result4.bathroom._id.toString() === id2.toString());
                        test.equal(result4.bathroom.pending, false);
                        
                        impl.getNearbyBathrooms(44.999, 144.999, 4000000, function(result5) {
                            test.equal(result5.result.ok, 1);
                            test.equal(result5.bathrooms.length, 2, 'Ensure both nearby bathrooms returned');
                            test.ok(result5.bathrooms[0]._id.toString() === idToRemove.toString(), 'Ensure id1 was returned');
                            test.ok(result5.bathrooms[1]._id.toString() === id2.toString(), 'Ensure id2 was returned');
                            test.done();
                        });
                    });
                });
            });
        });
    },

    removeNull: function(test) {
        impl.removeBathroom(null, function(result) {
            test.equal(result.result.ok, 0);
            test.done();
        });
    },

    removeNotFound: function(test) {
        impl.removeBathroom("asdf", function(result) {
            test.equal(result.result.ok, 0);
            test.done();
        });
    },

/*
    removeBathroom: function(test) {
        impl.removeBathroom(idToRemove, function(result) {
            test.equal(result.result.ok, 1);
            impl.getBathrooms(true, function(result) {
                test.equal(result.result.ok, 1);
                test.equal(result.bathrooms.length, 1);
                test.done();
            });
        });
    },
*/
    cleanupTest: function(test) {
        impl.shutdown();
        test.done();
    }
};

function testAddBathroomHelper(test, lat, lon, name, cat, admin, expectSuccess) {
    impl.addBathroom(lat, lon, name, cat, true, function(result) {
        var addBathroomSucceeded = (result.result.ok == 1);

        test.ok(addBathroomSucceeded == expectSuccess, 'Check addBathroom succeed/failure');
        
        if (addBathroomSucceeded && expectSuccess) {
            var bathroom = result.bathroom;
            test.equals(bathroom.lat, lat);
            test.equals(bathroom.lon, lon);
            test.ok(bathroom.name == name);
            test.ok(bathroom.category == cat);

            impl.getBathrooms(false, function(result) {
                console.log("GET BATHROOM RESULT:");
                console.log(result);

                test.ok(result.result.ok == 1, 'Check getBathroom succeeds (after add)');
                test.ok(result.bathrooms.length == 1, 'Check bathroom list is length 1');

                var bathroom = result.bathrooms[0];
                test.equal(bathroom.lat, lat);
                test.equal(bathroom.lon, lon);
                test.ok(bathroom.name == name);
                test.ok(bathroom.category == cat);

                test.done();
            });
        } else {
            test.done();
        }
    });
}
