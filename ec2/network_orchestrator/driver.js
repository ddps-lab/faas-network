var http = require('http');

/**
 * Argument
 */
const args = process.argv;
var download_container = args[2];
var file_number= args[3];

const postData = 'download_container='+download_container+'&file_number='+file_number

var headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
};

var options = {
    hostname: '172.17.0.1',
    port: 8080,
    path: '/job_submission',
    method: 'POST',
    headers: headers
};

var post_req = http.request(options, function(res) {
    var resData = '';
    res.on('data', function(chunk) {
        resData += chunk;
    });
    res.on('end', function() {
        console.log('orchestrator : '+resData);
    });
});

post_req.write(postData);
post_req.end();
