const Qiniu=require("qiniu")
const URL=require("url")

const assert=require("assert")
const config=require("../conf")
const DataService=require("./data-service")

const isNotUrl=a=>a.length>512 || a.indexOf("\r")!=-1 || a.indexOf("\n")!=-1

Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY

function normalizeStorageKey(key, app){
	if(app.bucket?.toLowerCase()===app.apiKey.toLowerCase()){
		return key
	}
	return `${app.apiKey}/${key}`
}

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
		key: String,
		id:String
	}
	extend type Mutation{
		file_create(_id:String!,host:ID!,bucket:String,size:Int,crc:Int,mimeType:String,imageInfo:JSON):File
		file_clean(host:ID!):Boolean
	}

	extend type Query{
		file_upload_token(key:String):FileToken
		file_exists(key:String!):Boolean
	}
`
exports.indexes={
	File:[
		{crc:1}
	],
}
exports.resolver=appEntity=>({
	URL:{
		parseValue(value) {// value from the client
			if(!appEntity.storage)
				return value

			try{
				const {host,pathname,search}=URL.parse(value)
				if(host && (appEntity.storage==host || URL.parse(appEntity.storage).host==host)){
					return pathname.substr(1)+(search||"")
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
				return `${storage}/${value}`
			}else{
				return `https://${storage}/${value}`
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
		id:require("./schema").ID,
		url({_id,updatedAt},{app}){
			return exports.resolver(appEntity).URL.serialize(`${normalizeStorageKey(_id,app.app)}${updatedAt ? `?${updatedAt.getTime()}` : ""}`)
		}
	},
	Query:{
		file_upload_token(_,{key, host},ctx){
			const {app:{app:{apiKey},fileProps=a=>({})},user:{_id:userId, sessionToken}}=ctx
			const bucket=exports.getBucket(ctx.app.app)
			
			if(!host){
				host=`User:${userId}`
			}

			const {PutPolicy}=Qiniu.rs
			const {api, qiniu}=config
			const POLICY={
				scope:bucket,
				expires:qiniu.expires,
				callbackUrl:`${api}?x-application-id=${apiKey}&x-session-token=${sessionToken}`,
				callbackBody:JSON.stringify({
					id:"file_create_Mutation",
					variables:{
						_id:`${key}`,
						host:`${host}`,
						crc:-99999999,
						bucket:`${bucket}`,
						size:-99999998,
						mimeType:"$(mimeType)",
						imageInfo:-99999997,
						...fileProps({key}),
					}
				}).replace("-99999999","$(crc)").replace("-99999998","$(fsize)").replace("-99999997","$(imageInfo)"),
				callbackBodyType:"application/json"
			}

			let policy=Object.assign(new PutPolicy(),POLICY)

			if(key){
				key=normalizeStorageKey(key,ctx.app.app)
				policy.scope=`${bucket}:${key}`
			}
			return  {token:policy.token(),id:new DataService.ObjectID().toHexString(), key}
		},
		file_exists(_,{key},{app}){
			return app.get1Entity("File",{_id:key})
				.then(file=>!!file)
		}
	},
	Mutation:{
		async file_create(_,file,{app,user}){
			assert(file._id,"upload file should specify node id")
			const query={_id:file._id}
			const last=await app.get1Entity("File",query)
			if(last){
				file.updatedAt=await app.patchEntity("File",query,file)
				return file
			}else{
				if(!!file.host){
					file.host='User:'+user._id
				}	
				await app.createEntity("File",{...file,author:user._id})
				return file
			}
		},

		async file_clean(_,{host},{app}){
			const bucket=exports.getBucket(app.app)
			let removing=await app.findEntity("File",{host},{_id:1})
			removing=removing.map(({_id:key})=>Qiniu.rs.deleteOp(bucket,normalizeStorageKey(key,app.app)))
			if(removing && removing.length>0){
				debugger
				new Qiniu.BucketManager(new qiniu.conf.Config())
					.batch(removing, (e,body,info)=>{
						//
					})
			}

			app.removeEntity("File",{host})

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
	const requestURI=`${conf.RS_HOST}/mkbucketv2/${util.urlsafeBase64Encode(bucketName)}`
	const token = util.generateAccessToken(requestURI);

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
					resolve(JSON.parse(resText).pop())
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
