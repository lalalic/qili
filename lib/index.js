Object.assign(Object.prototype,{
	forEach(f,context){//support iterate keys
		Object.keys(this).forEach((k)=>f.call(context, this[k], k))
	}
})
var config =require('../conf');
require("./cloud").support()

var express = require('express');
var app = module.exports.app = express.Router();
var bodyParser = require("body-parser");
var multipart=require('connect-multiparty')

;(function debug(){
	if(!config.debug)
		return;

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

	app.use("/test",express.static(__dirname+'/test'));
	app.use("/"+config.qiniu.bucket,express.static(__dirname+'/upload/'+config.qiniu.bucket));
})();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true, verify: require('./file').verify}));
app.use(multipart())

app.use(require('./wechat').resolve(app, config))
app.use(require('./app').resolve())
app.use(require('./user').resolve())

require("./log").init()
require("./file").init()
require("./user").init()
require("./role").init()
require("./app").init()
require("./entity").init()

// Bind to a port
var server=express()
server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000);
})

server.use("/"+config.version,app)

process.on("uncaughtException",function(error){
	console.info(new Date())
	console.dir(error,{depth:null})
})
/**
* @Todo:
log is not thread-safe
*/