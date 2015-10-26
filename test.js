var impl = require('./impl')('mongodb://127.0.0.1:27017/unittest');

var idToRemove;
var reviewIdToRemove;

var lat = 45;
var lon = 145;
var name = "Worst bathroom";
var cat = "Fake category";

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

exports.testAddBathroom = {

    setupTest: function(test) {
        test.expect(3);

        impl.clearDatabase(function(result) {
            test.ok(result == true, 'Check clearDatabase result');

            impl.getBathrooms(false /* pending */, function(result) {
                test.ok(result.result.ok == 1, 'Check getBathrooms succeeds');
                test.ok(result.bathrooms.length == 0, 'Check bathrooms list is empty');
                test.done();
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
            test.ok(bathroom.lat == lat);
            test.ok(bathroom.lon == lon);
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
                test.ok(bathroom.lat == lat);
                test.ok(bathroom.lon == lon);
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
        var lat = 50;
        var lon = 100;
        var name = "Pending bathroom";
        var cat = "Public";

        // Add a pending bathroom. Remember that there is already an active bathroom in the db.
        impl.addBathroom(lat, lon, name, cat, true, function(result) {
            test.ok(result.result.ok == 1, 'Check addBathroom pending succeeds');
            
            var bathroom = result.bathroom;
            test.ok(bathroom.lat == lat);
            test.ok(bathroom.lon == lon);
            test.ok(bathroom.name == name);
            test.ok(bathroom.category == cat);
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

            impl.getBathrooms(false, function(result) {
                test.ok(result.result.ok);
                test.equal(result.bathrooms.length, 1);

                var bathroom = result.bathrooms[0];
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
                    if (bathroom._id.equals(idToRemove)) {
                        found = true;

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
        console.log("ADD BATHROOM RESULT HELPER");
        console.log(result);
        var addBathroomSucceeded = (result.result.ok == 1);

        console.log('addBathroomSucceeded = ' + addBathroomSucceeded);
        console.log('expectSuccess = ' + expectSuccess);
        test.ok(addBathroomSucceeded == expectSuccess, 'Check addBathroom succeed/failure');

        console.log('DONE WITH OK TEST HELPER!');
        
        if (addBathroomSucceeded && expectSuccess) {
            var bathroom = result.bathroom;
            test.ok(bathroom.lat == lat);
            test.ok(bathroom.lon == lon);
            test.ok(bathroom.name == name);
            test.ok(bathroom.category == cat);

            impl.getBathrooms(false , function(result) {
                console.log("GET BATHROOM RESULT:");
                console.log(result);

                test.ok(result.result.ok == 1, 'Check getBathroom succeeds (after add)');
                test.ok(result.bathrooms.length == 1, 'Check bathroom list is length 1');

                var bathroom = result.bathrooms[0];
                test.ok(bathroom.lat == lat);
                test.ok(bathroom.lon == lon);
                test.ok(bathroom.name == name);
                test.ok(bathroom.category == cat);

                test.done();
            });
        } else {
            console.log("DONE!!!");
            test.done();
        }
    });
}
