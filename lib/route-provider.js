var request = require('request');


var Routing = function(options){
    var _this = this;
    _this._options = options;
    _this._routeProvider;
    switch(_this._options.routeProvider)
    {
        case "google":
            _this._routeProvider = new GoogleRoutingProvider();
            break
    }
}

Routing.prototype.setRouteProvider = function(provider)
{
    _this._provider = provider;
}

Routing.prototype.getRoute = function(startpos, endpos, callback)
{
    _this._routeProvider.getRoute(startpos, endpos, callback)
}


GoogleRoutingProvider = function(options)
{
    var _this = this;
    _this._options = options;
    _this._url = 'https://maps.googleapis.com/maps/api/directions/json';
};

GoogleRoutingProvider.prototype.getRoute = function(starpos, endpos, callback)
{
    //payload
    var ospOptions = {
        "origin" : starpos.latitude + ',' + starpos.longitude,
        "destination" : endpos.latitude + ',' + endpos.longitude,
        "mode" : "walking",
        'units' : 'metric'
    }

    var requestParams = Object.keys(ospOptions).map(function(key) {
        return key + '=' + encodeURIComponent([key]);
    }).join('&');

    var requestUrl = _this._url + '?' + requestParams;

    request(requestUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body) // Show the HTML for the Google homepage.
            var transform = _this.transformResults(body);
            callback(transform);
        }
    })
}

GoogleRoutingProvider.prototype.transformResults = function(body)
{
    console.log("transforming results");
    var routes = body['routes'];
    var legs = routes['legs'];
    console.log(legs.count() + 'legs');
    return legs;
}

module.exports = Routing;