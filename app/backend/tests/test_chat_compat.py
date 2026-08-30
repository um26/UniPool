from services.messages_service import _direct_message_filter


def test_direct_message_filter_accepts_missing_and_null_conversation_id():
    value = _direct_message_filter()
    assert value == {"$or": [{"conversation_id": {"$exists": False}}, {"conversation_id": None}]}
