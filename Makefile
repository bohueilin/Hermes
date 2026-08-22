PYTHON ?= python

ifndef DEMO_RUN_ID
DEMO_RUN_ID := phase1-demo-$(shell date -u +%Y%m%dt%H%M%Sz)
endif
DEMO_ARTIFACT := artifacts/$(DEMO_RUN_ID)

.PHONY: install install-dev doctor test lint check demo-phase1 sim-smoke fixtures \
	demo-adas demo-adas-tradeoff demo-seeded-defects

install:
	$(PYTHON) -m pip install -e .

install-dev:
	$(PYTHON) -m pip install -e ".[dev]"

doctor:
	$(PYTHON) -m hermes doctor

test:
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

sim-smoke:
	$(PYTHON) -m hermes sim-smoke --headless

fixtures:
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

demo-adas:
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
demo-adas-tradeoff:
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

# The evaluation's own acceptance criterion: controllers broken on purpose must be caught.
demo-seeded-defects:
	$(PYTHON) -m pytest -q tests/integration/test_seeded_defects.py
