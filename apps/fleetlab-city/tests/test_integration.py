"""Public packaging is additive; unexpected established-file edits fail closed."""

import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_launch import launch, write_release

TOOL = Path(__file__).resolve().parents[1] / "tools/integrate-site.py"
spec = importlib.util.spec_from_file_location("integrate_site", TOOL)
integration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integration)
PACK = Path(__file__).resolve().parents[3] / "playground/fleetlab/tools/pack.mjs"


class IntegrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.legacy = self.base / "legacy"
        self.legacy.mkdir()
        (self.legacy / "_headers").write_text("/*\n  Content-Security-Policy: connect-src 'none'\n")
        (self.legacy / "index.html").write_text('<link rel="stylesheet" href="./styles.css">')
        (self.legacy / "boot.js").write_text(
            'import { start } from "./src/ui/app.js";\nstart({ studio: true });\n'
        )
        for i in range(96):
            (self.legacy / f"original-{i}.txt").write_text(f"Original content {i}")
        self.viewer = self.base / "viewer"
        self.prior = self.base / "prior"
        write_release(self.viewer, "current")
        write_release(self.prior, "prior")
        self.offer = self.base / "offer"
        self.offer.mkdir()
        for name in ("index.html", "ODbL-1.0.txt", "database.tar.gz"):
            (self.offer / name).write_text(f"source offer {name}")
        (self.offer / "manifest.json").write_text(
            json.dumps({"files": launch.inventory(self.offer)})
        )
        self.offline = self.base / "offline.html"
        self.offline.write_text("preserved offline edition")

    def prepare(self):
        return integration.integrate(
            self.legacy, self.viewer, self.prior, self.offer, self.base / "out", self.offline
        )

    def stage_flow_client(self):
        """Stage reviewed sources and a client holding every declared flow and capacity file."""
        established = integration.CLIENT_FIXES | integration.FLOW_CHANGED
        for index, name in enumerate(sorted(established)):
            (self.legacy / f"original-{index}.txt").unlink()
            target = self.legacy / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("old " + name)
        client = self.base / "client"
        shutil.copytree(self.legacy, client)
        reviewed = self.base / "reviewed"
        pages = {
            "network-flows/capacity/boot.js": integration.CAPACITY_BOOT,
            "network-flows/capacity/index.html": (
                '<!doctype html><html><head></head><body>'
                '<div id="capacity-root"></div></body></html>'
            ),
        }
        for name in established | integration.FLOW_ADDED | integration.CAPACITY_ADDED:
            if name == "network-flows/capacity/release.json":
                continue
            if name in pages:
                data = pages[name].encode()
            elif name == "network-flows/capacity/visual.css":
                data = b".fl-capacity-bench { display: grid; }\n"
            else:
                data = (launch.ROOT / "playground/fleetlab" / name).read_bytes()
            # The packer generates the capacity page, so it has no reviewed source file.
            roots = [client] if name in pages else [client, reviewed / "playground/fleetlab"]
            for root in roots:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_bytes(data)
        # Sidecar generation uses the actual validator over this small preserved-client fixture.
        source_root = reviewed / "playground/fleetlab"
        for path in client.rglob("*"):
            if not path.is_file():
                continue
            name = path.relative_to(client).as_posix()
            if name in ("boot.js", "_headers", "network-flows/capacity/boot.js"):
                continue
            if name.startswith("network-flows/capacity/"):
                name = name.replace("network-flows/capacity/", "capacity/")
            target = source_root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(path.read_bytes())
        for name in (
            "pack.mjs", "check-dist.mjs", "release-sidecar.mjs", "site-shell.mjs",
            "media.mjs", "comment-strip.mjs",
        ):
            target = source_root / "tools" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(launch.ROOT / "playground/fleetlab/tools" / name, target)
        script = """
          import {createReleaseSidecar} from './playground/fleetlab/tools/release-sidecar.mjs';
          import {renderSitePage} from './playground/fleetlab/tools/site-shell.mjs';
          import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
          import {join} from 'node:path';
          const [site,source]=process.argv.slice(1),files=new Map();
          function walk(dir,prefix='') {for(const f of readdirSync(dir,{withFileTypes:true})) {
            if(f.isDirectory())walk(join(dir,f.name),prefix+f.name+'/');
            else files.set(prefix+f.name,readFileSync(join(dir,f.name),'utf8'));
          }}
          walk(site);
          const page='network-flows/capacity/index.html';
          const html=renderSitePage(
            files.get(page),'capacity/index.html',['../../styles.css','./visual.css']);
          files.set(page,html);
          writeFileSync(join(site,page),html);
          writeFileSync(join(site,'network-flows/capacity/release.json'),createReleaseSidecar(source,files));
        """
        subprocess.run(
            ["node", "--input-type=module", "-e", script, str(client), str(source_root)],
            cwd=launch.ROOT, check=True, capture_output=True, text=True,
        )
        self.enterContext(patch.object(integration.launch, "ROOT", reviewed))
        return client

    def integrate_flow(self, client):
        return integration.integrate(
            self.legacy, self.viewer, self.prior, self.offer,
            self.base / "out", self.offline, client_update=client, flow_update=True,
        )

    def test_only_three_declared_root_files_change_and_offline_is_untouched(self):
        before = launch.inventory(self.legacy)
        offline = self.offline.read_bytes()
        report = self.prepare()
        site = self.base / "out/site"
        self.assertEqual(set(report["modified_existing"]), {"index.html", "boot.js", "_headers"})
        self.assertEqual(len(report["preserved_existing"]), 96)
        self.assertEqual(launch.inventory(self.legacy), before)
        self.assertEqual(self.offline.read_bytes(), offline)
        download = site / "downloads/fleetlab-offline.html"
        self.assertEqual(download.read_bytes(), offline)
        self.assertEqual(report["offline_download"]["sha256"], launch.sha_file(download))
        self.assertEqual(report["offline_download"]["path"], "downloads/fleetlab-offline.html")
        self.assertEqual(report["offline_download"]["url"], "/downloads/fleetlab-offline")
        headers = (site / "_headers").read_text()
        self.assertIn(
            "/downloads/fleetlab-offline.html\n"
            '  Content-Disposition: attachment; filename="fleetlab-offline.html"',
            headers,
        )
        self.assertIn(
            "/downloads/fleetlab-offline\n"
            '  Content-Disposition: attachment; filename="fleetlab-offline.html"',
            headers,
        )
        for name in report["preserved_existing"]:
            self.assertEqual((site / name).read_bytes(), (self.legacy / name).read_bytes())
        self.assertIn("mountCityEntry", (site / "boot.js").read_text())
        self.assertIn("/city-explorer/*", (site / "_headers").read_text())
        self.assertTrue((site / "city-explorer/sources/index.html").is_file())
        self.assertTrue((site / report["rollback"]["path"] / "release.json").is_file())

    def test_unexpected_existing_file_change_is_rejected(self):
        before = launch.inventory(self.legacy)
        (self.legacy / "original-0.txt").write_text("unexpected replacement")
        with self.assertRaisesRegex(ValueError, "unexpected established"):
            integration.check_preservation(before, launch.inventory(self.legacy))

    def test_flow_update_preserves_undeclared_assets_and_all_city_records(self):
        before = {
            "src/ui/routes.js": {"sha256": "old"},
            "city-explorer/trace.json": {"sha256": "same"},
        }
        after = {**before, "src/ui/routes.js": {"sha256": "new"}}
        self.assertEqual(
            integration.check_preservation(before, after, True, True), ["src/ui/routes.js"]
        )
        after["city-explorer/trace.json"] = {"sha256": "changed"}
        with self.assertRaisesRegex(ValueError, "unexpected established"):
            integration.check_preservation(before, after, True, True)

    def test_visual_update_declares_reviewed_explicit_play_film_lifecycle(self):
        before = {"src/ui/hero-film.js": {"sha256": "old"}}
        after = {"src/ui/hero-film.js": {"sha256": "reviewed-explicit-play"}}
        self.assertEqual(
            integration.check_preservation(before, after, True, True),
            ["src/ui/hero-film.js"],
        )
        with self.assertRaisesRegex(ValueError, "unexpected established"):
            integration.check_preservation(before, after, True, False)

    def test_flow_update_requires_a_reviewed_client_distribution(self):
        with self.assertRaisesRegex(ValueError, "flow update requires"):
            integration.integrate(
                self.legacy, self.viewer, self.prior, self.offer, self.base / "out", self.offline,
                flow_update=True,
            )

    def test_flow_update_copies_the_capacity_entry_and_declares_it(self):
        client = self.stage_flow_client()
        report = self.integrate_flow(client)
        site = self.base / "out/site"
        for name in (
            "network-flows/capacity/index.html",
            "network-flows/capacity/boot.js",
            "network-flows/capacity/visual.css",
            "network-flows/capacity/release.json",
            "src/ui/depot-capacity-bench.js",
            "src/data/depot-capacity-study.js",
        ):
            self.assertEqual((site / name).read_bytes(), (client / name).read_bytes())
        self.assertEqual(report["teaching_update"], "depot-capacity-nf03-2026-10-09")

    def test_flow_update_rejects_a_missing_capacity_file(self):
        client = self.stage_flow_client()
        (client / "src/data/depot-capacity-study.js").unlink()
        with self.assertRaisesRegex(ValueError, "missing or unexpected modules"):
            self.integrate_flow(client)
        self.assertFalse((self.base / "out").exists())

    def test_capacity_visual_assets_and_release_sidecar_are_declared(self):
        self.assertTrue({
            "network-flows/capacity/visual.css", "network-flows/capacity/release.json",
            "src/ui/depot-capacity-bench.js",
        }.issubset(integration.CAPACITY_ADDED))

    def test_capacity_visual_or_provenance_tamper_is_rejected(self):
        client = self.stage_flow_client()
        for name in ("visual.css", "release.json"):
            path = client / "network-flows/capacity" / name
            original = path.read_bytes()
            path.write_bytes(original + b"tampered")
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "capacity|provenance"):
                self.integrate_flow(client)
            path.write_bytes(original)
        self.assertFalse((self.base / "out").exists())

    def test_capacity_undeclared_asset_is_rejected(self):
        client = self.stage_flow_client()
        (client / "network-flows/capacity/unreviewed.css").write_text("body {}")
        with self.assertRaisesRegex(ValueError, "missing or unexpected"):
            self.integrate_flow(client)

    def test_resealed_capacity_html_cannot_claim_the_reviewed_page_source(self):
        client = self.stage_flow_client()
        name = "network-flows/capacity/index.html"
        page = client / name
        page.write_text(page.read_text().replace("</body>", "<h1>Unreviewed result</h1></body>"))
        sidecar = client / "network-flows/capacity/release.json"
        release = json.loads(sidecar.read_text())
        release["emitted_files"][name] = launch.inventory(client)[name]
        del release["release_digest"]
        canonical = json.dumps(
            release, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        release["release_digest"] = hashlib.sha256(canonical).hexdigest()
        sidecar.write_text(json.dumps(release))
        with self.assertRaisesRegex(ValueError, "capacity page differs"):
            self.integrate_flow(client)
        self.assertFalse((self.base / "out").exists())

    def test_flow_update_rejects_an_unreviewed_capacity_page(self):
        client = self.stage_flow_client()
        page = client / "network-flows/capacity"
        tampers = (("boot.js", 'import "./other.js";\n'), ("index.html", "<script></script>"))
        for name, extra in tampers:
            original = (page / name).read_text()
            (page / name).write_text(original + extra)
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "capacity page"):
                self.integrate_flow(client)
            (page / name).write_text(original)
        self.assertFalse((self.base / "out").exists())

    def test_client_mutation_during_city_staging_is_rejected_without_output(self):
        client = self.stage_flow_client()
        original_prepare = integration.launch.prepare

        def mutate_after_prepare(*args, **kwargs):
            report = original_prepare(*args, **kwargs)
            (client / "src/model/depot-flow.js").write_text("unreviewed changed code")
            return report

        with (
            patch.object(integration.launch, "prepare", side_effect=mutate_after_prepare),
            self.assertRaisesRegex(ValueError, "client.*(changed|integrity)"),
        ):
            self.integrate_flow(client)
        self.assertFalse((self.base / "out").exists())

    def test_source_identified_release_cannot_omit_client_security_update(self):
        with self.assertRaisesRegex(ValueError, "security client update"):
            integration.integrate(
                self.legacy,
                self.viewer,
                self.prior,
                self.offer,
                self.base / "out",
                self.offline,
                source_commit="a" * 40,
            )
        self.assertFalse((self.base / "out").exists())

    def test_source_offer_tamper_is_rejected_without_partial_output(self):
        (self.offer / "database.tar.gz").write_text("changed")
        with self.assertRaisesRegex(ValueError, "source offer integrity"):
            self.prepare()
        self.assertFalse((self.base / "out").exists())

    def test_changed_boot_contract_is_rejected(self):
        (self.legacy / "boot.js").write_text("a_different_bootstrap();")
        with self.assertRaisesRegex(ValueError, "bootstrap contract"):
            self.prepare()
        self.assertFalse((self.base / "out").exists())

    def test_temporal_viewer_rejects_missing_or_foreign_corresponding_database(self):
        for identity in (None, "b" * 64):
            with (
                self.subTest(identity=identity),
                self.assertRaisesRegex(ValueError, "temporal source offer"),
            ):
                integration.check_temporal_offer(
                    {"temporal_candidate": {"candidate_bundle_digest": "a" * 64}},
                    {"temporal_candidate_bundle_digest": identity},
                    self.offer,
                )

    def test_temporal_source_offer_requires_actual_complete_archive(self):
        with self.assertRaisesRegex(ValueError, "temporal source offer"):
            integration.check_temporal_offer(
                {"temporal_candidate": {"candidate_bundle_digest": "a" * 64}},
                {"temporal_candidate_bundle_digest": "a" * 64},
                self.offer,
            )


class PackerAgreementTest(unittest.TestCase):
    def test_capacity_boot_is_the_module_the_packer_writes(self):
        """The release tool pins the capacity boot byte for byte; it must be the packer's."""
        match = re.search(
            r"^export const SITE_CAPACITY_BOOT = '((?:[^'\\\n]|\\.)*)';$",
            PACK.read_text(),
            re.MULTILINE,
        )
        self.assertIsNotNone(match, "SITE_CAPACITY_BOOT is one single-quoted line in pack.mjs")
        self.assertEqual(match.group(1).replace("\\n", "\n"), integration.CAPACITY_BOOT)
