import os
import sys
import subprocess
from importlib import import_module
from flask import Flask, Blueprint

app = Flask(__name__)
services=set()
def register_service(service, path=None):
    global services
    try:
        if path != None:
            if not os.path.exists(f"{path}/{service}-main.py"):
                return
            if os.path.exists(f"{path}/requirements.txt"):
                shells=["pip", "install", "-r", f"{path}/requirements.txt"]
                if(os.environ.get('PYTHONPATH') != None):
                    shells.extend(["--target", os.environ.get('PYTHONPATH')])
                subprocess.run(
                    shells, 
                    capture_output=False, 
                    text=True, 
                    check=True
                )

        module = import_module(f'{service}-main')
        blueprints = getattr(module, 'app')
        if not isinstance(blueprints, list):
            blueprints=[blueprints]

        for blueprint in blueprints:
            if isinstance(blueprint, Blueprint):
                ctx=f'/{service}/{blueprint.name}'
                app.register_blueprint(blueprint, url_prefix=ctx)
                services.add(ctx)
                print(f"flask blueprint[{blueprint.name}] loaded! ")
    except Exception as e:
        sys.stderr.write(f'Error: {str(e)}\n')


def register_services(name):
    root=os.path.join(os.path.dirname(__file__),name)
    service_dirs = [d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))]    
    for service in service_dirs:
        register_service(service)

#load from current folder
register_services("apps")

#load from arguments
for service in sys.argv[1:]:
    service_name, service_path=service.split(":")
    sys.path.append(service_path)
    register_service(service_name, service_path)
    sys.path.remove(service_path)

@app.route("/")
def home():
    return str(services)

@app.route("/conf")
def conf():
    return import_module("qili-conf").conf


if __name__ == '__main__':
    print(f"python service is running on 5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
    
