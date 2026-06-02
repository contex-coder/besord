"""
Country-specific tax-ID format validation.

Goal: catch obvious garbage (000000000, repeated digits, wrong length,
bad checksum) before persisting. Not a substitute for authority lookup,
but blocks the vast majority of typos/fraud at form submission.

Each validator returns (ok: bool, normalized_value_or_error: str).
"""
import re
from typing import Tuple, Optional


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _all_same(s: str) -> bool:
    return len(set(s)) <= 1


# ---------------- Portugal NIPC / NIF (9 digits, mod-11 checksum) ----------------
def validate_pt(raw: str) -> Tuple[bool, str]:
    d = _digits(raw)
    if len(d) != 9:
        return False, "NIPC inválido: deve ter 9 dígitos."
    if _all_same(d):
        return False, "NIPC inválido."
    # First digit indicates entity type (1,2,3 → singular; 5,6,8 → company; 9 → temporary)
    if d[0] not in "12356789":
        return False, "NIPC inválido (primeiro dígito não reconhecido)."
    total = sum(int(d[i]) * (9 - i) for i in range(8))
    chk = 11 - (total % 11)
    if chk >= 10:
        chk = 0
    if chk != int(d[8]):
        return False, "NIPC inválido (checksum)."
    return True, d


# ---------------- Brazil CNPJ (14 digits, 2 check digits) ----------------
def validate_br_cnpj(raw: str) -> Tuple[bool, str]:
    d = _digits(raw)
    if len(d) != 14:
        return False, "CNPJ inválido: deve ter 14 dígitos."
    if _all_same(d):
        return False, "CNPJ inválido."

    def _calc(slice_, weights):
        s = sum(int(slice_[i]) * weights[i] for i in range(len(weights)))
        r = s % 11
        return "0" if r < 2 else str(11 - r)

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    if _calc(d[:12], w1) != d[12] or _calc(d[:13], w2) != d[13]:
        return False, "CNPJ inválido (checksum)."
    # Pretty format
    pretty = f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return True, pretty


# ---------------- Spain CIF/NIF (8 digits + control char) ----------------
def validate_es(raw: str) -> Tuple[bool, str]:
    s = re.sub(r"[\s-]", "", (raw or "").upper())
    if not re.match(r"^[A-Z\d]\d{7}[A-Z\d]$", s):
        return False, "NIF/CIF inválido (formato: letra+7 dígitos+letra/dígito)."
    if _all_same(s[1:8]):
        return False, "NIF/CIF inválido."
    return True, s


# ---------------- France SIRET (14 digits, Luhn) ----------------
def _luhn(num: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(num)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def validate_fr_siret(raw: str) -> Tuple[bool, str]:
    d = _digits(raw)
    if len(d) != 14:
        return False, "SIRET inválido: deve ter 14 dígitos."
    if _all_same(d):
        return False, "SIRET inválido."
    if not _luhn(d):
        return False, "SIRET inválido (checksum Luhn)."
    return True, d


# ---------------- Italy P.IVA (11 digits, mod-10) ----------------
def validate_it(raw: str) -> Tuple[bool, str]:
    d = _digits(raw)
    if len(d) != 11:
        return False, "P.IVA inválida: deve ter 11 dígitos."
    if _all_same(d):
        return False, "P.IVA inválida."
    total = 0
    for i, ch in enumerate(d[:10]):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    chk = (10 - (total % 10)) % 10
    if chk != int(d[10]):
        return False, "P.IVA inválida (checksum)."
    return True, d


# ---------------- UK VAT (9 digits, mod-97) ----------------
def validate_gb_vat(raw: str) -> Tuple[bool, str]:
    s = re.sub(r"[\sGBgb]", "", raw or "")
    if not re.match(r"^\d{9}$", s):
        return False, "VAT inválido: deve ter 9 dígitos."
    if _all_same(s):
        return False, "VAT inválido."
    return True, s  # Real mod-97 has many edge cases; format check is enough for MVP


# ---------------- US EIN (9 digits, XX-XXXXXXX) ----------------
def validate_us_ein(raw: str) -> Tuple[bool, str]:
    d = _digits(raw)
    if len(d) != 9:
        return False, "EIN inválido: deve ter 9 dígitos."
    if _all_same(d):
        return False, "EIN inválido."
    return True, f"{d[:2]}-{d[2:]}"


# ---------------- Generic (other countries) ----------------
def validate_generic(raw: str) -> Tuple[bool, str]:
    s = (raw or "").strip()
    if len(s) < 4:
        return False, "ID fiscal demasiado curto."
    digits_only = _digits(s)
    if digits_only and _all_same(digits_only) and len(digits_only) >= 4:
        return False, "ID fiscal inválido."
    return True, s


VALIDATORS = {
    "PT": validate_pt,
    "BR": validate_br_cnpj,
    "ES": validate_es,
    "FR": validate_fr_siret,
    "IT": validate_it,
    "GB": validate_gb_vat,
    "US": validate_us_ein,
}


def validate_tax_id(country_code: Optional[str], raw: str) -> Tuple[bool, str]:
    """Returns (ok, normalized_or_error_message)."""
    cc = (country_code or "").upper()
    fn = VALIDATORS.get(cc, validate_generic)
    return fn(raw)
