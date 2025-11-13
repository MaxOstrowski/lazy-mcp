from pathlib import Path
from platformdirs import user_config_dir

APP_NAME = "lazy_mcp"
CONFIG_DIR = Path(user_config_dir(APP_NAME))
CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def get_config_path(agent: str) -> Path:
    """Return the config file path for a given agent name."""
    return CONFIG_DIR / f"{agent}.json"

def list_available_agents() -> list[str]:
    """Return a list of agent names (without .json extension) for all config files in the config dir."""
    return [p.stem for p in CONFIG_DIR.glob("*.json")]
