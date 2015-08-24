describe("wechat", function(){
    var token="test.token",
        nonce="asdfkafdljadsf",
        echostr="hrlslkjsfg",
        crypto = require('crypto');;

    function signature(timestamp){
        var shasum = crypto.createHash('sha1');
        var arr = [token, timestamp, nonce].sort();
        shasum.update(arr.join(''));
        return shasum.digest('hex')
    }


    var config=require('./config'),
		host=config.host,
		root=host+"/test/wechat",
		$=require('./ajax')(),
		_=require('underscore'),
		promise=require('node-promise');


    it("validate url(/1/:appKey/wechat), token by GET",function(done){
        var timestamp=Date.now()+""
        $.ajax({
            type:'get',
            url:root+"?nonce="+nonce+"&timestamp="+timestamp+"&echostr="+echostr+"&signature="+signature(timestamp)
        }).then(function(a){
            expect(a).toBe(echostr)
            done()
        }, done)
    })

    xdescribe("reply to message", function(){
        it("text", function(done){
            $.ajax({
                type:'post',
                url:root,
            }).then(function(){

            })
        })

        it("image", function(done){
            done();
        })
    })
})
