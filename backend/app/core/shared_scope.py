GLOBAL_BUSINESS_OWNER_ID = 1


def business_owner_id() -> int:
    """All core tax-workbench business data is shared across login accounts."""
    return GLOBAL_BUSINESS_OWNER_ID
