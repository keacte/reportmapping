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



# --- Iteration 2: shipBreakdown + ship.group ---
class TestShipBreakdown:
    def test_ship_breakdown_present(self, report_622):
        sb = report_622.get("shipBreakdown")
        assert isinstance(sb, list) and len(sb) > 0
        for entry in sb:
            for k in ("group", "count", "isk"):
                assert k in entry, f"missing {k} in shipBreakdown entry"
            assert isinstance(entry["count"], int)

    def test_ship_breakdown_sorted_desc(self, report_622):
        counts = [e["count"] for e in report_622["shipBreakdown"]]
        assert counts == sorted(counts, reverse=True)

    def test_ship_breakdown_sums_to_total(self, report_622):
        total = sum(e["count"] for e in report_622["shipBreakdown"])
        assert total == report_622["totalKills"] == 65

    def test_ship_breakdown_expected_groups(self, report_622):
        by_group = {e["group"]: e["count"] for e in report_622["shipBreakdown"]}
        # Per problem statement
        assert by_group.get("Capsule") == 27
        assert by_group.get("Assault Frigate") == 10

    def test_kill_ship_has_group(self, report_622):
        # Every kill should carry ship.group resolved from SDE
        groups_seen = set()
        for k in report_622["kills"]:
            assert "group" in k["ship"], f"missing group on kill {k.get('killId')}"
            groups_seen.add(k["ship"]["group"])
        # A handful of well-known mappings from the spec
        # (not every roam contains all; only assert the union has plausible strings)
        assert all(isinstance(g, (str, type(None))) for g in groups_seen)


# --- Iteration 2: /api/reports/recent ---
class TestRecentReports:
    @pytest.fixture(scope="class")
    def recent(self):
        r = requests.get(f"{API}/reports/recent", timeout=60)
        assert r.status_code == 200, f"recent failed: {r.status_code} {r.text[:300]}"
        return r.json()

    def test_shape(self, recent):
        assert "reports" in recent and "stats" in recent
        assert isinstance(recent["reports"], list) and len(recent["reports"]) > 0
        for key in ("kills30d", "isk30d", "hostCount", "fleets7d"):
            assert key in recent["stats"]

    def test_report_entry_shape(self, recent):
        rep = recent["reports"][0]
        for key in ("id", "name", "date", "fc", "host", "hostLogo", "iskHuman", "isk"):
            assert key in rep, f"missing {key} in recent report entry"
        assert isinstance(rep["id"], int)
        # hostLogo should be absolute media.npsi.rocks URL when present
        if rep["hostLogo"]:
            assert rep["hostLogo"].startswith("http"), rep["hostLogo"]
            assert "media.npsi.rocks" in rep["hostLogo"], rep["hostLogo"]

    def test_report_622_present(self, recent):
        by_id = {r["id"]: r for r in recent["reports"]}
        # 622 may age off of "recent" over time; if present, must match name
        if 622 in by_id:
            assert by_id[622]["name"] == "K-FLEET: ShrinkWrapped pew pew!"
        else:
            pytest.skip("report 622 no longer in recent feed")



# --- Iteration 3: /api/report/combined ---
class TestCombinedReport:
    @pytest.fixture(scope="class")
    def recent_ids(self):
        r = requests.get(f"{API}/reports/recent", timeout=60)
        assert r.status_code == 200
        ids = [rep["id"] for rep in r.json().get("reports", [])][:3]
        assert len(ids) >= 2, f"need at least 2 recent report ids, got {ids}"
        return ids

    @pytest.fixture(scope="class")
    def combined(self, recent_ids):
        r = requests.get(f"{API}/report/combined", params={"ids": ",".join(str(i) for i in recent_ids)}, timeout=90)
        assert r.status_code == 200, f"combined failed: {r.status_code} {r.text[:300]}"
        return r.json(), recent_ids

    def test_combined_shape(self, combined):
        data, ids = combined
        assert data["combined"] is True
        assert data["fleet"]["name"] == f"Combined \u00b7 {len(ids)} fleets"
        assert isinstance(data["fleets"], list)
        assert len(data["fleets"]) == len(ids)
        for f in data["fleets"]:
            for k in ("id", "name", "color", "kills", "iskHuman"):
                assert k in f, f"missing {k} in fleets meta"

    def test_combined_totals_sum(self, combined):
        data, _ = combined
        total = sum(f["kills"] for f in data["fleets"])
        assert data["totalKills"] == total == len(data["kills"])

    def test_combined_member_union(self, combined):
        data, _ = combined
        assert data["fleet"]["memberCount"] == len(data["members"])
        # union => members are unique by id
        ids = [m.get("id") for m in data["members"]]
        assert len(ids) == len(set(ids))

    def test_combined_kill_tags(self, combined):
        data, _ = combined
        fleet_ids = {f["id"] for f in data["fleets"]}
        for k in data["kills"]:
            assert "color" in k and "fleetId" in k and "fleetName" in k
            assert k["fleetId"] in fleet_ids

    def test_combined_aggregates_present(self, combined):
        data, _ = combined
        assert isinstance(data["hotspots"], list)
        assert isinstance(data["regionStats"], list)
        assert isinstance(data["shipBreakdown"], list)
        # sanity: shipBreakdown counts sum to totalKills
        assert sum(e["count"] for e in data["shipBreakdown"]) == data["totalKills"]

    def test_combined_isk_sum_human(self, combined):
        data, _ = combined
        # fleet.destroyedValueHuman is a string ending in k/m/b/t or digits
        v = data["fleet"]["destroyedValueHuman"]
        assert isinstance(v, str) and len(v) > 0

    def test_combined_single_id(self, recent_ids):
        one = recent_ids[0]
        r = requests.get(f"{API}/report/combined", params={"ids": str(one)}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["combined"] is True
        assert len(d["fleets"]) == 1

    def test_combined_invalid_id_returns_404(self, recent_ids):
        r = requests.get(f"{API}/report/combined", params={"ids": f"{recent_ids[0]},99999999"}, timeout=60)
        assert r.status_code == 404

    def test_combined_empty_returns_400(self):
        r = requests.get(f"{API}/report/combined", params={"ids": ""}, timeout=30)
        assert r.status_code == 400


# --- Iteration 3 regression: report 622 combined flag ---
class TestReport622Combined:
    def test_combined_flag_false(self, report_622):
        assert report_622.get("combined") is False
