const {Db, Server, ObjectID}=require("mongodb")
const DataLoader=require("dataloader")
const assert=require("assert")
const config=require("../conf")

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
		let conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conns
	}

    async createEntity(Type, doc){
        let conn=await this.collection(Type)
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
		let conn=await this.collection(Type)
        try{
            let updatedAt=new Date()
            let isNotSet=Object.keys(doc).find(k=>!k.startsWith('$'))
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
        let conn=await this.collection(Type)
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
        let conn=await this.collection(Type)
        try{


            let _id=query._id || (await conn.findOne(query,{_id:1}));
            require("./file").resolver(this).Mutation
                .file_clean(null,{host:`${Type}:${_id}`},{app:this})



            let {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async removeEntity(Type, query){
        let conn=await this.collection(Type)
        try{

            let removing=await conn.find(query,{_id:1})
            let ctx={app:this}
            removing.forEach(({_id})=>{
                require("./file").resolver.Mutation
                    .file_clean(null,{host:`${Type}:${_id}`},ctx)
            })



            let {deletedCount}=await conn.remove(query)
            return deletedCount
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async get1Entity(Type, query,projection){
        let conn=await this.collection(Type)
        try{
            return await conn.findOne(query,projection)
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

    async findEntity(Type, query, filter=cursor=>cursor,projection){
        let conn=await this.collection(Type)
        try{
			let cursor=await filter(conn.find(query,projection))
            return await cursor.toArray()
        }catch(e){
			logger.error(e)
		}finally{
            conn.close()
        }
    }

	nextPage(Type,{first:count,after},filter=a=>a,projection){
		const [createdAt,_id]=(after||":").split(":")
		count=count||20
		return this.findEntity(Type,{},cursor=>{
			let filtered=cursor.sort([["createdAt",-1]]).limit(count+parseInt(count/2))
			if(createdAt){
				filtered=filtered.filter({createdAt:{$lte:new Date(parseInt(createdAt))}})
			}
			return filter(filtered)
		},projection)
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

	prevPage(Type,{last:count,before},filter=a=>a,projection){
		const [createdAt,_id]=(before||":").split(":")
		count=count||20
		return this.findEntity(Type,{},cursor=>{
			let filtered=cursor.sort([["createdAt",-1]]).limit(count+parseInt(count/2))
			if(createdAt){
				filtered=filtered.filter({createdAt:{$gte:new Date(parseInt(createdAt))}})
			}
			return filter(filtered)
		},projection)
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
				let typeIndexes=indexes[type]
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
