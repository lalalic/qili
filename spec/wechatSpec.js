describe("wechat (/:appkey/wechat)", function(){
    var config=require('./config'),
		host=config.host,
		root=host+"/test/wechat",
		$=require('./ajax')();

    var token=config.server.token,
        nonce="asdfkafdljadsf",
        echostr="hrlslkjsfg",
        crypto = require('crypto');;

    function signature(timestamp){
        var shasum = crypto.createHash('sha1');
        var arr = [token, timestamp, nonce].sort();
        shasum.update(arr.join(''));
        return shasum.digest('hex')
    }


    beforeAll((done)=>config.init().then(done,done)	)
	afterAll((done)=>config.release().then(done,done))

    it("validate token by GET",function(done){
        var timestamp=Date.now()+""
        $.ajax({
            type:'get',
            url:root+"?nonce="+nonce+"&timestamp="+timestamp+"&echostr="+echostr+"&signature="+signature(timestamp)
        }).then(function(a){
            expect(a).toBe(echostr)
            done()
        }, done)
    })

    xit("post message", function(done){
        var content="hello wechat"
        $.ajax({
            type:'post',
            dataType:'xml',
            headers:{'content-type':'xml'},
            url:root,
            data:`<xml>
 <ToUserName><![CDATA[toUser]]></ToUserName>
 <FromUserName><![CDATA[fromUser]]></FromUserName>
 <CreateTime>1348831860</CreateTime>
 <MsgType><![CDATA[text]]></MsgType>
 <Content><![CDATA[${content}]]></Content>
 <MsgId>1234567890123456</MsgId>
 </xml>`
        }).then((m)=>{
            expect(m).toBe(content)
            done()
        },done)
    })
})
