import os
import sys
import traceback
from importlib import import_module, invalidate_caches
from flask import Flask, Blueprint

sys.path.append(os.getcwd())

app = Flask(__name__)
services=set()
def register_service(service, path=None):
    global services
    try:
        if path != None:
            if not os.path.exists(f"{path}/{service}/main.py"):
                print(f"[{service}]{path}/{service}/main.py does not exist")
                return ""
        if path not in sys.path:
            sys.path.append(path)

        print(f'[{service}]loading {service} from {path} with {sys.path}')
        module = import_module(f'{service}.main')
        print(f"[{service}] main module loaded")

        blueprints = getattr(module, 'app')
        if not isinstance(blueprints, list):
            blueprints=[blueprints]

        for blueprint in blueprints:
            if isinstance(blueprint, Blueprint):
                ctx=f'/{service}/{blueprint.name}'
                app.register_blueprint(blueprint, url_prefix=ctx)
                services.add(ctx)
                print(f"[{service}] flask blueprint[{blueprint.name}] loaded! ")
        return service
    except Exception as e:
        traceback.print_exc()
        return f'Error: {str(e)}'

def register_services(root):
    if not os.path.exists(root):
        print(f'[flask]tried load apps from {root}, failed!')
        return
    print(f'[flask]loading services from {root}')
    service_dirs = [d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))]    
    for service in service_dirs:
        register_service(service, root)

#load from environment
if "APPS_ROOT" in os.environ:
    register_services(os.environ.get("APPS_ROOT"))

#load from arguments
for root in sys.argv[1:]:
    register_services(root)

@app.route("/")
def home():
    return f"apps:{str(services)}\npython: {sys.path}"

if __name__ == '__main__':
    print(f"python service is running on 4001")
    app.run(host="0.0.0.0", port=4001, debug=True)
    
