
import subprocess
from pathlib import Path
from hatchling.builders.hooks.custom import BuildHookInterface

class CustomBuildHook(BuildHookInterface):
	def initialize(self, version, build_data):
		frontend_dir = Path(__file__).parent / "frontend"
		subprocess.run(["npm", "install", "--legacy-peer-deps"], cwd=frontend_dir, check=True)
		subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
