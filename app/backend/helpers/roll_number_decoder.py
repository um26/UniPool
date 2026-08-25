"""Mahindra University roll-number decoder used during college verification."""

import re
from typing import Optional

from config.college_roll_mapping import SCHOOL_CODES, DEGREE_LEVEL_NAMES, BRANCH_CODES

GENERIC_RE = re.compile(r"^([a-z]{2})(\d{2})([ump])([a-z]+)(\d{3})$", re.I)


def decode_roll_number(local_part: str) -> Optional[dict]:
    """Decode supported Mahindra University roll-number formats.

    Generic format:
        SE22UCAM015 -> School of Engineering / 2022 / Undergraduate /
        Computational Mathematics / serial 015

    Law has several legacy/program-specific formats, so those are handled
    explicitly before the generic parser.
    """
    value = (local_part or "").strip().lower()
    if not value:
        return None

    # School of Law formats supplied separately.
    m = re.fullmatch(r"sl(\d{2})u(lbb|lba)", value)
    if m:
        yy, branch = m.groups()
        program = "BBA LLB" if branch == "lbb" else "BA LLB"
        return {
            "roll_number": value.upper(), "school_code": "SL",
            "school_name": SCHOOL_CODES["sl"], "batch_year": 2000 + int(yy),
            "degree_level_code": "U", "degree_level_name": "Undergraduate",
            "branch_code": branch.upper(), "branch_name": program,
            "program_name": program, "serial": None,
        }

    m = re.fullmatch(r"sl(\d{2})mllb", value)
    if m:
        return {
            "roll_number": value.upper(), "school_code": "SL",
            "school_name": SCHOOL_CODES["sl"], "batch_year": 2000 + int(m.group(1)),
            "degree_level_code": "M", "degree_level_name": "Masters",
            "branch_code": "LLB", "branch_name": "Masters in Law",
            "program_name": "Masters in Law", "serial": None,
        }

    m = re.fullmatch(r"sl(\d{2})llba", value)
    if m:
        return {
            "roll_number": value.upper(), "school_code": "SL",
            "school_name": SCHOOL_CODES["sl"], "batch_year": 2000 + int(m.group(1)),
            "degree_level_code": "U", "degree_level_name": "Undergraduate",
            "branch_code": "LLBA", "branch_name": "LLB (3-year)",
            "program_name": "LLB (3-year)", "serial": None,
        }

    m = re.fullmatch(r"sl(\d{2})plaw(\d{3})", value)
    if m:
        yy, serial = m.groups()
        return {
            "roll_number": value.upper(), "school_code": "SL",
            "school_name": SCHOOL_CODES["sl"], "batch_year": 2000 + int(yy),
            "degree_level_code": "P", "degree_level_name": "PhD",
            "branch_code": "LAW", "branch_name": "Law",
            "program_name": "PhD in Law", "serial": serial,
        }

    m = re.fullmatch(r"sl(\d{2})ullb(\d{3})", value)
    if m:
        yy, serial = m.groups()
        return {
            "roll_number": value.upper(), "school_code": "SL",
            "school_name": SCHOOL_CODES["sl"], "batch_year": 2000 + int(yy),
            "degree_level_code": "U", "degree_level_name": "Undergraduate",
            "branch_code": "LLB", "branch_name": "LLB (3-year)",
            "program_name": "LLB (3-year)", "serial": serial,
        }

    # Engineering/Management and any future batch using a known branch code.
    m = GENERIC_RE.fullmatch(value)
    if not m:
        return None

    school_code, yy, degree_code, branch_code, serial = m.groups()
    school_code = school_code.lower()
    degree_code = degree_code.lower()
    branch_code = branch_code.lower()

    if school_code not in SCHOOL_CODES or branch_code not in BRANCH_CODES:
        return None

    return {
        "roll_number": value.upper(),
        "school_code": school_code.upper(),
        "school_name": SCHOOL_CODES[school_code],
        "batch_year": 2000 + int(yy),
        "degree_level_code": degree_code.upper(),
        "degree_level_name": DEGREE_LEVEL_NAMES[degree_code],
        "branch_code": branch_code.upper(),
        "branch_name": BRANCH_CODES[branch_code],
        "program_name": BRANCH_CODES[branch_code],
        "serial": serial,
    }
