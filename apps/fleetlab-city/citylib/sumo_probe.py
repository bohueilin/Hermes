"""Bounded microscopic SUMO traffic audition; not depot-controller qualification."""

import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import sumolib
import traci

from .contracts import save_json


def probe(out, bin_dir, background=0):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    net = out / "grid.net.xml"
    routes = out / "probe.rou.xml"
    build = subprocess.run(
        [
            str(Path(bin_dir) / "netgenerate"),
            "--grid",
            "--grid.number",
            "8",
            "--grid.length",
            "300",
            "--no-turnarounds",
            "true",
            "--output-file",
            str(net),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if build.returncode:
        raise ValueError(build.stderr)
    network = sumolib.net.readNet(str(net))
    edges = [e for e in network.getEdges() if e.allows("passenger")]
    # Find a connected directed loop using three corner-near edges; repeat to keep 100
    # vehicles active.
    corners = [
        min(
            edges,
            key=lambda e: (
                (e.getFromNode().getCoord()[0] - x) ** 2 + (e.getFromNode().getCoord()[1] - y) ** 2
            ),
        )
        for x, y in [(0, 0), (2100, 0), (2100, 2100), (0, 2100)]
    ]
    loop = []
    for a, b in zip(corners, corners[1:] + corners[:1], strict=True):
        path, _ = network.getShortestPath(a, b)
        if not path:
            raise ValueError("probe graph has no loop")
        loop.extend(e.getID() for e in path[:-1])
    root = ET.Element("routes")
    ET.SubElement(root, "vType", id="ev", vClass="passenger", length="4.7", maxSpeed="13.9")
    ET.SubElement(root, "route", id="loop", edges=" ".join(loop * 50))
    departures = [(0, f"ev-{i:03d}") for i in range(100)] + [
        (int(i * 3600 / max(1, background)), f"bg-{i:03d}") for i in range(background)
    ]
    for t, vid in sorted(departures):
        ET.SubElement(
            root, "vehicle", id=vid, type="ev", route="loop", depart=str(t), departLane="free"
        )
    ET.ElementTree(root).write(routes, encoding="utf-8")
    command = [
        str(Path(bin_dir) / "sumo"),
        "-n",
        str(net),
        "-r",
        str(routes),
        "--step-length",
        "1",
        "--seed",
        "42",
        "--no-step-log",
        "true",
        "--duration-log.disable",
        "true",
        "--time-to-teleport",
        "-1",
        "--error-log",
        str(out / "sumo-errors.log"),
    ]
    start = time.monotonic()
    traci.start(command, label=f"probe-{background}")
    conn = traci.getConnection(f"probe-{background}")
    departed = arrived = teleports = 0
    maximum = 0
    try:
        for _ in range(3600):
            conn.simulationStep()
            departed += conn.simulation.getDepartedNumber()
            arrived += conn.simulation.getArrivedNumber()
            teleports += conn.simulation.getStartingTeleportNumber()
            maximum = max(maximum, conn.vehicle.getIDCount())
        pending = len(conn.simulation.getPendingVehicles())
        clock = conn.simulation.getTime()
    finally:
        conn.close()
    result = {
        "engine": "SUMO 1.27.1",
        "mode": "microscopic",
        "clock_s": clock,
        "wall_s": time.monotonic() - start,
        "fleet": 100,
        "background_arrivals_per_hour": background,
        "max_concurrent": maximum,
        "departed": departed,
        "arrived": arrived,
        "pending_insertion": pending,
        "teleports": teleports,
        "traffic_probe_pass": clock == 3600 and teleports == 0 and departed == 100 + background,
        "depot_controller_qualification": "NOT_RUN",
        "source_map_qualification": "NOT_ESTABLISHED_BY_GRID_PROBE",
        "command": command,
    }
    save_json(out / "report.json", result)
    return result
