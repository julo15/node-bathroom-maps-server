var winston = require('winston');

module.exports = function() {
    var exports = {};

    exports.createBaseFilename = function() {
        return './logs/' + new Date().toJSON().replace(/:/g, '.');
    };

    exports.createLogger = function(baseFilename) {
        var timestamp = function() {
            return new Date().toJSON();
        };
        var formatter = function(options) {
            return options.timestamp() + ' ' +
                   options.level.toUpperCase() + '\t' +
                   ((undefined !== options.message) ? options.message : '') +
                   ((options.meta && Object.keys(options.meta).length) ? '\n\t' + JSON.stringify(options.meta) : '');
        };
        var logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({
                    handleExceptions: true,
                    humanReadableUnhandledException: true,
                    timestamp: timestamp,
                    formatter: formatter
                })
            ]
        });

        if (baseFilename != null) {
            logger.add(winston.transports.File, {
                    name: 'all-file',
                    filename: baseFilename + '.log',
                    json: false,
                    handleExceptions: true,
                    humanReadableUnhandledException: true,
                    timestamp: timestamp,
                    formatter: formatter
                });

            logger.add(winston.transports.File, {
                    name: 'error-file',
                    filename: baseFilename + '.err',
                    json: false,
                    level: 'error',
                    handleExceptions: true,
                    humanReadableUnhandledException: true,
                    timestamp: timestamp,
                    formatter: formatter
                });
        }
        return logger;
    };

    return exports;
};

function initLogger() {
    var filename = './logs/' + new Date().toJSON().replace(/:/g, '.');
    var timestamp = function() {
        return new Date().toJSON();
    };
    var formatter = function(options) {
        return options.timestamp() + ' ' +
               options.level.toUpperCase() + '\t' +
               ((undefined !== options.message) ? options.message : '') +
               ((options.meta && Object.keys(options.meta).length) ? '\n\t' + JSON.stringify(options.meta) : '');
    };

    // log file
    winston.add(winston.transports.File, {
                    name: 'all-file',
                    filename: filename + '.log',
                    json: false,
                    handleExceptions: true,
                    humanReadableUnhandledExceptions: true,
                    timestamp: timestamp,
                    formatter: formatter
                }
            );

            // err file
    winston.add(winston.transports.File, {
                    name: 'error-file',
                    filename: filename + '.err',
                    json: false,
                    level: 'error',
                    handleExceptions: true,
                    humanReadableUnhandledExceptions: true,
                    timestamp: timestamp,
                    formatter: formatter
                }
            );
}
