const {ObjectID}=require("mongodb")
const {Cache,resolve}=require("./app")
const config=require("../conf")

exports.typeDefs=`
    type App implements Node{
        id: ID!
        apiKey: String!
        name: String!
		uname: String
		cloudCode: String
        author: User
        createdAt: Date!
        updatedAt: Date
    }

	extend type User{
		apps: [App]!
		app(_id:ObjectID!): App
	}

	extend type Mutation{
		app_create(name: String!, uname:String): App
		app_update(_id: ObjectID!, name:String, uname:String, cloudCode:String): Date
        app_remove(_id: ObjectID!): Boolean
	}
`

exports.resolver={
    App: {
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
        id:({_id})=>`apps:${_id}`
    },
    User: {
        async apps(parent,{},{app,user:{_id}}){
            return await app.findEntity("apps",{author:_id})
        },

		async app(_, {_id}, {app,user}){
			return await app.get1Entity("apps",{_id, author:user._id})
		}
    },
    Mutation: {
        app_create(_,args, {app,user:{_id:author}}){
            return app.createEntity("apps", {...args, apiKey:new ObjectID().toHexString(), author})
        },
        app_update(_,{_id, cloudCode,...$set},{app,user:{_id:author}}){
			return app.patchEntity("apps",{_id,author}, {...$set,cloudCode,author})
				.then(d=>{
					Cache.remove(_id)
					return d
				})
		},
	 	app_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("apps", {_id,author})
				.then(b=>{
					Cache.remove(_id)
					return b
				})
		},
    }
}


exports.resolve=(req, res, next)=>{
    if(req.headers['x-application-id']==config.adminKey
        && req.headers['x-application-id2']
        && config.adminKey!=req.headers['x-application-id2']){
        req.headers['x-application-id']=req.headers['x-application-id2']
        req.user.master=true
        resolve(true)(req, res, next)
    }else{
        next()
    }
}

exports.persistedQuery={
    "app_create_Mutation": "mutation app_create_Mutation(\n  $name: String!\n  $uname: String\n) {\n  app_create(name: $name, uname: $uname) {\n    id\n    name\n    uname\n    apiKey\n  }\n}\n",
    "app_remove_Mutation": "mutation app_remove_Mutation(\n  $id: ObjectID!\n) {\n  app_remove(_id: $id)\n}\n",
    "app_update_Mutation": "mutation app_update_Mutation(\n  $id: ObjectID!\n  $name: String\n  $uname: String\n) {\n  app_update(_id: $id, name: $name, uname: $uname)\n}\n",
    "cloud_update_Mutation": "mutation cloud_update_Mutation(\n  $id: ObjectID!\n  $cloudCode: String!\n) {\n  app_update(_id: $id, cloudCode: $cloudCode)\n}\n",
    "userProfile_update_Mutation": "mutation userProfile_update_Mutation(\n  $photo: String\n  $username: String\n  $birthday: Date\n  $gender: Gender\n  $location: String\n  $signature: String\n) {\n  user_update(photo: $photo, username: $username, birthday: $birthday, gender: $gender, location: $location, signature: $signature)\n}\n",
    "account_update_Mutation": "mutation account_update_Mutation(\n  $photo: String\n) {\n  user_update(photo: $photo)\n}\n",
    "authentication_login_Mutation": "mutation authentication_login_Mutation(\n  $contact: String!\n  $token: String!\n  $name: String\n) {\n  login(contact: $contact, token: $token, name: $name) {\n    id\n    token\n  }\n}\n",
    "authentication_requestToken_Mutation": "mutation authentication_requestToken_Mutation(\n  $contact: String!\n) {\n  requestToken(contact: $contact)\n}\n",
    "comment_create_Mutation": "mutation comment_create_Mutation(\n  $parent: ID!\n  $content: String!\n  $type: CommentType\n) {\n  comment: comment_create(parent: $parent, content: $content, type: $type) {\n    __typename\n    id\n    content\n    type\n    createdAt\n    author {\n      id\n      name\n      photo\n    }\n    isOwner\n  }\n}\n",
    "file_create_Mutation": "mutation file_create_Mutation(\n  $_id: String!\n  $host: ID!\n  $bucket: String\n  $size: Int\n  $crc: Int\n  $mimeType: String\n  $imageInfo: JSON\n) {\n  file_create(_id: $_id, host: $host, bucket: $bucket, size: $size, crc: $crc, mimeType: $mimeType, imageInfo: $imageInfo) {\n    url\n    id\n  }\n}\n",
    "file_token_Mutation": "mutation file_token_Mutation(\n  $key: String\n) {\n  file_token(key: $key) {\n    token\n    id\n  }\n}\n",
    "main_app_update_Query": "query main_app_update_Query(\n  $id: ObjectID!\n) {\n  me {\n    app(_id: $id) {\n      ...app\n      id\n    }\n    id\n  }\n}\n\nfragment app on App {\n  id\n  name\n  uname\n  apiKey\n}\n",
    "main_comment_Query": "query main_comment_Query(\n  $parent: ObjectID!\n  $count: Int = 10\n  $cursor: JSON\n) {\n  ...main_appComments\n}\n\nfragment main_appComments on Query {\n  comments: app_comments(parent: $parent, last: $count, before: $cursor) {\n    edges {\n      node {\n        id\n        content\n        type\n        createdAt\n        author {\n          id\n          name\n          photo\n        }\n        isOwner\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasPreviousPage\n      startCursor\n    }\n  }\n}\n",
    "main_my_apps_Query": "query main_my_apps_Query {\n  me {\n    ...my\n    id\n  }\n}\n\nfragment my on User {\n  id\n  username\n  photo\n  apps {\n    id\n    name\n  }\n}\n",
    "main_prefetch_Query": "query main_prefetch_Query {\n  me {\n    name\n    token\n    apps {\n      id\n      name\n      uname\n      cloudCode\n      apiKey\n    }\n    id\n  }\n}\n",
    "main_userProfile_me_Query": "query main_userProfile_me_Query {\n  me {\n    id\n    username\n    birthday\n    gender\n    location\n    photo\n    signature\n  }\n}\n"
}
