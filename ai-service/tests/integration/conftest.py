"""Shared integration capture for the bounded HTTP timing logger."""

import json
import logging

import pytest

from app.providers.http_timing import LOGGER, get_emitter


@pytest.fixture
def timing_records():
    emitter = get_emitter()
    assert emitter.drain()
    records = []

    class Collector(logging.Handler):
        def emit(self, record):
            records.append(json.loads(record.getMessage()))

    handler = Collector()
    LOGGER.addHandler(handler)
    try:
        yield records
    finally:
        try:
            assert emitter.drain()
        finally:
            LOGGER.removeHandler(handler)
