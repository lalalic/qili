const isEmail = require("is-email")
const {Entity}=require("./entity")

const SCHEMA=exports.schema=`
	type User{
		_id: ID!
		email: String
		phone: String
		username: String
		createdAt: Date!
		updatedAt: Date
	}
`

const graphql=require('express-graphql')
exports.graphql_auth=function(options){
	let middleware=graphql(options)
	return function(error, req, res, next){
		if(req.user){
			next()
		}else{
			middleware(req, res, next)
		}
	}
}

exports.User=class extends Entity{
	get(){
		return Promise.resolve({_id:"1234", username:"raymond"})
	}

	getByContact(emailOrPhone){
		let bEmail=isEmail(emailOrPhone)
		let query=bEmail ? {email:emailOrPhone} : {phone: emailOrPhone}
		return this.get(query)
	}
}
