"""Circles: shared expenses, settlements and debt simplification for student groups."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from config.database import db
from services.auth_service import get_current_user

router = APIRouter(tags=["circles-expenses"])


def now() -> datetime:
    return datetime.now(timezone.utc)


async def current_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def public_user(user: dict) -> dict:
    return {
        "user_id": user.get("user_id"), "name": user.get("name") or "Student", "username": user.get("username"),
        "picture": user.get("picture"), "college_verified": bool(user.get("college_verified")),
    }


async def group_for_member(group_id: str, user_id: str) -> dict:
    group = await db.expense_groups.find_one({"group_id": group_id, "member_ids": user_id, "archived": {"$ne": True}}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Circle not found")
    return group


async def log_activity(group_id: str, actor: dict, action: str, label: str, metadata: Optional[dict] = None):
    await db.expense_activity.insert_one({
        "activity_id": f"act_{uuid.uuid4().hex[:12]}", "group_id": group_id,
        "actor_id": actor["user_id"], "actor_name": actor.get("name") or "Student",
        "action": action, "label": label, "metadata": metadata or {}, "created_at": now(),
    })


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    member_ids: List[str] = Field(default_factory=list, max_length=40)
    emoji: str = Field(default="💸", max_length=8)


class MemberAdd(BaseModel):
    user_id: str


class JoinCircle(BaseModel):
    invite_code: str = Field(min_length=6, max_length=24)


class ExpenseSplit(BaseModel):
    user_id: str
    amount_paise: int = Field(ge=0)


class ExpenseCreate(BaseModel):
    description: str = Field(min_length=1, max_length=100)
    amount_paise: int = Field(gt=0, le=100_000_000)
    paid_by: str
    splits: List[ExpenseSplit] = Field(min_length=1, max_length=40)
    split_type: Literal["equal", "exact", "percentage", "shares"] = "equal"
    category: str = Field(default="other", min_length=2, max_length=30)
    notes: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def total_matches(self):
        if sum(item.amount_paise for item in self.splits) != self.amount_paise:
            raise ValueError("Split amounts must add up exactly to the expense total")
        return self


class SettlementCreate(BaseModel):
    from_user_id: str
    to_user_id: str
    amount_paise: int = Field(gt=0, le=100_000_000)
    note: Optional[str] = Field(default=None, max_length=240)


async def member_map(group: dict) -> Dict[str, dict]:
    ids = list(dict.fromkeys(group.get("member_ids") or []))
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "name": 1, "username": 1, "picture": 1, "college_verified": 1}).to_list(len(ids) or 1)
    return {u["user_id"]: public_user(u) for u in users}


async def ledger(group_id: str, member_ids: List[str]) -> dict:
    balances = {uid: 0 for uid in member_ids}
    expenses = await db.expenses.find({"group_id": group_id, "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    settlements = await db.expense_settlements.find({"group_id": group_id, "voided_at": None}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for expense in expenses:
        payer = expense.get("paid_by")
        if payer in balances:
            balances[payer] += int(expense.get("amount_paise") or 0)
        for split in expense.get("splits") or []:
            uid = split.get("user_id")
            if uid in balances:
                balances[uid] -= int(split.get("amount_paise") or 0)
    for settlement in settlements:
        source, target, amount = settlement.get("from_user_id"), settlement.get("to_user_id"), int(settlement.get("amount_paise") or 0)
        if source in balances:
            balances[source] += amount
        if target in balances:
            balances[target] -= amount
    return {"balances": balances, "expenses": expenses, "settlements": settlements}


def simplify_balances(balances: Dict[str, int]) -> List[dict]:
    """Return deterministic settlement suggestions preserving every member's net position."""
    creditors = [[uid, amount] for uid, amount in balances.items() if amount > 0]
    debtors = [[uid, -amount] for uid, amount in balances.items() if amount < 0]
    creditors.sort(key=lambda item: (-item[1], item[0]))
    debtors.sort(key=lambda item: (-item[1], item[0]))
    result, i, j = [], 0, 0
    while i < len(debtors) and j < len(creditors):
        amount = min(debtors[i][1], creditors[j][1])
        if amount > 0:
            result.append({"from_user_id": debtors[i][0], "to_user_id": creditors[j][0], "amount_paise": amount})
        debtors[i][1] -= amount
        creditors[j][1] -= amount
        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1
    return result


async def group_payload(group: dict, viewer_id: str, activity_limit: int = 30) -> dict:
    members = await member_map(group)
    state = await ledger(group["group_id"], group.get("member_ids") or [])
    simplified = simplify_balances(state["balances"])
    for item in simplified:
        item["from_name"] = members.get(item["from_user_id"], {}).get("name", "Student")
        item["to_name"] = members.get(item["to_user_id"], {}).get("name", "Student")
    for expense in state["expenses"]:
        expense["paid_by_name"] = members.get(expense.get("paid_by"), {}).get("name", "Student")
        expense["split_names"] = {s["user_id"]: members.get(s["user_id"], {}).get("name", "Student") for s in expense.get("splits") or []}
    activity = await db.expense_activity.find({"group_id": group["group_id"]}, {"_id": 0}).sort("created_at", -1).limit(activity_limit).to_list(activity_limit)
    month_key = now().strftime("%Y-%m")
    month_expenses = [e for e in state["expenses"] if e.get("created_at") and e["created_at"].strftime("%Y-%m") == month_key]
    categories: Dict[str, int] = {}
    for e in month_expenses:
        categories[e.get("category") or "other"] = categories.get(e.get("category") or "other", 0) + int(e.get("amount_paise") or 0)
    return {
        "group": group,
        "members": [members[uid] for uid in group.get("member_ids") or [] if uid in members],
        "balances": [{"user_id": uid, "name": members.get(uid, {}).get("name", "Student"), "amount_paise": amount} for uid, amount in state["balances"].items()],
        "my_balance_paise": state["balances"].get(viewer_id, 0),
        "simplified": simplified,
        "expenses": state["expenses"][:100], "settlements": state["settlements"][:100], "activity": activity,
        "month": {"key": month_key, "total_paise": sum(int(e.get("amount_paise") or 0) for e in month_expenses), "categories": categories},
    }


@router.post("/expense-groups")
async def create_group(body: GroupCreate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    ids = list(dict.fromkeys([user["user_id"], *body.member_ids]))[:40]
    existing = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1}).to_list(len(ids))
    valid = {u["user_id"] for u in existing}
    ids = [uid for uid in ids if uid in valid]
    group = {
        "group_id": f"grp_{uuid.uuid4().hex[:12]}", "name": body.name.strip(), "emoji": body.emoji,
        "created_by": user["user_id"], "member_ids": ids, "admins": [user["user_id"]],
        "invite_code": uuid.uuid4().hex[:8].upper(), "archived": False, "created_at": now(), "updated_at": now(),
    }
    await db.expense_groups.insert_one(group)
    await log_activity(group["group_id"], user, "group_created", f"created {group['name']}")
    group.pop("_id", None)
    return await group_payload(group, user["user_id"])


@router.get("/expense-groups")
async def list_groups(authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    groups = await db.expense_groups.find({"member_ids": user["user_id"], "archived": {"$ne": True}}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    result = []
    for group in groups:
        state = await ledger(group["group_id"], group.get("member_ids") or [])
        result.append({
            **group, "my_balance_paise": state["balances"].get(user["user_id"], 0),
            "member_count": len(group.get("member_ids") or []), "expense_count": len(state["expenses"]),
        })
    return result


@router.get("/expense-groups/{group_id}")
async def get_group(group_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await group_for_member(group_id, user["user_id"])
    return await group_payload(group, user["user_id"])


@router.post("/expense-groups/{group_id}/members")
async def add_member(group_id: str, body: MemberAdd, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await group_for_member(group_id, user["user_id"])
    if user["user_id"] not in group.get("admins", []):
        raise HTTPException(status_code=403, detail="Only a Circle admin can add members")
    member = await db.users.find_one({"user_id": body.user_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.expense_groups.update_one({"group_id": group_id}, {"$addToSet": {"member_ids": body.user_id}, "$set": {"updated_at": now()}})
    await log_activity(group_id, user, "member_added", f"added {member.get('name') or 'a student'}", {"user_id": body.user_id})
    return {"ok": True, "member": public_user(member)}


@router.post("/expense-groups/join")
async def join_group(body: JoinCircle, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await db.expense_groups.find_one({"invite_code": body.invite_code.strip().upper(), "archived": {"$ne": True}}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Invite code not found")
    await db.expense_groups.update_one({"group_id": group["group_id"]}, {"$addToSet": {"member_ids": user["user_id"]}, "$set": {"updated_at": now()}})
    await log_activity(group["group_id"], user, "member_joined", "joined the Circle")
    group = await db.expense_groups.find_one({"group_id": group["group_id"]}, {"_id": 0})
    return await group_payload(group, user["user_id"])


@router.post("/expense-groups/{group_id}/expenses")
async def add_expense(group_id: str, body: ExpenseCreate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await group_for_member(group_id, user["user_id"])
    members = set(group.get("member_ids") or [])
    if body.paid_by not in members or any(split.user_id not in members for split in body.splits):
        raise HTTPException(status_code=400, detail="Every payer and participant must be a Circle member")
    expense = {
        "expense_id": f"exp_{uuid.uuid4().hex[:12]}", "group_id": group_id,
        "description": body.description.strip(), "amount_paise": body.amount_paise, "currency": "INR",
        "paid_by": body.paid_by, "splits": [s.model_dump() for s in body.splits], "split_type": body.split_type,
        "category": body.category.lower().strip(), "notes": body.notes.strip() if body.notes else None,
        "created_by": user["user_id"], "created_at": now(), "updated_at": now(), "deleted_at": None,
    }
    await db.expenses.insert_one(expense)
    await db.expense_groups.update_one({"group_id": group_id}, {"$set": {"updated_at": now()}})
    await log_activity(group_id, user, "expense_added", f"added {expense['description']}", {"expense_id": expense["expense_id"], "amount_paise": body.amount_paise})
    expense.pop("_id", None)
    return expense


@router.delete("/expense-groups/{group_id}/expenses/{expense_id}")
async def delete_expense(group_id: str, expense_id: str, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await group_for_member(group_id, user["user_id"])
    expense = await db.expenses.find_one({"group_id": group_id, "expense_id": expense_id, "deleted_at": None}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.get("created_by") != user["user_id"] and user["user_id"] not in group.get("admins", []):
        raise HTTPException(status_code=403, detail="Only the creator or a Circle admin can remove this expense")
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": {"deleted_at": now(), "deleted_by": user["user_id"]}})
    await log_activity(group_id, user, "expense_deleted", f"removed {expense['description']}", {"expense_id": expense_id})
    return {"ok": True}


@router.post("/expense-groups/{group_id}/settlements")
async def settle(group_id: str, body: SettlementCreate, authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    group = await group_for_member(group_id, user["user_id"])
    members = set(group.get("member_ids") or [])
    if body.from_user_id not in members or body.to_user_id not in members or body.from_user_id == body.to_user_id:
        raise HTTPException(status_code=400, detail="Choose two different Circle members")
    if user["user_id"] not in {body.from_user_id, body.to_user_id} and user["user_id"] not in group.get("admins", []):
        raise HTTPException(status_code=403, detail="You can only record your own settlement unless you're a Circle admin")
    settlement = {
        "settlement_id": f"set_{uuid.uuid4().hex[:12]}", "group_id": group_id,
        "from_user_id": body.from_user_id, "to_user_id": body.to_user_id, "amount_paise": body.amount_paise,
        "currency": "INR", "note": body.note.strip() if body.note else None, "created_by": user["user_id"],
        "created_at": now(), "voided_at": None,
    }
    await db.expense_settlements.insert_one(settlement)
    await db.expense_groups.update_one({"group_id": group_id}, {"$set": {"updated_at": now()}})
    names = await member_map(group)
    await log_activity(group_id, user, "settlement_added", f"recorded {names.get(body.from_user_id, {}).get('name', 'Student')} → {names.get(body.to_user_id, {}).get('name', 'Student')} settlement", {"amount_paise": body.amount_paise})
    settlement.pop("_id", None)
    return settlement


@router.get("/expense-dashboard")
async def expense_dashboard(authorization: Optional[str] = Header(None)):
    user = await current_user(authorization)
    groups = await db.expense_groups.find({"member_ids": user["user_id"], "archived": {"$ne": True}}, {"_id": 0}).to_list(100)
    owed_to_me = owe = spent = paid = 0
    month_key = now().strftime("%Y-%m")
    circle_rows = []
    for group in groups:
        state = await ledger(group["group_id"], group.get("member_ids") or [])
        mine = state["balances"].get(user["user_id"], 0)
        if mine > 0: owed_to_me += mine
        if mine < 0: owe += -mine
        for expense in state["expenses"]:
            if expense.get("created_at") and expense["created_at"].strftime("%Y-%m") == month_key:
                if expense.get("paid_by") == user["user_id"]:
                    paid += int(expense.get("amount_paise") or 0)
                spent += sum(int(s.get("amount_paise") or 0) for s in expense.get("splits") or [] if s.get("user_id") == user["user_id"])
        circle_rows.append({"group_id": group["group_id"], "name": group["name"], "emoji": group.get("emoji", "💸"), "my_balance_paise": mine, "member_count": len(group.get("member_ids") or [])})
    return {"month": month_key, "spent_paise": spent, "paid_paise": paid, "owe_paise": owe, "owed_to_me_paise": owed_to_me, "net_paise": owed_to_me - owe, "circles": circle_rows}
