'use strict';

var xmlrpc = require('xmlrpc'),
    util = require('util'),
    isPromise = require('is-promise');

function Server(libraries, options) {
    this.host = options.host;
    this.port = options.port;
    this.timeout = parseInt(options.timeout, 10) || 10000;

    var keywords = {
        'stopRemoteServer': this.stopRemoteServer
    };

    // Load libraries
    libraries.forEach(function (lib) {
        for (var keywordName in lib) {
            if (lib.hasOwnProperty(keywordName)) {
                var keyword = lib[keywordName];
                // Parameters name for documenting purpose.
                var rawParameters = /\(([\s\S]*?)\)/.exec(keyword.toString())[1];
                keyword.args = rawParameters.length > 0 ? rawParameters.split(/\s*,\s*/) : [];
                if (!keyword.doc) {
                    keyword.doc = '';
                }
                keywords[keywordName] = keyword;
            }
        }
    });
    this.keywords = keywords;

    this.allowStop = options.allowStop === true || false;
    this.server = xmlrpc.createServer(options);

    // Register functions
    var that = this;
    var rpcWrap = function (keyword) {
        return function (method, params, response) {
            params.push(response);
            keyword.apply(that, params);
        };
    };
    this.server.on('get_keyword_names', rpcWrap(this.getKeywordNames));
    this.server.on('run_keyword', rpcWrap(this.runKeyword));
    this.server.on('get_keyword_arguments', rpcWrap(this.getKeywordArguments));
    this.server.on('get_keyword_documentation', rpcWrap(this.getKeywordDocumentation));

    // Register signal handlers.
    var handleSignal = function () {
        process.removeListener('SIGHUP', handleSignal);
        process.removeListener('SIGINT', handleSignal);
        that.allowStop = true;
        that.stopRemoteServer();
    };
    process.on('SIGHUP', handleSignal);
    process.on('SIGINT', handleSignal);

    console.log('Robot Framework remote server starting at ' + this.host + ':' + this.port);
}

module.exports.Server = Server;

Server.prototype.getKeywordDocumentation = function (name, response) {
    response(null, this.keywords[name].doc);
};

Server.prototype.getKeywordArguments = function (name, response) {
    response(null, this.keywords[name].args);
};

Server.prototype.stopRemoteServer = function () {
    var prefix = 'Robot Framework remote server at ' + this.host + ':' + this.port;
    if (this.allowStop) {
        console.log(prefix + ' stopping');
        var that = this;
        that.server.close(function () {
        });
        setTimeout(function () {
            process.kill(process.pid);// Still want to stop if we have open connections.
        }, 2000);
        return true;
    } else {
        console.log(prefix + ' does not allow stopping');
        return false;
    }
};
Server.prototype.stopRemoteServer.doc = 'Stop remote server';
Server.prototype.stopRemoteServer.args = [];

Server.prototype.runKeyword = function (name, params, response) {
    var keyword = this.keywords[name];
    var timeout = null;
    var keywordReturn = function (val) {
        if (timeout === null) {
            return;
        }
        clearTimeout(timeout);
        timeout = null;
        var result = {status: 'PASS', output: '', traceback: '', return: '', error: ''};
        if (val instanceof Error) {
            result.traceback = val.stack.toString();
            result.status = 'FAIL';
            result.error = val.toString();
        } else if (val instanceof Return) {
            result.return = val.return;
            result.output = val.output;
            if (val.error instanceof Error) {
                result.traceback = val.error.stack.toString();
                result.status = 'FAIL';
                result.error = val.error.toString();
            }
        } else {
            result.return = val;
        }
        response(null, result);
    };
    timeout = setTimeout(function () {
        keywordReturn(new Error('Keyword execution got timeout'));
    }, this.timeout);
    var result;
    try {
        result = keyword.apply(this, params);
    } catch (e) {
        // Got sync keyword failure.
        keywordReturn(e);
        return;
    }
    if (isPromise(result)) {
        result.then(keywordReturn, keywordReturn);
    } else {
        // Got sync keyword return.
        keywordReturn(result);
    }
};

Server.prototype.getKeywordNames = function (response) {
    response(null, Object.keys(this.keywords));
};


function Client(options) {
    options.path = '/';
    var client = xmlrpc.createClient(options);
    this.client = client;
    var that = this;
    client.methodCall('get_keyword_names', [], function (err, val) {
        val.forEach(function (keywordName) {
            that[keywordName] = function () {
                var arrayArguments = Array.prototype.slice.call(arguments);
                var cb = arrayArguments.pop();
                var args = [keywordName, arrayArguments];
                client.methodCall('run_keyword', args, cb);
            };
            client.methodCall('get_keyword_arguments', [keywordName], function (err, val) {
                that[keywordName].args = val;
            });
            client.methodCall('get_keyword_documentation', [keywordName], function (err, val) {
                that[keywordName].docs = val;
            });
        });
    });
}

module.exports.Client = Client;

function Return(ret, out, err) {
    this.return = ret;
    this.output = out;
    this.error = err;
}

module.exports.Return = Return;

function Logger() {
    this.helper = function () {
        var args = Array.prototype.slice.call(arguments);
        var level = args.shift();
        var msg = util.format.apply(util, args);
        return '*' + level + ':' + new Date().getTime() + '* ' + msg + '\n';
    };
    this.msg = '';
}

Logger.prototype.trace = function (msg) {
    Array.prototype.unshift.call(arguments, 'TRACE');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.debug = function (msg) {
    Array.prototype.unshift.call(arguments, 'DEBUG');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.info = function () {
    Array.prototype.unshift.call(arguments, 'INFO');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.warn = function (msg) {
    Array.prototype.unshift.call(arguments, 'WARN');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.fail = function (msg) {
    Array.prototype.unshift.call(arguments, 'FAIL');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.html = function (msg) {
    Array.prototype.unshift.call(arguments, 'HTML');
    this.msg += this.helper.apply(this, arguments);
};

Logger.prototype.getMsg = function () {return this.msg};

module.exports.Logger = Logger;