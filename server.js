var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

var config =require('./conf');

if (false && cluster.isMaster) {
	// Fork workers.
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('death', function (worker) {
		console.log('worker ' + worker.pid + ' died');
	});
} else {
	require("./lib/cloud").support()

	// Worker processes have a http server.
	var express = require('express');
	var app = module.exports.app = express();

	var bodyParser = require("body-parser");

	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended : true}));

	app.use(require('./lib/wechat').resolve())
	app.use(require('./lib/app').resolve())
	app.use(require('./lib/user').resolve())


	if(config.debug){
		//require('express-debug')(app)

		app.use(function(req,res,next){
			res.header({
				"Access-Control-Allow-Headers":"X-Application-Id,Request,X-Requested-With,Content-Type,Accept,X-Session-Token",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE"
			});
			next();
		})
		app.options("*",function(req,res){
			res.send()
		})

		app.use(require("morgan")("dev"));

		app.use("/test",express.static(__dirname+'/test'));
		app.use("/"+config.qiniu.bucket,express.static(__dirname+'/upload/'+config.qiniu.bucket));
	}

	require("./lib/log").init()
	require("./lib/file").init()
	require("./lib/user").init()
	require("./lib/role").init()
	require("./lib/app").init()
	require("./lib/entity").init()

	// Bind to a port
	app.listen(config.server.port, config.server.address);

	app.on('connection', function (socket) {
		socket.setTimeout(config.server.timeout * 1000);
		console.log("server is ready");
	});

	process.on("uncaughtException",function(error){
		console.error(error)
	})
}
