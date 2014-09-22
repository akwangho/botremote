'use strict';

var fs = require('promised-io/fs'),
    assert = require('assert'),
    Return = require('../lib/botremote').Return,
    Logger = require('../lib/botremote').Logger;

var lib = module.exports;

/**
 * Example of asynchronous keyword.
 *
 * You can implement asynchronous keywords just returning an A+ promise.
 * Promise can be resolved or rejected with respectively:
 *
 * - arbitrary return value, or
 * - an instance of `Error` if the keyword failed
 *
 * Just count items in given directory.
 *
 * @param path directory path to count item in.
 */
lib.countItemsInDirectory = function (path) {
    return fs.readdir(path).then(function (items) {
        return items.length;
    });
};
// The doc attribute is used for inspection on the command line of client and doc generation.
// It's optional and defaults to empty string when missing.
lib.countItemsInDirectory.doc = 'Returns the number of items in the directory specified by `path`.';

/**
 * Example of asynchronous keyword with log output.
 *
 * You can implement asynchronous keywords just returning an A+ promise.
 * Promise can be resolved or rejected with respectively:
 *
 * - {Return} Return value consists of return value as the first param and output log as the second param.
 * - arbitrary return value, or
 * - an instance of `Error` if the keyword failed
 *
 * Just count items in given directory.
 *
 * @param path directory path to count item in with output log in robot log.
 */
lib.countItemsInDirectoryWithOutput = function (path) {
    var logger = new Logger();
    logger.info('Start to read directory from path[%s].', path);
    return fs.readdir(path).then(
        function (items) {
            logger.debug('The items: [%s].', items.toString());
            return new Return(items.length, logger.getMsg());
        });
};
// The doc attribute is used for inspection on the command line of client and doc generation.
// It's optional and defaults to empty string when missing.
lib.countItemsInDirectoryWithOutput.doc = 'Returns the number of items in the directory specified by `path` with log output.';

/**
 * Example synchronous keyword.
 *
 * Any keyword which does not return an A+ promise is considered sync.
 * The following are considered successes:
 *
 * - the keyword returns `undefined` (that is doesn't return any value)
 * - the keyword return any other value
 *
 * While any thrown `Error` instance will lead the keyword failure.
 *
 * @param str1
 * @param str2
 */
lib.stringsShouldBeEqual = function (str1, str2) {
    console.log('Comparing \'%s\' to \'%s\'', str1, str2);
    assert.equal(str1, str2, 'Given strings are not equal');
};

/**
 *
 * Example of fail case with log output
 *
 * @returns {Return}
 */
lib.awfulKeyword = function () {
    var logger = new Logger();
    logger.info('Enter awful keyword.');
    logger.warn('Awful thing is going to happen.');
    return new Return('Awful return value', logger.getMsg(), new Error('Error happens because this is an awful keyword'));
};
lib.awfulKeyword.doc = 'This keyword will cause some terrible thing happen, please use this keyword carefully.';


// Run this keyword library if the library itself is called explicitly.
if (!module.parent) {
    var robot = require('../lib/botremote');
    var server = new robot.Server([lib], { host: 'localhost', port: 8270, allowStop: true });
}
