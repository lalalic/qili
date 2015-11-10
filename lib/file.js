"use strict"
var qiniu=require("qiniu"),
	config=require("../conf"),
	Super=require("./entity"),
	querystring=require('querystring');

class Main extends Super{
	get kind(){return "files"}

	uptoken(sessionToken, key){
		var policy=Object.assign(new qiniu.rs.PutPolicy(),{
			scope:`${config.qiniu.bucket}${key ? `:${key}` : ''}`,
			expires:config.qiniu.expires,
			callbackUrl:`${config.domain}/${config.version}${Main.url}?X-Application-Id=${this.app.apiKey}&X-Session-Token=${sessionToken}`,
			callbackBody:"entity=$(x:entity)&crc=$(x:crc)&"+
				"bucket,key,fsize,mimeType,imageInfo".split(',').map((a)=>`${a}=$(${a})`).join('&')
		})
		return {token:policy.token(),expires:policy.expires}
	}
}

Object.assign(Main,{
	url:"/files",
	init(){
		Super.init.apply(this,arguments)
		qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
		qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY
	},
	afterPost(doc){
		var d={"url":`${config.qiniu.accessURL}/${doc.key}`, _id:doc._id}
		return config.debug ? Object.assign(d,doc) : d
	},
	beforePost(doc){
		if(doc.entity){
			try{
				doc.entity=JSON.parse(doc.entity)
			}catch(e){
				delete doc.entity
			}
		}else {
			delete doc.entity
		}

		"fsize,crc".split(",").forEach((a)=>{
			try{
				doc[a] ? (doc[a]=parseInt(doc[a])) : delete doc[a]
			}catch(e){
				delete doc[a]
			}
		})
		return doc
	},
	verify(req, res, body, enpcoding){
		var auth=req.header('Authorization'),
			path=req.originalUrl;

		if(req.method=='POST'
			&& auth
			&& path==`/${config.version}${Main.url}`
			&& req.query['X-Application-Id']
			&& req.query['X-Session-Token']){
			if(!qiniu.util.isQiniuCallback(path, body.toString(), auth))
				throw new Error("not valid upload callback")
		}
		return true
	},
	routes:{
		"get token":function(req, res){
			res.send(new this(req, res).uptoken(req.header('X-Session-Token'), req.query.key))
		},
		"post": function(req, res){
			new this(req, res).create(this.beforePost(req.body))
				.then((doc)=>this.send(res, this.afterPost(doc)),this.error(res))
		},
		"get :id?":Super.routes["get :id?"]
	}
})module.exports=Main