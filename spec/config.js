var conf=require("../conf"),
    User=require('../lib/user'),
    App=require('../lib/app'),
    mongo=require("mongodb").MongoClient,
    assert = require('assert'),
    tester="test";
module.exports={
    host:`http://qili.server:${conf.server.port}/1`,
    server: conf,
    rootSessionToken: User.createSessionToken({_id:conf.root, username:conf.root}),
    testerSessionToken: User.createSessionToken({_id:tester, username:tester}),
    tester:{
        _id: tester,
        username:tester,
        "password": User.prototype.encrypt("test0123"),
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
    init(){
        return new Promise((resolve,reject)=>
            mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${conf.adminKey}`,(error,db)=>{
                if(error)
                    return reject(error);
                Promise.all([
                    new Promise((resolve,reject)=>db.collection('users')
                        .update({_id:tester},this.tester,{upsert:true},(error,r)=>{
                            error ? reject(error) : resolve(r)
                        })),

                    new Promise((resolve,reject)=>db.collection('apps')
                        .update({_id:tester},this.testApp,{upsert:true},(error,r)=>{
                            error ? reject(error) : resolve(r)
                        }))
                ]).then(resolve,(a)=>{fail(`init for testing failed with ${a.message}`);reject(a)})
            })
        )
    },
    release(){
        return new Promise((resolve,reject)=>
            mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${conf.adminKey}`,(error,db)=>{
                if(error)
                    return reject(error);

                Promise.all([
                    new Promise((resolve,reject)=>db.collection('users')
                        .remove({_id:tester},(error,r)=>{
                            error ? reject(error) : resolve(r)
                        })),

                    new Promise((resolve,reject)=>db.collection('apps').find({__fortest:true}).toArray(function(error, apps){
                            if(error)
                                return reject(error);
                            Promise.all(apps.map(function(app){
                                return Promise.all([
                                    new Promise((resolve,reject)=>mongo.connect(`mongodb://${conf.db.host}:${conf.db.port}/${app._id}`,(error,db)=>{
                                        db.dropDatabase((error,r)=>{
                                            error ? reject(error) : resolve(r)
                                        })
                                    })),

                                    new Promise((resolve,reject)=>db.collection('apps')
                                        .remove(app,(error,r)=>{
                                            error ? reject(error) : resolve(r)
                                        }))
                                ])
                            })).then(resolve,reject)
                        })
                    )
                ]).then(resolve,(a)=>{fail(`release for testing failed with ${a.message}`);reject(a)})
            })
        )
    }
}
