const {ObjectID}=require("mongodb")
const Qiniu=require("qiniu")

const assert=require("assert")
const config=require("../conf")

Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY

exports.typeDefs=`
	type File{
		id:ID!
		url: String
		host: ID!
	}
	type FileToken{
		token: String!
		expires: Int!
		id:String
	}
	extend type Mutation{
		file_link(url:String!, id:ID!, field:String!):Boolean
		file_token:FileToken
		file_create(_id:ObjectID!,host:ID!,bucket:String,size:Int,crc:Int,mimeType:String,imageInfo:JSON):File
		file_clean(host:ID!):Boolean
	}
`

exports.resolver={
	File:  {
		id:({_id})=>`files:${_id}`,
		url:({_id})=>`${config.qiniu.accessURL}/${_id}`
	},
	Mutation:{
		file_link(_,{url, id, field},{app,user}){
			let [file_id]=url.split("/").pop().split("?")
			let [cols, target_id]=id.split(":")
			return Promise.all([
				field ? app.patchEntity(cols,{_id:target_id},{author:user._id,[field]:url}) : Promise.resolve(),
				app.patchEntity("files", {_id:file_id}, {host:id})
			]).then(()=>true)
		},
		
		file_create(_,file,{app,user}){
			assert(file._id,"upload file should specify node id")
			app.createEntity("files",{...file,author:user._id})
			return file
		},

		file_token(_,{},{app:{app:{apiKey}},user:{sessionToken}}){
			const {PutPolicy}=Qiniu.rs
			const {domain,version, qiniu}=config
			const POLICY={
				scope:`${qiniu.bucket}`,
				expires:qiniu.expires,
				callbackUrl:`${domain}/${version}/graphql?x-application-id=${apiKey}&x-session-token=${sessionToken}`,
				callbackBody:JSON.stringify({
					id:"file_create_Mutation",
					variables:{
						_id:"$(key)",
						host:"$(x:id)",
						crc:0,
						bucket:"$(bucket)",
						size:1,
						mimeType:"$(mimeType)",
						imageInfo:2
					}
				}).replace("0","$(crc)").replace("1","$(fsize)").replace("2","$(imageInfo)"),
				callbackBodyType:"application/json"
			}
			let policy=Object.assign(new PutPolicy(),POLICY)
			return {token:policy.token(),expires:policy.expires,id:new ObjectID().toHexString()}
		},

		async file_clean(_,{host},{app}){
			let conn=app.collection("files")
			try{
				await conn.remove({host})
				return true
			}finally{
				conn.close()
			}
		}
	}
}

exports.qiniu=async function({app, user, body:doc}, res){
	assert(doc._id, "upload file should specify node id")

	"fsize,crc".split(",").forEach((a)=>{
		try{
			doc[a] ? (doc[a]=parseInt(doc[a])) : delete doc[a]
		}catch(e){
			delete doc[a]
		}
	})

	doc=await app.createEntity("files", {...doc, author:user._id})
	let d={"url":`${config.qiniu.accessURL}/${doc._id}`}
	res.json(config.debug ? {...doc,...d} : d).end()
}

exports.verify=(req, res, body)=>{
	assert(req.app, "app can't  be resolved")
	assert(req.user, "user can't be resolve")
	return Qiniu.util.isQiniuCallback(req.originalUrl, body.toString(), req.header('Authorization'))
}
