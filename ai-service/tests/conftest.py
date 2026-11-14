"""Offline checks must fail closed before any socket can leave the process."""

import logging
import socket
import threading

import pytest


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    original_socket, original_pair = socket.socket, socket.socketpair
    original_connect = original_socket.connect
    local = threading.local()

    def denied(*args, **kwargs):
        raise AssertionError("Network is disabled in the offline test suite")

    def connect(sock, address):
        # Windows implements asyncio's internal socketpair using loopback TCP.
        # Permit only the synchronous stdlib socketpair construction, not application I/O.
        if getattr(local, "socketpair", False) and address[0] in ("127.0.0.1", "::1"):
            return original_connect(sock, address)
        return denied()

    def pair(*args, **kwargs):
        local.socketpair = True
        try:
            return original_pair(*args, **kwargs)
        finally:
            local.socketpair = False

    class OfflineSocket(original_socket):
        def __init__(self, family=-1, type=-1, proto=-1, fileno=None):
            # Also block Proactor/ConnectEx and native async transports, which can bypass
            # socket.connect. Only the stdlib's synchronous socketpair may create TCP sockets.
            if family in (-1, socket.AF_INET, socket.AF_INET6) and not getattr(
                local, "socketpair", False
            ):
                denied()
            super().__init__(family, type, proto, fileno)

    monkeypatch.setattr(socket, "socket", OfflineSocket)
    monkeypatch.setattr(socket, "socketpair", pair)
    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", denied)
    monkeypatch.setattr(socket, "create_connection", denied)
    monkeypatch.setattr(socket, "getaddrinfo", denied)


@pytest.fixture
def diagnostic_records():
    from app.diagnostics import LOGGER, configure

    configure()
    records = []

    class Collector(logging.Handler):
        def emit(self, record):
            records.append(record)

    handler = Collector()
    LOGGER.addHandler(handler)
    try:
        yield records
    finally:
        LOGGER.removeHandler(handler)
