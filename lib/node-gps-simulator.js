"use strict";

var geolib = require('geolib');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var poissonprocess = require('poisson-process');
var uuid = require('node-uuid');
var Prob = require('prob.js');
var clusterfck = require('clusterfck');
var coordgenman = require('./coordinate-generator-manager');
var routing = require('./route-provider');
var routeProvider;


EventEmitter.defaultMaxListeners = 500;

//Simulator
function Simulator(options){
    var options = options;
    var _this = this;
    EventEmitter.call(this);
    process.nextTick(function(){
        _this.Initialize(options);
    });
};

util.inherits(Simulator,EventEmitter);


Simulator.prototype.Initialize = function(options){
        var _this = this;
        var _simulatorActive = false;
        _this._nodes = [];
        _this._options = options;
        EventEmitter.call(_this);

        console.log("Initializing simulator");
        var coordmanager;
        coordmanager = (function()
        {
            if(_this._options.CoordinateGeneratorOptions.CustomGenerator == null){
                return new coordgenman(_this._options.CoordinateGeneratorOptions);
            }
            else{
                return _this._options.CustomCoordinateGenerator;
            }
        })();
        _this.CoordinateGeneratorManager = coordmanager;


        var Routing;
        routeProvider = (function(){
            return new routing(_this._options.RouteProviderOptions)
        })();

        //create nodes
        console.log("Generating initial nodes");
        for(var i=0; i < _this._options.SimulatorTypeOptions.startNodeCount; i++)
        {
            _this.createSimNode(_this._options.MovementOptions, _this._options.CoordinateGeneratorOptions);
        }

        _this._nodeEnterHandle = poissonprocess.create(_this._options.SimulatorTypeOptions.arrivalRatePerHour * 60 * 60 * 1000,function() {

            _this.createSimNode(_this._options.MovementOptions,_this._options.CoordinateGeneratorOptions);
            //_this._nodes.push(newSimNode);
        });

        _this._nodeExitHandle = poissonprocess.create(_this._options.SimulatorTypeOptions.exitRatePerHour * 60 * 60 * 1000,function(){
            var node = shift(_this._nodes);
            node.dispose();
        });

        _this.on('start',function(){
            console.log("Attempting startup");

                console.log("Attaching simulator start mechanisms");
                _this._simulatorActive = true;
                _this._nodeEnterHandle.start();
                _this._nodeExitHandle.start();
                _this._clusteringStart();

        });

        _this.on('stop',function(){
            console.log("Attaching simulator stop cleanup mechanism");
            _this._simulatorActive = false;
            _this._nodeExitHandle.stop();
        });
        console.log("Simulator Initialization Complete")
    };

    Simulator.prototype._clusteringStart = function(){
        var _this = this;
        _this._clusterHandle;
        _this._clusterHandle = setInterval(function(){
            var centroids = _this._calculateClusters();
            _this.emit('clusterupdate',centroids);
        },5000);
    };

    Simulator.prototype._calculateClusters = function()
    {
        var _this = this;
        var nodeLocations = [];
        for(var i=0;i<_this._nodes.length;i++)
        {
            var node = _this._nodes[i];
            nodeLocations.push([node._location.latitude, node._location.longitude]);
        }
        var kmeans = new clusterfck.Kmeans();

        var clusters = kmeans.cluster(nodeLocations,10);
        var centroids = kmeans.centroids;
        var mapcentroids = [];
        for(var i=0;i<centroids.length;i++)
        {
            var maxDistance = 0;
            var cent = {'latitude': centroids[i][0], 'longitude': centroids[i][1]};
            for(var j=0; j < clusters[i].length; j++)
            {
                var nodeDistanceFromCentroid = geolib.getDistance(cent,{'latitude': clusters[i][j][0], 'longitude' : clusters[i][j][0]});
                if(nodeDistanceFromCentroid > maxDistance)
                {
                    maxDistance = nodeDistanceFromCentroid ;
                }
            }

            var centroidradius = {
                'latitude' : centroids[i][0],
                'longitude' : centroids[i][1],
                'radius' : maxDistance
            };
            mapcentroids.push(centroidradius);
        }
        return mapcentroids;
    }

    Simulator.prototype.start = function() {
        var _this = this;
        process.nextTick(function(){
            console.log("Starting Simulator");
            _this.emit('start');
        });
    };

    Simulator.prototype.stop = function(){
        console.log("Stopping Simulator");
        _this.emit('stop');
    };

    Simulator.prototype.createSimNode = function(movementOptions, coordinateGeneratorOptions)
    {
        var _this = this;
        var spawnPoint = _this.CoordinateGeneratorManager.generateCoordinates(coordinateGeneratorOptions);
        var updatedCoordinateGeneratorOptions = coordinateGeneratorOptions;
        updatedCoordinateGeneratorOptions.location = spawnPoint;
        var movementOptions = movementOptions;
        //console.log("Creating simnode " + i + "at location (lat:" + spawnPoint.latitude + ", long: " + spawnPoint.longitude + ")");
        var simnode = new simNode(updatedCoordinateGeneratorOptions, movementOptions);
        //console.log("New simnode, id=" + simnode.id);

        _this.emit('newnode',simnode);
        _this.on('start', function(){
            var _thissim = simnode;
            simnode._activateNode();
        });
        _this.on('stop', function(){
            console.log(simnode.id + " is exiting");
            simnode._deactivateNode
        });
        if(_this._simulatorActive)
        {
            simnode._activateNode();
        }
        _this._nodes.push(simnode);
        _this.emit('newnode',simnode);
        return true;
    };



//SimNode Object

function simNode(coordinateGeneratorOptions, movementOptions)
{
    var self = this;
    var _this = this;
    var cgo = coordinateGeneratorOptions;
    var mo = movementOptions;
    EventEmitter.call(_this);
    _this.Initialize(cgo,mo);
};

util.inherits(simNode,EventEmitter);
simNode.prototype.Initialize = function(coordinateGeneratorOptions, movementOptions)
{
    var _this = this;
    _this.id = uuid.v4();
    console.log("Initializing new node (" + _this.id + ")");
    _this._movementHandle;
    _this._location = coordinateGeneratorOptions.location;
    _this._speed; //feet per second
    _this._destination;
    _this._bearing;
    _this._movementOptions = movementOptions;
    _this._coordinateGeneratorOptions = coordinateGeneratorOptions;
    _this._newMovementHandle;

    _this._simCoordinateGenerator = new coordgenman();

    var avgStayLengthMS = movementOptions.avgStayLength * 60 * 60 * 1000

    _this._newMovementHandle = poissonprocess.create(avgStayLengthMS,function(){
        _this._newMovementHandle.stop();
        clearInterval(_this._movementHandle);
        _this._destination = _this._simCoordinateGenerator.generateCoordinates(_this._coordinateGeneratorOptions);

        //Testtting 1 2 3
        // routeProvider.getRoute(_this._location,_this._destination,function(routes){
        //     console.log(routes);
        // });


        console.log(_this.id + ": Moving to new position for " + _this.id);
        console.log(_this.id + ": @ current location:" + _this._location.latitude + "," + _this._location.longitude)
        console.log(_this.id + ": @ new destination:" + _this._destination.latitude + "," + _this._destination.longitude)
        _this._bearing = geolib.getBearing(_this._location,_this._destination);
        console.log(_this.id + ": new bearing:" + _this._bearing);
        var r = Prob.lognormal(movementOptions.avgSpeed, movementOptions.stdDevSpeed);
        _this._speed = r();
        var nodeNextMoveMs = _this._movementOptions.nodeUpdateFrequencyWhileMoving * 1000
        _this._movementHandle = setInterval(function(){
            _this._updateMovementHandler();
        },nodeNextMoveMs);
    });

    _this.on('newPosition',function(location){
        var newOptions = _this._simCoordinateGenerator.getOptions;
        newOptions.location = location;
        _this._simCoordinateGenerator.updateOptions(newOptions);
    })
    console.log("Initializing complete (" + _this.id + ")");
}
simNode.prototype._updateMovementHandler = function()
{
    var _this = this;
    //It could have been they arrived before interval is up, accept this minor error
    var maxDistanceTravel = _this._speed * _this._movementOptions.nodeUpdateFrequencyWhileMoving; //in feet * seconds
    console.log(_this.id + ": Traveled at least " + maxDistanceTravel);
    var curDistanceFromDestinationMeters = geolib.getDistance(_this._location,_this._destination);
    console.log(_this.id + ": is currently " + curDistanceFromDestinationMeters + " meters from target");
    //var curDistanceFromDestinationFeet = geolib.convertUnit('ft',curDistanceFromDestinationMeters);
    var travelDistance = Math.min(maxDistanceTravel,curDistanceFromDestinationMeters);
    console.log(_this.id + ": to travel " + travelDistance);
    _this._location = geolib.computeDestinationPoint(_this._location,travelDistance,_this._bearing);
    console.log(_this.id + ": new location is " + _this._location.latitude + "," + _this._location.longitude);
    //EMIT NEW LOCATION
    _this.emit('newPosition',_this._location)


    //to avoid any errors due to accuracy or precision, check to see if its 15 meters from destination
    if(geolib.isPointInCircle(_this._location,_this._destination,15))
    {
        console.log(_this.id + ": Arrived at " + _this._destination.latitude + "," + _this._destination.longitude + ", stopping simnode");
        clearInterval(_this._movementHandle);
        _this._speed = 0;
        _this._destination = null;
        _this._bearing = null;
        _this._newMovementHandle.start();
    }
    else
    {
        //update speed and location for next call
        var r = Prob.lognormal(_this._movementOptions.avgSpeed, _this._movementOptions.stdDevSpeed);
        _this._speed = r();
        console.log("Setting new speed " + _this._speed);
    }
};

simNode.prototype._activateNode = function()
{
    var _this = this;
    _this._newMovementHandle.start();
    var r = Prob.lognormal(_this._movementOptions.avgSpeed, _this._movementOptions.stdDevSpeed);
    _this._speed = r();
};

simNode.prototype._deactivateNode = function()
{
    _newMovementHandle.stop();
    clearInterval(_this._movementHandle);
};


simNode.prototype.dispose = function()
{
    _this.emit('dispose');

    //TODO: reevaluate remove listeners
    _this.removeAllListeners('newPosition');
};

//Export constructor entrypoint

var createSimulator = function(options)
{
    console.log("Creating new simulator");
    return new Simulator(options);
}

module.exports.createSimulator = createSimulator;