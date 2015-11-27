describe("application log service should provide", function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/logs",
		$=require('./ajax')(),
		INITAPP=10, ACCESS=9,ERROR=2,WARN=1,INFO=0;

	beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

	var headers={
		"X-Application-Id":config.server.adminKey,
		"X-Session-Token":config.testerSessionToken
	}
	function changeCloudCode(done,f,data,appId){
		var code="("+f.toString()+")(Cloud"+(data ? ","+JSON.stringify(data) : '')+");"
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

	function changeLogLevel(done,level){
		return $.ajax({
			type:'patch',
			url:`${host}/apps/${config.testApp._id}`,
			data:{logLevel:level},
			headers
		}).then(function(doc){
			expect(doc.updatedAt).toBeDefined()
			return $.get(`${host}/apps/${config.testApp._id}`,{headers}).then(function(doc){
				expect(doc.logLevel).toBe(level)
			},done)
		},done)
	}

	describe("individual application level log, including ", function(){
		it("http access log", function(done){
			$.get(root)
			.then(function(docs){
				var len=docs.results.length
				$.get(root)
				.then(function(docs){
					expect(docs.results.length).toBeGreaterThan(0)
					done()
				},done)
			},done)
		})

		describe("query", function(){
			it("all logs", function(done){
				$.get(root)
				.then(function(docs){
					expect(docs.results.length).toBeGreaterThan(0)
					done()
				},done)
			})

			describe("by level", function(){
				it("access log", function(done){
					$.get(root+"?query="+JSON.stringify({level:ACCESS}))
					.then(function(docs){
						expect(docs.results).toBeDefined()
						expect(docs.results.length).toBeGreaterThan(0)
						done()
					},done)
				})

				it("error log", function(done){
					changeCloudCode(done,function(Cloud){
						Cloud.define('test',function(req, res){
							console.error("error log")
							res.success("good")
						})
					}).then(function(){
						changeLogLevel(done,ERROR).then(function(){
							$.get(root+"?query="+JSON.stringify({level:ERROR}))
							.then(function(docs){
								expect(docs.results).toBeDefined()
								var len=docs.results.length
								$.get(host+"/functions/test")
								.then(function(m){
									expect(m).toBe('good')
									$.get(root+"?query="+JSON.stringify({level:ERROR}))
									.then(function(docs){
										expect(docs.results).toBeDefined()
										expect(docs.results.length-len).toBe(1)
										done()
									},done)
								},done)
							},done)
						})
					})
				})

				it("warning log", function(done){
					changeCloudCode(done,function(Cloud){
						Cloud.define('test',function(req, res){
							console.warn("warn log")
							res.success("good")
						})
					}).then(function(){
						changeLogLevel(done,WARN).then(function(){
							$.get(root+"?query="+JSON.stringify({level:WARN}))
							.then(function(docs){
								expect(docs.results).toBeDefined()
								var len=docs.results.length
								$.get(host+"/functions/test")
								.then(function(m){
									expect(m).toBe('good')
									$.get(root+"?query="+JSON.stringify({level:WARN}))
									.then(function(docs){
										expect(docs.results).toBeDefined()
										expect(docs.results.length-len).toBe(1)
										done()
									},done)
								},done)
							},done)
						})
					})
				})

				it("info log", function(done){
					changeCloudCode(done,function(Cloud){
						Cloud.define('test',function(req, res){
							console.info("info log")
							console.log('info log')
							res.success("good")
						})
					}).then(function(){
						changeLogLevel(done,INFO).then(function(){
							$.get(root+"?query="+JSON.stringify({level:INFO}))
							.then(function(docs){
								expect(docs.results).toBeDefined()
								var len=docs.results.length
								$.get(host+"/functions/test")
								.then(function(m){
									expect(m).toBe('good')
									$.get(root+"?query="+JSON.stringify({level:INFO}))
									.then(function(docs){
										expect(docs.results).toBeDefined()
										expect(docs.results.length-len).toBe(2)
										done()
									},done)
								},done)
							},done)
						})
					})
				})
			})
		})

		describe("log level on application", function(){
			it("set on application", function(done){
				changeLogLevel(done,INFO)
				.then(done,done)
			})

			it("access is lowest level, and always logged", function(done){
				$.get(root+"?query="+JSON.stringify({level:ACCESS}))
				.then(function(docs){
					expect(docs.results).toBeDefined()
					var len=docs.results.length
					changeLogLevel(done,99)
					.then(function(){
						$.get(root+"?query="+JSON.stringify({level:ACCESS}))
							.then(function(docs){
								expect(docs.results).toBeDefined()
								expect(docs.results.length-len).toBe(1)
								done()
							},done)
					},done)
				},done)
			})

			it("only error logged", function(done){
				$.get(root).then(function(docs){//+1
					expect(docs.results).toBeDefined()
					var len=docs.results.length
					changeLogLevel(done,ERROR)
					.then(function(){
						changeCloudCode(done,function(Cloud){
							Cloud.define('test',function(req, res){
								console.error("error log")//+1
								console.info("hello")
								console.warn("good")
								res.success("good")
							})
						}).then(function(m){
							$.get(host+"/functions/test")//+1
							.then(function(m){
								expect(m).toBe('good')
								$.get(root)
								.then(function(docs){
									expect(docs.results).toBeDefined()
									expect(docs.results.length-len).toBe(3)
									done()
								},done)
							},done)

						},done)

					},done)
				},done)
			})
		})

		it("support dump logs, not finished", function(done ){
			fail("not implement")
			return done()
			$.get(`${root}/dump`).then((r)=>{
				expect(r.done).toBe(true)
				expect(r.message).toBe(/email/gi)
				done()
			}, done)
		})

		it("clear all logs", function(done){
			Promise.all([$.get(root),$.get(root),$.get(root),$.get(root),$.get(root)]).then(()=>
				$.get(root).then((logs)=>{
					expect(logs.results.length).toBeGreaterThan(3)
					$.post(`${root}/clear`).then((r)=>{
						expect(r.done).toBe(true)
						$.get(root).then((logs)=>{
							expect(logs.results.length).toBeLessThan(2)
							done()
						},done)
					}, done)
				},done)
			,done)

		})
	})
})
