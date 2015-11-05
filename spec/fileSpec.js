//File Service is based on Qiniu storage Cloud
/*
File Service works as business server to provide token to client, and make qiniu return {url} directly. The token should be expired in a few minutes.

*/
describe('File Service', function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/files",
		$=require('./ajax')(),
		_=require('underscore'),
		qiniu=require('qiniu');

	beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

	it('get upload token',function(done){
		$.get(root+"/token").then(function(token){
			expect(token).toBeDefined()
		},done)
	},1000)

	it('The token should be expired in a few minutes', function(done){
		$.get(root+"/token?policy="+JSON.stringify({expires:1}))
		.then(function(token){
			expect(token).toBeTruthy()
			var now=Date.now()
			while(Date.now()<(now+1000));
			var key="test/"+Date.now()
			qiniu.io.put(token,key,"test",null,function(error,response){
				if(error)
					expect(error).toBeTruthy();
				else
					fail("should expire")
				done()
			})
		},done)
	},2000)

	it("is able to search files",function(){

	})

	describe("upload", function(){
		it("images with information in qili server", function(){

		})

		it("docx with information in qili server", function(){

		})

		it("replace", function(){})

		it("remove", function(){})

		it("for entity", function(){})
	})


})
