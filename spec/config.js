var conf=require("../conf"),
    User=require('../lib/user'),
    App=require('../lib/app'),
    mongo=require("mongodb").MongoClient,
    assert = require('assert'),
    uuid=Date.now()
module.exports=(tester=`test${uuid++}`)=>({
    host:`http://qili.server:${conf.server.port}/1`,
    server: conf,
    rootSessionToken: User.createSessionToken({_id:conf.root, username:conf.root}),
    testerSessionToken: User.createSessionToken({_id:tester, username:tester}),
	createSalt:User.createSalt,
    tester:{
        _id: tester,
        username:tester,
        password: User.prototype.encrypt("test0123"),
		phone:"1",
        __password:"test0123",
        __fortest:true,
        createdAt: new Date()
    },
    testApp:{
        _id:tester,
        apiKey: tester,
        name: tester,
        uname: tester,
        __fortest:true,
        author: {
            _id:tester,
            username:tester
        },
        createdAt:new Date()
    },
    dropDB(name){
        return new Promise((resolve,reject)=>{
            mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${name}`,(error,db)=>{
                db.dropDatabase(error=>{
                    db.close()
                    error ? reject() : resolve()
                })
            })
        })
    },
    init(){
        return new Promise((res,rej)=>
            mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${conf.adminKey}`,(error,db)=>{
                const resolve=a=>{
                    db.close()
                    res()
                }

                const reject=a=>{
                    db.close()
                    rej()
                }

                Promise.all([
                    new Promise((resolve1,reject1)=>db.collection('users')
                        .update({_id:tester},this.tester,{upsert:true},(error,r)=>{
                            error ? reject1(error) : resolve1()
                        })),

                    new Promise((resolve1,reject1)=>db.collection('apps')
                        .update({_id:tester},this.testApp,{upsert:true},(error,r)=>{
                            error ? reject1(error) : resolve1()
                        }))
                ]).then(a=>{
					mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${this.testApp._id}`,(error,db)=>{
						if(error){
                            db.close()
                            return reject(error);
                        }
						db.collection('users')
							.update({_id:tester},this.tester,{upsert:true},(error,r)=>{
                                db.close()
								error ? reject(error) : resolve()
							})
					})
				},reject)
            })
        )
    },
    release(){
        return new Promise((res,rej)=>
            mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${conf.adminKey}`,(error,db)=>{
                if(error)
                    return rej(error);

                const resolve=a=>{
                    db.close(error=>{
                        if(error)
                            rej(error)
                        else
                            res()
                    })
                }

                const reject=a=>{
                    db.close(error=>{
                        if(error)
                            rej(error)
                        else {
                            rej(a)
                        }
                    })
                }

                Promise.all([
                    new Promise((resolve1,reject1)=>db.collection('users')
                        .remove({_id:tester},(error,r)=>{
                            error ? reject1(error) : resolve1()
                        })),

                    new Promise((resolve1,reject1)=>db.collection('apps').find({__fortest:true}).toArray(function(error, apps){
                            if(error)
                                return reject1(error);
                            Promise.all(apps.map(function(app){
                                return Promise.all([
                                    new Promise((resolve2,reject2)=>mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${app._id}`,(error,db)=>{
                                        db.dropDatabase((error,r)=>{
                                            db.close()
                                            error ? reject2(error) : resolve2()
                                        })
                                    })),

                                    new Promise((resolve2,reject2)=>db.collection('apps')
                                        .remove(app,(error,r)=>{
                                            error ? reject2(error) : resolve2()
                                        }))
                                ])
                            })).then(resolve1,reject1)
                        })
                    )
                ]).then(resolve,reject)
            })
        )
    }
})
