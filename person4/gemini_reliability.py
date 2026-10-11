"""Bounded retry for transient overload, with an explicit Gemini backup model."""
import time
import urllib.error

TRANSIENT = {500, 502, 503, 504}
BACKUP = "gemini-3.6-flash"


def generate(request_fn, key, model, body):
    # At most three calls: selected model, one retry, then eligible backup.
    # Never retry auth errors or quota errors, and never cycle through models.
    for attempt in range(2):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            return request_fn(url, key, body), model
        except urllib.error.HTTPError as error:
            if error.code not in TRANSIENT:
                raise
            if attempt == 0:
                time.sleep(1)
            elif model != "gemini-3.8-flash":
                raise
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{BACKUP}:generateContent"
    return request_fn(url, key, body), BACKUP
