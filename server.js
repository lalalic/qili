Object.assign(Object.prototype,{
	forEach(f,context){
		Object.keys(this).forEach((k)=>f.call(context, this[k], k))
	}
})
var config =require('./conf');
require("./lib/cloud").support()

var express = require('express');
var app = module.exports.app = express.Router();
var bodyParser = require("body-parser");

(function debug(){
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

{//make ObjectID transparent for code
	var ObjectID=require('mongodb').ObjectID
	ObjectID.prototype.toString=function(){return this.toHexString()}

	app.use(bodyParser.json({reviver:function(key,value){
		try{
			return key==='_id' ? ObjectID(value) : value
		}catch(e){
			return value
		}
	}}));
}
app.use(bodyParser.urlencoded({extended : true, verify: require('./lib/file').verify}));


app.use(require('./lib/wechat').resolve())
app.use(require('./lib/app').resolve())
app.use(require('./lib/user').resolve())

require("./lib/log").init()
require("./lib/file").init()
require("./lib/user").init()
require("./lib/role").init()
require("./lib/app").init()
require("./lib/entity").init()

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
