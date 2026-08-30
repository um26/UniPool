"""Personal cashflow tracking for UniPool students.

This ledger is independent from Circle debts: it records the user's own income and
expenses so shared balances never get mixed into personal cashflow totals.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from config.database import db
from services.auth_service import get_current_user

router = APIRouter(tags=["personal-finance"])


def now() -> datetime:
    return datetime.now(timezone.utc)


async def current_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


class TransactionCreate(BaseModel):
    kind: Literal["expense", "income"]
    amount_paise: int = Field(gt=0, le=100_000_000)
    description: str = Field(min_length=1, max_length=100)
    category: str = Field(default="other", min_length=2, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=400)
    occurred_at: Optional[datetime] = None


class TransactionUpdate(BaseModel):
    kind: Optional[Literal["expense", "income"]] = None
    amount_paise: Optional[int] = Field(default=None, gt=0, le=100_000_000)
    description: Optional[str] = Field(default=None, min_length=1, max_length=100)
    category: Optional[str] = Field(default=None, min_length=2, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=400)
    occurred_at: Optional[datetime] = None


def month_bounds(month: str) -> tuple[datetime, datetime]:
    try:
        start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM") from exc
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.post("/personal-transactions")
async def create_transaction(body: TransactionCreate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    occurred = body.occurred_at or now()
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)
    doc = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "kind": body.kind,
        "amount_paise": body.amount_paise,
        "currency": "INR",
        "description": body.description.strip(),
        "category": body.category.lower().strip(),
        "notes": body.notes.strip() if body.notes else None,
        "occurred_at": occurred,
        "created_at": now(),
        "updated_at": now(),
        "deleted_at": None,
    }
    await db.personal_transactions.insert_one(doc)
    return clean(dict(doc))


@router.get("/personal-transactions")
async def list_transactions(
    month: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    authorization: Optional[str] = Header(None),
):
    user = await current_user(authorization)
    query: dict = {"user_id": user["user_id"], "deleted_at": None}
    if month:
        start, end = month_bounds(month)
        query["occurred_at"] = {"$gte": start, "$lt": end}
    rows = await db.personal_transactions.find(query, {"_id": 0}).sort("occurred_at", -1).limit(limit).to_list(limit)
    return rows


@router.patch("/personal-transactions/{transaction_id}")
async def update_transaction(transaction_id: str, body: TransactionUpdate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    existing = await db.personal_transactions.find_one({"transaction_id": transaction_id, "user_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "description" in patch:
        patch["description"] = patch["description"].strip()
    if "category" in patch:
        patch["category"] = patch["category"].lower().strip()
    if "notes" in patch and patch["notes"]:
        patch["notes"] = patch["notes"].strip()
    if "occurred_at" in patch and patch["occurred_at"].tzinfo is None:
        patch["occurred_at"] = patch["occurred_at"].replace(tzinfo=timezone.utc)
    patch["updated_at"] = now()
    await db.personal_transactions.update_one({"transaction_id": transaction_id}, {"$set": patch})
    return await db.personal_transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})


@router.delete("/personal-transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    result = await db.personal_transactions.update_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"], "deleted_at": None},
        {"$set": {"deleted_at": now(), "updated_at": now()}},
    )
    if not result.modified_count:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"ok": True}


@router.get("/personal-finance/dashboard")
async def personal_dashboard(month: Optional[str] = Query(default=None), authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    month_key = month or now().strftime("%Y-%m")
    start, end = month_bounds(month_key)
    rows = await db.personal_transactions.find(
        {"user_id": user["user_id"], "deleted_at": None, "occurred_at": {"$gte": start, "$lt": end}},
        {"_id": 0},
    ).sort("occurred_at", -1).to_list(1000)
    expense = sum(int(row.get("amount_paise") or 0) for row in rows if row.get("kind") == "expense")
    income = sum(int(row.get("amount_paise") or 0) for row in rows if row.get("kind") == "income")
    categories: dict[str, int] = {}
    for row in rows:
        if row.get("kind") != "expense":
            continue
        key = row.get("category") or "other"
        categories[key] = categories.get(key, 0) + int(row.get("amount_paise") or 0)
    return {
        "month": month_key,
        "income_paise": income,
        "expense_paise": expense,
        "net_cashflow_paise": income - expense,
        "categories": categories,
        "transactions": rows[:100],
    }


__all__ = ["router"]
