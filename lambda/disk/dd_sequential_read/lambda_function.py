import subprocess


def lambda_handler(event, context):
    bs = 'bs=' + event['bs']
    count = 'count=' + event['count']
    print(bs)
    print(count)
    # File Write
    write = subprocess.Popen(['dd', 'if=/dev/zero', 'of=/tmp/out', bs, count, 'conv=fdatasync'])
    write.communicate()

    output = subprocess.check_output(['ls', '-alh', '/tmp/'])
    print(output)

    # Drop cache
    cache_fd = open('/tmp/cache_logs', 'w')
    drop_cache = subprocess.Popen(['echo', '3', '|', 'sudo', 'tee', '/proc/sys/vm/drop_caches'], stderr=cache_fd)

    with open('/tmp/cache_logs') as f:
        logs = f.readlines()
        print(logs)

    # File Read
    out_fd = open('/tmp/io_read_logs', 'w')
    read = subprocess.Popen(['dd', 'if=/tmp/out', 'of=/dev/null', bs, count, 'status=progress'], stderr=out_fd)
    read.communicate()

    with open('/tmp/io_read_logs') as f:
        logs = f.readlines()
        print(logs)
        result = logs[2].split(',')

    rm = subprocess.Popen(['rm', '-rf', '/tmp/out', '/tmp/io_read_logs'])
    rm.communicate()

    return result
