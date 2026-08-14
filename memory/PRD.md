# New Eden Fleet Cartographer — PRD

## Original Problem Statement
"map this > https://npsi.rocks/reports/fleet/622/ using the eve online SDE"

## Interpretation & User Choices
Visualize an EVE Online NPSI fleet roam report as an interactive New Eden star map showing **content hotspots** — the solar systems where the fleet got kills, plotted using coordinates from the official CCP Static Data Export (SDE).
- Show content hotspots on the EVE map (systems sized/colored by ISK destroyed)
- Fetch fleet data **live** from npsi.rocks; use official CCP SDE for coordinates
- Dark "in-space" theme (starfield, neon route lines) — EVE aesthetic
- Click systems/kills/pilots to link out to zKillboard and npsi capsuleer pages

## Architecture
- **Frontend**: React + d3 (HTML5 canvas star map), Tailwind, framer-motion, lucide-react. Fonts: Rajdhani / JetBrains Mono / Chakra Petch.
- **Backend**: FastAPI. Fetches live NPSI report (`https://i.npsi.rocks/reports/api/fleet/{id}/`), joins each killmail's system with SDE coordinates.
- **Data**: `/app/backend/data/systems.json` — cached slice of the CCP SDE (Fuzzwork mapSolarSystems mirror): name → [x, z, security, regionID], 8490 systems (5485 known-space).
- No auth, no database writes (read-only over public NPSI API + bundled SDE).

## Endpoints
- `GET /api/universe/systems` → known-space systems for the star map backdrop
- `GET /api/report/{id}` → fleet meta, totalKills, hotspots (coords+kills+ISK), kills, members, regionStats, unmappedSystems

## User Personas
- EVE Online FCs / pilots reviewing a roam's content and geographic spread
- NPSI community members sharing where the action happened

## Implemented (2026-08-14)
- Interactive canvas star map: ~5485 background systems, glowing heat-colored hotspots sized by ISK, neon roam route lines, zoom/pan, auto-focus to hotspot cluster on load, hover tooltip, click-to-select
- Fleet summary panel: name, host, date, duration, FC, stat tiles (Kills/ISK/Fleet Size/Systems), Top Damage & Final Blows badges, Roam-by-Region bars
- Killmail feed with ship render/victim/value/system/region/time; click system to filter; Members roster tab
- Load any report by ID; external links to zKillboard + npsi capsuleer/host pages
- Verified: backend 100%, frontend 100% (testing agent iteration_1)

## Backlog (P1/P2)
- P1: Kill activity timeline / histogram (kills per 5-min window + cumulative ISK)
- P1: Highlight/animate the roam route sequentially (playback of the roam over time)
- P2: Brief server-side caching of NPSI responses
- P2: Ship-class breakdown of what the fleet killed
- P2: Compare multiple reports / recent reports browser

## Next Tasks
- Await user feedback on report 622 mapping; add timeline or route playback if requested
