"""Independent integer-millisecond exhaustive oracle, no JS producer imports."""
import json
import subprocess
from itertools import permutations
from pathlib import Path

root = Path(__file__).resolve().parents[2] / "playground/fleetlab"
cases = {"default": [480, 340, 290, 240], "impossible": [220, 340, 290, 240],
         "close": [235, 280, 328, 480], "tie": [480, 480, 480, 480]}
module = (root / "src/data/delivery-order-study.js").as_uri()
manifest = json.loads(subprocess.check_output(
    ["node", "--input-type=module", "-e", f'import {{ORDER_STUDY}} from {json.dumps(module)};'
     'console.log(JSON.stringify(ORDER_STUDY))'], text=True))
for name, targets in cases.items():
    scores = {}
    for order in permutations(range(4)):
        late = [max(0, 234000 + order.index(i) * 48000 - targets[i] * 1000) for i in range(4)]
        scores[order] = (sum(value > 0 for value in late), sum(late))
    best = min(scores.values())
    orders = [[f"V{i+1}" for i in order] for order, score in scores.items() if score == best]
    for published in [manifest["cases"][name], manifest["cases"][name]["refinement"]]:
        assert published["best_orders"] == orders, name
        metrics = published["best_metrics"]
        assert (metrics["missed_count"], metrics["late_ms_total"]) == best, name
    print(name, best, len(orders), "ties: independently matched")
