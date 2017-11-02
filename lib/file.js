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

exports.resolver={
	File:  {
		id:({_id})=>`files:${_id}`,
		url:({_id,updatedAt})=>`${config.qiniu.accessURL}/${_id}${updatedAt?'?'+updatedAt.getTime():''}`
	},
	Query:{
		file_upload_token(_,{key},{app:{app:{apiKey}},user:{sessionToken}}){
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
			const getToken=key=>{
				let policy=Object.assign(new PutPolicy(),POLICY)
				if(key){
					policy.scope=`${qiniu.bucket}:${key}`
				}
				return {token:policy.token(),expires:policy.expires,id:new ObjectID().toHexString()}
			}
			return getToken(key)
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
				app.createEntity("files",{...file,author:user._id})
				return file
			}
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
