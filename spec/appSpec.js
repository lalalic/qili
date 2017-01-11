describe("app", function(){
var config=require('./config'),
	host=config.host,
	root=host+"/apps",
	$=require('./ajax')();

	$.ajaxSetup({
		headers:{
			"X-Application-Id":config.server.adminKey,
			"X-Session-Token":config.testerSessionToken
		}
	})

	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(), createApp

	describe("user", function(){
		describe("create", function(){
			it("new application, and return application token, and author should be set", createApp=function(){
				var data={name:`_app${uid++}`}
				return $.ajax({url:root,type:'post',data:data})
					.then(function(doc){
						expect(doc._id).toBeDefined()
						expect(doc.apiKey).toBeDefined()
						expect(doc.createdAt).toBeDefined()

						return $.get(`${root}/${doc._id}`)
							.then(function(a){
								expect(a.author).toBeDefined()
								expect(a.author.username).toBe(config.tester.username)
								a._raw=data
								return a
							})
					})
			})

			it("can't create application with same name within an org", function(){
				return createApp()
					.then(app=>$.post(root,{data:{name:app.name},error:null}))
					.then(fail,error=>expect(error).toMatch(/duplicate key/gi))
			})

			it("can't create application with empty name", function(){
				return $.ajax({url:root, type:'post', data:{url:"ok"},error:null})
					.then(fail,error=>expect(error).toMatch(/empty/gi))
			})
		})

		describe("update", function(){
			it("can update its own application", function(){
				return createApp()
					.then(app=>$.ajax({type:'patch',url:`${root}/${app._id}`,data:{__newField:1}})
						.then(doc=>expect(doc.updatedAt).not.toEqual(app.updatedAt)))
			})

			it("can NOT update other's application", function(){
				return $.ajax({
					type:'patch',
					url:root+"/"+config.server.adminKey,
					data:{__newField:'test19'},
					error:null,
				}).then(
					doc=>expect(doc).toBeFalsy(),
					error=>expect(error).toBeTruthy()
				)
			})

			it("can't update name to be duplicated", function(){
				return Promise.all([createApp(),createApp()])
					.then(apps=>$.ajax({type:'patch',url:`${root}/${apps[0]._id}`,data:{name:apps[1].name}, error:null}))
					.then(fail,error=>expect(error).toMatch(/duplicate/gi))
			})

			it("can update cloud code", function(){
				return createApp().then((app)=>{
					var code="var a=1";
					$.ajax({
						type:'patch',
						url:`${root}/${app._id}`,
						data:{cloudCode:code}
					}).then(doc=>{
						expect(doc.updatedAt).toBeDefined()
						return $.get(`${root}/${app._id}`)
							.then(doc=>expect(doc.cloudCode).toBe(code))
					})
				})
			})

			it("should throw error when there's error in cloud code", function(){
				return createApp()
				.then(app=>{
					var code="var a }";
					return $.ajax({
						type:'patch',
						url:`${root}/${app._id}`,
						data:{cloudCode:code},
						error:null
					})
				})
				.then(fail,error=>expect(error).toBe("Unexpected token }"))
			})
		})

		describe("delete",function(){
			it("can be done", function(){
				return createApp()
				.then(app=>$.ajax({
						type:"delete",
						url:`${root}/${app._id}`
					}))
				.then(a=>expect(a).toBe(true))
			})

		})

		describe("query", function(){
			it("can not get any information without admin key", function(){
				return $.get(root,{headers:{
						"X-Application-Id":"test",
						"X-Session-Token":config.testerSessionToken
					}, error: null})
				.then(fail,error=>expect(error).toMatch(/no hack/gi))
			})

			it("can get its own applictions", function(){
				return $.get(root)
					.then(docs=>{
						docs.results && docs.results.forEach(function(doc){
							expect(doc.author.username).toBe(config.tester.username)
						})
					})
			})

			it("can NOT get others applictions by id", function(){
				return $.get(root+"/"+config.server.adminKey,{error:null})
					.then(fail,error=>expect(error).toMatch(/no hack/gi))
			})

			it("can NOT get others applictions by query", function(){
				return $.get(root+"?query="+JSON.stringify({"author._id":"lalalic"}))
					.then(docs=>{
						docs.results && docs.results.forEach(function(doc){
							expect(doc.author.username).toBe(config.tester.username)
						})
					})
			})
		})
	})

	describe("management", function(){
		var _root, extra=`appman=${config.testApp.apiKey}`;
		beforeAll(()=>{
			_root=root
			root=host+'/schemas'
		})
		afterAll(()=>root=_root)

		it("to create schemas and indexes", function(){
			//$.ajax({type:'post', url:root, })
		})

		it("to change schemas and indexes", function(){})

		it("to drop a collection", function(){})

		it("to get indexes", function(){})

		it("to get schemas", function(){})

		it("to get collection data", function(){})

		it("to get user data without password", function(){})

		it("to upload app client code", function(){
			var clientcode=require('fs').createReadStream(__dirname+"/data/clientcode.html")
			return $.ajax({
				type:'post',
				url:`${root}/clientcode?`+extra,
				formData: {clientcode}
			}).then(r=>expect(r).toBe(config.testApp.apiKey))
		})

		it("to upload admin client code", function(){
			var clientcode=require('fs').createReadStream(__dirname+"/data/clientcode.html")
			return $.ajax({
				type:'post',
				url:`${root}/clientcode?appman=${config.server.adminKey}`,
				formData: {clientcode}
			}).then(r=>expect(r).toBe(config.server.adminKey))
		})
	})
})
