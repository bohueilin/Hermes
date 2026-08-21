PYTHON ?= python

ifndef DEMO_RUN_ID
DEMO_RUN_ID := phase1-demo-$(shell date -u +%Y%m%dt%H%M%Sz)
endif
DEMO_ARTIFACT := artifacts/$(DEMO_RUN_ID)

.PHONY: install install-dev doctor test lint check demo-phase1 sim-smoke fixtures demo-adas

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
ifndef ADAS_RUN_SUFFIX
ADAS_RUN_SUFFIX := $(shell date -u +%Y%m%dt%H%M%Sz)
endif

demo-adas:
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/aeb_lead_hard_brake.yaml \
		--policy adas-longitudinal --gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adas-threat-$(ADAS_RUN_SUFFIX)"
	$(PYTHON) -m hermes run --simulator metadrive --headless \
		--scenario scenarios/adas/adas_nominal_no_lead.yaml \
		--policy adas-longitudinal --gate-config config/gates.adas.yaml \
		--seed 7 --run-id "adas-nominal-$(ADAS_RUN_SUFFIX)"
	$(PYTHON) -m hermes review-artifact "adas-threat-$(ADAS_RUN_SUFFIX)" \
		--artifact-root artifacts --format text
