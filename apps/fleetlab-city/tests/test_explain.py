import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from citylib.explain import explain


class ExplainTests(unittest.TestCase):
    def test_no_provider_is_deterministic_and_does_not_change_results(self):
        run = {"metrics": {"completed": 10, "created": 12}, "outcome": "INCOMPLETE"}
        before = copy.deepcopy(run)
        self.assertEqual(explain(run), explain(run))
        self.assertEqual(run, before)
        self.assertEqual(explain(run)["provider"], "template")

    def test_missing_opt_in_and_budget_prevent_network(self):
        def transport(_):
            raise AssertionError("network must not run")

        for options in [
            {"allow_paid": False, "remaining_usd": 10},
            {"allow_paid": True, "remaining_usd": 0},
        ]:
            self.assertEqual(
                explain({"metrics": {}}, provider="fireworks", transport=transport, **options)[
                    "provider"
                ],
                "template",
            )

    def test_bad_timeout_unknown_reference_and_override_fall_back(self):
        cases = [
            {},
            {"references": ["not-a-metric"], "text": "Hello", "hypotheses": []},
            {"references": ["completed"], "text": "Deploy the fleet now", "hypotheses": []},
            {"references": ["completed"], "text": "Completed 999 trips", "hypotheses": []},
        ]
        for data in cases:
            r = explain(
                {"metrics": {"completed": 2}},
                provider="fireworks",
                allow_paid=True,
                remaining_usd=1,
                transport=lambda _, data=data: data,
            )
            self.assertEqual(r["provider"], "template")

        def timeout(_):
            raise TimeoutError()

        self.assertEqual(
            explain(
                {"metrics": {}},
                provider="fireworks",
                allow_paid=True,
                remaining_usd=1,
                transport=timeout,
            )["provider"],
            "template",
        )

    def test_valid_mock_is_labeled_draft_not_evidence(self):
        r = explain(
            {"metrics": {"completed": 2}},
            provider="fireworks",
            allow_paid=True,
            remaining_usd=1,
            transport=lambda _: {
                "references": ["completed"],
                "text": "Compare completed journeys alongside unfinished work.",
                "hypotheses": [],
            },
        )
        self.assertEqual(r["status"], "DRAFT_REQUIRES_HUMAN_REVIEW")
        self.assertEqual(r["decision_authority"], "NONE")


if __name__ == "__main__":
    unittest.main()
