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

	getDataLoader(type, f){
		if(!this._dataLoaders[type]){
			if(!f)
				f=ids=>this.findEntity(type, {_id:{$in:ids}})
					.then(data=>ids.map(id=>data.find(a=>a._id==id)))
			this._dataLoaders[type]=new DataLoader(f)
		}
		return this._dataLoaders[type]
	}


	async collection(...names){
		let db=await new Db(this.app.apiKey, this.constructor.mongoServer,{w:1}).open()
		let conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conns
	}

    async createEntity(cols, doc){
        let conn=await this.collection(cols)
        try{
            doc.createdAt=new Date()
			if(!doc._id)
				doc._id=this.makeId()
            await conn.insertOne(doc)
            return doc
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }

	async updateEntity(cols,query,doc){
		let conn=await this.collection(cols)
        try{
            doc.updatedAt=new Date()
            await conn.update(query,doc)
            return doc.updatedAt
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
	}

    async patchEntity(cols, query, $set){
        let conn=await this.collection(cols)
        try{
            $set.updatedAt=new Date()
            await conn.findOneAndUpdate(query,{$set})
            return $set.updatedAt
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }

    async remove1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            let {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }

    async get1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            return await conn.findOne(query)
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }

    async findEntity(cols, query, filter=cursor=>cursor){
        let conn=await this.collection(cols)
        try{
			let cursor=await filter(conn.find(query))
            return await cursor.toArray()
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }
	
	nextPage(cols,{first:count,after},filter=a=>a){
		const [createdAt,_id]=(after||":").split(":")
		return this.findEntity(cols,{},cursor=>{
			let filtered=cursor.sort([["createdAt",-1]]).limit(count+parseInt(count/2))
			if(createdAt){
				filtered=filtered.filter({createdAt:{$lte:new Date(parseInt(createdAt))}})
			}
			return filter(filtered)
		})
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
			}
		})
	}
	
	prevPage(cols,{last:count,before},filter=a=>a){
		const [createdAt,_id]=(before||":").split(":")
		return this.findEntity(cols,{},cursor=>{
			let filtered=cursor.sort([["createdAt",-1]]).limit(count+parseInt(count/2))
			if(createdAt){
				filtered=filtered.filter({createdAt:{$gte:new Date(parseInt(createdAt))}})
			}
			return filter(filtered)
		})
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
			}
		})
	}
	
	async buildIndexes(indexes){
		const arrayfy=index=>Array.isArray(index) ? index : [index]
		Object.keys(indexes)
			.map(type=>{
				let typeIndexes=indexes[type]
				return this.collection(type)
					.then(conn=>Promise.all(typeIndexes.map(arrayfy).map(a=>conn.ensureIndex(...a)))
						.then(()=>conn.close())
						.catch(()=>conn.close())
					)
			})
	}
}

module.exports=DataService
