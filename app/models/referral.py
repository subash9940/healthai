"""
referral_state_machine.py

Drop into app/models/referral.py. Both the mobile app (creates + reads)
and the Next.js dashboard (reads + advances) must use these exact string
values — they get stored as the FHIR ServiceRequest.status equivalent.
"""

from enum import Enum


class ReferralState(str, Enum):
    CREATED = "created"                        # ASHA/rule engine creates it
    IN_TRANSIT = "in_transit"                   # patient is traveling to facility
    RECEIVED_AT_FACILITY = "received_at_facility"  # facility staff confirms arrival
    CLOSED = "closed"                           # outcome recorded, referral loop complete


# Explicit allowed transitions — reject anything not listed here.
ALLOWED_TRANSITIONS: dict[ReferralState, list[ReferralState]] = {
    ReferralState.CREATED: [ReferralState.IN_TRANSIT],
    ReferralState.IN_TRANSIT: [ReferralState.RECEIVED_AT_FACILITY],
    ReferralState.RECEIVED_AT_FACILITY: [ReferralState.CLOSED],
    ReferralState.CLOSED: [],  # terminal
}

# Who is allowed to trigger each transition — enforce this in the API layer.
TRANSITION_OWNER = {
    ReferralState.IN_TRANSIT: "asha_app",       # ASHA marks patient as sent
    ReferralState.RECEIVED_AT_FACILITY: "dashboard",  # facility staff confirms
    ReferralState.CLOSED: "dashboard",          # facility staff records outcome
}


def can_transition(current: ReferralState, target: ReferralState) -> bool:
    return target in ALLOWED_TRANSITIONS.get(current, [])