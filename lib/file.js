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
		file_clean(host:ID!):Boolean
	}
`

exports.resolver={
	File:  {
		url({_id}){
			return `${config.qiniu.accessURL}/${_id}`
		}
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

		file_token(_,{},{app:{app:{apiKey}},user:{sessionToken}}){
			const {PutPolicy}=Qiniu.rs
			const {domain,version, qiniu}=config
			const POLICY={
				scope:`${qiniu.bucket}`,
				expires:qiniu.expires,
				callbackUrl:`${domain}/${version}/file?x-application-id=${apiKey}&x-session-token=${sessionToken}`,
				callbackBody:"entity=$(x:entity)&crc=$(x:crc)&"+
					"bucket,key,fsize,mimeType,imageInfo".split(',').map((a)=>`${a}=$(${a})`).join('&')
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

	doc=await app.createEntity("files", {...doc, _id: doc.key, key:undefined, author:user._id})
	let d={"url":`${config.qiniu.accessURL}/${doc._id}`, _id:doc._id}
	res.json(config.debug ? {...doc,...d} : d).end()
}

exports.verify=(req, res, body)=>{
	assert(req.app, "app can't  be resolved")
	assert(req.user, "user can't be resolve")
	return Qiniu.util.isQiniuCallback(req.originalUrl, body.toString(), req.header('Authorization'))
}
