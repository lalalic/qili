"use strict"
var qiniu=require("qiniu"),
	config=require("../conf"),
	Super=require("./entity"),
	querystring=require('querystring');

class Main extends Super{
	constructor(req, res){
		super(req, res)
		this.policy={
			scope:config.qiniu.bucket,
			expires:config.qiniu.expires,
			callbackUrl:`${config.domain}/${config.version}${Main.url}?X-Application-Id=${this.app.apiKey}&X-Session-Token=${req.header('X-Session-Token')}`,
			callbackBody:"entity=$(x:entity)&crc=$(x:crc)&"+
				"bucket,key,fsize,mimeType,imageInfo".split(',').map((a)=>`${a}=$(${a})`).join('&')
		}
	}

	get kind(){return "files"}

	uptoken(){
		var policy=Object.assign(new qiniu.rs.PutPolicy(),this.policy)
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
		if(doc.entity)
			doc.entity=JSON.parse(doc.entity)
		"fsize,crc".split(",").each((a)=>doc[a]=parseInt(doc[a]))
		return doc
	},
	verify(res, req, body, enpcoding){
		var auth=req.header('Authorization'),
			path=req.originalUrl;
		console.dir({path,body,auth})
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
			res.send(new this(req, res).uptoken())
		},
		"post": function(req, res){
			new this(req, res).create(this.beforePost(req.body))
				.then((doc)=>this.send(res, this.afterPost(doc)),this.error(res))
		},
		"get :id?":Super.routes["get :id?"]
	}
})module.exports=Main