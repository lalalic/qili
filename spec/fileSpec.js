"use strict"

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
		getKey=(id)=>`${config.testApp.apiKey}/user/${config.tester._id}/${id||(uid++)}`;

	it('token',getToken=function(done){
		return $.get(`${root}/token`).then(function(r){
			expect(r.token).toBeDefined()
			expect(r.expires).toBeDefined()
			done()
			return r.token
		},done)
	})

	describe("upload", function(){
		let doUpload=null;
		fit("simple content and get url", upload=function(done, content, keyId){
			return getToken(NULL).then(doUpload=(token)=>{
				console.info(token)
				return new Promise((resolve, reject)=>
					qiniu.io.put(token,getKey(keyId),content||"test",null, (e,ret)=>{
						if(e){
							console.dir(e)
							fail(e);
							reject(e)
							done()
							return
						}
						console.dir(ret)
						expect(ret.url).toBeDefined()
						expect(ret.url).toMatch(`${config.server.qiniu.accessURL}/${config.testApp.apiKey}/user/${config.tester._id}/`)
						done()
						resolve(ret.url)
					})
				)
			},done)
		}, 8000)

		it("upload multiple times with one token", (done)=>{
			getToken(NULL).then((token)=>{
				Promise.all([
					doUpload(token),
					doUpload(token),
					doUpload(token)
				]).then(done,$.fail(done))
			},done)
		})

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
