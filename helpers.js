// Import url. Needed to parse query parameters.
var url = require('url');

module.exports.getQueryParameters = function(req) {
    return url.parse(req.url, true /* parseQueryString */).query;
}

module.exports.isNumeric = function(v) {
    return ((v != null) && !isNaN(v));
}

module.exports.create2dSphere = function(lat, lon) {
    return {
        type: "Point",
        coordinates: [lon, lat]
    };
}

module.exports.are2dSpheresEqual = function(loc1, loc2) {
    return (
        (loc1.type == "Point") &&
        (loc2.type == "Point") &&
        (loc1.coordinates[0] == loc2.coordinates[0]) &&
        (loc1.coordinates[1] == loc2.coordinates[1])
    );
}
