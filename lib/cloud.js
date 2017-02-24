const config=require('../conf')
const ajax=require('./ajax')

function Cloud(){
	var callbacks={},
		functions={},
		wechat={},
		statics=[];


	this.asPlugin=function(){
		var plugin={
			define(url,handler){
				functions[url]=handler
				return this
			},
			wechat: require('./wechat').asCloud(wechat),
			
			static: require('./static').asCloud(statics)
		};

		"before,after".split(",").forEach((a)=>{
			"Create,Update,Remove".split(",").forEach((b)=>{
				plugin[a+b]=function(kind, callback, c){
					c=callbacks[kind]||(callbacks[kind]={})
					c=(c[a+b]||(c[a+b]=[]))
					c.push(callback)
					return plugin
				}
			})
		});
		return plugin
	}

	this.asKindCallback=function(service){
		var kindCallbacks=callbacks[service.kind]||{}, o={}
		"before,after".split(",").forEach((a)=>{
			"Create,Update,Remove".split(",").forEach((b)=>{
				o[a+b]=function(){
					var args=arguments;
					return Promise.all((kindCallbacks[a+b]||[]).map((f)=>f.apply(o,args)))
				}
			})
		})
		return o
	}

	this.asWechat=()=>wechat

	this.asStatic=()=>statics
	
	this.run=function(url, req, res){
		try{
			functions[url](req, res)
		}catch(error){
			res.error(error)
		}
	}
}
 
exports.load=function(service, filename){
	const {app,user}=service
	const cloud=new Cloud()
	const fetch=ajax(app,user)
	const console=config.debug ? global.console : service.console
	
	require("vm").runInNewContext(app.cloudCode, {
		Cloud:Object.freeze(cloud.asPlugin()),
		fetch:Object.freeze(fetch),
		console:Object.freeze(console),
		require:function(file){
			throw new Error("require not supported in cloud")
		},
		exports:null,
		module:null,
		__dirname: null,
		__filename: null,
		root: null
	}, {
		filename:filename,
		displayErrors:false,
		timeout:config.cloud.timeout
	});
	return cloud;
}

exports.compile=function(code){
	new Function("Cloud",code);
}