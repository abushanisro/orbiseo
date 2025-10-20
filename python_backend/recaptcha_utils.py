"""
OrbiSEO - reCAPTCHA Validation Utility
Validates reCAPTCHA v3 tokens for security
"""

import httpx
import os
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY")

class RecaptchaValidator:
    """reCAPTCHA v3 token validator"""

    def __init__(self, secret_key: Optional[str] = None):
        self.secret_key = secret_key or RECAPTCHA_SECRET_KEY

    async def verify_token(
        self,
        token: str,
        action: str,
        min_score: float = 0.5,
        remote_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Verify reCAPTCHA v3 token

        Args:
            token: reCAPTCHA token from frontend
            action: Expected action (e.g., 'search', 'contact', 'crawl')
            min_score: Minimum score threshold (0.0 to 1.0)
            remote_ip: Optional client IP for additional validation

        Returns:
            Dict with verification results
        """
        if not self.secret_key:
            logger.warning("reCAPTCHA secret key not configured")
            return {
                "success": True,  # Allow in development
                "score": 1.0,
                "action": action,
                "challenge_ts": None,
                "hostname": None,
                "error": "recaptcha_not_configured"
            }

        if not token:
            return {
                "success": False,
                "score": 0.0,
                "action": action,
                "error": "missing_token"
            }

        try:
            # Prepare verification payload
            payload = {
                "secret": self.secret_key,
                "response": token
            }

            if remote_ip:
                payload["remoteip"] = remote_ip

            # Verify with Google
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(RECAPTCHA_VERIFY_URL, data=payload)
                response.raise_for_status()
                result = response.json()

            # Check success
            if not result.get("success", False):
                logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")
                return {
                    "success": False,
                    "score": 0.0,
                    "action": action,
                    "error": f"verification_failed: {result.get('error-codes', [])}"
                }

            # Check action match
            if result.get("action") != action:
                logger.warning(f"reCAPTCHA action mismatch: expected '{action}', got '{result.get('action')}'")
                return {
                    "success": False,
                    "score": result.get("score", 0.0),
                    "action": result.get("action"),
                    "error": "action_mismatch"
                }

            # Check score threshold
            score = result.get("score", 0.0)
            if score < min_score:
                logger.warning(f"reCAPTCHA score too low: {score} < {min_score}")
                return {
                    "success": False,
                    "score": score,
                    "action": action,
                    "error": f"score_too_low: {score} < {min_score}"
                }

            # Success
            logger.info(f"reCAPTCHA verified successfully: action={action}, score={score}")
            return {
                "success": True,
                "score": score,
                "action": action,
                "challenge_ts": result.get("challenge_ts"),
                "hostname": result.get("hostname")
            }

        except httpx.TimeoutException:
            logger.error("reCAPTCHA verification timeout")
            return {
                "success": False,
                "score": 0.0,
                "action": action,
                "error": "verification_timeout"
            }
        except Exception as e:
            logger.error(f"reCAPTCHA verification error: {e}")
            return {
                "success": False,
                "score": 0.0,
                "action": action,
                "error": f"verification_error: {str(e)}"
            }

# Global validator instance
recaptcha_validator = RecaptchaValidator()

async def verify_recaptcha(
    token: str,
    action: str,
    min_score: float = 0.5,
    remote_ip: Optional[str] = None
) -> bool:
    """
    Simple boolean verification helper

    Args:
        token: reCAPTCHA token
        action: Expected action
        min_score: Minimum score threshold
        remote_ip: Optional client IP

    Returns:
        True if verification passes, False otherwise
    """
    result = await recaptcha_validator.verify_token(token, action, min_score, remote_ip)
    return result["success"]