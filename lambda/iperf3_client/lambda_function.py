import os
import subprocess
import time
import json
import boto3
import random

dynamodb = boto3.client('dynamodb')
model_name_index = 4
value_index = 1


def run_cmd(cmd):
    return os.popen(cmd).read().strip("\n")


def network_test(server_ip, port):
    sp = subprocess.Popen(["./iperf3",
                           "-c",
                           server_ip,
                           "-p",
                           str(port),
                           "-R",
                           "-t",
                           "10",
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


def get_cpuinfo():
    buf = "".join(open("/proc/cpuinfo").readlines())
    cpu_info = buf.replace("\n", ";").replace("\t", "")
    cpu_info = cpu_info.split(';')[model_name_index].split(':')[value_index].lstrip(' ')
    return cpu_info


def lambda_handler(event, context):
    r_id, c_id = get_vm_id()

    cpu_model_name = get_cpuinfo()

    send_mbit_s, recv_mbit_s = network_test(event['server_ip_addr'], event['port'])

    dynamodb.put_item(TableName='concurrent_execution',
        Item={
          'r_id': {'S': r_id},
          'timestamp': {'N': str(int(time.time()) + random.randrange(1, 100))},
          'c_id': {'S': c_id},
          'cpu_model_name': {'S': cpu_model_name},
          'lambda_mem_limit': {'S': context.memory_limit_in_mb},
          'port': {'S': str(event['port'])},
          'send_mbit_per_sec': {'S': str(send_mbit_s)},
          'recv_mbit_per_sec': {'S': str(recv_mbit_s)}
        }
    )