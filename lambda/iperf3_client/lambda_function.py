import boto3
import subprocess
import time
import json
import random

dynamodb = boto3.client('dynamodb')
model_name_index = 4
value_index = 1


def network_test(server_ip, server_port, test_time, reverse):
    reverse_option = ""
    if reverse:
        reverse_option = "R"

    sp = subprocess.Popen(["./iperf3",
                           "-c",
                           server_ip,
                           "-p",
                           str(server_port),
                           reverse_option,
                           "-t",
                           test_time,
                           "-Z",
                           "-J"
                           ],
                          stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE)
    out, err = sp.communicate()

    kilo = 1000
    byte = 8

    info_end = json.loads(out)["end"]
    print(info_end)

    file_size = info_end["sum_sent"]["bytes"] / kilo / kilo
    sender = info_end["sum_sent"]
    receiver = info_end["sum_received"]
    send_mbit_s = sender["bits_per_second"] / kilo / kilo / byte
    recv_mbit_s = receiver["bits_per_second"] / kilo / kilo / byte

    print("file_size : " + str(file_size))
    print("sender : " + str(send_mbit_s))
    print("receiver : " + str(recv_mbit_s))

    return send_mbit_s, recv_mbit_s


def get_vm_id():
    buf = open('/proc/self/cgroup').read().split('\n')[-3].split('/')
    vm_id, c_id = buf[1], buf[2]
    return vm_id, c_id


def lambda_handler(event, context):
    server_ip = event['server_ip']
    server_port = event['server_port']
    test_time = event['test_time']
    reverse = event['reverse']

    r_id, c_id = get_vm_id()

    send_mbit_s, recv_mbit_s = network_test(server_ip, server_port, test_time, reverse)

    """
    DynamoDB Table
     - partition key -> r_id(String)
     - sort_key -> timestamp(Number)
    """
    dynamodb.put_item(TableName='[YOUR_DYNAMODB_TABLE_NAME]',
        Item={
          'r_id': {'S': r_id},
          'timestamp': {'N': str(int(time.time()) + random.randrange(1, 100))},
          'c_id': {'S': c_id},
          'lambda_mem_limit': {'S': context.memory_limit_in_mb},
          'port': {'S': str(event['port'])},
          'send_mbit_per_sec': {'S': str(send_mbit_s)},
          'recv_mbit_per_sec': {'S': str(recv_mbit_s)}
        }
    )