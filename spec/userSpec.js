describe("user", function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/users",
		$=require('./ajax')(),
		_=require('underscore');

	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(), NULL=(a)=>a, createUser, login

	describe("Account service", function(){
		it("post to signup", createUser=function(done){
			var username=`test${uid++}`,
				user={username,password:`abc${uid++}`,email:`${username}@139.com`}
			return $.ajax({
				type:"post",
				url: root,
				data:user
			}).then(function(a){
				expect(a.sessionToken).toBeDefined()
				expect(a.username).toBe(username)
				expect(a.password).toBeUndefined()
				done()
				a._raw=user
				return a
			},done)
		})

		it("get /login", login=function(done){
			return createUser(NULL).catch($.fail(done,"can't create a user before login"))
				.then((user)=>$.get(`${host}/login?username=${user.username}&password=${user._raw.password}`)
					.then((a)=>{
							expect(a.sessionToken).toBeDefined()
							expect(a.username).toBe(user.username)
							expect(a.password).toBeUndefined()
							done()
							a._raw=user._raw
							return a
						}, done))

		})

		it("get /me with header 'X-Session-Token' of signedIn user to restore session", function(done){
			login(NULL).catch($.fail(done,"can't login user"))
				.then((a)=>$.get(host+"/me",{headers:{'X-Session-Token':a.sessionToken}})
					.then(function(user){
							expect(user.sessionToken).toBeDefined()
							expect(user.username).toBe(a.username)
							expect(user.password).toBeUndefined()
							done()
						},done))
		})

		it("get /me with header 'X-Session-Token' of not signedIn user to restore session", function(done){
			$.get(host+"/me",{headers:{'X-Session-Token':'test54'},error: null})
				.then(done,function(error){
					expect(error).toMatch(/No Session/i)
					done()
				})
		})
	})

	it("/requestPasswordReset", function(done){
		$.ajax({
			type:"get",
			url: host+"/requestPasswordReset",
			data:{old:"123456",password:"aa"},
			error: null
		}).then(done, function(error){
			expect(error).toBe("Not support yet")
			done()
		})
	})
})
