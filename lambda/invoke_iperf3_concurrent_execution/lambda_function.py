import boto3
import json
from multiprocessing.dummy import Pool as ThreadPool

lambda_client = boto3.client('lambda')


def invoke_lambda(port):
    response = lambda_client.invoke(
        FunctionName='lambda-function-measure-iperf3_faas',
        InvocationType='RequestResponse',
        Payload=json.dumps({
            "port": port
        })
    )
    return response


def update_lambda_configuration(memory):
    lambda_client.update_function_configuration(
        FunctionName='lambda-function-measure-iperf3_faas',
        Timeout=900,
        MemorySize=int(memory)
    )


def lambda_handler(event, context):
    n_worker = event['n_worker']
    memory = event['memory']

    update_lambda_configuration(memory)

    port_idx = [5200 + i for i in range(n_worker)]
    pool = ThreadPool(n_worker)
    pool.map(invoke_lambda, port_idx)
    pool.close()
    pool.join()
