exports.Flowise=function Flowise({init, finalize, static:staticFx,ready, flowiseRootPath="/", ...props}){
    process.env.DATABASE_TYPE="postgres"
    process.env.FLOWISE_SECRETKEY_OVERWRITE=process.env.SECRET
    let flowise, staticService
    return {
        name:"ai",
        ...props,
        static(service){
            staticFx?.(staticService=service)
        },
        init(app){
            exports.prepareQiliDatasource(app)
            const {App:Flowise}=require("flowise")
            if(!Flowise.prototype.extendServerNodes){
                Flowise.prototype.extendServerNodes=function(){return exports.extendServerNodes(this)}
                Flowise.prototype.Utils=require("flowise/dist/utils")
                Flowise.prototype.Handlers=require("flowise-components/dist/src/handler")
                Flowise.prototype.Handlers.LLMonitor=require('langchain/callbacks/handlers/llmonitor').LLMonitorHandler
                Flowise.prototype.CallbackManager=require('langchain/callbacks').CallbackManager
            }

            flowise=new Flowise()
            flowise.app=staticService.router(flowiseRootPath, `${flowiseRootPath}/index.html`.replace("//",'/'))
            require('./magic').init(flowise, app).then(()=>ready?.())
            init?.(app, flowise)
            /**
             * according to Flowise-server/index.ts
             * last 2 handlers are for root and index
            */
            flowise.app.stack.splice(-2)

            const { Pool } =require( 'pg')
            flowise.documentServer=new Pool(flowise.embeddingDbConfig)
        },
        finalize(){
            flowise?.AppDataSource?.destroy()
            flowise.documentServer?.close?.()
            flowise?.stopApp()
            finalize?.()
        }
    }
}

exports.prepareQiliDatasource=function prepareQiliDatasource(qili){
    const { DriverFactory } = require("typeorm/driver/DriverFactory")
    const uuid=require("uuid")

    const wrap4Flowise=a=>!!a ? (a.id=a._id, delete a._id, a) : a
    const wrap4Mongo=a=>!!a ? (a={...a}, a.id && (a._id=a.id, delete a.id),  a) : a

    DriverFactory.prototype.create=(fx=>{
        return function create(datasource){
            const EmptyFx=key=>function(a){
                //console.warn(`${key} called: ${a ? JSON.stringify(a) : ''}`)
            }
            datasource.initialize=()=>{
                return Promise.resolve(EmptyFx('datasource.initialize')())
            }
            datasource.getRepository=Entity=>{
                const Type=Entity.name
                return new Proxy({
                    create(doc){
                        return doc
                    },
                    merge(doc, patch){
                        return Object.assign(doc, patch)
                    },
                    async save(doc){
                        doc=wrap4Mongo(doc)
                        if(!doc._id){
                            doc._id=uuid.v4()
                            return wrap4Flowise(await qili.createEntity(Type, doc))
                        }
                        doc.updatedAt=await qili.updateEntity(Type, {_id:doc._id}, doc)
                        return wrap4Flowise(doc)
                    },
                    async find({where,select, order}={}){
                        const entities=await qili.findEntity(Type, wrap4Mongo(where), wrap4Mongo(select))
                        return entities.map(a=>wrap4Flowise(a))
                    },
                    async delete(filter){
                        return await qili.removeEntity(Type, wrap4Mongo(filter))
                    },
                    async findOneBy(filter, projection){
                        return wrap4Flowise(await qili.get1Entity(Type, wrap4Mongo(filter), projection))
                    },
                    async findBy(filter){
                        return await this.find({where:filter})
                    },
                    createQueryBuilder(type){
                        const me=this
                        switch(type){
                            case 'cf':{
                                const query={where:{$or:{apikeyid:null, apikeyid:""}}, order:{name:1}}
                                const builder=new Proxy({
                                    where(_,{apikeyid}){
                                        query.where.$or.apikeyid=apikeyid
                                        return builder
                                    },
                                    getMany(){
                                        return me.find(query)
                                    }
                                },{
                                    get(target, key){
                                        return target[key]||(()=>builder)
                                    }
                                })
                                return builder
                            }
                            case 'cm':{
                                const query={select:{_id:1},where:{},order:{createdDate:1}}
                                const builder= new Proxy({
                                    where(_,{ chatflowid }){
                                        query.where._id=chatflowid
                                        return builder
                                    },
                                    getOne(){
                                        return me.findOneBy(query.where, query.select)
                                    }
                                },{
                                    get(target, key){
                                        return target[key]||(()=>builder)
                                    }
                                })
                                return builder
                            }
                        }
                    }
                },{
                    get(target, key){
                        return target[key]||EmptyFx(key)
                    }
                })
            }
            datasource.runMigrations=function(){
                return EmptyFx('datasource.runMigrations')()
            }
            datasource.createQueryRunner=function(){
                return new Proxy({},{
                    get(target,key){
                        return EmptyFx(key)
                    }
                })
            }
            datasource.destroy=function(){
                return EmptyFx('datasource.destroy')()
            }

            DriverFactory.prototype.create=fx
            return fx.call(this, datasource)
        }
    })(DriverFactory.prototype.create);
}

exports.extendServerNodes=function extendServerNodes(flowise){
    return new Promise((resolve,reject)=>{
        let timer=setInterval(async ()=>{
            if(flowise.cachePool){
                clearInterval(timer)
                timeout && clearTimeout(timeout)
                //hack to load extra nodes
                try{

                    const {NodesPool} = require('flowise/dist/NodesPool')
                    const pool=new NodesPool()
                    pool.componentNodes=flowise.nodesPool.componentNodes
                    pool.componentCredentials=flowise.nodesPool.componentCredentials

                    pool.getFiles=(fx=>async function(){
                        pool.getFiles=fx//only once
                        return await fx.call(this, `${__dirname}/nodes`)
                    })(pool.getFiles)
                    await pool.initializeNodes()

                    pool.getFiles=(fx=>async function(){
                        pool.getFiles=fx//only once
                        return await fx.call(this, `${__dirname}/credentials`)
                    })(pool.getFiles)
                    await pool.initializeCredentials()

                    resolve()
                }catch(e){
                    console.error(e.message)
                    reject(e.message)
                }
            }
        },100)
        const timeout=setTimeout(()=>{
            clearInterval(timer)
            console.log('timeout')
            resolve()
            //reject('timeout')
        }, 60000)
    })
}

/*
exports.prepareMongoDatasource=function prepareMongoDatasource({mongo,database="ai"}={}){
    const { MongoDriver } = require("typeorm/driver/mongodb/MongoDriver")
    const conf=require("../../../conf")
    
    DriverFactory.prototype.create=(fx=>{

        if(mongo){
            MongoDriver.prototype.connect=(fn=>function(){
                this.mongodb.MongoClient.connect=async ()=>await mongo
                return fn.call(this,...arguments)
            })(MongoDriver.prototype.connect);
        }


        return function create(datasource){
            datasource.options={
                ...datasource.options,
                type:"mongodb",
                host: conf.db.host,
                port: conf.db.port,
                database,
                synchronize: false,
                migrationsRun: false,
                migrations: []
            }

            datasource.buildMetadatas=(fn=>async function(){
                await fn.call(datasource, ...arguments)
                //set objectId
                datasource.entityMetadatas.forEach(entity=>{
                    if(!entity.columns.find(a=>a.isObjectId)){
                        const primary=entity.columns.find(a=>a.isPrimary)
                        if(primary){
                            primary.isObjectId=true
                            entity.objectIdColumn=primary
                        }
                    }
                })
                
            })(datasource.buildMetadatas);
            DriverFactory.prototype.create=fx
            return fx.call(this, datasource)
        }
    })(DriverFactory.prototype.create);
}
exports.ToolNodeFactory=function({func, ...rest}, serverApp){
    const { getBaseClasses }=require("flowise-components/dist/src/utils")
    const { DynamicTool} = require('langchain/tools')
    class Node{
        constructor(){
            Object.assign(this,rest)
            this.baseClasses=[rest.type, ...getBaseClasses(DynamicTool)]
        }
    
        async init({inputs},_, options){
            return new DynamicTool({
                ...inputs,
                func
            })
        }
    }

    if(rest.icon){
        serverApp.app.get(`/api/v1/node-icon/${rest.name}`, (req,res)=>{
            res.redirect(rest.icon)
        })
    }

    return new Node()
}
*/