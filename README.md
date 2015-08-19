# ga-api

Google Analytics API access, with automated concurrency limiting and optional request caching.

## Installation

```
npm install ga-api --save
```

## Features

* Concurrent requests limiting (GA allows 10 by default, and we retry on 403s)
* Caching of requests (optional and configurable)
* Loosely based on [this](https://www.npmjs.com/package/ga-analytics).

<blockquote>
	Note: you'll need to setup a google service account here:
	https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount
	in order to use this library, and have access to google analytics reporting.
</blockquote>

## Authenticating

Before using the library, setup the [google service account](https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount) as described in the link, then grab the following information:

* clientId: "[CLIENTID].apps.googleusercontent.com"
* email: "[CLIENTID]@developer.gserviceaccount.com" - you must add a [service email here](https://www.google.com/analytics/web/), for the correct view.
* key: "[PATH/TO/PRIVATE.KEY.FILENAME].pem", as [described here](https://www.npmjs.com/package/ga-analytics)
* ids: The view ID(s), eg: "ga:[VIEWID]"

You can find the client ID and Email in the google developers console here (after creating it):

![alt text](https://raw.githubusercontent.com/jsguy/ga-api/master/instructions/clientid.jpg "Client ID and email")

And the view ID in the google analytics console here:

![alt text](https://raw.githubusercontent.com/jsguy/ga-api/master/instructions/viewid.jpg "View ID")

So you end up with something like:

```javascript
var options = {
  clientId: "clientidisalongandseeminglyrandomstringofcharacters.apps.googleusercontent.com",
  email: "clientidisalongandseeminglyrandomstringofcharacters@developer.gserviceaccount.com",
  key: "google-service-private-key.pem",
  ids: "ga:12345678"
};
```

## Usage

```javascript
gaApi(args, callBack, settings)
```

Where:

* args - all the authentication settings plus query parameters
* callBack - a function that can take an `error` and a `result` argument
* settings - an optional settings object where you can override the default settings


### args

* startDate - (YYYY-MM-DD), eg: 2015-05-21
* endDate - (YYYY-MM-DD), eg: 2015-05-28
* metrics - any metric to include, eg: "ga:session"
* filters - any filtering you wnat, eg: "ga:pagePath=~/Home"
* dimensions - any dimensions you like, eg: "ga:source"
* maxResults - maximum number of results to return, eg: 100
* startIndex - offset to start from to allow paging, eg: 1, 101
* sort - what to sort by, eg: "ga:source"

The args must also include the Authentication information from above, ie: clientId, email, key and ids.


### callBack

This function receives an error object and the resulting data from your query, i.e:

```javascript
function(error, result) {
    if(error) throw error;
    //	Do something with result here
}
```

### settings

The settings can optionally override some deafult settings, these include:

* cache - time in ms for caching requests, default is 0, ie: no cache
* cacheDir - directory to save the cache - uses system temp dir by default (process.env.TMPDIR)
* concurrentLimit - maximum concurrent requests - default is 10 (which is what Google set by default)
* concurrentDelay - how long to delay if we get a 403 error, default is 1000ms
* concurrentMaxRetry - how many times to retry after a 403 error - default is 3


## Example

```javascript
var options = {...authentication info from above...},
	gaApi = require('ga-api');

gaApi(_.extend({}, options, {
	startDate: "2015-06-03",
	endDate: "2015-06-10",
	dimensions: "ga:affiliation,ga:date",
	metrics: "ga:revenuePerTransaction"
}), function(err, data) {
	console.log(data);
});
```

The resulting data will look something like this:

```javascript
{ kind: 'analytics#gaData',
  id: 'https://www.googleapis.com/analytics/v3/data/ga?ids=ga:XXXXXXXX&dimensions=ga:affiliation,ga:date&metrics=ga:revenuePerTransaction&sort=ga:affiliation&start-date=2015-06-03&end-date=2015-06-10',
  query:
   { 'start-date': '2015-06-03',
     'end-date': '2015-06-10',
     ids: 'ga:XXXXXXXX',
     dimensions: 'ga:affiliation,ga:date',
     metrics: [ 'ga:revenuePerTransaction' ],
     sort: [ 'ga:affiliation' ],
     'start-index': 1,
     'max-results': 1000 },
  itemsPerPage: 1000,
  totalResults: 32,
  selfLink: 'https://www.googleapis.com/analytics/v3/data/ga?ids=ga:XXXXXXXX&dimensions=ga:affiliation,ga:date&metrics=ga:revenuePerTransaction&sort=ga:affiliation&start-date=2015-06-03&end-date=2015-06-10',
  profileInfo:
   { profileId: 'XXXXXXXX',
     accountId: 'XXXXXXXX',
     webPropertyId: 'UA-XXXXXXXX-2',
     internalWebPropertyId: 'XXXXXXXX',
     profileName: 'Web data',
     tableId: 'ga:XXXXXXXX' },
  containsSampledData: false,
  columnHeaders:
   [ { name: 'ga:affiliation',
       columnType: 'DIMENSION',
       dataType: 'STRING' },
     { name: 'ga:date', columnType: 'DIMENSION', dataType: 'STRING' },
     { name: 'ga:revenuePerTransaction',
       columnType: 'METRIC',
       dataType: 'CURRENCY' } ],
  totalsForAllResults: { 'ga:revenuePerTransaction': '123.456' },
  rows:
   [ [ 'SOURCE1', '20150603', '12.34' ],
     [ 'SOURCE1', '20150604', '56.78' ],
     [ 'SOURCE2', '20150603', '90.12' ],
     [ 'SOURCE2', '20150604', '34.56' ],
     [ 'SOURCE3', '20150603', '78.90' ],
     [ 'SOURCE3', '20150605', '12.34' ],
}
```
So essentially the "rows" attribute of the data object will have what you want.

<blockquote>
	Note: See this page:
	
  https://ga-dev-tools.appspot.com/query-explorer/
	
  for examples of how to use dimensions and metrics and create a report, and:

  https://developers.google.com/analytics/devguides/reporting/core/dimsmets
  
  for examples of dimensions and metrics
</blockquote>
