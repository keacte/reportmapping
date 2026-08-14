"""Backend API tests for New Eden Fleet Cartographer."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fleet-analytics-eve.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def report_622():
    r = requests.get(f"{API}/report/622", timeout=60)
    assert r.status_code == 200, f"Report 622 failed: {r.status_code} {r.text[:300]}"
    return r.json()


# --- Universe / SDE ---
class TestUniverseSystems:
    def test_systems_endpoint(self):
        r = requests.get(f"{API}/universe/systems", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "systems" in data
        assert data["count"] == len(data["systems"])
        # Expect around ~5485 known-space systems
        assert 5000 <= data["count"] <= 6000, f"unexpected system count {data['count']}"
        sample = data["systems"][0]
        for key in ("name", "x", "z", "security"):
            assert key in sample, f"missing {key} in system entry"
        # Jita should be present as a well-known K-space system
        names = {s["name"] for s in data["systems"]}
        assert "Jita" in names


# --- Report endpoint ---
class TestReport:
    def test_report_meta(self, report_622):
        f = report_622["fleet"]
        assert f["name"] == "K-FLEET: ShrinkWrapped pew pew!"
        assert f["providerName"] == "F.U.N. Inc."
        assert f["memberCount"] == 57
        assert f["destroyedValueHuman"] == "6.76b"
        assert f["fc"]["name"] == "keacte"

    def test_report_totals(self, report_622):
        assert report_622["totalKills"] == 65
        assert len(report_622["kills"]) == 65
        assert len(report_622["members"]) == 57
        assert len(report_622["hotspots"]) == 15

    def test_hotspots_have_coords(self, report_622):
        for hs in report_622["hotspots"]:
            for k in ("system", "x", "z", "kills", "iskDestroyed"):
                assert k in hs
            assert isinstance(hs["x"], (int, float))
            assert isinstance(hs["z"], (int, float))
        # Sorted desc by iskDestroyed
        isk = [h["iskDestroyed"] for h in report_622["hotspots"]]
        assert isk == sorted(isk, reverse=True)

    def test_unmapped_systems_empty(self, report_622):
        assert report_622["unmappedSystems"] == []

    def test_kill_shape(self, report_622):
        k = report_622["kills"][0]
        for key in ("killId", "timestamp", "value", "system", "region", "ship", "victim"):
            assert key in k

    def test_region_stats(self, report_622):
        regions = {r["regionName"] for r in report_622["regionStats"]}
        # Expected regions the fleet roamed through
        for expected in ("Immensea", "Catch", "Tenerifis", "Curse", "Genesis"):
            assert expected in regions, f"missing region {expected}: got {regions}"

    def test_invalid_report_returns_404(self):
        r = requests.get(f"{API}/report/99999999", timeout=60)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
