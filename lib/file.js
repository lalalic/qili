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
			callbackBody:"entity=$(x:entity)&"+
				"bucket,key,fsize,mimeType,imageInfo,year,mon,day,ext".split(',').map((a)=>`${a}=$(${a})`).join('&')
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
	beforePost(doc){
		var doc=querystring.parse(doc)
		if(config.debug)
			console.dir(doc)
		return doc
	},
	afterPost(doc){
		return {url:`${config.qiniu.accessURL}/${doc.key}`}
	},
	isQiniuCallback(req){
		var auth=req.heads['Authorization']
		if(!auth) return false;
		auth=auth.split(/[:\s]/)
		if(auth.length!=3 || auth[0]!="QBox") return false;
		var accessKey=auth[1], secretData=auth[2]
		if(accessKey!=config.qiniu.ACCESS_KEY)
			return false;
		return secretData==qiniu.util.urlsafeBase64Encode(qiniu.util.hmacSha1(req.path+"\n"+req.body, config.qiniu.SECRET_KEY))
	},
	routes:{
		"get token":function(req, res){
			res.send(new this(req, res).uptoken())
		},
		"post": function(req, res){
			console.info("checking qiniu callback")
			if(!this.isQiniuCallback(req))
				return this.error(res)("No hack");
			console.info("is qiniu callback with req body: "+req.body)
			new this(req, res).create(this.beforePost(req.body))
				.then((doc)=>this.send(res, this.afterPost(doc)),this.error(res))
		},
		"get :id?":Super.routes["get :id?"]
	}
})module.exports=Main