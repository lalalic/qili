exports.Flowise=function Flowise({init, finalize, static:staticFx,extendFlowiseNodes, flowiseRootPath="/", ...props}){
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
            if(!Flowise.prototype.Utils){
                /**
                 * something in these modules are monkey injected
                 */
                Flowise.prototype.Utils=require("flowise/dist/utils")
                Flowise.prototype.Handlers=require("flowise-components/dist/src/handler")
                Flowise.prototype.Handlers.LLMonitor=require('langchain/callbacks/handlers/llmonitor').LLMonitorHandler
            }

            flowise=new Flowise()
            flowise.app=staticService.router(flowiseRootPath, `${flowiseRootPath}/index.html`.replace("//",'/'))

            const {extendFlowise, uploadBuiltin,  getBrowserGraphJS, getEndingNodeId }=require('./magic/extend-flowise')

            Object.assign(flowise, {getBrowserGraphJS, getEndingNodeId, ChatFlow:require('./magic/chatflow')})
            
            ;(async()=>{
                await init?.(app, flowise)//cloud app side can extend flowise configuration

                if(flowise. embeddingDbConfig){
                    const { Pool } =require( 'pg')
                    flowise.documentServer=new Pool(flowise.embeddingDbConfig)
                }
                
                await flowise.initDatabase()
                /**
                 * why can't it be moved to extendFlowise??
                 * it need monkey interception on flowise.app.get/use, which are called in flowise.config
                 */
                uploadBuiltin(flowise, app)//hacked use flowise.app.get to intercept handler
                await flowise.config(flowise.socketServer=app.websocketServer)

                await extendFlowiseNodes?.(flowise, app)

                await extendFlowise({ flowise, qili: app})
    
                flowise.Monitor=require("./magic/monitor-factory")(flowise,app) 
                /**
                 * according to Flowise-server/index.ts
                 * last 2 handlers are for root and index
                */
                flowise.app.stack.splice(-2)
                console.info("-------flowise is totally ready--------")
            })();
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