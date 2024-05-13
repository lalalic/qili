import os
import sys
import uuid
import json
import requests
import traceback

from importlib import import_module
    
def fetch(request, timeout=60000, conf={}):
    try:
        with requests.Session() as session:
            response = session.post(
                conf["api"],
                headers={
                    'Content-Type': 'application/json',
                    'x-application-id': conf["apiKey"],
                    "x-access-token":conf["token"]
                },
                data=request if isinstance(request, str) else json.dumps(request),
                timeout=timeout / 1000
            )
            response.raise_for_status()

            # Parse JSON response
            response_data = response.json()

            if 'data' not in response_data:
                raise ValueError(response_data.get('message') or response_data.get('statusText') or 'Unknown error')

            if 'errors' in response_data:
                raise ValueError(response_data['errors'])

            return response_data['data']

    except requests.exceptions.Timeout:
        raise TimeoutError('Timeout from qili service')


def upload_bytes(bytes, key=None, ext=".wav", conf={}):
    try: 
        if key is None:
            key=f"_temp_/1/{str(uuid.uuid4())}{ext}"
        data = fetch({
            "query": '''
                query($key:String!){
                    file_upload_token(key:$key){
                        token
                        key
                    }
                }
            ''', 
            "variables": {
                "key": key
            }
        }, conf=conf)

        data=data["file_upload_token"]
        files={"file":(os.path.basename(key), bytes)}
        response = requests.post(
            conf["storage"], 
            files=files, 
            data=data,
            headers={
                'x-application-id': conf["apiKey"],
            }
        )
        if response.ok:
            data = response.json()
            return data.get("data", {}).get("file_create", {}).get("url")
        else:
            raise Exception(f"{conf['storage']}: {response.status_code} - {response.reason}, {response.text}")
    except Exception as e:
        traceback.print_exc()
        return str(e)


def upload(files, root_key=None, conf={}):
    if not isinstance(files, list):
        shouldReturnString=True
        files = [files]
    
    if(root_key==None):
        root_key="_temp_/10/" + str(uuid.uuid4())
        
    try:
        keys, queries, variables = [], [], {}
        
        for i, file in enumerate(files):
            k = f"key{i}"
            keys.append(k)
            queries.append(f"""
                token{i}:file_upload_token(key:${k}){{
                    token
                    key
                }}
            """)
            variables[k] = f"{root_key}{os.path.basename(file)}"
        
        keys=','.join([f'${k}:String!' for k in keys])
        queries='\n'.join(queries)

        query = f"""query({ keys }){{ { queries } }}"""

        data = fetch({"query": query, "variables": variables}, conf=conf)
        
        tokens = list(data.values())
        urls = []
        
        for i, file in enumerate(files):
            form = {"file": open(file, "rb")}
            response = requests.post(
                conf["storage"], 
                files=form, 
                data=tokens[i], 
                headers={
                    'x-application-id': conf["apiKey"],
                },
            )
            
            if response.ok:
                data = response.json()
                urls.append(data.get("data", {}).get("file_create", {}).get("url"))
            else:
                raise Exception(f"{response.status_code} - {response.reason}, {response.text}")
        
        if shouldReturnString:
            urls[0]
        return list(filter(None, urls))
    except Exception as e:
        traceback.print_exc()
        return str(e)