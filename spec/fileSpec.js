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
		getToken,
		upload,
		getKey=()=>`${config.testApp.apiKey}/user/${config.tester._id}/${uid++}`;

	it('token',getToken=function(done){
		return $.get(`${root}/token`).then(function(r){
			expect(r.token).toBeDefined()
			expect(r.expires).toBeDefined()
			done()
			return r.token
		},done)
	})

	describe("upload", function(){
		fit("and save back to server", upload=function(done, content){
			getToken(NULL).then((token)=>{
				qiniu.io.put(token,getKey(),content||"test",null, (e,ret)=>{
					if(e){
						console.dir(e)
						fail(e);
					}
					expect(ret.url).toBeDefined()
					done()
				})
			},done)
		})

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
