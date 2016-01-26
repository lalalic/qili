describe("cloud", function(){
	var config=require('./config'),
		host=config.host,
		kind="books",
		root=host+"/classes/"+kind,
		$=require('./ajax')();

	beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(),
		NULL=(a)=>a,
		headers={
			"X-Application-Id":config.server.adminKey,
			"X-Session-Token":config.testerSessionToken
		}

	function changeCloudCode(done,f,data,appId){
		var code=`(${f.toString()})(Cloud${data ? ","+JSON.stringify(data) : ''});`
		appId=appId||'test'
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
			},done)
		},done)
	}

	function createBook(done){
		var data={_id:`book${uid++}`, name:`my book ${uid++}`, title:`title ${uid}`}
		return $.ajax({type:'post',url:root,data})
			.then((book)=>{
				expect(book._id).toBe(data._id)
				done()
				book._raw=data
				return book
			},$.fail(done,"can't create book"))
	}

	function createApp(done){
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
						done()
						a._raw=data
						return a
					},done)
			},done)
	}
	describe("of collections",function(){
		it("can inject code before creating document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.beforeCreate('books', function(req, res){
					res.success(req)
				})
			}).then(function(){
				$.ajax({url: root, type:'post',data:{name:"a"}})
					.then(function(m){
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe('test')
						expect(m.object).toBeDefined()
						expect(m.object.name).toBe('a')
						done()
					},done)
			},done)
		})

		it("can inject code after creating document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.afterCreate('books', function(req, res){
					res.success(req)
				})
			}).then(function(){
				$.ajax({url: root, type:'post',data:{name:"a"}})
					.then(function(m){
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)
						expect(m.object).toBeDefined()
						expect(m.object.name).toBe('a')
						expect(m.object._id).toBeDefined()
						expect(m.object.updatedAt).toBeDefined()
						done()
					},done)
			},done)
		})

		it("can inject code before updating document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.beforeUpdate('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook(NULL).then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'patch',data:{newField:"a"}}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object['$set'].newField).toBe('a')

						expect(m.old).toBeDefined()
						expect(m.old._id).toBe(book._id)
						done()
					},done)
				,done)
			,done)
		})

		it("can inject code after updating document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.afterUpdate('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook(NULL).then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'patch',data:{name:"goodbook"}}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBe('goodbook')

						expect(m.old).toBeUndefined()
						done()
					},done)
				,done)
			,done)
		})

		it("can inject code before deleting document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.beforeRemove('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook(NULL).then((book)=>
					$.ajax({url: `${root}/${book._id}`, type:'delete'}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBeDefined()
						done()
					},done)
				,done)
			,done)
		})

		it("can inject code after deleting document",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.afterRemove('books', function(req, res){
					res.success(req)
				})
			}).then(()=>
				createBook(NULL).then((book)=>
					$.ajax({url:`${root}/${book._id}`, type:'delete'}).then((m)=>{
						expect(m.user).toBeDefined()
						expect(m.user._id).toBe(config.tester._id)

						expect(m.object).toBeDefined()
						expect(m.object._id).toBe(book._id)
						expect(m.object.name).toBeDefined()
					},done).then(()=>{
						$.get(`${root}/${book._id}`,{error:null})
							.then(function(doc){
								fail()
								done()
							},function(error){
								expect(error).toMatch(/Not exists/i)
								done()
							})
					},done)
				,done)
			,done)
		})

		it("return error directly",function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.beforeCreate('books', function(req, res){
					res.error("error from cloud")
				})
			}).then(()=>
				$.ajax({url: root, type:'post',data:{name:"a"},error:null})
					.then($.fail(done),(error)=>{
						expect(error).toBe("error from cloud")
						done()
					})
			,done)
		})
	})

	describe("of rest functions", function(){
		it("can create", function(done){
			changeCloudCode(done,function(Cloud){
				Cloud.define('test', function(req, res){
					res.success(req)
				})
			}).then(function(){
				$.post(host+"/functions/test",{data:{hello:1}})
				.then(function(m){
					expect(m.user).toBeDefined()
					expect(m.user._id).toBe(config.tester._id)
					expect(m.params).toBeDefined()
					expect(m.params.hello).toBe(1)
					done()
				},done)
			},done)
		})
	})

	describe("context seperation:root,global,native object", function(){
		it("can NOT change other application's context", function(done){
			createApp(NULL).then((app)=>
				Promise.all([
					changeCloudCode(done,function(Cloud){//change on Test app
						Array.prototype.indexOf=function(){return 10}
						Cloud.define('test',function(req, res){
							res.success({array:[1,3,5,2].indexOf(2)})
						})
					}),
					changeCloudCode(done,function(Cloud){//change on Test1 app
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
							done()
						},done)
				,done)
			,done)
		})

		describe("Safe VM", function(){
			it("error in code", function(done){
				changeCloudCode(done,function(Cloud){
					Cloud.define('test',function(req, res){
						try{
							a.b=1
							res.success("good")
						}catch(error){
							res.error(error)
						}
					})
				}).then(function(){
					$.get(host+"/functions/test",{error:null})
						.then($.fail(done),function(error){
							try{
								a.b=1
							}catch(e){
								expect(error).toBe(e.message)
							}
							done()
						})
				},done)
			})

			it("can NOT shutdown vm", function(done){
				changeCloudCode(done,function(Cloud){
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
						done()
					},function(error){
						expect(error).toBeTruthy()
						done()
					})
				},done)
			})

			it("should timeout for long time execution", function(done){
				changeCloudCode(done,function(Cloud){
					Cloud.define('test',function(req, res){
						var now=Date.now()
						while(Date.now()<now+4000);
						res.success("good")
					})
				}).then(function(){
					$.get(host+"/functions/test",{error:null})
					.then(function(m){
						$.fail("should throw timeout from server")
						done()
					},function(error){
						expect(error).toBeTruthy()
						done()
					})
				},done)
			},5000)
		})
	})

	describe("shared modules", function(){
		"backbone,ajax".split(",").forEach(function(module){
			describe(module, function(){
				it("require", function(done){
					changeCloudCode(done,function(Cloud,module){
						Cloud.define('test',function(req, res){
							res.success({required:require(module)&&true})
						})
					},module).then(function(){
						$.get(host+"/functions/test")
						.then(function(m){
							expect(m.required).toBe(true)
							done()
						},done)
					},done)
				})

				describe("seperation", function(){
					it("application level", function(done){
						createApp(NULL).then((app)=>
							Promise.all([
								changeCloudCode(done,function(Cloud,module){//change on Test app
									var m=require(module);
									m.imchanged=true
									Cloud.define('test',function(req, res){
										res.success({imchanged:m.imchanged})
									})
								},module),
								changeCloudCode(done,function(Cloud,module){//change on Test1 app
									var m=require(module);
									Cloud.define('test',function(req, res){
										res.success({imchanged:m.imchanged||false})
									})
								},module,app._id)
								]).then(function(){
									Promise.all([
										$.get(host+"/functions/test"),
										$.get(host+"/functions/test",{headers:{"X-Application-Id":app.apiKey}})
									]).then(function(results){
										expect(results.length).toBe(2)
										expect(results[0].imchanged).toBe(true)
										expect(results[1].imchanged).toBe(false)
										done()
									},done)
								},done)
							,done)
					})
				})
			})
		})
	})

	describe("server side require('ajax')", function(){
		it("not exists get with id return error", function(done){
				changeCloudCode(done,function(Cloud,root){
					var $=require('ajax')
					Cloud.define('test',function(req, res){
						$.get(root+"/booknoexist")
						.then(res.success,res.error)
					})
				},root).then(function(){
					$.get(host+"/functions/test",{error:null})
					.then($.fail(done),function(error){
						expect(error).toBe('Not exists')
						done()
					})
				},done)
			})

		describe("query with GET", function(){
			it(":id",function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,data){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(`${data.root}/${data.book}`)
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(()=>
						$.get(host+"/functions/test").then(function(data){
							expect(data._id).toBe(book._id)
							done()
						},done)
					,done)
				,done)
			})

			it("[all]", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then(()=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root)
							.then(res.success,res.error)
						})
					},root).then(function(){
						Promise.all([
							$.get(host+"/functions/test"),
							$.get(root)
						]).then(function(data){
							expect(data.length).toBe(2)
							var cloudData=data[0]
							data=data[1]
							expect(data.results).toBeDefined()
							expect(cloudData.results).toBeDefined()
							expect(data.results.length).toBe(cloudData.results.length)
							done()
						},done)
					},done)
				,done)
			})

			it('?query={name}', function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,data){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(data.root+"?query="+JSON.stringify({name:data.name}))
							.then(res.success,res.error)
						})
					},{root,name:book._raw.name}).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(1)
							expect(data.results[0].name).toBe(book._raw.name)
							done()
						},done)
					},done)
				,done)
			})

			it("?limit=n", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then(()=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root+"?limit=2&query="+JSON.stringify({__fortest:true}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)
							done()
						},done)
					},done)
				,done)
			})

			it("direct doc recturned from ?limit=1", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then(()=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root+"?limit=1&query="+JSON.stringify({__fortest:true}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.__fortest).toBe(true)
							done()
						},done)
					},done)
				,done)
			})

			it("?skip=n", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then((books)=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root+"?skip=3")
							.then(res.success,res.error)
						})
					},root).then(function(){
						Promise.all([
							$.get(host+"/functions/test"),
							$.get(root)
						]).then(function(data){
							expect(data.length).toBe(2)
							var allBooks=data[1]
							data=data[0]
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(allBooks.results.length-3)
							done()
						},done)
					},done)
				,done)
			})

			it("?sort={name:1}", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then((books)=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root+"?limit=2&sort="+JSON.stringify({name:1}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)
							var names=data.results.map((a)=>a.name).sort()
							expect(data.results[0].name).toBe(names[0])
							expect(data.results[1].name).toBe(names[1])
							done()
						},done)
					},done)
				,done)
			})

			it("?sort={name:-1}", function(done){
				Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then((books)=>
					changeCloudCode(done,function(Cloud,root){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(root+"?limit=2&sort="+JSON.stringify({name:-1}))
							.then(res.success,res.error)
						})
					},root).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.results).toBeDefined()
							expect(data.results.length).toBe(2)
							var names=data.results.map((a)=>a.name).sort()
							expect(data.results[0].name).toBe(names[1])
							expect(data.results[1].name).toBe(names[0])
							done()
						},done)
					},done)
				,done)
			})

			it("?fields={name:1}", function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,d){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(d.root+"/"+d.book+"?fields="+JSON.stringify({name:1}))
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(function(){
						$.get(host+"/functions/test")
						.then(function(doc){
							expect(doc.name).toBeDefined()
							expect(doc.title).toBeUndefined()
							done()
						},done)
					},done)
				,done)
			})

			it("?fields={name:0}", function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,d){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.get(d.root+"/"+d.book+"?fields="+JSON.stringify({name:0}))
							.then(res.success,res.error)
						})
					},{root,book:book._id}).then(function(){
						$.get(host+"/functions/test")
						.then(function(doc){
							expect(doc.name).toBeUndefined()
							done()
						},done)
					},done)
				,done)
			})
		})

		describe("create with POST" ,function(){
			it("with _id", function(done){
				var id='a book created with _id';
				changeCloudCode(done,function(Cloud,root){
					var $=require('ajax')
					Cloud.define('test',function(req, res){
						var id='a book created with _id'
						$.ajax({type:'post',url:root,data:{_id:id}})
						.then(res.success,res.error)
					})
				},root).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data._id).toBe(id)
						done()
					},done)
				},done)

			})

			it("without _id", function(done){
				var name='a book created without _id'
				changeCloudCode(done,function(Cloud,root){
					var $=require('ajax')
					Cloud.define('test',function(req, res){
						var name='a book created without _id'
						$.ajax({type:'post',url:root,data:{name:name}})
						.then(res.success,res.error)
					})
				},root).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data._id).toBeTruthy()
						done()
					},done)
				},done)
			})
		})

		describe('update with PUT/PATCH', function(){
			it("replace update with PUT", function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,d){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.ajax({
								type:'put',
								url:d.root+"/"+d.book,
								data:{title:'raymond'}
							})
							.then(res.success,res.error)
						})
					},{book:book._id,root}).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.updatedAt).toBeTruthy()
							return $.get(root+"/"+book._id)
								.then(function(doc){
									expect(doc.name).toBeUndefined()
									expect(doc.title).toBe('raymond')
									done()
								},done)
							done()
						},done)
					},done)
				,done)
			})

			it("patch update with PATCH", function(done){
				createBook(NULL).then((book)=>
					changeCloudCode(done,function(Cloud,d){
						var $=require('ajax')
						Cloud.define('test',function(req, res){
							$.ajax({
								type:'patch',
								url:d.root+"/"+d.book,
								data:{title:'raymond'}
							})
							.then(res.success,res.error)
						})
					},{book:book._id,root}).then(function(){
						$.get(host+"/functions/test")
						.then(function(data){
							expect(data.updatedAt).toBeTruthy()
							return $.get(root+"/"+book._id)
								.then(function(doc){
									expect(doc.name).toBeDefined()
									expect(doc.title).toBe('raymond')
									done()
								},done)
							done()
						},done)
					},done)
				,done)
			})
		})

		it("delete with DELETE", function(done){
			createBook(NULL).then((book)=>
				changeCloudCode(done,function(Cloud,d){
					var $=require('ajax')
					Cloud.define('test',function(req, res){
						$.ajax({
							type:'delete',
							url:d.root+"/"+d.book
						})
						.then(res.success,res.error)
					})
				},{book:book._id,root}).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data).toBeTruthy()
						done()
					},done)
				},done)
			,done)
		})

	})

	describe("backbone in server side", function(){
		it("get",function(done){
			createBook(NULL).then((book)=>
				changeCloudCode(done,function(Cloud,d){
					var backbone=require('backbone'),
						Book=backbone.Model.extend({urlRoot:d.root,idAttribute:'_id'});
					Cloud.define('test',function(req, res){
						(new Book({_id:d.book}))
						.fetch()
						.then(res.success,res.error)
					})
				},{root,book:book._id}).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data._id).toBe(book._id)
						expect(data.name).toBe(book._raw.name)
						done()
					},done)
				},done)
			,done)
		})

		it("create",function(done){
			changeCloudCode(done,function(Cloud,root){
				var backbone=require('backbone'),
					Book=backbone.Model.extend({urlRoot:root,idAttribute:'_id'});
				Cloud.define('test',function(req, res){
					(new Book({name:'a book created with _id'}))
					.save()
					.then(res.success,res.error)
				})
			},root).then(function(){
				$.get(host+"/functions/test")
				.then(function(data){
					expect(data._id).toBeDefined()
					expect(data.updatedAt).toBeDefined()
					$.get(root+"/"+data._id)
						.then(function(doc){
							expect(doc.name).toBe('a book created with _id')
							done()
						},done)
				},done)
			},done)
		})

		it("put update",function(done){
			createBook(NULL).then((book)=>
				changeCloudCode(done,function(Cloud,d){
					var backbone=require('backbone'),
						Book=backbone.Model.extend({urlRoot:d.root,idAttribute:'_id'});
					Cloud.define('test',function(req, res){
						(new Book({_id:d.book,title:'raymond'}))
						.save()
						.then(res.success,res.error)
					})
				},{root,book:book._id}).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data.updatedAt).toBeDefined()
						$.get(root+"/"+book._id)
							.then(function(doc){
								expect(doc.name).toBeUndefined()
								expect(doc.title).toBe('raymond')
								done()
							},done)
					},done)
				},done)
			,done)
		})

		it("patch update",function(done){
			createBook(NULL).then((book)=>
				changeCloudCode(done,function(Cloud,d){
					var backbone=require('backbone'),
						Book=backbone.Model.extend({urlRoot:d.root,idAttribute:'_id'});
					Cloud.define('test',function(req, res){
						(new Book({_id:d.book}))
						.save({title:'raymond'},{patch:true})
						.then(res.success,res.error)
					})
				},{root,book:book._id}).then(function(){
					$.get(host+"/functions/test")
					.then(function(data){
						expect(data.updatedAt).toBeDefined()
						$.get(root+"/"+book._id)
							.then(function(doc){
								expect(doc.name).toBeDefined()
								expect(doc.title).toBe('raymond')
								done()
							},done)
					},done)
				},done)
			,done)
		})

		it("destroy",function(done){
			changeCloudCode(done,function(Cloud,root){
				var backbone=require('backbone'),
					Book=backbone.Model.extend({urlRoot:root,idAttribute:'_id'});
				Cloud.define('test',function(req, res){
					(new Book({_id:'book0'}))
					.destroy({wait:true})
					.then(res.success,res.error)
				})
			},root).then(function(){
				$.get(host+"/functions/test")
				.then(function(data){
					$.get(root+"/book0",{error:null})
						.then(function(doc){
							$.fail()
							done()
						},function(error){
							expect(error).toBe('Not exists')
							done()
						})
				},done)
			},done)
		})
	})

	describe("wechat (/:appkey/wechat)", function(){
	    var config=require('./config'),
			host=config.host,
			root=host+"/test/wechat",
			$=require('./ajax')();

		function signature(timestamp){
			var shasum = crypto.createHash('sha1');
			var arr = [token, timestamp, nonce].sort();
			shasum.update(arr.join(''));
			return shasum.digest('hex')
		}

	    var token=config.server.token,
	        nonce="asdfkafdljadsf",
	        echostr="hrlslkjsfg",
	        crypto = require('crypto'),
			now=Date.now()+"",
			url=`${root}?nonce=${nonce}&timestamp=${now}&signature=${signature(now)}`


	    beforeAll((done)=>config.init().then(done,done)	)
		afterAll((done)=>config.release().then(done,done))

	    it("validate token by GET",function(done){
	        var timestamp=Date.now()+""
	        $.ajax({
	            type:'get',
	            url:`${url}&echostr=${echostr}`
	        }).then(function(a){
	            expect(a).toBe(echostr)
	            done()
	        }, done)
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
	        it(".all",(done)=>{
	            changeCloudCode(done,(Cloud)=>{
	                Cloud.wechat.on((req,res,next)=>{
						res.success(JSON.stringify(req.message))
	                })
	            }).then(()=>{
					var now=Date.now()
	                $.ajax(Object.assign({
						body:text
	                },opt)).then((m)=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test"}))).not.toBe(-1)
						done()
	                },$.fail(done))
	            }, $.fail(done,"cloud code fails changed"))
	        })

	        it(".all then .text",(done)=>{
				changeCloudCode(done,(Cloud)=>{
	                Cloud.wechat.on((req,res,next)=>{
						req.message.all=1
						next()
	                }).on('text',(req,res)=>{
						res.success(JSON.stringify(req.message))
					})
	            }).then(()=>{
					var now=Date.now()
	                $.ajax(Object.assign({
						body:text
	                },opt)).then((m)=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test",all:1}))).not.toBe(-1)
						done()
	                },$.fail(done))
	            }, $.fail(done,"cloud code fails changed"))
			})

			it("only .text",(done)=>{
				changeCloudCode(done,(Cloud)=>{
					Cloud.wechat.on('text',(req,res)=>{
						res.success(JSON.stringify(req.message))
					})
				}).then(()=>{
					var now=Date.now()
					$.ajax(Object.assign({
						body:text
					},opt)).then((m)=>{
						expect(m.indexOf("<ToUserName><![CDATA[fromUser]]></ToUserName>")).not.toBe(-1)
						expect(m.indexOf(JSON.stringify({MsgType:"text",Content:"test"}))).not.toBe(-1)
						done()
					},$.fail(done))
				}, $.fail(done,"cloud code fails changed"))
			})
		})
	})

})
