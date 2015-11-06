describe('File Service', function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/files",
		$=require('./ajax')(),
		qiniu=require('qiniu');

	beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(),
		NULL=()=>1,
		getToken,upload;

	describe("policy",function(){
		it('token',getToken=function(done,more){
			return $.get(`${root}/token?${more}`).then(function(r){
				expect(r.token).toBeDefined()
				done()
				return r.token
			},done)
		})

		it('token for save',function(done){
			getToken(NULL,"save=1").then((token)=>{
				expect(token).toBeDefined()
				done()
			},done)
		})

		it('token with life of 1 second', function(done){
			getToken(NULL,`policy=${JSON.stringify({expires:1})}`).then((token)=>{
				var now=Date.now()
				while(Date.now()<(now+1000));
				var key="test/"+Date.now()
				qiniu.io.put(token,key,"test",null,(error)=>{
					console.dir(error)
					error ? expect(error).toMatch(/expired/i) : fail("token should be expired")
					done()
				})
			},done)
		},8000)
	})

	describe("upload", function(){
		fit("then forget", function(done){
			getToken(NULL).then((token)=>{
				qiniu.io.put(token,null,"test",null,(error,res)=>{
					expect(res).toBeDefined()
					console.dir(res)
					done()
				})
			},done)
		}, 7000)

		it("and save back to server", function(){})

		it("and save back for entity", function(){})

		it("images with information in qili server", function(){

		})

		it("docx with information in qili server", function(){

		})

		it("for replacement", function(){})
	})

	describe("search", function(){
		it("by entity",function(){

		})
	})

	describe("remove", function(){
		it("one file", function(){})

		it("remove files for entity", function(){})

		it("trim file system", function(){})
	})
})
