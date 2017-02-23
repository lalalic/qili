
describe("cloud", function(){
	var config=require('./config')(),
		host=config.host,
		kind="books",
		root=host+"/classes/"+kind,
		$=require('./ajax')(config);

	beforeAll(()=>config.init())
	afterAll(()=>config.release())

	var uid=Date.now(),
		headers={
			"X-Application-Id":config.server.adminKey,
			"X-Session-Token":config.testerSessionToken
		}


	function changeCloudCode(f,data,appId){
		var code=`(${f.toString()})(Cloud${data ? ","+JSON.stringify(data) : ''});`
		appId=appId||config.testApp._id
		return $.ajax({
			type:'patch',
			url:host+"/apps/"+appId,
			data:{cloudCode:code},
			headers,
		}).then(function(doc){
			expect(doc.updatedAt).toBeDefined()
			return $.ajax({
				type:'get',
				url:host+"/apps/"+appId,
				headers
			}).then(function(doc){
				expect(doc.cloudCode).toBe(code)
			})
		})
	}

	function createBook(){
		var data={_id:`book${uid++}`, name:`my book ${uid++}`, title:`title ${uid}`}
		return $.ajax({type:'post',url:root,data})
			.then((book)=>{
				expect(book._id).toBe(data._id)
				book._raw=data
				return book
			})
	}

	function createApp(){
		var data={name:`_app${uid++}`},
			headers={
				"X-Application-Id":config.server.adminKey,
				"X-Session-Token":config.testerSessionToken
			}
		return $.ajax({url:`${host}/apps`,type:'post',data:data,headers})
			.then(function(doc){
				expect(doc._id).toBeDefined()
				expect(doc.apiKey).toBeDefined()
				expect(doc.createdAt).toBeDefined()

				return $.ajax({url:`${host}/apps/${doc._id}`,type:'get',headers})
					.then(function(a){
						expect(a.author).toBeDefined()
						expect(a.author.username).toBe(config.tester.username)
						a._raw=data
						return a
					})
			})
	}


	describe("of collections",function(){
		it("can inject code before creating document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.beforeCreate('books', function(req, res){
					res.success(req)
				})
			}).then(function(){
				return $.ajax({url: root, type:'post',data:{name:"a"}})
					.then(function(m){
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)
						expect(m.object).toBeDefined()
						expect(m.object.name).toBe('a')
					})
			})
		})

		it("can inject code after creating document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.afterCreate('books', function(req, res){
					res.success(req)
				})
			}).then(function(){
				return $.ajax({url: root, type:'post',data:{name:"a"}})
					.then(function(m){
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)
						expect(m.object).toBeDefined()
						expect(m.object.name).toBe('a')
						expect(m.object._id).toBeDefined()
						expect(m.object.updatedAt).toBeDefined()

					})
			})
		})

		it("can inject code before updating document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.beforeUpdate('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook().then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'patch',data:{newField:"a"}}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object['$set'].newField).toBe('a')

						expect(m.old).toBeDefined()
						expect(m.old._id).toBe(book._id)

					})
				)
			)
		})

		it("can inject code after updating document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.afterUpdate('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook().then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'patch',data:{name:"goodbook"}}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBe('goodbook')

						expect(m.old).toBeUndefined()

					})
				)
			)
		})

		it("can inject code before deleting document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.beforeRemove('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook().then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'delete'}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBeDefined()

					})
				)
			)
		})

		it("can inject code after deleting document",function(){
			return changeCloudCode(function(Cloud){
				Cloud.afterRemove('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook().then((book)=>
					$.ajax({url:`${root}/${book._id}`, type:'delete'}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBeDefined()
					}).then(()=>{
						return $.get(`${root}/${book._id}`,{error:null})
							.then(fail,function(error){
								expect(error).toMatch(/Not exists/i)

							})
					})
				)
			)
		})

		it("return error directly",function(){
			return changeCloudCode(function(Cloud){
				Cloud.beforeCreate('books', function(req, res){
					res.error("error from cloud")
				})
			}).then(()=>
				$.ajax({url: root, type:'post',data:{name:"a"},error:null})
					.then(fail,(error)=>{
						expect(error).toBe("error from cloud")

					})
			)
		})
	})

	describe("of rest functions", function(){
		it("can create, req={user,params,method}, any method can call", function(){
			return changeCloudCode(function(Cloud){
				Cloud.define('test', function(req, res){
					res.success(req)
				})
			}).then(function(){
				return Promise.all(
					"get,post,put,patch,delete".split(",").map(
						method=>$[method](host+"/functions/test",{data:{hello:1}})
						.then(function(m){
							expect(m.user).toBeDefined()
							expect(m.user._id).toBe(config.tester._id)
							expect(m.params).toBeDefined()
							expect(m.params.hello).toBe(1)
							expect(m.method).toBe(method.toUpperCase())
						})
					)
				)
			})
		})
	})

	describe("context seperation:root,global,native object", function(){
		it("can NOT change other application's context", function(){
			return createApp().then((app)=>
				Promise.all([
					changeCloudCode(function(Cloud){//change on Test app
						Array.prototype.indexOf=function(){return 10}
						Cloud.define('test',function(req, res){
							res.success({array:[1,3,5,2].indexOf(2)})
						})
					}),
					changeCloudCode(function(Cloud){//change on Test1 app
						Cloud.define('test',function(req, res){
							res.success({array:[1,3,5,2].indexOf(2)})
						})
					},null,app._id)
				]).then(()=>
						Promise.all([
							$.get(host+"/functions/test"),
							$.get(host+"/functions/test",{headers:{"X-Application-Id":app.apiKey}})
						]).then((results)=>{
							expect(results.length).toBe(2)
							expect(results[0].array).toBe(10)
							expect(results[1].array).toBe(3)

						})
				)
			)
		})

		describe("Safe VM", function(){
			it("error in code", function(){
				return changeCloudCode(function(Cloud){
					Cloud.define('test',function(req, res){
						try{
							a.b=1
							res.success("good")
						}catch(error){
							res.error(error)
						}
					})
				}).then(function(){
					return $.get(host+"/functions/test",{error:null})
						.then(fail,function(error){
							try{
								a.b=1
							}catch(e){
								expect(error).toBe(e.message)
							}
						})
				})
			})

			it("can NOT shutdown vm", function(){
				return changeCloudCode(function(Cloud){
					Cloud.define('test',function(req, res){
						try{
							root.process.exit()
							res.success("good")
						}catch(error){
							res.error(error)
						}
					})
				}).then(function(){
					$.get(host+"/functions/test",{error:null})
					.then(function(m){
						$.fail()

					},function(error){
						expect(error).toBeTruthy()

					})
				})
			})

			it("should timeout for long time execution", function(){
				return changeCloudCode(function(Cloud){
					Cloud.define('test',function(req, res){
						var now=Date.now()
						while(Date.now()<now+4000);
						res.success("good")
					})
				}).then(function(){
					$.get(host+"/functions/test",{error:null})
					.then(function(m){
						$.fail("should throw timeout from server")

					},function(error){
						expect(error).toBeTruthy()

					})
				})
			},5000)
		})
	})

	describe("cloud not support require", function(){
		"ajax,backbone,fs,./app".split(",").forEach(function(module){
			it(module, function(){
				return changeCloudCode(function(Cloud,module){
					Cloud.define('test',function(req, res){
						require(module)
					})
				},module).then(function(){
					return $.get(host+"/functions/test",{error:null})
					.catch(data=>expect(data).toBe("require not supported in cloud"))
				})
			})
		})
	})


	describe("server side fetch", function(){
		it("not exists get with id return error", function(){
				return changeCloudCode(function(Cloud,root){
					
					Cloud.define('test',function(req, res){
						fetch(root+"/booknoexist")
						.then(res.success,res.error)
					})
				},root).then(function(){
					return $.get(host+"/functions/test",{error:null})
					.then(fail,function(error){
						expect(error).toBe('Not exists')

					})
				})
			})

		describe("query with GET", function(){
			it(":id",function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,data){
						Cloud.define('test',function(req, res){
							fetch(`${data.root}/${data.book}`)
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(()=>
						$.get(host+"/functions/test").then(function(data){
							expect(data._id).toBe(book._id)

						})
					)
				)
			})

			it("[all]", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then(()=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root)
							.then(res.success,res.error)
						})
					},root).then(function(){
						return Promise.all([
							$.get(host+"/functions/test"),
							$.get(root)
						]).then(function(data){
							expect(data.length).toBe(2)
							var cloudData=data[0]
							data=data[1]
							expect(data.results).toBeDefined()
							expect(cloudData.results).toBeDefined()
							expect(data.results.length).toBe(cloudData.results.length)

						})
					})
				)
			})

			it('?query={name}', function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,data){
						
						Cloud.define('test',function(req, res){
							fetch(data.root+"?query="+JSON.stringify({name:data.name}))
							.then(res.success,res.error)
						})
					},{root,name:book._raw.name}).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(1)
							expect(data.results[0].name).toBe(book._raw.name)

						})
					})
				)
			})

			it("?limit=n", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then(()=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root+"?limit=2&query="+JSON.stringify({__fortest:true}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)

						})
					})
				)
			})

			it("direct doc recturned from ?limit=1", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then(()=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root+"?limit=1&query="+JSON.stringify({__fortest:true}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.__fortest).toBe(true)

						})
					})
				)
			})

			it("?skip=n", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then((books)=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root+"?skip=3")
							.then(res.success,res.error)
						})
					},root).then(function(){
						return Promise.all([
							$.get(host+"/functions/test"),
							$.get(root)
						]).then(function(data){
							expect(data.length).toBe(2)
							var allBooks=data[1]
							data=data[0]
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(allBooks.results.length-3)

						})
					})
				)
			})

			it("?sort={name:1}", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then((books)=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root+"?limit=2&sort="+JSON.stringify({name:1}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)
							var names=data.results.map((a)=>a.name).sort()
							expect(data.results[0].name).toBe(names[0])
							expect(data.results[1].name).toBe(names[1])

						})
					})
				)
			})

			it("?sort={name:-1}", function(){
				return Promise.all([createBook(),createBook(),createBook()]).then((books)=>
					changeCloudCode(function(Cloud,root){
						
						Cloud.define('test',function(req, res){
							fetch(root+"?limit=2&sort="+JSON.stringify({name:-1}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)
							var names=data.results.map((a)=>a.name).sort()
							expect(data.results[0].name).toBe(names[1])
							expect(data.results[1].name).toBe(names[0])

						})
					})
				)
			})

			it("?fields={name:1}", function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,d){
						
						Cloud.define('test',function(req, res){
							fetch(d.root+"/"+d.book+"?fields="+JSON.stringify({name:1}))
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(function(){
						return $.get(host+"/functions/test")
						.then(function(doc){
							expect(doc.name).toBeDefined()
							expect(doc.title).toBeUndefined()

						})
					})
				)
			})

			it("?fields={name:0}", function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,d){
						
						Cloud.define('test',function(req, res){
							fetch(d.root+"/"+d.book+"?fields="+JSON.stringify({name:0}))
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(function(){
						return $.get(host+"/functions/test")
						.then(function(doc){
							expect(doc.name).toBeUndefined()

						})
					})
				)
			})
		})

		describe("create with POST" ,function(){
			it("with _id", function(){
				var id='a book created with _id';
				return changeCloudCode(function(Cloud,root){
					
					Cloud.define('test',function(req, res){
						var id='a book created with _id'
						fetch({type:'post',url:root,data:{_id:id}})
						.then(res.success,res.error)
					})
				},root).then(function(){
					return $.get(host+"/functions/test")
					.then(function(data){
						expect(data._id).toBe(id)

					})
				})

			})

			it("without _id", function(){
				var name='a book created without _id'
				return changeCloudCode(function(Cloud,root){
					
					Cloud.define('test',function(req, res){
						var name='a book created without _id'
						fetch({type:'post',url:root,data:{name:name}})
						.then(res.success,res.error)
					})
				},root).then(function(){
					return $.get(host+"/functions/test")
					.then(function(data){
						expect(data._id).toBeTruthy()

					})
				})
			})
		})

		describe('update with PUT/PATCH', function(){
			it("replace update with PUT", function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,d){
						
						Cloud.define('test',function(req, res){
							fetch({
								type:'put',
								url:d.root+"/"+d.book,
								data:{title:'raymond'}
							})
							.then(res.success,res.error)
						})
					},{book:book._id,root}).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.updatedAt).toBeTruthy()
							return $.get(root+"/"+book._id)
								.then(function(doc){
									expect(doc.name).toBeUndefined()
									expect(doc.title).toBe('raymond')

								})

						})
					})
				)
			})

			it("patch update with PATCH", function(){
				return createBook().then((book)=>
					changeCloudCode(function(Cloud,d){
						
						Cloud.define('test',function(req, res){
							fetch({
								type:'patch',
								url:d.root+"/"+d.book,
								data:{title:'raymond'}
							})
							.then(res.success,res.error)
						})
					},{book:book._id,root}).then(function(){
						return $.get(host+"/functions/test")
						.then(function(data){
							expect(data.updatedAt).toBeTruthy()
							return $.get(root+"/"+book._id)
								.then(function(doc){
									expect(doc.name).toBeDefined()
									expect(doc.title).toBe('raymond')

								})

						})
					})
				)
			})
		})

		it("delete with DELETE", function(){
			return createBook().then((book)=>
				changeCloudCode(function(Cloud,d){
					
					Cloud.define('test',function(req, res){
						fetch({
							type:'delete',
							url:d.root+"/"+d.book
						})
						.then(res.success,res.error)
					})
				},{book:book._id,root}).then(function(){
					return $.get(host+"/functions/test")
					.then(function(data){
						expect(data).toBeTruthy()

					})
				})
			)
		})

	})

	describe("wechat (/:appkey/wechat)", function(){
	    var root=host+"/test/wechat"

		function signature(timestamp){
			var shasum = crypto.createHash('sha1');
			var arr = [token, timestamp, nonce].sort();
			shasum.update(arr.join(''));
			return shasum.digest('hex')
		}

	    var token=config.server.wechat.token,
	        nonce="asdfkafdljadsf",
	        echostr="hrlslkjsfg",
	        crypto = require('crypto'),
			now=Date.now()+"",
			url=`${root}?nonce=${nonce}&timestamp=${now}&signature=${signature(now)}`

	    it("validate token by GET",function(){
	        var timestamp=Date.now()+""
	        return $.ajax({
	            type:'get',
	            url:`${url}&echostr=${echostr}`
	        }).then(function(a){
	            expect(a).toBe(echostr)

	        })
	    })

	    describe('wechat cloud', function(){
	        var opt={
	            url,
	            type:'post',
	            headers:{'Content-Type':'xml;encoding=utf-8'},
	            dataType:'xml'
	        }, _head=`<xml>
					<ToUserName><![CDATA[toUser]]></ToUserName>
					<FromUserName><![CDATA[fromUser]]></FromUserName>
					<CreateTime>1348831860</CreateTime>
					<MsgId>1234567890123456</MsgId>`,
				text=`${_head}
					<MsgType><![CDATA[text]]></MsgType>
					<Content><![CDATA[test]]></Content>
				</xml>`;
	        it(".all",()=>{
	            return changeCloudCode((Cloud)=>{
	                Cloud.wechat.on("all",(req,res,next)=>{
						res.success(JSON.stringify(req.message))
	                })
	            }).then(()=>{
					var now=Date.now()
	                return $.ajax(Object.assign({
						body:text
	                },opt)).then(m=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test"}))).not.toBe(-1)

	                })
	            })
	        })

	        it(".all then .text",()=>{
				return changeCloudCode((Cloud)=>{
	                Cloud.wechat.on((req,res,next)=>{
						req.message.all=1
						next()
	                }).on('text',(req,res)=>{
						res.success(JSON.stringify(req.message))
					})
	            }).then(()=>{
					var now=Date.now()
	                return $.ajax(Object.assign({
						body:text
	                },opt)).then((m)=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test",all:1}))).not.toBe(-1)

	                },fail)
	            }, e=>fail("cloud code fails changed"))
			})

			it("only .text",()=>{
				return changeCloudCode((Cloud)=>{
					Cloud.wechat.on('text',(req,res)=>{
						res.success(JSON.stringify(req.message))
					})
				}).then(()=>{
					var now=Date.now()
					return $.ajax(Object.assign({
						body:text
					},opt)).then((m)=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test"}))).not.toBe(-1)

					},fail)
				}, e=>fail("cloud code fails changed"))
			})
		})
	})
	
	describe("static service", function(){
		it("not defined static url", function(){
			return changeCloudCode((Cloud)=>{
				Cloud.static.on("book",function(req, res){
					res.success("<html><body>I have a book</body></html>")
				})
			}).then(()=>$.get(`${host}/${config.testApp.apiKey}/static/asdfd/reading.html`))
			.then(data=>expect(data).toEqual("no static content"))
		})
		
		
		it(`static /${config.testApp.apiKey}/static/book/reading.html`, function(){
			const book="<html><body>I have a book</body></html>"
			return changeCloudCode((Cloud)=>{
				Cloud.static.on("book",function(req, res){
					res.success("<html><body>I have a book</body></html>")
				})
			}).then(()=>$.get(`${host}/${config.testApp.apiKey}/static/book/reading.html`))
			.then(data=>expect(data).toEqual(book))
		})
		
		it(`variant: /${config.testApp.apiKey}/static/book/{id}.html`, function(){
			return createBook().then(({_raw:book})=>{
				return changeCloudCode(function(Cloud,{root,id}){
					Cloud.static.on("book",function(req, res){
						fetch(`${root}/${id}`)
							.then(book=>res.success(`<html><body>${book.title}</body></html>`),res.error)
					})
				}, {root,id:book._id})
				.then(()=>$.get(`${host}/${config.testApp.apiKey}/static/book/${book._id}.html`))
				.then(data=>expect(data).toEqual(`<html><body>${book.title}</body></html>`))
			})
		})
	})

})
