PYTHON ?= python

# Always import THIS checkout's source.
#
# Two ways this goes wrong without it, and the second is the dangerous one:
#   * an environment without Hermes installed fails with "No module named hermes";
#   * the hermes-dev environment's editable install resolves `hermes` to a *different*
#     checkout, so every target would silently run another tree's code and appear to work.
# tests/unit/test_import_provenance.py fails loudly if this is ever got wrong.
export PYTHONPATH := $(CURDIR)/src$(if $(PYTHONPATH),:$(PYTHONPATH))

# Byte-compiled files from a shared source tree confuse nothing here, but keep the tree clean.
export PYTHONDONTWRITEBYTECODE := 1


ifndef DEMO_RUN_ID
DEMO_RUN_ID := phase1-demo-$(shell date -u +%Y%m%dt%H%M%Sz)
endif
DEMO_ARTIFACT := artifacts/$(DEMO_RUN_ID)

.PHONY: install install-dev doctor test lint check demo-phase1 sim-smoke fixtures \
	demo-adas demo-adas-tradeoff demo-seeded-defects demo-flywheel demo-cut-in \
	demo-stationary demo-fcw-stationary demo-steady-lead demo-adjacent-pass \
	demo-lead-decelerates preflight

# Fail early and actionably rather than deep inside a demo.
preflight:
	@$(PYTHON) -c "import pathlib, sys; \
import importlib.util as u; \
spec = u.find_spec('hermes'); \
sys.exit(0) if spec and pathlib.Path(spec.origin).resolve().parent == pathlib.Path('$(CURDIR)/src/hermes').resolve() else sys.exit(1)" \
	2>/dev/null || { \
		echo ""; \
		echo "  Hermes is not importable from this checkout with '$(PYTHON)'."; \
		echo ""; \
		echo "  Activate the project environment first:"; \
		echo "      conda activate hermes-dev"; \
		echo ""; \
		echo "  Or point make at that interpreter directly:"; \
		echo "      make <target> PYTHON=$(HOME)/miniconda3/envs/hermes-dev/bin/python"; \
		echo ""; \
		exit 1; \
	}
	@$(PYTHON) -c "import pydantic, yaml, typer, rich" 2>/dev/null || { \
		echo ""; \
		echo "  Hermes dependencies are missing from '$(PYTHON)'."; \
		echo "      conda activate hermes-dev && make install-dev"; \
		echo ""; \
		exit 1; \
	}


install:
	$(PYTHON) -m pip install -e .

install-dev:
	$(PYTHON) -m pip install -e ".[dev]"

doctor: preflight
	$(PYTHON) -m hermes doctor

test: preflight
	$(PYTHON) -m pytest -q

lint:
	$(PYTHON) -m ruff check .

check: lint test doctor

demo-phase1:
	test ! -e "$(DEMO_ARTIFACT)"
	$(PYTHON) -m hermes run --simulator fake \
		--scenario scenarios/fake_nominal.yaml --policy baseline --seed 7 \
		--run-id "$(DEMO_RUN_ID)"
	$(PYTHON) -m hermes verify-artifact "$(DEMO_ARTIFACT)"

sim-smoke: preflight
	$(PYTHON) -m hermes sim-smoke --headless

fixtures: preflight
	$(PYTHON) -m hermes fixtures regenerate

# SIMULATION-ONLY ADAS demonstration: one threat scenario the controller must brake for,
# and one threat-free scenario it must stay quiet in. Requires a vendored MetaDrive.
# `hermes run` encodes the verdict in its exit status: 0 PASS, 10 CONDITIONAL, 20 HOLD.
# A demo that shows non-PASS verdicts must tolerate those three and still fail on 30
# (invalid evidence) or on any operational error, so it cannot simply ignore errors.
ALLOW_VERDICT := || { status=$$?; [ $$status -eq 10 ] || [ $$status -eq 20 ]; }

ifndef ADAS_RUN_SUFFIX
ADAS_RUN_SUFFIX := $(shell date -u +%Y%m%dt%H%M%Sz)
endif

demo-adas: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/aeb_lead_hard_brake.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adas-threat-base-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_nominal_slow_closing.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adas-nominal-base-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes agent triage "adas-threat-base-$(ADAS_RUN_SUFFIX)"

# The trade-off demonstration: a candidate that brakes far earlier improves the safety metric
# on the threat scenario and is held anyway for what it does when nothing is there.
demo-adas-tradeoff: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_nominal_slow_closing.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "tradeoff-base-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_nominal_slow_closing.yaml \
		--policy adas-longitudinal --policy-config config/adas/defect_over_braking.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "tradeoff-cand-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes compare \
		"artifacts/tradeoff-base-$(ADAS_RUN_SUFFIX)" \
		"artifacts/tradeoff-cand-$(ADAS_RUN_SUFFIX)" \
		--variation-axis policy $(ALLOW_VERDICT)

# Does the evaluation generalise? The oracle was written against a lead-brake scenario and
# never inspects challenge.kind. These two scenarios use the same cut-in manoeuvre and differ
# only in geometry - one is a threat, one is not - so the classification cannot be coming from
# the manoeuvre. Nothing in src/hermes/adas/ or src/hermes/verifiers/ changed to support them.
demo-cut-in: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_cut_in_near.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "cutin-near-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_cut_in_far.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "cutin-far-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- the pair must separate by geometry, and be complementary ---"
	$(PYTHON) -m pytest -q tests/integration/test_cut_in_generalisation.py

# The classic AEB complement: the same stopped actor and longitudinal gap are in-path for
# the threat twin and one lane away for the nominal twin. The unchanged oracle must separate
# them from stored geometry alone; no challenge-kind dispatch exists in verifiers/adas.py.
demo-stationary: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/aeb_stationary_lead.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "stationary-threat-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/non_in_path_stationary_object.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "stationary-nominal-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- the stationary pair must separate by geometry and be complementary ---"
	$(PYTHON) -m pytest -q tests/integration/test_stationary_lead_generalisation.py

# FCW warning-margin stationary pair: warning-due geometry arrives before PARTIAL AEB
# staging in the long-gap threat, while the existing adjacent-lane twin remains nominal.
demo-fcw-stationary: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/fcw_stationary_lead.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "fcw-stationary-threat-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/non_in_path_stationary_object.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "fcw-stationary-nominal-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- the FCW stationary pair must separate by geometry and preserve warning margin ---"
	$(PYTHON) -m pytest -q tests/integration/test_fcw_stationary_lead_generalisation.py

# Constant-speed moving-lead complement: the unchanged oracle separates a 10 m/s closing
# threat from same-speed following geometry, while trace verification pins scripted speed.
demo-steady-lead: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/slow_lead_closing.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "steady-lead-threat-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/fcw_aeb_nominal_following.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "steady-lead-nominal-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- the steady-lead pair must separate by geometry and preserve actor speed ---"
	$(PYTHON) -m pytest -q tests/integration/test_steady_lead_generalisation.py

# Moving mirrored tuple: the same 10 m/s actor and 32 m gap are in-path for the threat
# and one lane away for the nominal. The unchanged oracle must separate lane placement.
demo-adjacent-pass: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/slow_lead_closing.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adjacent-pass-threat-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adjacent_lane_pass.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adjacent-pass-nominal-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- the moving mirrored tuple must separate by lane placement alone ---"
	$(PYTHON) -m pytest -q tests/integration/test_adjacent_lane_pass_generalisation.py

# Declared constant-rate lead deceleration: the baseline stays quiet over the stored nominal
# run, while the geometry-blind actor-presence defect exposes the false-intervention diagonal.
demo-lead-decelerates: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/decelerating_but_safe_lead.yaml \
		--policy adas-longitudinal --policy-config config/adas/baseline.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "lead-decelerates-nominal-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/decelerating_but_safe_lead.yaml \
		--policy adas-longitudinal \
		--policy-config config/adas/defect_actor_presence_braking.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "lead-decelerates-defect-$(ADAS_RUN_SUFFIX)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- declared lead deceleration must stay nominal unless presence alone triggers braking ---"
	$(PYTHON) -m pytest -q -p no:cacheprovider \
		tests/integration/test_decelerating_but_safe_lead_generalisation.py

# The evaluation's own acceptance criterion: controllers broken on purpose must be caught.
demo-seeded-defects: preflight
	$(PYTHON) -m pytest -q tests/integration/test_seeded_defects.py

# The failure-to-regression flywheel up to the human decision. Runs a deliberately defective
# controller, triages the failure, drafts a regression case from the observed geometry, and
# stops at the draft listing with no approval recorded - so the demo is repeatable and never
# writes into the committed suite. Approval and promotion are the manual steps in
# HERMES_SOURCE_OF_TRUTH.md section 3.2.
FLYWHEEL_RUN := flywheel-$(ADAS_RUN_SUFFIX)
FLYWHEEL_DRAFTS := $(CURDIR)/drafts

demo-flywheel: preflight
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/aeb_lead_hard_brake.yaml \
		--policy adas-longitudinal --policy-config config/adas/defect_late_braking.yaml \
		--gate-config config/gates.adas.yaml \
		--seed 7 --run-id "$(FLYWHEEL_RUN)" $(ALLOW_VERDICT)
	@echo ""
	@echo "--- triage: agent proposes, the classifier decides ---"
	$(PYTHON) -m hermes agent triage "$(FLYWHEEL_RUN)"
	@echo ""
	@echo "--- draft a regression case from the observed failure geometry ---"
	$(PYTHON) -m hermes regression draft "$(FLYWHEEL_RUN)" --draft-root "$(FLYWHEEL_DRAFTS)"
	@echo ""
	@echo "--- no human decision is recorded, so nothing here is promotable ---"
	@$(PYTHON) -m hermes regression list --draft-root "$(FLYWHEEL_DRAFTS)"
