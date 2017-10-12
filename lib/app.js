const {Db, Server, ObjectID}=require("mongodb")
const PasswordlessStore = require('passwordless-memorystore');
const {makeExecutableSchema}=require('graphql-tools')
const {buildSchema} = require('graphql')
const {printSchema} = require("graphql/utilities")
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")

const Schema=require("./schema")
const User=require("./user")
const Role=require("./role")
const File=require("./file")
const Comment=require("./comment")


const isEmail = require("is-email")
const isPhone = v=>(/^(\+\d{2})?\d{11}$/g).test(v)


const config=require("../conf")

const APPS=exports.Cache={}

exports.resolve=(req, res, next)=>{
    Application.create(req.headers['x-application-id'])
        .then(app=>{
            req.app=app
            next()
        })
        .catch(e=>{
            console.error(e)
            res.status(401).end()
        })
}

function makeContact(contact){
	let o={}
	if(isEmail(contact))
		o.email=contact
	else if(isPhone(contact))
		o.phone=contact
	else
		o._contact=contact
	return o
}

class Application{
    static get mongoServer(){
        return new Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }

    static create(id){
        if(APPS[id])
            return Promise.resolve(APPS[id])

        return new Application({_id:config.adminKey})
            .get1Entity("apps",{_id:id})
            .then(app=>{
                return APPS[id]=new Application(app)
            })
    }

    constructor(app){
        require("assert")(app&&app._id)
        this.app=app
		this.cloudCode()
		this.passwordless=new PasswordlessStore(`mongodb://${config.db.host}:${config.db.port}/${app._id}}`)
	}

    sendEmailToken(email, uid, token){
		return Promise.resolve({token,uid})
		const nodemailer = require('nodemailer')
		const {from, ...serverOption}=config.email
		let server=nodemailer.createTransport(serverOption)
		return new Promise((resolve, reject)=>server.sendMail({
			from,
			to:email,
			subject: `code to login`,
			text: token
		}, e=>e ?  reject(e) : resolve({token,uid})))
    }

    sendPhoneToken(phone, uid, token){
		return Promise.resolve({token,uid})
		const sms = require("ali-sms");
		const {ACCESS_KEY, SECRET_KEY, sms:{SIGN_NAME,TEMPLATE_CREATE}}=config.ali
		return new Promise((resolve,reject)=>sms({
			accessKeyID:ACCESS_KEY,
			accessKeySecret: SECRET_KEY,
			signName:SIGN_NAME,
			templateCode:TEMPLATE_CREATE,
			paramString:{token},
			recNum:[phone],
		},(error,body)=>{
			if(error){
				reject(error)
			}else{
				body = JSON.parse(body)
				if(body.hasOwnProperty('Model'))
					resolve({token,uid})
				else
					reject(new Error(body.message))
			}
		}))
    }

    requestToken(contact){
		let token="1234"//`${Math.floor(Math.random()*900000) + 100000}`
        return this.getUserByContact(contact)
            .then(user=>{
				let uid=user&&user._id||contact
				let transport=isEmail(contact) ? "Email" : (isPhone(contact) ? "Phone" : null)
				if(!transport)
					throw new Error("need either phone or email")

				return this[`send${transport}Token`](contact,uid,token)
					.then(()=>({user, token, uid}))
			})
            .then(({user,token,uid})=>new Promise((resolve,reject)=>{
                this.passwordless.storeOrUpdate(token,uid,60*1000,null, e=>{
					if(e)
						reject(e)
					else
						resolve(!!user)
				})
            }))
	}

	login(contact, token, username){
        return this.getUserByContact(contact)
            .then(user=>new Promise((resolve, reject)=>{
                    let uid=user&&user._id||contact
                    this.passwordless.authenticate(token,uid, (e,valid)=>{
                        if(valid){
                            this.passwordless.invalidateUser(uid,e=>e)
							if(user){
								resolve(user)
							}else{//create user for this contact
								this.createEntity("users",{...makeContact(contact),username})
									.then(resolve, reject)
							}
                        }else{
                            reject(e)
                        }
                    })
            }))
	}

	logout({_id:uid}){
		this.passwordless.invalidateUser(uid,e=>e)
	}

	encode({_id}){
		return jwt.sign({_id},config.secret, {expiresIn: "1y"})
	}

	isAdmin(){
		return config.adminKey==this.app._id
	}

	cloudCode(){
        if(this.isAdmin()){
            const {typeDefs, resolver}=require("./admin")
            this.app.typeDefs=typeDefs
            this.app.resolver=resolver
            return
        }

		const {cloudCode}=this.app
		if(!cloudCode){
			return
		}

		try{
			let hasComment=false
            const Cloud={
				pagination: Schema.pagination,
				merge,
				buildComment(){
					hasComment=true
					return Comment.build(...arguments)
				},
				file_link(id,urls){
					return Promise.all(urls.map(url=>File.Mutation.file_link(null,{url,id},{app:this})))
				},
			}
			new Function("Cloud", cloudCode)(Cloud);

			this.app.typeDefs=`
				${Cloud.typeDefs}
				${hasComment ? Comment.typeDefs : ""}
			`
			this.app.resolver=hasComment ? Cloud.resolver : merge(Cloud.resolver, Comment.resolver)
		}catch(e){
            console.error(e)
		}
	}

    get schema(){
        try{
            return makeExecutableSchema({
                typeDefs:[
                    Schema.typeDefs,
    				User.typeDefs,
    				Role.typeDefs,
    				File.typeDefs,
                    this.app.typeDefs||"",
                ],
                resolvers:merge({},
    				Schema.resolver,
                    User.resolver,
    				Role.resolver,
    				File.resolver,
                    this.app.resolver,
                )
            })
        }catch(e){
            console.error(e)
        }
    }

	async getUserByContact(contact){
		let db=await this.collection("users")
		try{
			let query=makeContact(contact)
			return await db.findOne(query)
		}finally{
			db.close()
		}
	}

	async collection(...names){
		let db=await new Db(this.app._id, this.constructor.mongoServer,{w:1}).open()
		let conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conn
	}

    async createEntity(cols, doc){
        let conn=await this.collection(cols)
        try{
            doc.createdAt=new Date()
			if(!doc._id)
				doc._id=new ObjectID().toHexString()
            await conn.insertOne(doc)
            return doc
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
        }finally{
            conn.close()
        }
    }

    async remove1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            let {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }finally{
            conn.close()
        }
    }

    async get1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            return await conn.findOne({query})
        }finally{
            conn.close()
        }
    }

    async findEntity(cols, query, filter=cursor=>cursor){
        let conn=await this.collection(cols)
        try{
            return await filter(conn.find(query)).toArray()
        }finally{
            conn.close()
        }
    }
}
