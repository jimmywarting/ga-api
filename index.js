/*  Google analytics API acees with concurrency limiting and retry + caching built in.  */
var googleapis  = require('googleapis'),
    crypto = require('crypto'),
    OAuth2      = googleapis.auth.OAuth2,
    _ = require('lodash'),
    fs = require('fs'),
    compactObject = function(o) {
        var clone = _.clone(o);
        _.each(clone, function(v, k) {
            if(!v) {
                delete clone[k];
            }
        });
        return clone;
    },

    //  For caching - generates a file name based on parameters
    getCacheFileName = function(args){
        //  Remove auth info
        var fnArgs = _.clone(args),
            shasum = crypto.createHash('sha1'),
            fileName;
        delete fnArgs.auth;
        fileName = JSON.stringify(fnArgs);
        shasum.update(fileName);
        return cacheDir + shasum.digest('hex');
    },

    //  Execuates a ga query, or returns cache if available
    gaExecuteQuery = function(args, callback, cache, retryCount){
        retryCount = retryCount || 0;
        concurrentUp();
        googleapis.analytics('v3').data.ga.get(args, function(err, result) {
            concurrentDown();
            if(err) {
                //  403 error: we probably just need to wait 1 sec...
                if(err.code === 403) {
                    setTimeout(function(){
                        if(retryCount < concurrentMaxRetry) {
                            retryCount += 1;
                            gaExecuteQuery.apply(this, [args, callback, cache, retryCount]);
                        } else {
                            //  Give up
                            return callback(err);
                        }
                    }, concurrentDelay);
                    return;
                } else {
                    return callback(err);
                }
            }
            
            //  Cache the response, if caching is on
            if(cache ) {
                var fileName = getCacheFileName(args);
                fs.writeFileSync(fileName, JSON.stringify(result), {encoding: "utf8"});
            }

            callback(null, result);
        });
    },
    //  Concurrency limiting, GA default is 10 concurrent connections
    concurrentLimit = 10,
    concurrentDelay = 1000,
    concurrentMaxRetry = 3,
    concurrentQueries = 0,
    concurrentUp = function(){
        concurrentQueries += 1;
    },
    concurrentDown = function(){
        concurrentQueries -= 1;
        //  Execute any queries
        if(queryQueue.length > 0) {
            gaExecuteQuery.apply(this, queryQueue.shift());
        }
    },
    queryQueue = [],
    gaQuery = function() {
        if(concurrentQueries < concurrentLimit) {
            gaExecuteQuery.apply(this, arguments);
        } else {
            var args = Array.prototype.slice.call(arguments);
            queryQueue.push(args);
        }
    },

    // Caching is off by default - to enable 15 mins caching: cache = 15 * 1000 * 60;
    cache = 0,
    cacheDir = process.env.TMPDIR;

module.exports = function(args, callback, settings){
    if(settings) {
        cache = typeof settings.cache !== 'undefined'? settings.cache: cache;
        cacheDir = typeof settings.cacheDir !== 'undefined'? settings.cacheDir: cacheDir;
        concurrentLimit = typeof settings.concurrentLimit !== 'undefined'? settings.concurrentLimit: concurrentLimit;
        concurrentDelay = typeof settings.concurrentDelay !== 'undefined'? settings.concurrentDelay: concurrentDelay;
        concurrentMaxRetry = typeof settings.concurrentMaxRetry !== 'undefined'? settings.concurrentMaxRetry: concurrentMaxRetry;
    }

    var jwt = new googleapis.auth.JWT(
            args.email,
            args.key,
            null,
            ['https://www.googleapis.com/auth/analytics.readonly']
        ),
        oauth2Client = new OAuth2(
            args.clientId,
            null,
            'postmessage'
        ),
        sessionFile = cacheDir + "ga-runner-" + args.email.replace(/[^a-zA-Z\-]/gi, "_"),
        authorize = function(authCallback) {
            fs.readFile(sessionFile, {encoding: "utf8"}, function(err, result) {
                //  If the file was read successfully
                if(!err) {
                    //  If we cannot parse the file
                    try {
                        var json = JSON.parse(result);
                        //  If session is still valid
                        if(new Date(json.expiry_date) > Date.now()) {
                            return authCallback(null, json);
                        }
                    } catch(e) {}
                }
                concurrentUp();
                jwt.authorize(function(err, result){
                    concurrentDown();
                    fs.writeFile(sessionFile, JSON.stringify(result));
                    authCallback.apply(this, arguments);
                });
            });
        };

    //  Check we have required values
    _.each(['ids', 'startDate', 'endDate', 'metrics'], function(value, key){
        if(!args[value]) {
            callback("Missing argument for " + value);
            return false;
        }
    })

    //  Make sure we are authorized, then make request
    authorize(function(err, result) {
        if(err) {
            callback(err);
        } else {
            oauth2Client.setCredentials({
                access_token: result.access_token,
                refresh_token: result.refresh_token
            });

            // https://developers.google.com/analytics/devguides/reporting/core/dimsmets
            // https://developers.google.com/analytics/devguides/reporting/core/v3/coreDevguide
            var gaArgs = compactObject({
                "ids": args.ids,
                "start-date": args.startDate,
                "end-date": args.endDate,
                "metrics": args.metrics,
                "filters": args.filters,
                'dimensions': args.dimensions,
                "max-results": args.maxResults,
                sort: args.sort,
                auth: oauth2Client
            });

            //  Load the cached response, if caching is on
            if(cache) {
                var fileName = getCacheFileName(gaArgs),
                    stats;

                fs.readFile(fileName, "utf8", function(err, data){
                    if(!err) {
                        stats = fs.statSync(fileName);
                        if(stats.isFile() && (stats.birthtime >= ((new Date()).getTime() - cache))) {
                            return callback(null, JSON.parse(data));
                        }
                    }
                    gaQuery(gaArgs, callback, cache);
                });
            } else {
                gaQuery(gaArgs, callback);
            }
        }
    });
};