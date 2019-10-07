import subprocess


def lambda_handler(event, context):
    bs = 'bs=' + event['bs']
    count = 'count=' + event['count']
    print(bs)
    print(count)

    out_fd = open('/tmp/io_write_logs', 'w')
    write = subprocess.Popen(['dd', 'if=/dev/zero', 'of=/tmp/out', bs, count, 'conv=fdatasync'], stderr=out_fd)
    write.communicate()

    output = subprocess.check_output(['ls', '-alh', '/tmp/'])
    print(output)

    with open('/tmp/io_write_logs') as f:
        logs = f.readlines()
        print(logs)
        result = logs[2].split(',')

    rm = subprocess.Popen(['rm', '-rf', '/tmp/out'], stderr=out_fd)
    rm.communicate()

    output = subprocess.check_output(['ls', '-alh', '/tmp/'])
    print(output)

    return result
