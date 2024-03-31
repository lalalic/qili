import os


def install_requirements_in_folder(folder):
    target=os.environ.get("PYTHONPATH")
    if target is not None:
        target=f"--target {target}"
    for root, _, files in os.walk(folder):
        for file in files:
            if file == 'requirements.txt':
                path = os.path.join(root, file)
                print(f"Installing requirements from: {path}")
                os.system(f"pip install -r {path} {target}")

# Replace '/path/to/your/folder' with the path to the folder containing your requirements.txt files
install_requirements_in_folder(os.path.basename(__file__))
