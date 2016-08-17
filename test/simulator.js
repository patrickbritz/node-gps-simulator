var expect  = require("chai").expect;
var simulator = require("../lib/node-gps-simulator.js");

describe("creating a new simulator",function(){
    it("create a new simulator with default options",function(){
        options = {
            "SimulatorTypeOptions" : {
                "type": "dynamic", //fixed or dynamic
                "startNodeCount": 150,
                "arrivalRatePerHour": 25,
                "exitRatePerHour": 25
            },
            "CoordinateGeneratorOptions" : {
                "type" : "polar",
                "radius" : 300,
                "coordinates" : {
                    "latitude" : 8.02564545,
                    "longitude" : 40.5465545
                }
            },
            "SimCoordinateGeneratorOptions" : {
                "type" : "polar",
                "radius" : 5
            },
            "MovementOptions" : {
                "nodeUpdateFrequencyWhileMoving": 30, //seconds
                "avgStayLength": 2, //2 hours
                "avgSpeed": 1.6, //1 mph
                "stdDevSpeed": .8,
                "arrivalDistance" : 15 //meters
            },
            "Units" : "metric"
        };
        var wtc7location = { latitude: 40.7134, longitude: 74.0120};
        options.CoordinateGeneratorOptions.location = wtc7location;
        var newsim = simulator.createSimulator(options);
        expect("true").to.equal("true");
    });
});