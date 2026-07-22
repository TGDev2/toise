"""Make ``app`` importable from the tests (same convention as
``training/smoke_test.py``): the service is run as ``uvicorn app.main:app``
from the cv-service root, so put that root on ``sys.path``.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
