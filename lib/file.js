const config=require("../conf")

exports.typeDefs=`
	type File{
		token(key:String): String
		url: String
	}

	extend type Mutation{
		file_connect(type:String!,id:String!, files:[String!]!):Boolean
	}
`

exports.resolver={
	File:  {
		token(_,{key},{app:{apiKey},user:{sessionToken}}){
			const qiniu=require("qiniu")
			const {domain,version}=config
			var policy=Object.assign(new qiniu.rs.PutPolicy(),{
				scope:`${config.qiniu.bucket}${key ? `:${key}` : ''}`,
				expires:config.qiniu.expires,
				callbackUrl:`${domain}/${version}${Main.url}?X-Application-Id=${apiKey}&X-Session-Token=${sessionToken}`,
				callbackBody:"entity=$(x:entity)&crc=$(x:crc)&"+
					"bucket,key,fsize,mimeType,imageInfo".split(',').map((a)=>`${a}=$(${a})`).join('&')
			})
			return {token:policy.token(),expires:policy.expires}
		},
		url({_id}){
			return `${config.qiniu.accessURL}/${_id}`
		}
	},
	Mutation:{
		async file_connect(_,{type,id,files},{app}){
			let conn=app.collection("files")
			try{
				await files.map(_id=>conn.findOneAndUpdate({_id},{$set:{refrence:{type,id}}}))
			}finally{
				conn.close()
			}
		}
	}
}

exports.qiniu=async function({app, user, body:doc}, res){
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
	doc._id=doc.key
	delete doc.key
	doc.createdAt=new Date()
	doc.author=user._id
	let conn=await app.collection("files")
	try{
		await conn.insertOne(doc)
		let d={"url":`${config.qiniu.accessURL}/${doc._id}`, _id:doc._id}
		let result=config.debug ? Object.assign(d,doc) : d
		res.json(d).end()
	}finally{
		conn.close()
	}
}

exports.verify=(req, res, body)=>{
	return req.app
		&& req.user
		&& qiniu.util.isQiniuCallback(req.originalUrl, body.toString(), req.header('Authorization'))
}
