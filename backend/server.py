from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio
import logging
from pathlib import Path
import httpx

import eve_sde

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

NPSI_API = "https://i.npsi.rocks/reports/api/fleet"
NPSI_HOME = "https://i.npsi.rocks/events/api/home"
NPSI_HOSTS = "https://i.npsi.rocks/events/api/hosts"
NPSI_MEDIA = "https://media.npsi.rocks"

app = FastAPI(title="New Eden Fleet Cartographer")
api_router = APIRouter(prefix="/api")


def _abs_logo(logo: str | None) -> str | None:
    return (NPSI_MEDIA + logo) if logo and logo.startswith("/") else logo


def _map_report_entries(raw_list) -> list[dict]:
    """Map NPSI 'recent_fleet_reports' entries to our compact shape."""
    out = []
    for r in raw_list or []:
        url = r.get("reportUrl") or ""
        rid = None
        for part in url.strip("/").split("/"):
            if part.isdigit():
                rid = int(part)
        if rid is None:
            continue
        out.append({
            "id": rid,
            "name": r.get("eventName"),
            "date": r.get("eventStart"),
            "fc": r.get("fc"),
            "host": r.get("hostName"),
            "hostLogo": _abs_logo(r.get("hostLogo")),
            "iskHuman": r.get("destroyedValueHuman"),
            "isk": r.get("destroyedValue") or 0,
        })
    return out


async def _fetch_json(url: str):
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach NPSI: {exc}")
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"NPSI returned {resp.status_code}")
    try:
        return resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="NPSI response was not JSON")


@api_router.get("/")
async def root():
    return {"message": "New Eden Fleet Cartographer online"}


@api_router.get("/universe/systems")
async def universe_systems():
    """Known-space solar systems (from the CCP SDE) for the star map backdrop."""
    systems = eve_sde.background_systems()
    return {"count": len(systems), "systems": systems}


@api_router.get("/universe/regions")
async def universe_regions():
    """Known-space region label anchors (centroids) from the CCP SDE."""
    regions = eve_sde.region_centroids()
    return {"count": len(regions), "regions": regions}


@api_router.get("/reports/recent")
async def recent_reports():
    """Recent NPSI fleet reports for the roam browser."""
    data = await _fetch_json(NPSI_HOME)
    return {"reports": _map_report_entries(data.get("recent_fleet_reports")), "stats": {
        "kills30d": data.get("kills_30d"),
        "isk30d": data.get("isk_30d"),
        "hostCount": data.get("hostCount"),
        "fleets7d": data.get("fleets_7d"),
    }}


@api_router.get("/hosts")
async def list_hosts():
    """All NPSI hosts (from https://npsi.rocks/hosts)."""
    data = await _fetch_json(NPSI_HOSTS)
    hosts = []
    for h in data or []:
        hosts.append({
            "name": h.get("name"),
            "slug": h.get("slug"),
            "logo": _abs_logo(h.get("logo")),
            "website": h.get("website"),
        })
    hosts.sort(key=lambda h: (h["name"] or "").lower())
    return {"count": len(hosts), "hosts": hosts}


@api_router.get("/hosts/{slug}")
async def host_reports(slug: str):
    """A single host's recent fleet reports (for host-filtered roam browsing)."""
    data = await _fetch_json(f"{NPSI_HOSTS}/{slug}")
    provider = data.get("provider") or {}
    return {
        "host": {
            "name": provider.get("name"),
            "slug": provider.get("slug"),
            "logo": _abs_logo(provider.get("logo")),
            "website": provider.get("website"),
        },
        "reports": _map_report_entries(data.get("recent_fleet_reports")),
    }


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


FLEET_COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444", "#eab308"]


def _human_isk(v: float) -> str:
    n = float(v or 0)
    if n >= 1e12:
        return f"{n / 1e12:.2f}t"
    if n >= 1e9:
        return f"{n / 1e9:.2f}b"
    if n >= 1e6:
        return f"{n / 1e6:.1f}m"
    if n >= 1e3:
        return f"{n / 1e3:.0f}k"
    return str(round(n))


def _kill_record(k: dict, fleet: dict | None = None) -> dict:
    loc = k.get("location") or {}
    sys_name = loc.get("name")
    coord = eve_sde.resolve(sys_name) if sys_name else None
    ship = k.get("ship") or {}
    rec = {
        "killId": k.get("killId"),
        "timestamp": k.get("timestamp"),
        "value": k.get("value") or 0,
        "valueHuman": k.get("valueHuman"),
        "system": sys_name,
        "region": loc.get("region"),
        "security": coord["security"] if coord else None,
        "x": coord["x"] if coord else None,
        "z": coord["z"] if coord else None,
        "ship": {"id": ship.get("id"), "name": ship.get("name"), "group": eve_sde.ship_group(ship.get("id"))},
        "victim": _pilot(k.get("victim")),
        "topDamage": _pilot(k.get("topDamage")),
        "finalBlow": _pilot(k.get("finalBlow")),
    }
    if fleet is not None:
        rec["fleetId"] = fleet.get("id")
        rec["fleetName"] = fleet.get("name")
        rec["color"] = fleet.get("color")
    return rec


def _aggregate(records: list[dict]) -> dict:
    """Build hotspots, ship breakdown and region stats from kill records."""
    hotspots: dict[str, dict] = {}
    groups: dict[str, dict] = {}
    regions: dict[str, dict] = {}
    unmapped = set()

    for rec in records:
        sys_name = rec["system"]
        if sys_name and rec["x"] is None:
            unmapped.add(sys_name)

        gname = rec["ship"]["group"] or "Unknown"
        g = groups.get(gname) or groups.setdefault(gname, {"group": gname, "count": 0, "isk": 0})
        g["count"] += 1
        g["isk"] += rec["value"]

        region = rec["region"] or "Unknown"
        rs = regions.get(region) or regions.setdefault(region, {"regionName": region, "killmails": 0, "_isk": 0})
        rs["killmails"] += 1
        rs["_isk"] += rec["value"]

        if sys_name and rec["x"] is not None:
            hs = hotspots.get(sys_name)
            if hs is None:
                hs = hotspots[sys_name] = {
                    "system": sys_name, "region": rec["region"],
                    "x": rec["x"], "z": rec["z"], "security": rec["security"],
                    "kills": 0, "iskDestroyed": 0, "killIds": [],
                }
            hs["kills"] += 1
            hs["iskDestroyed"] += rec["value"]
            hs["killIds"].append(rec["killId"])

    region_stats = sorted(regions.values(), key=lambda d: d["killmails"], reverse=True)
    for rs in region_stats:
        rs["destroyedValueHuman"] = _human_isk(rs.pop("_isk"))

    return {
        "hotspots": sorted(hotspots.values(), key=lambda h: h["iskDestroyed"], reverse=True),
        "shipBreakdown": sorted(groups.values(), key=lambda d: (d["count"], d["isk"]), reverse=True),
        "regionStats": region_stats,
        "unmappedSystems": sorted(unmapped),
    }


async def _fetch_npsi_report(report_id: int) -> dict:
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
        return resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="NPSI response was not JSON")


@api_router.get("/report/combined")
async def combined_report(ids: str):
    """Merge several NPSI fleet reports into one aggregated report + map."""
    id_list = []
    for part in ids.split(","):
        part = part.strip()
        if part.isdigit() and int(part) not in id_list:
            id_list.append(int(part))
    id_list = id_list[:8]
    if len(id_list) < 1:
        raise HTTPException(status_code=400, detail="Provide at least one report id")

    datas = await asyncio.gather(*[_fetch_npsi_report(i) for i in id_list])

    records: list[dict] = []
    fleets_meta = []
    members: dict = {}
    total_isk = 0
    starts = []

    for idx, data in enumerate(datas):
        fleet = data.get("fleet") or {}
        color = FLEET_COLORS[idx % len(FLEET_COLORS)]
        tag = {"id": fleet.get("id"), "name": fleet.get("name"), "color": color}
        fleet_kills = data.get("kills", []) or []
        fleet_isk = sum(k.get("value") or 0 for k in fleet_kills)
        total_isk += fleet_isk
        if fleet.get("start"):
            starts.append(fleet.get("start"))
        for k in fleet_kills:
            records.append(_kill_record(k, tag))
        for m in data.get("members", []) or []:
            if m.get("id") not in members:
                members[m.get("id")] = m
        fleets_meta.append({
            "id": fleet.get("id"), "name": fleet.get("name"),
            "providerName": fleet.get("providerName"), "providerSlug": fleet.get("providerSlug"),
            "start": fleet.get("start"), "color": color,
            "kills": len(fleet_kills), "iskHuman": _human_isk(fleet_isk),
        })

    agg = _aggregate(records)
    return {
        "combined": True,
        "fleets": fleets_meta,
        "fleet": {
            "id": None,
            "name": f"Combined · {len(fleets_meta)} fleets",
            "start": min(starts) if starts else None,
            "durationText": None,
            "memberCount": len(members),
            "providerName": "Multiple hosts",
            "providerSlug": None,
            "destroyedValueHuman": _human_isk(total_isk),
            "fc": None,
        },
        "topDamage": None,
        "topFinalBlow": None,
        "regionStats": agg["regionStats"],
        "totalKills": len(records),
        "shipBreakdown": agg["shipBreakdown"],
        "hotspots": agg["hotspots"],
        "kills": records,
        "members": list(members.values()),
        "unmappedSystems": agg["unmappedSystems"],
    }


@api_router.get("/report/{report_id}")
async def get_report(report_id: int):
    """Fetch an NPSI fleet report live and map every kill onto SDE coordinates."""
    data = await _fetch_npsi_report(report_id)
    records = [_kill_record(k) for k in (data.get("kills", []) or [])]
    agg = _aggregate(records)
    fleet = data.get("fleet") or {}

    return {
        "combined": False,
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
        "regionStats": agg["regionStats"],
        "totalKills": len(records),
        "shipBreakdown": agg["shipBreakdown"],
        "hotspots": agg["hotspots"],
        "kills": records,
        "members": data.get("members", []),
        "unmappedSystems": agg["unmappedSystems"],
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
