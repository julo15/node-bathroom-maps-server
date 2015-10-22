// Import url. Needed to parse query parameters.
var url = require('url');

module.exports.getQueryParameters = function(req) {
    return url.parse(req.url, true /* parseQueryString */).query;
}

module.exports.isNumeric = function(v) {
    return ((v != null) && !isNaN(v));
}
