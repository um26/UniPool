"""Real match scoring and smart feed ranking."""
from datetime import timezone, timedelta
from difflib import SequenceMatcher
from typing import Any, Dict, List, Tuple
from config.database import db

def _aware(dt):
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None: return dt.replace(tzinfo=timezone.utc)
    return dt

def _norm(v: Any) -> str: return " ".join(str(v or "").strip().lower().split())
def _sim(a,b):
    a,b=_norm(a),_norm(b)
    if not a or not b: return 0.0
    return 1.0 if a==b else SequenceMatcher(None,a,b).ratio()
def _route(a,b): return (_sim(a.get("from_location"),b.get("from_location"))+_sim(a.get("to_location"),b.get("to_location")))/2
def _time(a,b):
    try: d=abs((_aware(a["travel_datetime"])-_aware(b["travel_datetime"])).total_seconds())/60
    except Exception: return 0.0
    if d<=15:return 1.0
    if d<=30:return .9
    if d<=60:return .78
    if d<=120:return .55
    if d<=180:return .3
    return 0.0
def _gender(a,b):
    ga,gb=_norm(a.get("user_gender")),_norm(b.get("user_gender"))
    for x,y in ((a,b),(b,a)):
        if x.get("gender_preference")=="same":
            if not ga or not gb:return .55
            if ga!=gb:return 0.0
    return 1.0
def _travel(a,b):
    try:c=max(0,1-min(abs(int(a.get("companions") or 0)-int(b.get("companions") or 0)),3)/4)
    except Exception:c=.6
    la,lb=_norm(a.get("luggage")),_norm(b.get("luggage")); l=.6 if not la or not lb else (1.0 if la==lb else .7)
    return .55*l+.45*c
def _trust(c):
    r=c.get("user_rating_avg"); n=int(c.get("user_rating_count") or 0); badges=len(c.get("user_badges") or [])
    return (0 if r is None else min(float(r)/5,1))*.55+min(n/10,1)*.25+min(badges/3,1)*.20
def _score(a,b):
    parts={"route":round(_route(a,b)*35),"time":round(_time(a,b)*25),"preferences":round(_gender(a,b)*10),"travel_details":round(_travel(a,b)*10),"trip_mode":round((1 if bool(a.get("trip_mode"))==bool(b.get("trip_mode")) else .55)*5),"trust":round(_trust(b)*15)}
    return max(0,min(99,sum(parts.values()))),parts
def _label(s): return "Excellent fit" if s>=90 else "Strong fit" if s>=80 else "Good fit" if s>=70 else "Possible fit"
async def _blocked(uid):
    docs=await db.blocks.find({"$or":[{"blocker_id":uid},{"blocked_id":uid}]},{"_id":0}).to_list(2000)
    return {d["blocked_id"] if d["blocker_id"]==uid else d["blocker_id"] for d in docs}
async def _enrich(cands):
    if not cands:return cands
    ids=list({c["user_id"] for c in cands})
    stats=await db.ratings.aggregate([{"$match":{"rated_user_id":{"$in":ids}}},{"$group":{"_id":"$rated_user_id","avg":{"$avg":"$stars"},"count":{"$sum":1}}}]).to_list(len(ids))
    sm={s["_id"]:s for s in stats}
    for c in cands:
        s=sm.get(c["user_id"]); c["user_rating_avg"]=round(s["avg"],1) if s else None; c["user_rating_count"]=s["count"] if s else 0
    return cands
async def smart_matches(user_id:str)->List[Dict[str,Any]]:
    mine=await db.pools.find({"user_id":user_id,"status":"open"},{"_id":0}).to_list(100)
    if not mine:return []
    blocked=await _blocked(user_id); lo=min(_aware(p["travel_datetime"]) for p in mine)-timedelta(hours=3); hi=max(_aware(p["travel_datetime"]) for p in mine)+timedelta(hours=3)
    cands=await db.pools.find({"user_id":{"$ne":user_id,"$nin":list(blocked)},"status":"open","travel_datetime":{"$gte":lo,"$lte":hi}},{"_id":0}).to_list(500)
    await _enrich(cands); out={}
    for c in cands:
        best=None
        for own in mine:
            s,b=_score(own,c)
            if best is None or s>best[0]:best=(s,b,own)
        if not best:continue
        s,b,own=best
        if b["route"]<18 or b["time"]<8 or s<52:continue
        c["match_score"]=s;c["match_label"]=_label(s);c["match_breakdown"]=b;c["matched_pool_id"]=own.get("pool_id");c["match_time_delta_minutes"]=round(abs((_aware(c["travel_datetime"])-_aware(own["travel_datetime"])).total_seconds()/60)
        out[c["pool_id"]]=c
    return sorted(out.values(),key=lambda x:(x.get("match_score",0),-x.get("match_time_delta_minutes",999)),reverse=True)
async def rank_pool_feed(user:Dict[str,Any],pools:List[Dict[str,Any]])->List[Dict[str,Any]]:
    mine=await db.pools.find({"user_id":user["user_id"],"status":"open"},{"_id":0}).to_list(100)
    if not mine:
        pools.sort(key=lambda x:_aware(x["travel_datetime"]));return pools
    await _enrich(pools)
    for p in pools:
        best=(0,{})
        for own in mine:
            s,b=_score(own,p)
            if s>best[0]:best=(s,b)
        p["feed_score"]=best[0];p["match_score"]=best[0];p["match_label"]=_label(best[0]);p["match_breakdown"]=best[1]
    return sorted(pools,key=lambda x:(x.get("feed_score",0),-_aware(x["travel_datetime"]).timestamp()),reverse=True)
