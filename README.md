QiLi
====

A graphql server

Install
-------
<code>npm install qili</code>

Protocol
----
http header or query
* X-Application-Id=? : create an application from qili2.com to get appid
* X-Session-Token=? : get a session token from following request as json data

config
-----
	* cloud: support local app
		* [apiKey]
			* root: optional static root
			* code: cloud code file path
			* [any app entity keys, such as isDev, canRunInCore, bucket: use qiliadmin as default]
			* appUpdates : see expo-updates-server
				* UPDATES: update assets folder 
				* PRIVATE_KEY_PATH: 
				* HOSTNAME({runtimeVersion, platform, assetFilePath}): return asset url


File
----
	* qiniu is the file storage service
	* temp file: key like temp/[x:1, ...]/... would be removed after x minutes, x is optional and default is 1
	* 

Cloud
-----
to extend server, with following API.

* apiKey: readonly

* merge(resolver1, resolver2, ...): a utility to deep merge objects

* addModule({typeDefs, resolver, persistedQuery,static,wechat}) : to add a cloud module
	* name: optional module name
	* typeDefs: string, app's schema
	* resolver: graphql resolver object, app's resolver
	* persistedQuery: {<id>: <graphql:string>, ...}
	* static(service)
		* serve request at <version=1>/:appKey/static/<path>
		* service
			.on([regexp|string]/*path*/, function(req/*{path,app}*/, res/*{send}*/))
			.on(path,callback)
	* wechat(service)
		* serve wechat request at <version=1>/:appKey/wechat
		* service
			.on(event/*event name*/,function(req/*{message,app}*/, res/*{send}*/))
			> event could be text,image,voice, video,location,link, event,device_text,device_event,subcribe,unsubscribe,scan
			> callback=function(req/*{message,app}*/, res/*{send}*/)
			> when event name is empty, callback will be called on every event 
	* pubsub:
		* init: return a pubsub object, or nothing to use in-memory built-in
		* onConnect: a callback for subscription connection
		* onDisconnect
	* appUpdates: support 2 ways
		* fromManifestURI({runtimeVersion, platform}, app): return manifest url
		* an extension of expo-updates-server
	* proxy: http-proxy-middleware.createProxyMiddleware is used to serve 
		* [ key ]
			* options: used by createProxyMiddleware

* ID(...): a utility to extract id from type field resolver arguments

* reportThreshold: write only, to a performance profiler threshold when app set isDev=true in app.qili2.com,default undefined

* logVariables(variables,operationName): write only, returned value as log.variables, default undefined

* buildPagination(Type:String): {typeDefs, resolver}
	* to build pagination module for Type, you should manually merge returned typeDefs and resolver
	* typeDefs
		
		type ${Type}Edge{
			node: ${Type}
			cursor: JSON
		}

		type ${Type}Connection{
			edges: [${Type}Edge]
			pageInfo: PageInfo
		}

		
* buildComment(Type:String): {typeDefs, resolver}
	* to build comment module for Type, you should manually merge returned typeDefs and resolver
	* typeDefs

		enum CommentType {
			photo
			text
		}

		interface Comment{
			id: ID!
			content: String!
			type: CommentType
			author: User!
			createdAt:  Date!
			parent: ObjectID!
			isOwner: Boolean
		}

		extend type Mutation{
			comment_create(parent:ID,content:String!, type: CommentType, _id: ObjectID):Comment
		}

		type ${CommentType} implements Comment & Node {
			id: ID!
			content: String!
			type: CommentType
			author: User!
			createdAt:  Date!
			parent: ObjectID!
			isOwner: Boolean
		}

		${Pagination.typeDefs}

		extend type Query{
			${type}_comments(parent:ObjectID,last:Int, before: JSON):${CommentType}Connection

		}

* buildFavorite(Type:String, statisticsFieldName[optional]): {typeDefs,resolver}
	* to build favorite module for Type, you should manually merge returned typeDefs and resolver to Cloud
	* typeDefs

			type ${TypedFavorite} implements Node{
                id: ID!
                author: User!
                ${type}: ${Type}!
            }

            extend type User{
                ${typedFavorite}s:[${Type}]
            }

            extend type ${Type}{
                isMyFavorite: Boolean
                ${!statisticsFieldName ? "favorited: Int" : ""}
            }

            extend type Mutation{
                ${typedFavorite}_toggle(_id:ObjectID!): ${Type}
            }

* buildStatistics(Type:String,fields:[String])
	* to build statistics module for Type
	* typeDefs

			type ${TypedStatistics} implements Node{
                id: ID!
                ${fieldDefs}
            }

            extend type ${Type}{
                ${fieldDefs}
				
				"""use query to auto count: _viewed in your query to inc viewed automatically"""
                ${fields.map(a=>`_${a}: Boolean`).join("\n\r")}
            }
* statistics(typeName, statObject, {app}): function to call whenever you want to statistic for an type object
	* typeName: such as "User"
	* statObject: {_id, login:1, score:2,...}, the User[_id] login+=1, score+=2
	* context: {app}

Schema
---

	scalar Date
	scalar ObjectID
	scalar JSON
	enum Gender {
	  girl
	  boy
	}

	interface Node {
	  id: ID!
	}

	type PageInfo {
	  hasNextPage: Boolean
	  endCursor: JSON
	  hasPreviousPage: Boolean
	  startCursor: JSON
	}

	type Query {
	  version: String!
	  schema: String!
	  me: User!
	}
	type Subscription {
	  ping: Boolean
	}

	type Mutation {
	  requestToken(contact: String!): Boolean
	  login(contact: String!, token: String!, name: String): User
	  logout: Boolean
	  user_update(username: String, birthday: Date, gender: Gender, location: String, signature: String): Date
	  role_create(name: String): Role
	  role_update(_id: ObjectID!, name: String): Date
	  role_remove(_id: ObjectID!): Boolean
	  role_user_add(_id: ObjectID!, users: [String!]!): Date
	  role_user_remove(_id: ObjectID!, users: [String!]!): Date
	  file_link(url: String!, id: ID!, field: String!): Boolean
	  file_tokens(count: Int): [FileToken]
	  file_clean(host: ID!): Boolean
	  comment_create(parent: ID, content: String!, type: CommentType): Comment
	}


	type User implements Node {
	  id: ID!
	  photo(size: Int = 25): String
	  name: String
	  email: String
	  phone: String
	  createdAt: Date!
	  updatedAt: Date
	  token: String
	  username: String
	  birthday: Date
	  gender: Gender
	  location: String
	  signature: String
	  roles: [Role]
	}

	type File {
	  id: ID!
	  url: String
	  host: ID!
	}

	type FileToken {
	  token: String!
	  expires: Int!
	}

	type Role implements Node {
	  id: ID!
	  name: String!
	  createdAt: Date!
	  updatedAt: Date
	  author: User
	  users: [User]
	}
			
How to Start
-----
1. create app on qili2.com
2. get schema of created app on qili2.com with query "query {schema}"
3. upload your cloud code on qili2.com
4. create your client app, 
	* yarn add github.com/lalalic/qili-app, and check qili-app tutorial
	* or create your own client app from  scratch

cloud example
----		
```javascript
	//localhost/1/<appKey>/book
	Cloud.addModule({
		name: 'test',
		typeDefs:`
			type Book implements Node{
				id:ID
				title: String
			}
			extend type  User{
				firstName: String
			}
			extend type Query{
				ping: Boolean
			}
			extend type Mutation{
				ding(dong:String): Boolean
			}
			extend type Subscription{
				ping: Boolean
			}
		`,
		persistedQuery:{//use ping, ding as request {id:ding, variables:{dong:"ding"}}
			ping: `query {
				ping
			}`,
			ding: `mutation a($dong:String){
				ding(dong:$dong)
			}`
		},
		resolve:Cloud.merge({
			Book:{},
			User:{},
			Query:{},
			Mutation:{},
			Subscription:{}
		},Cloud.buildComment("Book"), Cloud.buildComment("User")),

		pubsub:{
			init(){
				return new YourPubsub()
			},
			onConnect(){},
			onDisconnect(){}
		},
		appUpdates:{
			context:"updates",
			fromManifestURI({runtimeVersion, platform}, app){
				return `https://cdn.qili2.com/${app.app.apiKey}/updates/${runtimeVersion}/${platform}-manifest.json`
			}
		},

		proxy:{
			chatgpt: "https://chat.openai.com",
			twitter: {
				
			}
		},

		static(service){
			service
				.on("/book",function(req, res){// /1/static/book
					res.send("<html>book</html>")
				}
				.on(/^\/book\/done/g, (req,res)=>{
					res.send("hello")
				})	
		},

		wechat(service){
			service
				.on((req, res)=>{
					res.send("hello, wechat")
				})
				.on("text",function(req,res){
					res.send(req.message.Content)
				})
		}
		
	})
```
	