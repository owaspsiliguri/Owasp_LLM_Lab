"""Fix-It challenge for LLM10: never build SQL from model output."""
import sqlite3

FUNC_NAME = "search_products"
TITLE = "Parameterize model-generated SQL input"
BRIEF = (
    "The model extracts a category filter from the user's request; search_products() pastes it into SQL. "
    "Use a parameterized query so the filter is always treated as data. Return a list of rows."
)
STARTER = '''def search_products(conn, category: str) -> list:
    # VULNERABLE: model output is concatenated into the SQL string.
    sql = "SELECT id, name, category, price FROM products WHERE category = '" + category + "'"
    return conn.execute(sql).fetchall()
'''
TOKEN = "TOKEN-FIXIT-5c1e"
PAYLOADS = [
    "x' UNION SELECT id, username, api_token, 0 FROM users --",
    "' OR '1'='1",
    "Gadgets' OR category LIKE '%",
    "x' UNION SELECT 1, api_token, 'a', 1 FROM users WHERE '1'='1",
]


def _conn():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL)")
    c.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, api_token TEXT)")
    c.executemany("INSERT INTO products VALUES (?,?,?,?)", [
        (1, "Widget", "Gadgets", 9.5), (2, "Gizmo", "Gadgets", 19.0),
        (3, "Novel", "Books", 12.0), (4, "Trail Jacket", "Men's Gear", 89.0)])
    c.execute("INSERT INTO users VALUES (1, 'admin', ?)", (TOKEN,))
    return c


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for cat, n in (("Gadgets", 2), ("Books", 1), ("Men's Gear", 1)):
        try:
            rows = fn(_conn(), cat)
            out.append(_t(f"returns {n} row(s) for '{cat}'", len(rows) == n, f"got {len(rows)} rows"))
        except Exception as exc:
            out.append(_t(f"returns {n} row(s) for '{cat}'", False, f"{type(exc).__name__}: {exc}"))
    for payload in PAYLOADS:
        try:
            rows = fn(_conn(), payload)
            leaked = TOKEN in repr(rows)
            out.append(_t(f"injection neutralised: {payload[:34]}...", not leaked and len(rows) == 0,
                          "Query returned data for a non-existent category."))
        except sqlite3.Error:
            out.append(_t(f"injection neutralised: {payload[:34]}...", True))
    return out
