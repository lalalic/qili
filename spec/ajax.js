var request=require('request'),
	gDefaults={
		method:'get',
		encoding:'utf-8',
		headers:{}
	},
	config=require("./config");

function omit(a){
	var b=Object.assign({},a)
	for(var i=1, len=arguments.length;i<len;i++)
		delete b[arguments[i]]
	return b
}
module.exports=function(){
	var defaults=Object.assign({},gDefaults), AJAX={};
	defaults.headers=Object.assign({},gDefaults.headers,defaults.headers||{})

	function initParams(uri, options, callback) {
		var opts;
		if ((typeof options === 'function') && !callback) callback = options
		if (options && typeof options === 'object') {
			opts = Object.assign({},defaults,omit(options,"dataType,type,data".split(",")));
			opts.headers=Object.assign({},defaults.headers,opts.headers||{})
			options && ajaxSetup(options,opts)
			opts.uri = uri
		} else if (typeof uri === 'string') {
			opts = Object.assign({},defaults,{uri:uri})
		} else {
			opts = Object.assign({}, defaults, uri);
			opts.headers=Object.assign({},defaults.headers,opts.headers||{})
			uri = opts.uri
		}

		return { uri: uri, options: opts, callback: callback }
	}

	function ajaxSetup(options, target){
		target=target||defaults
		if(options.dataType=='json')
			target.json=true;
		if(options.headers)
			Object.assign(target.headers,options.headers)
		if(options.type)
			target.method=options.type.toLowerCase()
		if(options.data && target.json)
			target.json=options.data
		if(options.error)
			target.error=options.error
	}

	function _request(uri,options){
		var params=initParams(uri,options)
		uri=params.uri
		options=params.options
		var errorHandler=options.error

		if(options.json && options.method=='post')
			options.json.__fortest=true

		return new Promise((resolve, reject)=>{
			request(uri, options, function(error, response, body){
				if(error){
					errorHandler && errorHandler(error)
					reject(error.message)
				}else if(response.statusCode>=400){
					var message=body.split("&nbsp;at ")[0]
					errorHandler && errorHandler(new Error(message))
					reject(message)
				}else{
					resolve(body)
				}
			})
		})
	}

	"get,delete,put,post,patch".split(',').forEach(function(key){
		this[key]=function(uri, options, callback){
			var params = initParams(uri, options, callback)
			params.options.method = key.toUpperCase()
			return _request(params.uri || null, params.options, params.callback)
		}
	},AJAX)

	AJAX.ajax=function(options){
		return _request(options.url,options)
	}

	AJAX.fail=failit
	AJAX.ajaxSetup=ajaxSetup

	ajaxSetup({
		async:false,
		dataType:"json",
		headers:{
			"X-Application-Id":config.testApp.apiKey,
			"X-Session-Token":config.testerSessionToken
		},
		error: function(error){
			fail(error.message)
		}
	})
	return AJAX
}

function failit(done,error){
	return (e)=>{fail(error||e);done()}
}
