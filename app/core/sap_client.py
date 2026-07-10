import datetime
import time
import logging
from typing import Any, Dict, Generator, List
import httpx

from app.core.config import get_settings
from app.core.exceptions import SAPConnectionError, SAPQueryError

logger = logging.getLogger(__name__)


class SAPClient:
    """
    HTTP Client for connecting to the SAP Business One Service Layer.
    Handles Login authentication, dynamic session cookie caching, proactive session renewal,
    transient failure retries with exponential backoff, and OData pagination.
    """

    def __init__(self):
        settings = get_settings()
        self.base_url = str(settings.sap_base_url).rstrip("/") if settings.sap_base_url else ""
        self.username = settings.sap_username
        self.password = settings.sap_password.get_secret_value() if settings.sap_password else ""
        self.company_db = settings.sap_company_db
        self.verify_ssl = settings.sap_verify_ssl

        # Initialize httpx Client
        self.client = httpx.Client(verify=self.verify_ssl, timeout=30.0)
        self.session_id = None
        self.cookies = {}
        self.session_expiry = None

    def login(self) -> None:
        """
        Logs in to the SAP Service Layer and caches session cookies and timeout.
        Raises SAPConnectionError on failure.
        """
        if not self.base_url:
            raise SAPConnectionError("SAP_BASE_URL is not configured.")

        login_url = f"{self.base_url}/Login"
        payload = {
            "CompanyDB": self.company_db,
            "UserName": self.username,
            "Password": self.password
        }

        logger.info("SAP Service Layer: Initiating Login request...")
        try:
            response = self.client.post(login_url, json=payload)
        except httpx.RequestError as exc:
            logger.error(f"SAP Service Layer Login failed due to connection error: {exc}")
            raise SAPConnectionError(f"Connection to SAP Service Layer failed: {exc}")

        if response.status_code != 200:
            logger.error(f"SAP Service Layer Login returned status {response.status_code}: {response.text}")
            raise SAPConnectionError(f"SAP Login failed (HTTP {response.status_code}): {response.text}")

        try:
            data = response.json()
        except ValueError:
            logger.error("SAP Service Layer Login returned invalid JSON.")
            raise SAPConnectionError("SAP Login failed: Service Layer did not return valid JSON.")

        self.session_id = data.get("SessionId")
        if not self.session_id:
            logger.error("SAP Service Layer Login response missing SessionId.")
            raise SAPConnectionError("SAP Login failed: Response missing SessionId.")

        self.cookies = dict(response.cookies)

        # Dynamic timeout renewal (B1 session timeout is in minutes)
        timeout_mins = int(data.get("SessionTimeout", 30))
        # Proactively refresh 2 minutes before expiry
        self.session_expiry = datetime.datetime.now() + datetime.timedelta(minutes=max(timeout_mins - 2, 1))
        logger.info("SAP Service Layer: Login successful.")

    def _ensure_session(self) -> None:
        """
        Ensures a valid session is active. Re-authenticates if expired.
        """
        if not self.session_id or not self.session_expiry or datetime.datetime.now() >= self.session_expiry:
            self.login()

    def _execute_request_with_retry(
        self, method: str, url: str, params: Dict[str, Any] = None, cookies: Dict[str, str] = None
    ) -> httpx.Response:
        """
        Executes an HTTP request with transient retry logic (exponential backoff) for idempotent GETs.
        """
        attempts = 3
        backoff = 1.0

        for i in range(attempts):
            try:
                response = self.client.request(method, url, params=params, cookies=cookies)
                # Check for session expiration
                if response.status_code == 401:
                    logger.warning("SAP Service Layer session expired/invalid. Re-authenticating...")
                    self.login()
                    # Use new cookies
                    cookies = self.cookies
                    # Retry immediate request after re-login
                    response = self.client.request(method, url, params=params, cookies=cookies)

                if response.status_code == 200 or method != "GET":
                    return response

                # Retry for server errors (502, 503, 504)
                if response.status_code in (502, 503, 504) and method == "GET":
                    logger.warning(
                        f"SAP GET request returned {response.status_code}. Retry attempt {i+1} of {attempts}..."
                    )
                else:
                    return response
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                if method != "GET":
                    raise SAPConnectionError(f"SAP Request failed: {exc}")
                logger.warning(
                    f"SAP GET request failed due to connection/timeout error: {exc}. Retry attempt {i+1} of {attempts}..."
                )
                if i == attempts - 1:
                    raise SAPConnectionError(f"SAP Service Layer connection failed after {attempts} attempts: {exc}")

            time.sleep(backoff)
            backoff *= 2.0

        raise SAPConnectionError(f"SAP Service Layer returned transient error after {attempts} attempts.")

    def get_invoices_pages(
        self, from_date: str, to_date: str, reconciliation_session_id: str = "N/A"
    ) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Fetches Sales Invoices page-by-page from /Invoices filtered by date range.
        Traverses @odata.nextLink exactly as returned by SAP.
        Yields raw invoice lists (pages) to keep memory footprint low.
        """
        self._ensure_session()

        # OData filter query
        filter_str = f"DocDate ge '{from_date}' and DocDate le '{to_date}'"
        params = {"$filter": filter_str}

        # Try optimizing with $select if supported. Falling back if query returns HTTP 400.
        select_str = "FederalTaxID,CardName,DocNum,DocDate,U_CUINV,DocumentLines"
        params_with_select = {**params, "$select": select_str}

        url = f"{self.base_url}/Invoices"
        next_url = url
        use_select = True

        logger.info(
            f"[ReconciliationSession: {reconciliation_session_id}] Fetching invoices from SAP for range {from_date} to {to_date}"
        )

        while next_url:
            current_params = None
            if next_url == url:
                current_params = params_with_select if use_select else params

            try:
                response = self._execute_request_with_retry(
                    "GET", next_url, params=current_params, cookies=self.cookies
                )
            except SAPConnectionError as exc:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] Connection error fetching SAP invoices: {exc}"
                )
                raise

            # Fallback if $select is not supported (OData version mismatch / projection unsupported)
            if response.status_code == 400 and next_url == url and use_select:
                logger.warning(
                    f"[ReconciliationSession: {reconciliation_session_id}] SAP returned HTTP 400 with select projection. Retrying without $select projection..."
                )
                use_select = False
                continue

            if response.status_code != 200:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] SAP Query failed with status {response.status_code}: {response.text}"
                )
                raise SAPQueryError(f"SAP Invoices query failed (HTTP {response.status_code}): {response.text}")

            try:
                data = response.json()
            except ValueError:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] SAP returned non-JSON data: {response.text}"
                )
                raise SAPQueryError("SAP Invoices query returned invalid JSON.")

            invoices_page = data.get("value", [])
            yield invoices_page

            # Traverse @odata.nextLink exactly as returned by SAP
            next_link = data.get("odata.nextLink") or data.get("@odata.nextLink")
            if next_link:
                if next_link.startswith("http"):
                    next_url = next_link
                else:
                    # If relative, construct using base URL
                    next_url = f"{self.base_url}/{next_link}"
            else:
                next_url = None
