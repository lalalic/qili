const {ObjectID}=require("mongodb")
const Qiniu=require("qiniu")
const URL=require("url")

const assert=require("assert")
const config=require("../conf")

const isNotUrl=a=>a.length>512 || a.indexOf("\r")!=-1 || a.indexOf("\n")!=-1

Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY

exports.typeDefs=`
	scalar URL
	type File{
		id:ID!
		url: String
		crc: Int
	}
	type FileToken{
		token: String!
		expires: Int!
		id:String
	}
	extend type Mutation{
		file_create(_id:String!,host:ID!,bucket:String,size:Int,crc:Int,mimeType:String,imageInfo:JSON):File
		file_clean(host:ID!):Boolean
	}

	extend type Query{
		file_upload_token(key:String):FileToken
	}
`

exports.resolver=appEntity=>({
	URL:{
		parseValue(value) {// value from the client
			if(!appEntity.storage)
				return value

			try{
				const {host,pathname}=URL.parse(value)
				if(host && (appEntity.storage==host || URL.parse(appEntity.storage).host==host)){
					return pathname.substr(1)
				}
				return value
			}catch(e){
				return value
			}
		},
		serialize(value) {// value sent to the client
			const storage=appEntity.storage
			if(!storage ||
				!value ||
				isNotUrl(value) ||
				(value.startsWith("http:") || value.startsWith("https:")))
				return value

			if(storage.startsWith("http:") || storage.startsWith("https:")){
				return `${appEntity.storage}/${value}`
			}else{
				return `https://${appEntity.storage}/${value}`
			}
		},
		parseLiteral(ast) {// ast value is always in string format
			if (ast.kind === Kind.INT) {
				return parseInt(ast.value, 10);
			}
			return null;
		}
	},
	File:  {
		id:({_id})=>`files:${_id}`,
		url({_id},_,{app}){
			return exports.resolver(app).URL.serialize(_id)
		}
	},
	Query:{
		file_upload_token(_,{key},ctx){
			const {app:{app:{apiKey}},user:{sessionToken,_id:author}}=ctx
			const bucket=exports.getBucket(ctx.app.app)
			const {PutPolicy}=Qiniu.rs
			const {api,version, qiniu}=config
			const POLICY={
				scope:bucket,
				expires:qiniu.expires,
				callbackUrl:`${api}?x-application-id=${apiKey}&x-session-token=${sessionToken}`,
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

			if(key){
				policy.scope=`${bucket}:${key}`
			}
			return  {token:policy.token(),id:new ObjectID().toHexString()}
		},
	},
	Mutation:{
		async file_create(_,file,{app,user}){
			assert(file._id,"upload file should specify node id")
			let query={_id:file._id}
			let last=await app.get1Entity("files",query)
			if(last){
				file.updatedAt=await app.updateEntity("files",query,file)
				return file
			}else{
				await app.createEntity("files",{...file,author:user._id})
				return file
			}
		},

		async file_clean(_,{host},{app}){
			let bucket=exports.getBucket(app.app)
			let removing=await app.findEntity("files",{host},undefined,{_id:1})
			removing=removing.map(({_id:key})=>Qiniu.rs.deleteOp(bucket,key))
			if(removing && removing.length>0){
				debugger
				new Qiniu.BucketManager(new qiniu.conf.Config())
					.batch(removing, (e,body,info)=>{
						//
					})
			}

			app.removeEntity("files",{host})

			return true
		}
	}
})

exports.getBucket=function(appEntity){
	return appEntity.bucket||appEntity.apiKey.toLowerCase()
}

exports.createStorage=function(appEntity){
	const bucketName=exports.getBucket(appEntity)
	const {rpc,conf,util}=Qiniu
	let requestURI=`${conf.RS_HOST}/mkbucketv2/${util.urlsafeBase64Encode(bucketName)}`
	var token = util.generateAccessToken(requestURI);

	return new Promise((resolve,reject)=>rpc.postWithoutForm(requestURI,token, (error, body, respInfo)=>{
		if(error){
			reject(error)
		}else if (parseInt(respInfo.statusCode / 100) == 2){
			exports.getStorage(appEntity).then(resolve,reject)
		}else{
			reject(new Error("can't create storage"))
		}
	}))
}

exports.getStorage=function(appEntity){
	const bucketName=exports.getBucket(appEntity)
	const {rpc,conf,util}=Qiniu

	return new Promise((resolve,reject)=>{
		const req=require("http").request({
			host: conf.API_HOST.split("//").pop(),
			port:80,
			method:'GET',
			path:`/v6/domain/list?tbl=${bucketName}`,
			headers:{
				Authorization: util.generateAccessToken(`${conf.API_HOST}/v6/domain/list?tbl=${bucketName}`),
			}
		},res=>{
			res.setEncoding('utf-8')
			let resText = ''
			res.on('data', data=>resText += data)
			res.on('end', function() {
				if (res.statusCode != 200) {
					reject(new Error("no storage domain info"))
				} else {
					resolve(JSON.parse(resText)[0])
				}
			})
		})
		.on('error', e=>{
			reject(e)
		})
		req.end()
	})
}

exports.destroyStorage=function(appEntity){
	let bucketName=exports.getBucket(appEntity)
	const {rpc,conf,util}=Qiniu
	let requestURI=`${conf.RS_HOST}/drop/${bucketName}`
	var token = util.generateAccessToken(requestURI);

	return new Promise((resolve,reject)=>rpc.postWithoutForm(requestURI,token,(error, body, respInfo)=>{
		if(error){
			reject(error)
		}else if (parseInt(respInfo.statusCode / 100) == 2){
			resolve()
		}else{
			reject()
		}
	}))
}
