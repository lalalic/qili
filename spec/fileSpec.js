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
		upload=(done, content, keyId,extra)=>{
			return getToken(NULL).then((token)=>{
				return new Promise((resolve, reject)=>
					qiniu.io.put(token,getKey(keyId),content||"test",extra, (e,ret)=>{
						if(e){
							reject(e)
							done()
							return
						}
						expect(ret.url).toBeDefined()
						expect(ret.url).toMatch(`${config.server.qiniu.accessURL}/${config.testApp.apiKey}/user/${config.tester._id}/`)
						done()
						resolve(ret)
					})
				)
			},done)
		}

		it("simple content and get url", (done)=>upload(done).catch(fail), 8000)

		it("upload multiple times with one token", (done)=>{
			let doUpload=(token)=>{
				return new Promise((resolve, reject)=>
					qiniu.io.put(token,getKey(),"test",null, (e,ret)=>{
						if(e){
							fail();
							reject(e)
							return
						}
						expect(ret.url).toBeDefined()
						expect(ret.url).toMatch(`${config.server.qiniu.accessURL}/${config.testApp.apiKey}/user/${config.tester._id}/`)
						resolve(ret.url)
					})
				)
			};
			getToken(NULL).then((token)=>{
				Promise.all([
					doUpload(token),
					doUpload(token),
					doUpload(token)
				]).then(done,$.fail(done))
			},done)
		},8000)

		it("can't replace", function(done){
			upload(NULL,"test replace","replaceit").then(()=>{
				upload(NULL,"test replace2","replaceit").then(()=>{
					fail("should not be replaced")
					done()
				},done)
			},$.fail(done,"first upload failed"))
		})

		fit("with mimeType, entity, and crc", function(done){
			upload(NULL,"test",uid++,{
				mimeType:"text/plain",
				params:{
					"x:entity":JSON.stringify({kind:'user',_id:config.tester._id}),
					"x:crc0":534
				}
			}).then((file)=>{
				console.dir(file)
				expect(file.mimeType).toBe("text/plain")
				expect(file.entity).toBeDefined()
				//expect(file.entity._id).toBe(config.tester._id)
				expect(file.crc).toBe(5)
				done()
			},$.fail(done))
		})

		it("images with information in qili server", function(){

		})

		it("docx with information in qili server", function(){

		})
	})

	describe("remove", function(){
		it("one file", function(){})

		it("remove files for entity", function(){})

		it("trim file system", function(){})
	})
})
