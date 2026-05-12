from twilio.rest import Client
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

client = None

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    client = Client(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN
    )


def send_sms(to_number: str, message: str):
    """
    Send SMS notification using Twilio
    """

    try:
        if not client:
            print("Twilio client not initialized")
            return False

        sms = client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=to_number
        )

        print(f"SMS Sent Successfully: {sms.sid}")
        return True

    except Exception as e:
        print(f"SMS Sending Failed: {str(e)}")
        return False


def grievance_created_message(grievance_id: str):
    return f"""
AI Grievance System

Your grievance has been registered successfully.

Grievance ID: {grievance_id}

Status: Pending

Thank you for using Smart Governance System.
"""


def grievance_status_message(grievance_id: str, status: str):
    return f"""
AI Grievance System

Update for Grievance ID: {grievance_id}

New Status: {status}

Track your grievance in the portal.
"""


def officer_assigned_message(grievance_id: str, department: str):
    return f"""
AI Grievance System

Your grievance {grievance_id} has been assigned to:

Department: {department}

Action will be taken shortly.
"""


def critical_alert_message(grievance_id: str):
    return f"""
CRITICAL ALERT

High priority grievance detected.

Grievance ID: {grievance_id}

Immediate attention required.
"""


def send_grievance_created_sms(phone_number: str, grievance_id: str):
    message = grievance_created_message(grievance_id)
    return send_sms(phone_number, message)


def send_status_update_sms(
    phone_number: str,
    grievance_id: str,
    status: str
):
    message = grievance_status_message(
        grievance_id,
        status
    )

    return send_sms(phone_number, message)


def send_officer_assignment_sms(
    phone_number: str,
    grievance_id: str,
    department: str
):
    message = officer_assigned_message(
        grievance_id,
        department
    )

    return send_sms(phone_number, message)


def send_critical_alert_sms(
    phone_number: str,
    grievance_id: str
):
    message = critical_alert_message(grievance_id)

    return send_sms(phone_number, message)