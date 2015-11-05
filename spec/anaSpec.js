describe("analyze service", function(){
    var config=require('./config')

    beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

})
