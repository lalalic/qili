var VERSION=require('./service').config.version,
	services={users:'user',roles:'role',plugins:'plugin',classes:'entity'}
/*
	ajax({
		url:"",
		type:"",
		data:"",
		context:false,
		beforeSend: function(xhr, settings){},
		success: function(data,status,xhr){},
		complete: function(xhr, status){},
		error: function(xhr, status, error){}
	})
*/
module.exports= function(app, user){
	function ajax(options){
		var xhr={
				settings:options,
				response:null,
				status:null
			},
			method=(options.type||'get').toLowerCase(),
			url=require('url').parse(options.url),
			path=url.pathname,
			info=path.split("/"),
			i=info.indexOf(VERSION),
			kind=info[++i],
			Service=require('./'+services[kind]),
			service=new Service({application:app,user:user}),
			data=options.data && (typeof(options.data)=='string' ? JSON.parse(options.data) : options.data);
		kind=='classes' && (service.kind=info[++i])
		var p=null;
		switch(method){
		case 'get':
			var query={}, id=info.length-1>i ? info[++i] : null;
			url.query && decodeURI(url.query).split("&").forEach(function(t){
				var d=t.split('=')
				this[d[0]]=d[1]
			},query)
			p=Service.prototype.get.apply(service, Service.parseQuery(id, query))
			p=p.then(function(data){return Service.afterGet(data)})
		break
		case 'post':
			p=service.create(Service.beforePost(data))
			p=p.then(function(data){return Service.afterPost(data)})
			break
		case 'put':
			p=service.update(info[++i],data)
			break
		case 'delete':
			p=service.remove(info[++i])
			break
		case 'patch':
			p=service.patch(info[++i],data)
			break
		default:
			p=Promise.reject(new Error("Not support "+method))
		}
		return new Promise((resolve, reject)=>
			p.then(function(doc){
				xhr.response=doc
				xhr.status='success'
				options.success && options.success.call(options.context,doc,xhr.status,xhr);
				options.complete && options.complete.call(options.context,xhr,xhr.status);
				resolve(doc)
			},function(error){
				xhr.response=error
				xhr.status='error'
				options.error && options.error.call(options.context,xhr,xhr.status,error);
				options.complete && options.complete.call(options.context,xhr,xhr.status);
				reject(error)
			})
		)
	}

	return {
		ajax:ajax,
		get: function(url,options){
			return this.ajax(Object.assign({},options,{type:'get',url:url}))
		}
	}
}
