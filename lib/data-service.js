const {Db, Server, ObjectID}=require("mongodb")
const DataLoader=require("dataloader")
const assert=require("assert")
const config=require("../conf")
const logger=require("./logger")

class DataService{
    static get mongoServer(){
        return new Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }
	constructor(app){
		assert(app && app.apiKey, "DataService must be constructed with apiKey")
		this.app=app
		this._dataLoaders={}
	}

	makeId(){
		return new ObjectID().toHexString()
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


	async collection(...names){
		let db=await new Db(this.app.apiKey, this.constructor.mongoServer,{w:1}).open()
		const conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conns
	}

    async createEntity(Type, doc){
        const conn=await this.collection(Type)
        try{
            doc.createdAt=new Date()
			if(!doc._id)
				doc._id=this.makeId()
            await conn.insertOne(doc)
            return doc
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

	async updateEntity(Type,query,doc){
		const conn=await this.collection(Type)
        try{
            const updatedAt=new Date()
            const isNotSet=Object.keys(doc).find(k=>!k.startsWith('$'))
            if(isNotSet)
                doc.updatedAt=updatedAt
            else if(doc.$set)
                doc.$set.updatedAt=updatedAt
            else
                doc.$set={updatedAt}

            await conn.update(query,doc)
            return updatedAt
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
	}

    async patchEntity(Type, query, $set){
        const conn=await this.collection(Type)
        try{
            $set.updatedAt=new Date()
            await conn.findOneAndUpdate(query,{$set})
            return $set.updatedAt
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async remove1Entity(Type, query){
        const conn=await this.collection(Type)
        try{
            const _id=query._id || (await conn.findOne(query,{_id:1}))._id
            require("./file").resolver(this).Mutation
                .file_clean(null,{host:`${Type}:${_id}`},{app:this})

            const {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async removeEntity(Type, query){
        const conn=await this.collection(Type)
        try{
            const removing=await conn.find(query,{_id:1})
            const ctx={app:this}
            removing.forEach(({_id})=>{
                require("./file").resolver.Mutation
                    .file_clean(null,{host:`${Type}:${_id}`},ctx)
            })
            const {deletedCount}=await conn.remove(query)
            return deletedCount
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async get1Entity(Type, query,projection){
        const conn=await this.collection(Type)
        try{
            return await conn.findOne(query,projection)
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async findEntity(Type, query, filter=cursor=>cursor,projection){
        const conn=await this.collection(Type)
        try{
			const cursor=await filter(conn.find(query,projection))
            return await cursor.toArray()
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

	nextPage(Type,{first:count,after, ...query},filter=a=>a,projection){
		const [createdAt,_id]=(after||":").split(":")
		count=count||20
		if(createdAt){
			query.createdAt={$lte:new Date(parseInt(createdAt))}
		}
		return this.findEntity(Type,query,a=>a.sort([["createdAt",-1]]).limit(count+parseInt(count/2)),projection)
			.then(docs=>{
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
			})
	}

	prevPage(Type,{last:count,before, ...query},filter=a=>a,projection){
		const [createdAt,_id]=(before||":").split(":")
		count=count||20
		if(createdAt){
			query.createdAt={$gte:new Date(parseInt(createdAt))}
		}
		
		return this.findEntity(Type,query,a=>a.sort([["createdAt",-1]]).limit(count+parseInt(count/2)),projection)
			.then(docs=>{
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
			})
	}

	async buildIndexes(indexes){
		const arrayfy=index=>Array.isArray(index) ? index : [index]
		Object.keys(indexes)
			.map(type=>{
				const typeIndexes=indexes[type]
				return this.collection(type)
					.then(conn=>Promise.all(
						typeIndexes.map(arrayfy).map(([{__drop, ...spec},...b])=>{
							return __drop ? conn.dropIndex(spec) : conn.ensureIndex(spec,...b)
						})
					)
						.then(()=>conn.close())
						.catch(()=>conn.close())
					)
			})
	}
}

module.exports=DataService
