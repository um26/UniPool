from pydantic import ValidationError
import pytest

from routes.expenses import ExpenseCreate, simplify_balances


def apply_suggestions(suggestions):
    result = {}
    for item in suggestions:
        source = item["from_user_id"]
        target = item["to_user_id"]
        amount = item["amount_paise"]
        result[source] = result.get(source, 0) - amount
        result[target] = result.get(target, 0) + amount
    return result


def test_simplification_preserves_exact_net_positions():
    balances = {"a": 12500, "b": -5000, "c": -4000, "d": -3500}
    suggestions = simplify_balances(balances)
    transfers = apply_suggestions(suggestions)
    assert transfers == balances
    assert sum(item["amount_paise"] for item in suggestions) == 12500
    assert len(suggestions) == 3


def test_simplification_is_deterministic():
    balances = {"z": 1000, "a": 1000, "c": -1000, "b": -1000}
    assert simplify_balances(balances) == simplify_balances(dict(reversed(list(balances.items()))))


def test_expense_split_must_equal_total():
    with pytest.raises(ValidationError):
        ExpenseCreate(
            description="Dinner",
            amount_paise=10000,
            paid_by="u1",
            splits=[{"user_id": "u1", "amount_paise": 4000}, {"user_id": "u2", "amount_paise": 5000}],
            split_type="exact",
        )
