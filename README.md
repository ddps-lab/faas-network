# Network in Serverless Cloud Function Service
## PUBLICATION
_Jeongchul Kim, Jungae Park and Kyungyong Lee, 'Network in Serverless Cloud Function Service',
AMGCC 2019[link](http://htcaas.kisti.re.kr/wiki/index.php/AMGCC19), 06/2019 [pdf]()_

### iPerf3 experiment
iperf3 is widely used as a network micro-benchmark.
1. EC2(iperf3 server)
 - Start your EC2 instance, Configure EC2 Network and Subnet(same Lambda functions)
 - Configure your Security Group(5201 port - iperf3 server default port)
 - Check your EC2 internal-ip (ex : 172.31.XX.XX)
 - Install iperf3 
   $ sudo yum -y install iperf3
 - Server start
   $ iperf3 -s 
 - If you want to multiple test(concurrent exeuction), executed this [code](https://github.com/kmu-bigdata/faas-network/blob/master/ec2/iperf3_server/restart_iperf_server.sh)

2. Lambda(iperf3 client)
 - Check your Lambda VPC Permission AWSLambdaVPCAccessExecutionRole
 - Config your Lambda Network(VPC, Subnet)
 - Using iperf3 command, we can let a client (function run-time) work as either a data uploader (default option) or downloader (with -R oprtion).
 - Lambda code(single test) : [iperf3_client](https://github.com/kmu-bigdata/faas-network/tree/master/lambda/iperf3_client)
 - Lambda Invocation code(concurrent test) : [invoke_iperf3_concurrent_execution](https://github.com/kmu-bigdata/faas-network/blob/master/lambda/invoke_iperf3_concurrent_execution/lambda_function.py)

#### single test
![image](https://user-images.githubusercontent.com/10591350/57977928-41614c00-7a3d-11e9-9692-99a66591ddbc.png)

#### concurrent test
![image](https://user-images.githubusercontent.com/10591350/57977954-c77d9280-7a3d-11e9-8962-be83320e7b6b.png)
