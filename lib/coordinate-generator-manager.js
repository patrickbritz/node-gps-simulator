var geolib = require('geolib');

manager = function(options) {};

manager.prototype = {
    generateCoordinates: function(options){
        var _this = this;
        _this._options = options;
        var coords = _this._options.coordinates;
        var radius = _this._options.radius;
        var gentype = _this._options.type;
        switch(gentype)
        {
            case "polar":
                return _this.uniformPolarCoordinateGenerator(coords, radius);
                break;
            case "uniform":
                return _this.uniformCoordinateGenerator(coords, radius);
                break;
            case "halfnormal":
                //not implemented yet
                console.log("half normal");
                break;
        }
        console.log("Couldn't find selected implementation");
    },
    updateOptions: function(options){
        var _this = this;
        _this._options = options;
    },
    getOptions: function(){
        return _this._options;
    },
    uniformPolarCoordinateGenerator: function(coord, radius)
    {
        var dist = Math.random() * radius;
        var degrees = Math.round(Math.random() * 360);
        //var coord = intialCoord;
        var calculatedCoord = geolib.computeDestinationPoint(coord, dist, degrees);
        return calculatedCoord;
    },
    uniformCoordinateGenerator: function(coord, radius)
    {
        var dist = Math.sqrt(Math.random()) * radius;
        var degrees = Math.round(Math.random() * 360);
        var coord = initialCoord;
        var calculatedCoord = geolib.computeDestinationPoint(coord, dist, degrees);
        return calculatedCoord;
    }
};


module.exports = manager;