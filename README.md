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

Cloud
---
to extend server, with following API.

* isDev: Boolean
	* true
		* support profiling with extension: {...times}
		* support persisted query || query
		* support constant user token=1234

* buildPagination(Type:String): {typeDefs, resolver}
	* to build pagination for <Type>, you should manually merge returned typeDefs and resolver
	* types
		* <Type>Edge
		* <Type>Connection
		
* buildComment(Type:String): {typeDefs, resolver}
	* to build comment for <Type>, you should manually merge returned typeDefs and resolver
	* types
		* <Type>Comment
		* <Type>CommentEdge
		* <Type>CommentEdgeConnection

* file_link(id:ID,urls:[String]): to link uploaded resources at <urls> to node with <id>

* merge(resolver1, resolver2, ...): to merge resolvers

* typeDefs: app's schema

* resolver: app's resolver


* persistedQuery: {<id>: <graphql:string>, ...}

* static 
	* <version=1>/:appKey/static/<path>
		* Cloud.static
			.on([regexp|string]/*path*/, function(req/*{path,app}*/, res/*{send}*/))
			.on(path,callback)

* wechat
	* <version=1>/:appKey/wechat
		* Cloud.wechat.on(/*event name*/,function(req/*{message,app}*/, res/*{send}*/)).on(event, callback)
			> event could be text,image,voice, video,location,link, event,device_text,device_event,subcribe,unsubscribe,scan
			> callback=function(req/*{message,app}*/, res/*{send}*/)
			> when event name is empty, callback will be called on every event 

			
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
<pre>
	//localhost/1/<appKey>/book
	Cloud.static.on("book",function(req, res){
		res.send("<html>book</html>")
	})
	
	Cloud.wechat.on(function(req, res){
		res.send("hello, wechat")
	}).on("text",function(req,res){
		res.send(req.message.Content)
	})
	
	const BookComment=Cloud.buildComment("Book")
	
	Cloud.typeDefs=`
		type Book implements Node{
			id:ID
			title: String
		}
		extend type  User{
			firstName: String
		}
	`
	
	Cloud.resolver=merge(BookComment.resolver,{
		Book:{
			id(book, root, {app,user}){
				return `books:${book._id}`
			}
		}
	})
	
	Cloud.isDev=true
</pre>
	