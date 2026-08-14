"""EVE Online SDE loader.

Loads solar system coordinates from a cached slice of the official CCP Static
Data Export (mirrored by Fuzzwork's mapSolarSystems dump). Each entry maps a
solar system name to [x, z, security, regionID]. X/Z form the horizontal galaxy
plane used by the in-game star map.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent / "data" / "systems.json"

# Known space = New Eden cluster (region IDs below 11000000). Anything above is
# wormhole / abyssal / Jove space which sits far outside the main cluster.
KNOWN_SPACE_MAX_REGION = 11000000

_SYSTEMS: dict[str, list] = {}


def _load() -> None:
    global _SYSTEMS
    if _SYSTEMS:
        return
    with open(DATA_FILE, encoding="utf-8") as fh:
        _SYSTEMS = json.load(fh)
    logger.info("Loaded %d solar systems from SDE cache", len(_SYSTEMS))


def resolve(name: str):
    """Return {x, z, security, region_id} for a system name, or None."""
    _load()
    row = _SYSTEMS.get(name)
    if not row:
        return None
    x, z, sec, reg = row
    return {"x": x, "z": z, "security": sec, "region_id": reg}


def background_systems() -> list[dict]:
    """All known-space systems as compact points for the star map backdrop."""
    _load()
    out = []
    for name, (x, z, sec, reg) in _SYSTEMS.items():
        if reg < KNOWN_SPACE_MAX_REGION:
            out.append({"name": name, "x": x, "z": z, "security": sec})
    return out
