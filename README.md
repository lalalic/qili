QiLi
====

A REST server

Install
-------
<code>npm install qili</code>

Protocol
----
http header or query
* X-Application-Id=? : create an application from qili2.com to get appid
* X-Session-Token=? : get a session token from following request as json data
    * post /user
    * get /login
    * get /me


API
----
* classes/<collectionName>/:id?
    * get: ?query={json}&'limit', 'sort', 'fields', 'skip', 'hint', 'explain', 'snapshot', 'timeout'
    * post: {json} in request.body
    * delete
    * put
    * patch

You can use following 3 request to get a session token, and all returns user information with extra sessionToken: {sessionToken:xxx, ...user infor...}.
* user
    * post : sign up
* login
    * get
* me
    * get

* requestPasswordReset
    * post

* roles/:id?
    * get
    * post
    * delete
    * put
    * patch

* files
    * get token
    * post

* apps/:id?
    * get
    * post
    * delete
    * put
    * patch

Cloud code support following extension
* functions/:function of any method(get,post,put,patch,delete)
	* Cloud.define(/function name/, callback(req/*{user}*/, res/*{success,error}*/))


* :appKey/static
	* Cloud.static.on([regexp|string]/*path*/, function(req/*{user,path}*/, res/*{success,error}*/)).on(path,callback)

* :appKey/wechat
	* Cloud.wechat.on(/*event name*/,callback).on(event, callback)
		> event could be text,image,voice, video,location,link, event,device_text,device_event,subcribe,unsubscribe,scan
		> callback=function(req/*{user,message}*/, res/*{success,error}*/)
		> when event name is empty, callback will be called on every event 
* entity operation: before/after create/update/delete
	* Cloud.beforeCreate(/*entity type:string*/,function(req/*{user,object}*/, res/*{success,error}*/)).afterCreate(...)

* global fetch to call rest entity API: fetch(option), options defined as
	{
		url//rest api, /1/classes/xxx, /1/file/xxx,... 
		type:"",//[get,post,put,patch,delete]
		data:"",
		context:false,
		beforeSend: function(xhr, settings){},
		success: function(data,status,xhr){},
		complete: function(xhr, status){},
		error: function(xhr, status, error){}
	}
<pre>
	Cloud.define("test",function(req,res){
		res.success("hello")
	}).define("hello", function(req,res){})
	
	Cloud.static.on("book",function(req, res){
		res.success("<html>book</html>")
	})
	
	Cloud.wechat.on(function(req, res){
		res.success("hello, wechat")
	}).on("text",function(req,res){
		res.success(req.message.Content)
	})
	
	Cloud.afterCreate("book",function(req,res){
		return fetch({url:"/1/classes/author/${user._id}",type:"patch",data:{bookCount:1}})
	}).afterUpdate(...)
	
</pre>
	