/* LIBRARY */
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var timeout = require('connect-timeout')
var fs = require('fs');

const { spawn, execSync } = require('child_process');
AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});

var s3 = new AWS.S3();

/* QUEUE */
function Queue() {
    this.data = [];
}

Queue.prototype.add = function(record) {
    this.data.unshift(record);
}

Queue.prototype.remove = function() {
    this.data.pop();
}

Queue.prototype.first = function() {
    return this.data[0];
}
Queue.prototype.last = function() {
    return this.data[this.data.length - 1];
}
Queue.prototype.size = function() {
    return this.data.length;
}
Queue.prototype.elementRemove = function(element) {
    this.data.splice( this.data.indexOf(element), 1 );
}

const download_file_list = new Queue();
const download_container_list = new Queue();
const map_container_list = new Queue();

/* JOB INFO */
var job_type = "";
var download_container;
var total_container;
var file_number;
var start;
var total_download_time = 0;

var isFirstCheck = false;
var total_download_time = 0;
var min_download_time = 0;
var max_download_time = 0;
var max_network_bandwidth = 0;
var total_map_time = 0;

var current_container = 0;
var current_download_container = 0;
var current_file_idx = 0;
var cnt_map_done = 0;

/* WEB SERVER */
var orchstrator = express();
var port = 8080;
orchstrator.use(bodyParser.urlencoded({extended:true}));
orchstrator.use(timeout('100s'))
http.createServer(orchstrator).listen(port, function() {
    console.log('orchstrator on ' + port + '...');
});

var file_list = [];
var s_recv = get_network_packet();

function docker_rm() {
    console.log("[*] Docker Container Remove .. ");
    var response = execSync('docker ps -q').toString();
    response = response.split("\n");
    for (idx in response) {
        docker_id = response[idx];
        console.log("[-] Docker Container Stop : " + docker_id );
        spawn('docker', ['stop', docker_id], {
            detached: true
        });
    }
}

function get_network_packet() {
   buf = fs.readFileSync('/proc/net/dev', 'utf8').toString();
   buf = buf.split("\n");
   for (item in buf) {
       item = buf[item].split(":")
       if("docker0" == item[0]) {
           info = item[1].split(' ')
           info = info.filter(function(item) {
               return (parseInt(item) == item);
           });
           recv = info[8];
           return Number(recv);
       }
   }
}

function message(port, f_id) {
    console.log('[DOCKER CONTAINER DOWNLOADER SUBMIT] ' + port + ' file : ' + f_id);

    var postData = 'f_id='+f_id;

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    };

    var options = {
        hostname : '172.17.0.1',
        port : port,
        path : '/download',
        method: 'POST',
        headers: headers
    }

    var post_req = http.request(options, function(res) {
    });

    post_req.write(postData);
    post_req.end();
}

orchstrator.post('/job_submission', function(req, res, next) {
    download_container = req.body.download_container;
    file_number = req.body.file_number;

    console.log('[JOB SUBMISSION]');
    console.log(' - Download Container : ' + download_container);
    console.log(' - Download File Number : ' + file_number);
    res.send('[JOB SUBMISSION] Done .. ');

    var params = {
        Bucket: "kmu-serverless-pavlo-dataset",
        MaxKeys: file_number
    };
    s3.listObjects(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else {
            data.Contents.forEach(item => {
                file_list.push(item.Key);
            });
            console.log(file_list);
            start = new Date();
            for(var idx = 0; idx < download_container; idx++) {
                var worker_id = "worker" + String(idx);
                var worker_port = port + idx + 1;
                var docker_port = worker_port + ':' + worker_port
                spawn('docker', ['run', '-dit', '--rm', '--name', worker_id, '-p', docker_port, '--cpus', '0.08', '--memory', '128m', '-v', '/tmp:/tmp', '-v', '/home/ec2-user/.aws/:/root/.aws/', '--entrypoint', '/usr/bin/node', 'kmubigdata/aws-lambda:latest', '/tmp/download.js', worker_id, worker_port], {
                    detached: true
                });

                download_container_list.add(worker_id);
                current_container += 1;
                console.log('[DOCKER CONTAINER DOWNLOADER SERVER CREATE] ' + worker_id + ' port : ' + worker_port);
            }
        }
    });
});

/**
 * Router - Downloader Done
*/
orchstrator.post('/downloader_done', function(req, res, next) {
    res.send('[DOWNLOADER DONE]');

    var c_id = req.body.c_id;
    var worker_port = req.body.port;
    var end = new Date() - start;
    console.log('[DOCKER CONTAINER DOWNLOADER READY] ' + c_id + ' on ' + worker_port + ' ... Time : ' + end);

    message(worker_port, file_list[current_file_idx]);
    current_file_idx += 1;
});

/**
 * Router - download
*/
orchstrator.post('/download', function(req, res, next) {
    res.send('[JOB DONE]');

    var worker_id = req.body.c_id;
    var worker_port = Number(req.body.port);
    var file_id = req.body.f_id;
    var download_time = Number(req.body.download_time);
    var tmp_write_time = Number(req.body.tmp_write_time);
    total_download_time += download_time;
    var end = new Date() - start;

    if(!isFirstCheck) {
        min_download_time = download_time;
        max_download_time = download_time;
        isFirstCheck = true;
    } else {
        if(download_time > max_download_time)
            max_download_time = download_time;
        if(download_time < min_download_time)
            min_download_time = download_time;
    }

    download_file_list.add(file_id);

    console.log('---[DOWNLOAD DONE] ' + worker_id + ' port ' + worker_port + ' :::  Download File : ' + file_id + ' / Download Time : ' + download_time + '(ms) / Disk Write Time : ' + tmp_write_time + '(ms) / Time  : ' + end + '(ms)');

    if(Number(file_number) > Number(current_file_idx)) {
       message(worker_port, file_list[current_file_idx]);
       current_file_idx += 1
    } else { // Nothing to Download Job -> Change to Upload Job
        download_container_list.elementRemove(worker_id);
        map_container_list.add(worker_id);
    }

    if(file_list[file_number-1] == file_id) {
        console.log('[JOB FINISH]');
        console.log(' - Min Download Time : ' + min_download_time + '(ms)');
        console.log(' - Average Download Time : ' + (total_download_time / file_number) + '(ms)');
        console.log(' - Max Download Time : ' + max_download_time + '(ms)');
        console.log(' - Total Download Time : ' + total_download_time + '(ms)');
        console.log(' - MAX Network Bandwidth : ' + max_network_bandwidth + '(MB/S)');
        console.log(' - Response Time : ' + end + '(ms)');
        docker_rm();
    }
});

/**
 * Router - Uploader Done
*/
orchstrator.post('/uploader_done', function(req, res, next) {
    res.send('[UPLOADER DONE]');

    var c_id = req.body.c_id;
    var worker_port = req.body.port;
    var end = new Date() - start;
    console.log('[DOCKER CONTAINER UPLOADER READY] ' + c_id + ' on ' + worker_port + ' ... Time : ' + end);

    message(worker_port, file_list[current_file_idx]);
    current_file_idx += 1;
});

/**
 * Router - upload
*/
orchstrator.post('/upload', function(req, res, next) {
    res.send('[JOB DONE]');

    var worker_id = req.body.c_id;
    var worker_port = Number(req.body.port);
    var file_id = req.body.f_id;
    var upload_time = Number(req.body.upload_time);
    total_upload_time += upload_time;
    var end = new Date() - start;

    if(!isFirstCheck) {
        min_upload_time = upload_time;
        max_upload_time = upload_time;
        isFirstCheck = true;
    } else {
        if(upload_time > max_upload_time)
            max_upload_time = upload_time;
        if(upload_time < min_upload_time)
            min_upload_time = upload_time;
    }

    download_file_list.add(file_id);

    console.log('---[UPLOAD DONE] ' + worker_id + ' port ' + worker_port + ' :::  Upload File : ' + file_id + ' / Upload Time : ' + upload_time + '(ms) / Time  : ' + end + '(ms)');

    if(Number(file_number) > Number(current_file_idx)) {
       message(worker_port, file_list[current_file_idx]);
       current_file_idx += 1
    } else { // Nothing to Download Job -> Change to Upload Job
        download_container_list.elementRemove(worker_id);
    }

    if(file_list[file_number-1] == file_id) {
        console.log('[JOB FINISH]');
        console.log(' - Min Upload Time : ' + min_upload_time + '(ms)');
        console.log(' - Average Upload Time : ' + (total_upload_time / file_number) + '(ms)');
        console.log(' - Max Upload Time : ' + max_upload_time + '(ms)');
        console.log(' - Total Upload Time : ' + total_upload_time + '(ms)');
        console.log(' - MAX Network Bandwidth : ' + max_network_bandwidth + '(MB/S)');
        console.log(' - Response Time : ' + end + '(ms)');
        docker_rm();
    }
});

setInterval(function(){
    e_recv = get_network_packet();
    var network_bandwidth = (e_recv - s_recv) / (1024 * 1024) / 1
    if(network_bandwidth > max_network_bandwidth)
        max_network_bandwidth = network_bandwidth;
    var end = new Date() - start;
    console.log("[*] NETWORK BANDWIDTH " + end + " : " + network_bandwidth + " MB/S");
    s_recv = e_recv;
}, 1000);