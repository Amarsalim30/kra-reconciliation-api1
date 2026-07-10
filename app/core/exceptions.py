class AppException(Exception):
    """Base application exception."""
    pass

class SAPConfigurationError(AppException):
    """Error raised when SAP Service Layer configuration is missing or invalid."""
    pass

class SAPConnectionError(AppException):
    """Error raised when connection to SAP Service Layer fails."""
    pass

class SAPQueryError(AppException):
    """Error raised when queries/requests to SAP Service Layer fail."""
    pass

