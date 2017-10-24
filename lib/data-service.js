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
				doc._id=new ObjectID().toHexString()
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
            (doc.$set=doc.$set||{}).updatedAt=new Date()
            await conn.update(query,doc)
            return doc.$set.updatedAt
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
            return await filter(conn.find(query)).toArray()
        }catch(e){
			console.error(e)
		}finally{
            conn.close()
        }
    }	
}

module.exports=DataService