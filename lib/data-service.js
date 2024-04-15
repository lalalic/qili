const DataLoader=require("dataloader")
const {Db, Server, ObjectID}=require("mongodb")
const PasswordlessStore = require('passwordless-nodecache');

const assert=require("assert")
const config=require("../conf")
const logger=require("./logger");
const { EventEmitter } = require("stream");

class DataService extends EventEmitter{
	static ObjectID=ObjectID
	static createPasswordStore(){
		return new PasswordlessStore()
	}

	constructor(app){
		super()
		assert(app && app.apiKey, "DataService must be constructed with apiKey")
		this.app={...app}
		this._dataLoaders={}
	}

	makeId(){
		return new this.constructor.ObjectID().toHexString()
	}

	getDataLoader(Type, f){
		if(!this._dataLoaders[Type]){
			if(!f)
				f=ids=>this.findEntity(Type, {_id:{$in:ids}})
					.then(data=>ids.map(id=>data.find(a=>a._id==id)))
			this._dataLoaders[Type]=new DataLoader(f)
		}
		return this._dataLoaders[Type]
	}

	/**
	 * get data connection for names 
	 * all data operations are on collection
	 */
	collection(...names){
		return {
			insertOne(doc){},
			update(query, doc){},
			findOneAndUpdate(query, patch){},
			deleteOne(query){},
			remove(query){},
			findOne(query){},
			find(query){}
		}
	}

	async createEntity(Type, doc){
        let conn=null
        try{
			conn=await this.collection(Type)
            doc.createdAt=new Date()
			if(!doc._id)
				doc._id=this.makeId()
            await conn.insertOne(doc)
            return doc
        }catch(e){
			logger.error(e.message)
		}finally{
            conn?.close()
        }
    }

	async updateEntity(Type,query,doc){
		let conn=null
        try{
			conn=await this.collection(Type)
            if(Object.keys(doc).find(k=>!k.startsWith('$'))){//has key:value
				doc.updatedAt=new Date()
			}else{
				(doc.$set=doc.$set||{}).updatedAt=new Date()
			}

            await conn.update(query,doc)
            return doc.updatedAt
        }catch(e){
			logger.error(e.message)
		}finally{
            conn?.close()
        }
	}

    async patchEntity(Type, query, patch){
        let conn=null
        try{
			conn=await this.collection(Type)
			if(Object.keys(patch).find(k=>k.startsWith('$'))){//has operator
				(patch.$set=patch.$set||{}).updatedAt=new Date()
			}else{
				patch={$set:{...patch,updatedAt:new Date()}}
			}
            await conn.findOneAndUpdate(query,patch)
            return patch.$set.updatedAt
        }catch(e){
			logger.error(e.message)
		}finally{
            conn?.close()
        }
    }

    async remove1Entity(Type, query){
        let conn=null
        try{
			conn=await this.collection(Type)
            const _id=query._id || (await conn.findOne(query,{_id:1}))._id
            this.resolver.Mutation.file_clean?.({},{host:`${Type}:${_id}`},{app:this})

            const {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }catch(e){
			logger.error(e.message)
			return 0
		}finally{
            conn?.close()
        }
    }

    async removeEntity(Type, query){
        let conn=null
        try{
			conn=await this.collection(Type)
            const removing=await (await conn.find(query,{_id:1})).toArray()
            const ctx={app:this}
            removing.forEach(({_id})=>{
                this.resolver.Mutation.file_clean?.({},{host:`${Type}:${_id}`},ctx)
            })
            const {deletedCount}=await conn.remove(query)
            return deletedCount
        }catch(e){
			logger.error(e.message)
			return 0
		}finally{
            conn?.close()
        }
    }

    async get1Entity(Type, query,projection){
        let conn=null
        try{
			conn=await this.collection(Type)
            return await conn.findOne(query,projection)
        }catch(e){
			logger.error(e.message)
		}finally{
            conn?.close()
        }
    }

    async findEntity(Type, query, projection, filter=cursor=>cursor){
        let conn=null
        try{
			conn=await this.collection(Type)
			const cursor=await filter(conn.find(query,projection))
            return await cursor.toArray()
        }catch(e){
			logger.error(e.message)
			return []
		}finally{
            conn?.close()
        }
    }

	async nextPage(Type,{first:count,after, ...query},projection){
		const [createdAt,_id]=(after||":").split(":")
		count=count||20
		if(createdAt){
			query.createdAt={$lte:new Date(parseInt(createdAt))}
		}
		const docs=await this.findEntity(Type,query,projection,a=>a.sort([["createdAt",-1]]).limit(count+parseInt(count/2)))
	
		let edges=_id ? docs.slice(docs.findIndex(a=>a._id==_id)+1) : docs
		let hasNextPage=false

		if(edges.length>=count){
			edges=edges.slice(0,count)
			hasNextPage=true
		}

		return {
			edges,
			hasNextPage,
			hasPreviousPage:!!_id
		}
	}

	async prevPage(Type,{last:count,before, ...query},projection){
		const [createdAt,_id]=(before||":").split(":")
		count=count||20
		if(createdAt){
			query.createdAt={$gte:new Date(parseInt(createdAt))}
		}
		
		const docs=await this.findEntity(Type,query,projection,a=>a.sort([["createdAt",-1]]).limit(count+parseInt(count/2)))
			
		let edges=_id ? docs.slice(0,docs.findIndex(a=>a._id==_id)) : docs
		let hasPreviousPage=false

		if(edges.length>=count){
			edges=edges.slice(edges.length-count)
			hasPreviousPage=true
		}
		return {
			edges,
			hasPreviousPage,
			hasNextPage:!!_id,
		}
	}

	async buildIndexes(indexes){
		const arrayfy=index=>Array.isArray(index) ? index : [index]
		Object.keys(indexes)
			.map(async type=>{
				const typeIndexes=indexes[type]
				let conn=null
				try{
					conn=await this.collection(type)
					await Promise.all(
						typeIndexes.map(arrayfy).map(([{__drop, ...spec},...b])=>{
							return __drop ? conn.dropIndex(spec) : conn.ensureIndex(spec,...b)
						})
					)
				}catch(e){
					console.error(e.message)
				}finally{
					conn?.close()
				}
			
			})
	}
}

class MongoDataService extends DataService{
    static get mongoServer(){
        return new Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }
	
	async collection(name){
		try{
			const db=await new Db(
				(name=="User" && this.app.userApiKey) || this.app.apiKey,
				this.constructor.mongoServer,
				{w:1}
			).open()
			const conn=db.collection(name)
			conn.close=()=>db.close()
			return conn
		}catch(e){
			throw new Error(`[db.${this.app.apiKey}.${name}]: ${e.message}`)
		}
	}
}

module.exports=MongoDataService