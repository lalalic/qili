function Cloud(){
	var callbacks={},
		functions={},
		wechat={};


	this.asPlugin=function(){
		var plugin={
			define(url,handler){
				functions[url]=handler
				return this
			},
			wechat: require('./wechat').asCloud(wechat)
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

	this.asWechat=()=>{
		return wechat
	}

	this.run=function(url, req, res){
		try{
			functions[url](req, res)
		}catch(error){
			console.error(error)
			res.error(error)
		}
	}
}

exports.load=function(service, filename){
	var app=service.app,
		user=service.user,
		cloud=new Cloud(),
		parentRequire=require,
		thisLoadedShare={},
		ajax=require('./ajax'),
		Module=require('module');

	require("vm").runInNewContext(app.cloudCode, {
		Cloud:cloud.asPlugin(),
		console: service.console,
		require: function(path){
			if(!Module.isShareModule(path))
				throw new Error(path+" module is not found.")

			if(path=='ajax')
				return ajax(app,user)

			if(thisLoadedShare[path])
				return thisLoadedShare[path];

			if(!sharedModules[path])
				parentRequire(path);
			var m={exports:{}};
			sharedModules[path] && sharedModules[path](m.exports,parentRequire,m)

			if(path=='backbone')
				m.exports.ajax=ajax(app).ajax
			return thisLoadedShare[path]=m.exports
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

var sharedModules={}, config=require('../conf')

/**
Hacked nodejs module, how to replace it with public API?
sharedModule is transformed to function(exports,require,module){...//raw module content}
to make sharedModule as function to dyamically create private functions for any cloudcode

can "strict mode" to make global shared module unwritable to replace this hacker?
*/
exports.support=function(){
	var Module=require("module")
	Module.isShareModule=function(path){
		return config.sharedModules.indexOf(path)!==-1
	}

	var _resolveFilename=Module._resolveFilename,
		sharedModulesPath={};
	Module._resolveFilename=function(request){
		var path=_resolveFilename.apply(this,arguments)
		if(Module.isShareModule(request) && !sharedModules[request]){
			sharedModulesPath[path]=request;
		}
		return path
	}

	var __compile=Module.prototype._compile
	Module.prototype._compile=function(content, filename){
		var r=__compile.apply(this,arguments), request=sharedModulesPath[filename];
		if(request && Module.isShareModule(request) && !sharedModules[request]){
			console.log("loaded shared "+request)
			delete sharedModulesPath[filename];
			sharedModules[request]=new Function("exports,require,module",content.replace(/^\#\!.*/, ''))
		}
		return r
	}
}
