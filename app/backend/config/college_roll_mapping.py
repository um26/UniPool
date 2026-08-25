"""Authoritative Mahindra University roll-number mappings.

The branch/program codes are derived from the university roll-prefix mapping
provided for UniPool. The two-digit year is intentionally parsed separately,
so the same mapping works for SE22, SE24, SE26, SM25, etc.
"""

SCHOOL_CODES = {
    "se": "School of Engineering",
    "sm": "School of Management",
    "sl": "School of Law",
}

DEGREE_LEVEL_NAMES = {
    "u": "Undergraduate",
    "m": "Masters",
    "p": "PhD",
}

# Prefixes from the supplied SE26/SM26 mapping. These branch/program codes
# remain valid across batches because the batch year is a separate component.
BRANCH_CODES = {
    "aee": "Aerospace Engineering",
    "ari": "Artificial Intelligence",
    "mbt": "5-Year Integrated M.Tech - Biotechnology",
    "mcs": "5-Year Integrated M.Tech - Computer Science and Engineering",
    "bit": "Biotechnology",
    "cab": "Computational Biology",
    "cie": "Civil Engineering",
    "cam": "Computational Mathematics",
    "cse": "Computer Science and Engineering",
    "dsc": "Data Science",
    "ece": "Electronics and Communication Engineering",
    "ecm": "Electronics and Computer Engineering",
    "mee": "Mechanical Engineering",
    "mec": "Mechatronics",
    "nan": "Nano-Technology",
    "vls": "VLSI Design and Technology",
    "inm": "Infrastructure Management",
    "bef": "Applied Economics and Finance",
    "efb": "Entrepreneurship and Family Business",
    "bba": "Computational Business Analytics",
    "bbd": "Digital Technologies",
}

# School of Law formats supplied separately by a student. These are kept
# explicit because law roll numbers do not all use the generic
# school+year+degree+branch+3-digit-serial shape.
LAW_PATTERNS = (
    # SL22ULBB / SL26ULBB
    (r"^sl(\d{2})u(lbb)$", "BBA LLB", "Undergraduate", "BBA LLB"),
    # SL22ULBA / SL26ULBA
    (r"^sl(\d{2})u(lba)$", "BA LLB", "Undergraduate", "BA LLB"),
    # SL25MLLB
    (r"^sl(\d{2})m(llb)$", "Masters in Law", "Masters", "Masters in Law"),
    # SL23LLBA
    (r"^sl(\d{2})(llba)$", "LLB", "Undergraduate", "LLB (3-year)"),
    # SL25PLAW001
    (r"^sl(\d{2})p(law)(\d{3})$", "Law", "PhD", "PhD in Law"),
    # SL25ULLB001
    (r"^sl(\d{2})u(llb)(\d{3})$", "LLB", "Undergraduate", "LLB (3-year)"),
)
