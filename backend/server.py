from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from collections import defaultdict
import httpx

import eve_sde

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

NPSI_API = "https://i.npsi.rocks/reports/api/fleet"

app = FastAPI(title="New Eden Fleet Cartographer")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "New Eden Fleet Cartographer online"}


@api_router.get("/universe/systems")
async def universe_systems():
    """Known-space solar systems (from the CCP SDE) for the star map backdrop."""
    systems = eve_sde.background_systems()
    return {"count": len(systems), "systems": systems}


def _pilot(node: dict | None) -> dict | None:
    if not node:
        return None
    corp = node.get("corporation") or {}
    alliance = node.get("alliance") or {}
    return {
        "id": node.get("id"),
        "name": node.get("name"),
        "corporation": corp.get("name"),
        "alliance": alliance.get("name"),
    }


@api_router.get("/report/{report_id}")
async def get_report(report_id: int):
    """Fetch an NPSI fleet report live and map every kill onto SDE coordinates."""
    url = f"{NPSI_API}/{report_id}/"
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach NPSI: {exc}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Fleet report {report_id} not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"NPSI returned {resp.status_code}")

    try:
        data = resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="NPSI response was not JSON")

    kills = data.get("kills", []) or []

    # Build per-kill records joined with SDE coordinates.
    kill_records = []
    hotspots: dict[str, dict] = {}
    unmapped = set()

    for k in kills:
        loc = k.get("location") or {}
        sys_name = loc.get("name")
        region = loc.get("region")
        coord = eve_sde.resolve(sys_name) if sys_name else None
        if coord is None and sys_name:
            unmapped.add(sys_name)

        ship = k.get("ship") or {}
        record = {
            "killId": k.get("killId"),
            "timestamp": k.get("timestamp"),
            "value": k.get("value") or 0,
            "valueHuman": k.get("valueHuman"),
            "system": sys_name,
            "region": region,
            "security": coord["security"] if coord else None,
            "ship": {"id": ship.get("id"), "name": ship.get("name")},
            "victim": _pilot(k.get("victim")),
            "topDamage": _pilot(k.get("topDamage")),
            "finalBlow": _pilot(k.get("finalBlow")),
        }
        kill_records.append(record)

        if coord is None or not sys_name:
            continue
        hs = hotspots.get(sys_name)
        if hs is None:
            hs = hotspots[sys_name] = {
                "system": sys_name,
                "region": region,
                "x": coord["x"],
                "z": coord["z"],
                "security": coord["security"],
                "kills": 0,
                "iskDestroyed": 0,
                "killIds": [],
            }
        hs["kills"] += 1
        hs["iskDestroyed"] += k.get("value") or 0
        hs["killIds"].append(k.get("killId"))

    fleet = data.get("fleet") or {}

    return {
        "fleet": {
            "id": fleet.get("id"),
            "name": fleet.get("name"),
            "start": fleet.get("start"),
            "durationText": fleet.get("durationText"),
            "memberCount": fleet.get("memberCount"),
            "providerName": fleet.get("providerName"),
            "providerSlug": fleet.get("providerSlug"),
            "destroyedValueHuman": (fleet.get("stats") or {}).get("destroyedValueHuman"),
            "fc": _pilot(fleet.get("fc")),
        },
        "topDamage": _pilot(data.get("topDamage")),
        "topFinalBlow": _pilot(data.get("topFinalBlow")),
        "regionStats": data.get("regionStats", []),
        "totalKills": len(kill_records),
        "hotspots": sorted(hotspots.values(), key=lambda h: h["iskDestroyed"], reverse=True),
        "kills": kill_records,
        "members": data.get("members", []),
        "unmappedSystems": sorted(unmapped),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
