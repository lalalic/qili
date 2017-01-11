describe("user", function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/users",
		$=require('./ajax')();
	
	const phone=config.tester.phone
	const code="123456"
	const salt=config.createSalt(code,phone)
	const verifyPhone={phone,code,salt}
	
	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now()
	const expectError=e=>e

	describe("Account service", function(){
		it("post to signup", function(){
			var username=`test${uid++}`,
				user={username,password:`abc${uid++}`,verifyPhone:{phone:"7890-789",code,salt:config.createSalt(code,"7890-789")}}
			return $.ajax({
				type:"post",
				url: host+"/signup",
				data:user
			}).then(a=>{
				expect(a.sessionToken).toBeDefined()
				expect(a.username).toBe(username)
				expect(a.password).toBeUndefined()
			})
		})

		it("post /login", function(){
			let user=config.tester
			return $.ajax({
					type:"post",
					url: host+"/login",
					data:{username:user.username, password: user.__password,verifyPhone}
				})
				.then(a=>{
					expect(a.sessionToken).toBeDefined()
					expect(a.username).toBe(user.username)
					expect(a.password).toBeUndefined()
				})

		})

		it("get /me with header 'X-Session-Token' of signedIn user to restore session", function(){
			let user=config.tester
			return $.ajax({
					type:"post",
					url: host+"/login",
					data:{username:user.username, password: user.__password,verifyPhone}
				})
				.then(a=>$.get(host+"/me",{headers:{'X-Session-Token':a.sessionToken}})
					.then(user=>{
						expect(user.sessionToken).toBeDefined()
						expect(user.username).toBe(a.username)
						expect(user.password).toBeUndefined()
					})
				)
		})

		it("get /me with header 'X-Session-Token' of not signedIn user to restore session", function(){
			return $.get(host+"/me",{headers:{'X-Session-Token':'test54'},error: null})
				.then(fail,expectError)
		})
	})

	it("/requestPhoneCode for exist user", function(){
		return $.ajax({
			type:"post",
			url: host+"/requestPhoneCode",
			data:{phone,existence:true}
		})
	})
	
	it("/requestPhoneCode for non-exist user", function(){
		return $.ajax({
			type:"post",
			url: host+"/requestPhoneCode",
			data:{phone:"asfdsf",existence:false}
		})
	})
	
	it("/requestPhoneCode, existence:true, but phone not used, should throw error", function(){
		return $.ajax({
			type:"post",
			url: host+"/requestPhoneCode",
			data:{phone:"erasdfs",existence:true},
			error:null
		}).then(fail, expectError)
	})

	describe("ping", function(){
		it("ping", function(){
			return $.ajax({
				type:'get',
				url:`${host}/ping`
			})
		})
		
		it("xping", function(){
			return $.ajax({
				type:'get',
				url:`${host}/xping`
			}).then(username=>expect(username).toBe(config.tester.username))
		})
	})

	it("basic auth", function(){
		return $.ajax({
			type:'get',
			url:`${host}/xping`,
			headers:{
				"X-Application-Id": config.server.adminKey,
				Authorization: `Basic ${new Buffer(`${config.server.root}:${config.server.rootPassword}`).toString('base64')}`,
				"X-Session-Token": undefined
			}
		}).then(username=>expect(username).toBe(config.server.root))
	})

})
