"""Import-safe simulator compatibility declarations.

This module contains data only.  It is deliberately outside ``hermes.adapters`` so
stored evidence verification can validate a recorded support profile without loading
runtime adapter code or an external simulator package.
"""

SUPPORTED_METADRIVE_VERSION = "0.4.3"
SUPPORTED_METADRIVE_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"
SUPPORTED_METADRIVE_SOURCE = "third_party/metadrive"
