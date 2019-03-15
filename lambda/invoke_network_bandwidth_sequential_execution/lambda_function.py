import boto3

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
    iteration = event['n']
    bucket = event['bucket']
    key = event['key']
    memory = event['memory']

    update_lambda_configuration(memory)

    for item in range(0, iteration):
        invoke_lambda(bucket, key)
