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

* role/:id?
    * get
    * post
    * delete
    * put
    * patch

* files
    * get token
    * post

* app/:id?
    * get
    * post
    * delete
    * put
    * patch

* functions/:function
    * get
    * post
    * delete
    * put
    * patch
