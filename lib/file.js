const {ObjectID}=require("mongodb")
const Qiniu=require("qiniu")

const assert=require("assert")
const config=require("../conf")

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
		file_upload_token(host:ID, path:String, justToken:Boolean):FileToken
	}
`

exports.resolver={
	URL:{
		parseValue(value) {
			if(value.startsWith(config.qiniu.accessURL)){
				value=value.substr(config.qiniu.accessURL.length)
				if(value[0]=='/')
					value=value.substr(1)
				value=value.split("?")[0]
			}
			return value// value from the client
		},
		serialize(value) {
			if(!value.startsWith(config.qiniu.accessURL))
				return `${config.qiniu.accessURL}/${value}`
				
			return value; // value sent to the client
		},
		parseLiteral(ast) {
			if (ast.kind === Kind.INT) {
				return parseInt(ast.value, 10); // ast value is always in string format
			}
			return null;
		}
	},
	File:  {
		id:({_id})=>`files:${_id}`,
		url:({_id,updatedAt})=>`${config.qiniu.accessURL}/${_id}${updatedAt?'?'+updatedAt.getTime():''}`
	},
	Query:{
		file_upload_token(_,{host,path, justToken},{app:{app:{apiKey}},user:{sessionToken,_id:author}}){
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

			if(justToken){
				return  policy.token()
			}
			
			return (()=>{
				let ret={}

				if(!host){
					host=`users:${author}`
				}
				
				if(host.indexOf(":")==-1){//types
					ret.id=`${host}:${new ObjectID().toHexString()}`
					host=ret.id
				}
				
				let key=`${apiKey}/${host}/${path||new ObjectID().toHexString()}`.replace(/\:/g,"/")

				policy.scope=`${qiniu.bucket}:${key}`
				
				ret.token=policy.token()

				return ret
			})();
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
