/* LIBRARY */
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

var s3 = new AWS.S3();

/**
 * Argument
*/
const args = process.argv;
var c_id = process.argv[2];
var port = process.argv[3];

/* WEB SERVER */
var downloader = express();
downloader.use(bodyParser.urlencoded({extended:true}));

http.createServer(downloader).listen(port, function() {
    console.log('downloader on ' + port + ' ...');
});

/* Container Doen  */
const postDoneData = 'c_id='+c_id+'&port='+port;

/**
 * Http Request
*/
var headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postDoneData)
};

var options = {
    hostname : '172.17.0.1',
    port : 8080,
    path : '/downloader_done',
    method: 'POST',
    headers: headers
};

var post_req = http.request(options, function(res) {
});
post_req.write(postDoneData);
post_req.end();
post_req.on('error', function(e) {
    console.error(e);
});

downloader.post('/download', function(req, res, next) {
    res.send('[DONE]');
    var key = req.body.f_id;

    var params = {
        Bucket: "kmu-serverless-pavlo-dataset",
        Key: key
    };

    start = new Date();
    s3.getObject(params, function(err, data){
        if(err) {
            console.log("Error", err);
        } else {
            console.log("Success S3 getObject!");

            var s3DownloadTime = new Date() - start;
            console.log("Download Time : " + s3DownloadTime + " ms");
            var objectSize = data.ContentLength;

            var write = new Date();
            fs.writeFileSync('/tmp/'+String(key), data.Body, 'utf8');
            var tmpWriteTime = new Date() - write;

            const postData = 'c_id='+c_id+'&port='+port+'&f_id='+key+'&download_time='+s3DownloadTime+'&tmp_write_time='+tmpWriteTime;

            /**
             * Http Request
            */
            var headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            };

            var options = {
                hostname: '172.17.0.1',
                port: 8080,
                path: '/download',
                method: 'POST',
                headers: headers
            };

            var post_req = http.request(options, function(res) {
            });
            post_req.write(postData);
            post_req.end();
        }
    });
});
