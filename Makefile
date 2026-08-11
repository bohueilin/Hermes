PYTHON ?= python

.PHONY: install install-dev doctor test lint check

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
