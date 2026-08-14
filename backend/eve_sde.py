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
SHIP_FILE = Path(__file__).parent / "data" / "ship_types.json"
REGION_FILE = Path(__file__).parent / "data" / "regions.json"

# Known space = New Eden cluster (region IDs below 11000000). Anything above is
# wormhole / abyssal / Jove space which sits far outside the main cluster.
KNOWN_SPACE_MAX_REGION = 11000000

_SYSTEMS: dict[str, list] = {}
_SHIP_TYPES: dict[str, str] = {}
_REGION_NAMES: dict[str, str] = {}


def _load() -> None:
    global _SYSTEMS, _SHIP_TYPES, _REGION_NAMES
    if _SYSTEMS:
        return
    with open(DATA_FILE, encoding="utf-8") as fh:
        _SYSTEMS = json.load(fh)
    with open(SHIP_FILE, encoding="utf-8") as fh:
        _SHIP_TYPES = json.load(fh)
    with open(REGION_FILE, encoding="utf-8") as fh:
        _REGION_NAMES = json.load(fh)
    logger.info("Loaded %d systems, %d ship types, %d regions from SDE cache",
                len(_SYSTEMS), len(_SHIP_TYPES), len(_REGION_NAMES))


def ship_group(type_id) -> str | None:
    """Return the SDE ship group name (e.g. 'Assault Frigate') for a type id."""
    _load()
    if type_id is None:
        return None
    return _SHIP_TYPES.get(str(type_id))


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


def region_centroids() -> list[dict]:
    """Region label anchors: mean 2D position of each known-space region's systems."""
    _load()
    acc: dict[int, list] = {}
    for _name, (x, z, _sec, reg) in _SYSTEMS.items():
        if reg >= KNOWN_SPACE_MAX_REGION:
            continue
        a = acc.get(reg)
        if a is None:
            a = acc[reg] = [0.0, 0.0, 0]
        a[0] += x
        a[1] += z
        a[2] += 1
    out = []
    for reg, (sx, sz, n) in acc.items():
        name = _REGION_NAMES.get(str(reg))
        if not name or n == 0:
            continue
        out.append({"name": name, "x": round(sx / n), "z": round(sz / n), "systems": n})
    return out
