const Qiniu=require("qiniu")
const URL=require("url")
const multer=require("multer")

const assert=require("assert")
const config=require("../../conf")
const DataService=require("../data-service")

const isNotUrl=a=>a.length>512 || a.indexOf("\r")!=-1 || a.indexOf("\n")!=-1

Qiniu.conf.ACCESS_KEY=config.qiniu.ACCESS_KEY
Qiniu.conf.SECRET_KEY=config.qiniu.SECRET_KEY

function normalizeStorageKey(key, app){
	if(app.bucket?.toLowerCase()===app.apiKey.toLowerCase()){
		return key
	}
	return `${app.apiKey}/${key}`
}

function isLocalStorageName(bucketName){
	return bucketName=="/static"
}

exports.name="file"

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
		file_upload_token(key:String!, host:String):FileToken
		file_exists(key:String!):Boolean
		getFile(key:String!):File
	}
`
exports.indexes={
	File:[
		{crc:1}, {deletable:1}
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
		url({_id,updatedAt},{}, {app}){
			if(isLocalStorageName(app.app.bucket)){
				return `https://${app.app.apiKey}.${app.app.vhost}/${_id}`
			}
			return exports.resolver(app.app).URL.serialize(`${normalizeStorageKey(_id,app.app)}${updatedAt ? `?${updatedAt.getTime()}` : ""}`)
		}
	},
	Query:{
		file_upload_token(_,{key, host},ctx){
			const {app:{app:{apiKey},fileProps=a=>(a||{})},user:{_id:userId}}=ctx
			const bucket=exports.getBucket(ctx.app.app)
			
			if(!host){
				host=`User:${userId}`
			}

			const sessionToken=ctx.app.encode({_id:userId},{expiresIn:'10m'})
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
			return  {
				token: isLocalStorageName(bucket) ? sessionToken : policy.token(),
				id:new DataService.ObjectID().toHexString(), 
				key
			}
		},
		file_exists(_,{key},{app}){
			return app.get1Entity("File",{_id:key}).then(file=>!!file)
		},
		getFile(_,{key},{app}){
			key=normalizeStorageKey(key, app.app)

			if(isLocalStorageName(app.app.bucket)){
				return {_id:key}
			}
			return app.get1Entity("File",{_id:key})
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
				if(!!file.host || file.host=="User:pending"){
					file.host='User:'+user._id
				}	
				let [temp, timeout]=file._id.split("/")
				if(temp==="_temp_" && !isLocalStorageName(app.app.bucket)){
					timeout=parseInt(timeout)||1
					file.deletable=Date.now()+timeout*60*1000
				}
				await app.createEntity("File",{...file,author:user._id})
				return file
			}
		},

		async file_clean(_,{host, filter={host} },{app}){
			try{
				const bucket=exports.getBucket(app.app)
				const removing=(await app.findEntity("File",filter,{_id:1}))
					.map(({_id:key})=>new Qiniu.rs.EntryPath(bucket, normalizeStorageKey(key,app.app)))
				if(removing.length>0){
					new Qiniu.rs.Client().batchDelete(removing,()=>{
						app.removeEntity("File",filter)
						app.logger.info(`${removing.length} temp files removed`)
					})
				}
			}catch(e){
				app.logger.error(`[file clean]: ${e.message}`)
			}
			return true
		}
	}
})

const clearTempFileTimers={}
exports.init=function(app){
	const {app:appEntity, resolver}=app

	clearTempFileTimers[appEntity.apiKey]=setInterval(()=>{
		resolver.Mutation.file_clean?.({},{filter:{deletable:{$lt:Date.now()}}},{app})
	}, 1*60*1000)
	app.logger.info(`cleaner service of temp files is ready`)
}

exports.finalize=function(app){
	const {app:{apiKey}}=app
	clearInterval(clearTempFileTimers[apiKey])
	delete clearTempFileTimers[apiKey]
	app.logger.info(`the cleaner service of temp files is stopped`)
}

//utils
exports.getBucket=function(appEntity){
	return appEntity.bucket||appEntity.apiKey.toLowerCase()
}

exports.createStorage=function(appEntity){
	const bucketName=exports.getBucket(appEntity)
	if(isLocalStorageName(bucketName)){
		return createLocalStorage(bucketName)
	}

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
	if(isLocalStorageName(bucketName)){
		return Promise.reject()
	}

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
	if(isLocalStorageName(bucketName)){
		return Promise.reject()
	}

	const {rpc,conf,util}=Qiniu
	if(normalizeStorageKey("test",appEntity)!="test"){
		return Promise.resolve()
	}

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

function createLocalStorage(bucketName){
	let staticRoot=""
	function getPath(app, key){
		if(!staticRoot){
			staticRoot=[app.app.staticRoot].flat()[0]
		}
		return require("path").resolve(staticRoot,key)
	}

	const resolve=multer({storage:multer.diskStorage({
		destination(req, file, cb){
			const fileName=getPath(req.app, req.body.key)
			const folder=fileName.split("/").reverse().slice(1).reverse().join("/")
			require("fs").mkdirSync(folder,{recursive:true})
			cb(null, folder)
		},
		filename(req, file, cb){
			const [fileName]=req.body.key.split("/").reverse()
			cb(null, fileName)
		}
	})}).single("file")

	function handler(req, res, next){
		resolve(req, res, ()=>{
			if(req.headers['content-type']?.indexOf('multipart')>-1){
				const {key,token}=req.body
				req.body={
					id:"file_create_Mutation",
					variables:{
						_id:key,
						host:"User:pending"
					}
				}
				req.headers['x-session-token']=token
			}
			next(req, res)
		})
	}

	handler.pipe=function({stream, key, app, user}){
		key=normalizeStorageKey(key,app.app)
		const path=getPath(app,key)
		const {mkdirp}=require('mkdirp')
		mkdirp.sync(path.substring(0,path.lastIndexOf("/")))

		stream.pipe(require("fs").createWriteStream(path))
		app.resolver.Mutation.file_create({},{_id:key,host:"User:pending"},{app,user})
		return app.resolver.File.url({_id:key},{},{app})
	}

	return {
		storage: bucketName,
		localStorageHandler: handler,
	}
}
