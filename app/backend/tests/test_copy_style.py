from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_public_marketing_copy_avoids_common_generated_style_markers():
    landing = (REPO_ROOT / "app/frontend/app/index.tsx").read_text(encoding="utf-8")
    metadata = (REPO_ROOT / "app/frontend/app/+html.tsx").read_text(encoding="utf-8")
    public_copy = landing + "\n" + metadata
    assert " — " not in public_copy
    assert "seamless" not in public_copy.lower()
    assert "revolutionize" not in public_copy.lower()
    assert "game-changer" not in public_copy.lower()
