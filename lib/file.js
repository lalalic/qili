const config=require("../conf")

exports.typeDefs=`
	type File{
		id:ID!
		url: String
		host: ID!
	}
	type FileToken{
		token: String!
		expires: Int!
	}
	extend type Mutation{
		file_link(url:String!, id:ID!, field:String!):Boolean
		file_tokens(count:Int):[FileToken]
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
		file_tokens(_,{count=1},{app:{apiKey},user:{sessionToken}}){
			const {PutPolicy}=require("qiniu").rs
			const {domain,version, qiniu}=config
			const get=()=>{
				let policy=Object.assign(new PutPolicy(),{
					scope:`${qiniu.bucket}`,
					expires:qiniu.expires,
					callbackUrl:`${domain}/${version}/${qiniu}?X-Application-Id=${apiKey}&X-Session-Token=${sessionToken}`,
					callbackBody:"entity=$(x:entity)&crc=$(x:crc)&"+
						"bucket,key,fsize,mimeType,imageInfo".split(',').map((a)=>`${a}=$(${a})`).join('&')
				})
				return {token:policy.token(),expires:policy.expires}
			}
			
			return new Array(count).fill(1).map(a=>get())
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
	return req.app
		&& req.user
		&& qiniu.util.isQiniuCallback(req.originalUrl, body.toString(), req.header('Authorization'))
}
