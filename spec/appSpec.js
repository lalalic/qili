describe("app", function(){
var config=require('./config'),
	host=config.host,
	root=host+"/apps",
	$=require('./ajax')(),
	_=require('underscore');

	$.ajaxSetup({
		headers:{
			"X-Application-Id":config.server.adminKey,
			"X-Session-Token":config.testerSessionToken
		}
	})

	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(), NULL=(a)=>a, createApp

	describe("user", function(){
		describe("create", function(){
			it("new application, and return application token, and author should be set", createApp=function(done){
				var data={name:`_app${uid++}`}
				return $.ajax({url:root,type:'post',data:data})
					.then(function(doc){
						expect(doc._id).toBeDefined()
						expect(doc.apiKey).toBeDefined()
						expect(doc.createdAt).toBeDefined()
						expect(doc.token).toBeDefined()

						return $.get(`${root}/${doc._id}`)
							.then(function(a){
								expect(a.author).toBeDefined()
								expect(a.author.username).toBe(config.tester.username)
								done()
								a._raw=data
								return a
							},done)
					},done)
			})

			it("can't create application with same name within an org", function(done){
				createApp(NULL).catch($.fail(done,"can't create app"))
					.then((app)=>$.post(root,{data:{name:app.name},error:null})
						.then(function(doc){
							fail("should not create new app")
							done()
						},function(error){
							expect(error).toMatch(/duplicate key/gi)
							done()
						})
					)
			})

			it("can't create application with empty name", function(done){
				$.ajax({url:root, type:'post', data:{url:"ok"},error:null})
					.then(function(doc){
						fail()
						done()
					},function(error){
						expect(error).toMatch(/empty/gi)
						done()
					})
			})
		})

		describe("update", function(){
			it("can update its own application", function(done){
				createApp(NULL).catch($.fail(done,"can't create app"))
					.then((app)=>$.ajax({type:'patch',url:`${root}/${app._id}`,data:{__newField:1}})
						.then(function(doc){
							expect(doc.updatedAt).not.toEqual(app.updatedAt)
							done()
						},done)
					)
			})

			it("can NOT update other's application", function(done){
				$.ajax({
					type:'patch',
					url:root+"/"+config.server.adminKey,
					data:{__newField:'test19'},
					error:null,
				}).then(function(doc){
					expect(doc).toBeFalsy()
					done()
				},function(error){
					expect(error).toBeTruthy()
					done()
				})
			})

			it("can't update name to be duplicated", function(done){
				Promise.all([
					createApp(NULL).catch($.fail(done,"can't create app")),
					createApp(NULL).catch($.fail(done,"can't create app"))
				]).then((apps)=>$.ajax({type:'patch',url:`${root}/${apps[0]._id}`,data:{name:apps[1].name}, error:null})
					.then(function(doc){
						fail()
						done()
					},function(error){
						expect(error).toMatch(/duplicate/gi)
						done()
					})
				,done)
			})

			it("can update cloud code", function(done){
				createApp(NULL).catch($.fail(done,"can't create app")).then((app)=>{
					var code="var a=1";
					$.ajax({
						type:'patch',
						url:`${root}/${app._id}`,
						data:{cloudCode:code}
					}).then(function(doc){
						expect(doc.updatedAt).toBeDefined()
						$.get(`${root}/${app._id}`)
							.then(function(doc){
								expect(doc.cloudCode).toBe(code)
								done()
							},done)
					},done)
				})
			})

			it("should throw error when there's error in cloud code", function(done){
				createApp(NULL).catch($.fail(done,"can't create app")).then((app)=>{
					var code="var a }";
					$.ajax({
						type:'patch',
						url:`${root}/${app._id}`,
						data:{cloudCode:code},
						error:null
					}).then(function(doc){
						fail()
						done()
					},function(error){
						expect(error).toBe("Unexpected token }")
						done()
					})
				})
			})
		})

		describe("delete",function(){
			it("can be deleted with confirmation", function(){

			})

			it("can't be deleted without confirmation", function(){

			})
		})

		describe("query", function(){
			it("can not get any information without admin key", function(done){
				$.get(root,{headers:{
						"X-Application-Id":"test",
						"X-Session-Token":config.testerSessionToken
					}, error: null})
				.then(function(docs){
					fail()
					done()
				},function(error){
					expect(error).toMatch(/no hack/gi)
					done()
				})
			})

			it("can get its own applictions", function(done){
				$.get(root)
					.then(function(docs){
						_.each(docs.results, function(doc){
							expect(doc.author.username).toBe(config.tester.username)
						})
						done()
					},done)
			})

			it("can NOT get others applictions by id", function(done){
				$.get(root+"/"+config.server.adminKey,{error:null})
					.then(function(doc){
						fail()
						done()
					},function(error){
						expect(error).toMatch(/no hack/gi)
						done()
					})
			})

			it("can NOT get others applictions by query", function(done){
				$.get(root+"?query="+JSON.stringify({"author._id":"lalalic"}))
					.then(function(docs){
						_.each(docs.results, function(doc){
							expect(doc.author.username).toBe(config.tester.username)
						})
						done()
					},done)
			})
		})
	})
})
